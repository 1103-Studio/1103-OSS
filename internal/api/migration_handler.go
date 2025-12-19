package api

import (
	"context"
	"encoding/xml"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"

	"github.com/gin-gonic/gin"
	"github.com/gooss/server/internal/auth"
	"github.com/gooss/server/internal/metadata"
	"github.com/gooss/server/internal/storage"
	"github.com/gooss/server/pkg/logger"
)

type MigrationHandler struct {
	storage storage.Engine
	repo    metadata.Repository
	region  string
}

func NewMigrationHandler(storage storage.Engine, repo metadata.Repository, region string) *MigrationHandler {
	return &MigrationHandler{
		storage: storage,
		repo:    repo,
		region:  region,
	}
}

type MigrationRequest struct {
	SourceEndpoint string `json:"sourceEndpoint" binding:"required"`
	AccessKey      string `json:"accessKey" binding:"required"`
	SecretKey      string `json:"secretKey" binding:"required"`
	Region         string `json:"region"`
}

type MigrationProgress struct {
	Status        string `json:"status"`
	CurrentBucket string `json:"currentBucket"`
	TotalBuckets  int    `json:"totalBuckets"`
	CurrentObject string `json:"currentObject"`
	TotalObjects  int    `json:"totalObjects"`
	CompletedObjects int `json:"completedObjects"`
	Errors        []string `json:"errors"`
}

type BucketInfo struct {
	Name         string
	CreationDate string
}

type ObjectInfo struct {
	Key          string
	Size         int64
	ETag         string
	ContentType  string
	LastModified string
}

// StartMigration 启动迁移任务
func (h *MigrationHandler) StartMigration(c *gin.Context) {
	userID := c.GetInt64("user_id")
	
	var req MigrationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request: " + err.Error()})
		return
	}

	// 规范化源端点
	sourceEndpoint := strings.TrimSuffix(req.SourceEndpoint, "/")
	if !strings.HasPrefix(sourceEndpoint, "http://") && !strings.HasPrefix(sourceEndpoint, "https://") {
		sourceEndpoint = "http://" + sourceEndpoint
	}

	if req.Region == "" {
		req.Region = "us-east-1"
	}

	logger.Infof("Starting migration from %s", sourceEndpoint)

	// 在后台执行迁移
	go h.performMigration(context.Background(), userID, sourceEndpoint, req.AccessKey, req.SecretKey, req.Region)

	c.JSON(http.StatusOK, gin.H{
		"message": "Migration started",
		"status":  "in_progress",
	})
}

// performMigration 执行实际的迁移操作
func (h *MigrationHandler) performMigration(ctx context.Context, userID int64, endpoint, accessKey, secretKey, region string) {
	logger.Infof("Starting migration for user %d from %s", userID, endpoint)

	// 1. 列出源服务器的所有存储桶
	buckets, err := h.listSourceBuckets(endpoint, accessKey, secretKey, region)
	if err != nil {
		logger.Errorf("Failed to list source buckets: %v", err)
		return
	}

	logger.Infof("Found %d buckets to migrate", len(buckets))

	// 2. 逐个迁移存储桶
	for _, bucket := range buckets {
		logger.Infof("Migrating bucket: %s", bucket.Name)
		
		if err := h.migrateBucket(ctx, userID, endpoint, accessKey, secretKey, region, bucket); err != nil {
			logger.Errorf("Failed to migrate bucket %s: %v", bucket.Name, err)
			continue
		}
		
		logger.Infof("Successfully migrated bucket: %s", bucket.Name)
	}

	logger.Infof("Migration completed for user %d", userID)
}

// migrateBucket 迁移单个存储桶
func (h *MigrationHandler) migrateBucket(ctx context.Context, userID int64, endpoint, accessKey, secretKey, region string, sourceBucket BucketInfo) error {
	bucketName := sourceBucket.Name

	// 1. 检查目标是否已存在
	existing, err := h.repo.GetBucketByName(ctx, bucketName)
	if err != nil {
		return fmt.Errorf("failed to check bucket: %w", err)
	}
	
	var targetBucket *metadata.Bucket
	
	if existing != nil {
		logger.Infof("Bucket %s already exists, using existing bucket", bucketName)
		targetBucket = existing
	} else {
		// 2. 创建目标存储桶
		if err := h.storage.CreateBucket(ctx, bucketName); err != nil {
			return fmt.Errorf("failed to create bucket: %w", err)
		}

		targetBucket = &metadata.Bucket{
			Name:    bucketName,
			OwnerID: userID,
			Region:  h.region,
			ACL:     "private",
		}
		
		if err := h.repo.CreateBucket(ctx, targetBucket); err != nil {
			return fmt.Errorf("failed to save bucket metadata: %w", err)
		}
	}

	// 3. 列出源存储桶中的所有对象
	objects, err := h.listSourceObjects(endpoint, accessKey, secretKey, region, bucketName)
	if err != nil {
		return fmt.Errorf("failed to list objects: %w", err)
	}

	logger.Infof("Found %d objects in bucket %s", len(objects), bucketName)

	// 4. 并发迁移对象（限制并发数）
	const maxConcurrent = 10
	sem := make(chan struct{}, maxConcurrent)
	var wg sync.WaitGroup
	errChan := make(chan error, len(objects))

	for _, obj := range objects {
		wg.Add(1)
		go func(obj ObjectInfo) {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()

			if err := h.migrateObject(ctx, endpoint, accessKey, secretKey, region, bucketName, targetBucket.ID, obj); err != nil {
				logger.Errorf("Failed to migrate object %s: %v", obj.Key, err)
				errChan <- err
			}
		}(obj)
	}

	wg.Wait()
	close(errChan)

	// 收集错误
	var errors []error
	for err := range errChan {
		errors = append(errors, err)
	}

	if len(errors) > 0 {
		return fmt.Errorf("migration completed with %d errors", len(errors))
	}

	return nil
}

// migrateObject 迁移单个对象
func (h *MigrationHandler) migrateObject(ctx context.Context, endpoint, accessKey, secretKey, region, bucketName string, targetBucketID int64, obj ObjectInfo) error {
	// 1. 从源下载对象
	reader, contentType, err := h.getSourceObject(endpoint, accessKey, secretKey, region, bucketName, obj.Key)
	if err != nil {
		return fmt.Errorf("failed to get source object: %w", err)
	}
	defer reader.Close()

	// 2. 上传到目标
	if contentType == "" {
		contentType = obj.ContentType
	}
	
	objInfo, err := h.storage.Put(ctx, bucketName, obj.Key, reader, obj.Size, contentType)
	if err != nil {
		return fmt.Errorf("failed to put object: %w", err)
	}

	// 3. 保存元数据
	targetObj := &metadata.Object{
		BucketID:     targetBucketID,
		Key:          obj.Key,
		Size:         objInfo.Size,
		ETag:         objInfo.ETag,
		ContentType:  contentType,
		StorageClass: "STANDARD",
		StoragePath:  objInfo.StoragePath,
	}

	if err := h.repo.CreateObject(ctx, targetObj); err != nil {
		return fmt.Errorf("failed to save object metadata: %w", err)
	}

	return nil
}

// listSourceBuckets 列出源S3服务器的所有存储桶
func (h *MigrationHandler) listSourceBuckets(endpoint, accessKey, secretKey, region string) ([]BucketInfo, error) {
	client := &http.Client{}
	
	req, err := http.NewRequest("GET", endpoint+"/", nil)
	if err != nil {
		return nil, err
	}

	// 使用AWS Signature V4签名
	if err := auth.SignRequest(req, accessKey, secretKey, region, "s3", nil); err != nil {
		return nil, fmt.Errorf("failed to sign request: %w", err)
	}

	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("list buckets failed: %d - %s", resp.StatusCode, string(body))
	}

	// 解析XML响应
	var result struct {
		Buckets struct {
			Bucket []struct {
				Name         string `xml:"Name"`
				CreationDate string `xml:"CreationDate"`
			} `xml:"Bucket"`
		} `xml:"Buckets"`
	}

	if err := parseXMLResponse(resp.Body, &result); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	buckets := make([]BucketInfo, 0, len(result.Buckets.Bucket))
	for _, b := range result.Buckets.Bucket {
		buckets = append(buckets, BucketInfo{
			Name:         b.Name,
			CreationDate: b.CreationDate,
		})
	}

	return buckets, nil
}

// listSourceObjects 列出源存储桶中的所有对象
func (h *MigrationHandler) listSourceObjects(endpoint, accessKey, secretKey, region, bucket string) ([]ObjectInfo, error) {
	var objects []ObjectInfo
	marker := ""

	for {
		url := fmt.Sprintf("%s/%s?max-keys=1000", endpoint, bucket)
		if marker != "" {
			url += "&marker=" + marker
		}

		client := &http.Client{}
		req, err := http.NewRequest("GET", url, nil)
		if err != nil {
			return nil, err
		}

		if err := auth.SignRequest(req, accessKey, secretKey, region, "s3", nil); err != nil {
			return nil, err
		}

		resp, err := client.Do(req)
		if err != nil {
			return nil, err
		}

		if resp.StatusCode != http.StatusOK {
			body, _ := io.ReadAll(resp.Body)
			resp.Body.Close()
			return nil, fmt.Errorf("list objects failed: %d - %s", resp.StatusCode, string(body))
		}

		var result struct {
			IsTruncated bool `xml:"IsTruncated"`
			NextMarker  string `xml:"NextMarker"`
			Contents    []struct {
				Key          string `xml:"Key"`
				Size         int64  `xml:"Size"`
				ETag         string `xml:"ETag"`
				LastModified string `xml:"LastModified"`
			} `xml:"Contents"`
		}

		if err := parseXMLResponse(resp.Body, &result); err != nil {
			resp.Body.Close()
			return nil, err
		}
		resp.Body.Close()

		for _, obj := range result.Contents {
			objects = append(objects, ObjectInfo{
				Key:          obj.Key,
				Size:         obj.Size,
				ETag:         strings.Trim(obj.ETag, "\""),
				LastModified: obj.LastModified,
			})
		}

		if !result.IsTruncated {
			break
		}
		marker = result.NextMarker
	}

	return objects, nil
}

// getSourceObject 从源获取对象内容
func (h *MigrationHandler) getSourceObject(endpoint, accessKey, secretKey, region, bucket, key string) (io.ReadCloser, string, error) {
	url := fmt.Sprintf("%s/%s/%s", endpoint, bucket, key)
	
	client := &http.Client{}
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, "", err
	}

	if err := auth.SignRequest(req, accessKey, secretKey, region, "s3", nil); err != nil {
		return nil, "", err
	}

	resp, err := client.Do(req)
	if err != nil {
		return nil, "", err
	}

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		resp.Body.Close()
		return nil, "", fmt.Errorf("get object failed: %d - %s", resp.StatusCode, string(body))
	}

	contentType := resp.Header.Get("Content-Type")
	return resp.Body, contentType, nil
}

// parseXMLResponse 解析XML响应
func parseXMLResponse(reader io.Reader, v interface{}) error {
	decoder := xml.NewDecoder(reader)
	return decoder.Decode(v)
}
