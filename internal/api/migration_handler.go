package api

import (
	"context"
	"encoding/xml"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/netip"
	"net/url"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gooss/server/internal/auth"
	"github.com/gooss/server/internal/metadata"
	"github.com/gooss/server/internal/storage"
	"github.com/gooss/server/pkg/logger"
)

type MigrationHandler struct {
	storage storage.Engine
	repo    metadata.Repository
	mu      sync.Mutex
	tasks   map[int64]*migrationTask
}

type migrationTask struct {
	job    *metadata.MigrationJob
	cancel context.CancelFunc
}

func NewMigrationHandler(storage storage.Engine, repo metadata.Repository) *MigrationHandler {
	return &MigrationHandler{
		storage: storage,
		repo:    repo,
		tasks:   make(map[int64]*migrationTask),
	}
}

type MigrationRequest struct {
	SourceEndpoint string `json:"sourceEndpoint" binding:"required"`
	AccessKey      string `json:"accessKey" binding:"required"`
	SecretKey      string `json:"secretKey" binding:"required"`
	Region         string `json:"region"`
}

type MigrationProgress struct {
	ID               int64    `json:"id"`
	Status           string   `json:"status"`
	CurrentBucket    string   `json:"currentBucket"`
	TotalBuckets     int      `json:"totalBuckets"`
	CurrentObject    string   `json:"currentObject"`
	TotalObjects     int      `json:"totalObjects"`
	CompletedObjects int      `json:"completedObjects"`
	Errors           []string `json:"errors"`
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

const (
	maxMigrationErrorBodySize = 8 << 10
	migrationWorkerCount      = 10
	migrationLookupTimeout    = 3 * time.Second
	migrationStatusQueued     = "queued"
	migrationStatusRunning    = "running"
	migrationStatusCompleted  = "completed"
	migrationStatusFailed     = "failed"
	migrationStatusCancelled  = "cancelled"
)

var blockedMigrationSourcePrefixes = []netip.Prefix{
	mustParsePrefix("0.0.0.0/8"),
	mustParsePrefix("10.0.0.0/8"),
	mustParsePrefix("100.64.0.0/10"),
	mustParsePrefix("127.0.0.0/8"),
	mustParsePrefix("169.254.0.0/16"),
	mustParsePrefix("172.16.0.0/12"),
	mustParsePrefix("192.0.0.0/24"),
	mustParsePrefix("192.0.2.0/24"),
	mustParsePrefix("192.168.0.0/16"),
	mustParsePrefix("198.18.0.0/15"),
	mustParsePrefix("198.51.100.0/24"),
	mustParsePrefix("203.0.113.0/24"),
	mustParsePrefix("224.0.0.0/4"),
	mustParsePrefix("240.0.0.0/4"),
	mustParsePrefix("::/128"),
	mustParsePrefix("::1/128"),
	mustParsePrefix("fc00::/7"),
	mustParsePrefix("fe80::/10"),
	mustParsePrefix("ff00::/8"),
	mustParsePrefix("2001:db8::/32"),
}

// StartMigration 启动迁移任务
func (h *MigrationHandler) StartMigration(c *gin.Context) {
	userID := c.GetInt64("user_id")

	var req MigrationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request: " + err.Error()})
		return
	}
	req.SourceEndpoint = strings.TrimSpace(req.SourceEndpoint)
	req.AccessKey = strings.TrimSpace(req.AccessKey)
	req.SecretKey = strings.TrimSpace(req.SecretKey)
	req.Region = strings.TrimSpace(req.Region)
	if req.SourceEndpoint == "" || req.AccessKey == "" || req.SecretKey == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "sourceEndpoint, accessKey and secretKey are required"})
		return
	}

	sourceEndpoint, err := normalizeAndValidateSourceEndpoint(req.SourceEndpoint)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	logger.Infof("Starting migration from %s", sourceEndpoint)

	job := &metadata.MigrationJob{
		UserID:         userID,
		SourceEndpoint: sourceEndpoint,
		Region:         req.Region,
		Status:         migrationStatusQueued,
	}
	if err := h.repo.CreateMigrationJob(c.Request.Context(), job); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create migration job"})
		return
	}

	responseJob := *job
	h.launchMigration(job, req.AccessKey, req.SecretKey)

	c.JSON(http.StatusOK, gin.H{
		"message": "Migration started",
		"status":  migrationStatusQueued,
		"job":     responseJob,
	})
}

// performMigration 执行实际的迁移操作
func (h *MigrationHandler) performMigration(ctx context.Context, job *metadata.MigrationJob, accessKey, secretKey string) {
	logger.Infof("Starting migration job %d for user %d from %s", job.ID, job.UserID, job.SourceEndpoint)
	metadataClient := newMigrationHTTPClient(30 * time.Second)
	objectClient := newMigrationHTTPClient(0)
	job.Status = migrationStatusRunning
	job.LastError = ""
	h.persistMigrationJob(ctx, job)

	// 1. 列出源服务器的所有存储桶
	buckets, err := h.listSourceBuckets(ctx, metadataClient, job.SourceEndpoint, accessKey, secretKey, job.Region)
	if err != nil {
		if isMigrationCancelled(ctx, err) {
			h.markMigrationCancelled(ctx, job)
			return
		}
		h.failMigrationJob(ctx, job, fmt.Errorf("failed to list source buckets: %w", err))
		return
	}

	job.TotalBuckets = len(buckets)
	h.persistMigrationJob(ctx, job)
	logger.Infof("Found %d buckets to migrate", len(buckets))

	// 2. 逐个迁移存储桶
	for _, bucket := range buckets {
		if ctx.Err() != nil {
			h.markMigrationCancelled(ctx, job)
			return
		}
		job.CurrentBucket = bucket.Name
		job.CurrentObject = ""
		h.persistMigrationJob(ctx, job)
		logger.Infof("Migrating bucket: %s", bucket.Name)

		if err := h.migrateBucket(ctx, metadataClient, objectClient, job, accessKey, secretKey, bucket); err != nil {
			if isMigrationCancelled(ctx, err) {
				h.markMigrationCancelled(ctx, job)
				return
			}
			logger.Errorf("Failed to migrate bucket %s: %v", bucket.Name, err)
			job.ErrorCount++
			job.LastError = err.Error()
			h.persistMigrationJob(ctx, job)
		}
	}

	now := time.Now()
	job.Status = migrationStatusCompleted
	job.CurrentBucket = ""
	job.CurrentObject = ""
	job.CompletedAt = &now
	h.persistMigrationJob(ctx, job)
	logger.Infof("Migration completed for job %d user %d", job.ID, job.UserID)
}

// migrateBucket 迁移单个存储桶
func (h *MigrationHandler) migrateBucket(ctx context.Context, metadataClient, objectClient *http.Client, job *metadata.MigrationJob, accessKey, secretKey string, sourceBucket BucketInfo) error {
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
			OwnerID: job.UserID,
			Region:  "",
			ACL:     "private",
		}

		if err := h.repo.CreateBucket(ctx, targetBucket); err != nil {
			_ = h.storage.DeleteBucket(ctx, bucketName)
			return fmt.Errorf("failed to save bucket metadata: %w", err)
		}
	}

	// 3. 列出源存储桶中的所有对象
	objects, err := h.listSourceObjects(ctx, metadataClient, job.SourceEndpoint, accessKey, secretKey, job.Region, bucketName)
	if err != nil {
		return fmt.Errorf("failed to list objects: %w", err)
	}

	job.TotalObjects += int64(len(objects))
	h.persistMigrationJob(ctx, job)
	logger.Infof("Found %d objects in bucket %s", len(objects), bucketName)

	return h.migrateBucketObjects(ctx, objectClient, job, accessKey, secretKey, bucketName, targetBucket.ID, objects)
}

// migrateObject 迁移单个对象
func (h *MigrationHandler) migrateObject(ctx context.Context, client *http.Client, endpoint, accessKey, secretKey, region, bucketName string, targetBucketID int64, obj ObjectInfo) error {
	existing, err := h.repo.GetObject(ctx, targetBucketID, obj.Key)
	if err != nil {
		return fmt.Errorf("failed to check target object: %w", err)
	}

	// 1. 从源下载对象
	reader, contentType, err := h.getSourceObject(ctx, client, endpoint, accessKey, secretKey, region, bucketName, obj.Key)
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

	if existing != nil {
		targetObj.ID = existing.ID
		if err := h.repo.UpdateObject(ctx, targetObj); err != nil {
			return fmt.Errorf("failed to update object metadata: %w", err)
		}
		return nil
	}

	if err := h.repo.CreateObject(ctx, targetObj); err != nil {
		_ = h.storage.Delete(ctx, bucketName, obj.Key)
		return fmt.Errorf("failed to save object metadata: %w", err)
	}

	return nil
}

// listSourceBuckets 列出源S3服务器的所有存储桶
func (h *MigrationHandler) listSourceBuckets(ctx context.Context, client *http.Client, endpoint, accessKey, secretKey, region string) ([]BucketInfo, error) {
	req, err := newSignedSourceRequest(ctx, http.MethodGet, endpoint, "", "", nil, accessKey, secretKey, region)
	if err != nil {
		return nil, err
	}

	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("list buckets failed: %d - %s", resp.StatusCode, readMigrationErrorBody(resp.Body))
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
func (h *MigrationHandler) listSourceObjects(ctx context.Context, client *http.Client, endpoint, accessKey, secretKey, region, bucket string) ([]ObjectInfo, error) {
	var objects []ObjectInfo
	marker := ""

	for {
		query := url.Values{}
		query.Set("max-keys", "1000")
		if marker != "" {
			query.Set("marker", marker)
		}

		req, err := newSignedSourceRequest(ctx, http.MethodGet, endpoint, bucket, "", query, accessKey, secretKey, region)
		if err != nil {
			return nil, err
		}

		resp, err := client.Do(req)
		if err != nil {
			return nil, err
		}

		if resp.StatusCode != http.StatusOK {
			body := readMigrationErrorBody(resp.Body)
			resp.Body.Close()
			return nil, fmt.Errorf("list objects failed: %d - %s", resp.StatusCode, body)
		}

		var result struct {
			IsTruncated bool   `xml:"IsTruncated"`
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
func (h *MigrationHandler) getSourceObject(ctx context.Context, client *http.Client, endpoint, accessKey, secretKey, region, bucket, key string) (io.ReadCloser, string, error) {
	req, err := newSignedSourceRequest(ctx, http.MethodGet, endpoint, bucket, key, nil, accessKey, secretKey, region)
	if err != nil {
		return nil, "", err
	}

	resp, err := client.Do(req)
	if err != nil {
		return nil, "", err
	}

	if resp.StatusCode != http.StatusOK {
		body := readMigrationErrorBody(resp.Body)
		resp.Body.Close()
		return nil, "", fmt.Errorf("get object failed: %d - %s", resp.StatusCode, body)
	}

	contentType := resp.Header.Get("Content-Type")
	return resp.Body, contentType, nil
}

// parseXMLResponse 解析XML响应
func parseXMLResponse(reader io.Reader, v interface{}) error {
	decoder := xml.NewDecoder(reader)
	return decoder.Decode(v)
}

func readMigrationErrorBody(reader io.Reader) string {
	body, err := io.ReadAll(io.LimitReader(reader, maxMigrationErrorBodySize))
	if err != nil {
		return "failed to read error response"
	}
	return string(body)
}

func (h *MigrationHandler) migrateBucketObjects(ctx context.Context, client *http.Client, job *metadata.MigrationJob, accessKey, secretKey, bucketName string, targetBucketID int64, objects []ObjectInfo) error {
	if len(objects) == 0 {
		return nil
	}

	workerCount := migrationWorkerCount
	if len(objects) < workerCount {
		workerCount = len(objects)
	}

	jobs := make(chan ObjectInfo, workerCount)
	var wg sync.WaitGroup
	var mu sync.Mutex
	var errCount int
	var firstErr error

	for i := 0; i < workerCount; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for obj := range jobs {
				if err := h.migrateObject(ctx, client, job.SourceEndpoint, accessKey, secretKey, job.Region, bucketName, targetBucketID, obj); err != nil {
					if isMigrationCancelled(ctx, err) {
						mu.Lock()
						if firstErr == nil {
							firstErr = err
						}
						mu.Unlock()
						return
					}
					logger.Errorf("Failed to migrate object %s: %v", obj.Key, err)
					mu.Lock()
					errCount++
					if firstErr == nil {
						firstErr = err
					}
					job.ErrorCount++
					job.LastError = err.Error()
					job.CurrentObject = obj.Key
					mu.Unlock()
					h.persistMigrationJob(ctx, job)
					continue
				}
				mu.Lock()
				job.CompletedObjects++
				job.CurrentObject = obj.Key
				mu.Unlock()
				h.persistMigrationJob(ctx, job)
			}
		}()
	}

	for _, obj := range objects {
		select {
		case <-ctx.Done():
			close(jobs)
			wg.Wait()
			if firstErr != nil {
				return fmt.Errorf("migration interrupted after %d errors: %w", errCount, firstErr)
			}
			return ctx.Err()
		case jobs <- obj:
		}
	}
	close(jobs)
	wg.Wait()

	if firstErr != nil {
		return fmt.Errorf("migration completed with %d errors: %w", errCount, firstErr)
	}
	return nil
}

func (h *MigrationHandler) persistMigrationJob(ctx context.Context, job *metadata.MigrationJob) {
	if job == nil || job.ID == 0 {
		return
	}
	if err := h.repo.UpdateMigrationJob(ctx, job); err != nil {
		logger.Warnf("failed to update migration job %d: %v", job.ID, err)
	}
}

func (h *MigrationHandler) failMigrationJob(ctx context.Context, job *metadata.MigrationJob, err error) {
	if job == nil {
		return
	}
	now := time.Now()
	job.Status = migrationStatusFailed
	job.LastError = err.Error()
	job.ErrorCount++
	job.CompletedAt = &now
	h.persistMigrationJob(ctx, job)
	logger.Errorf("Migration job %d failed: %v", job.ID, err)
}

func (h *MigrationHandler) ListMigrationJobs(c *gin.Context) {
	userID := c.GetInt64("user_id")
	limit := 20
	if raw := strings.TrimSpace(c.Query("limit")); raw != "" {
		if parsed, err := strconv.Atoi(raw); err == nil && parsed > 0 && parsed <= 100 {
			limit = parsed
		}
	}

	var filterUserID *int64
	if !c.GetBool("is_admin") {
		filterUserID = &userID
	}

	jobs, err := h.repo.ListMigrationJobs(c.Request.Context(), filterUserID, limit)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"jobs": make([]*metadata.MigrationJob, 0)})
		return
	}
	if jobs == nil {
		jobs = make([]*metadata.MigrationJob, 0)
	}
	c.JSON(http.StatusOK, gin.H{"jobs": jobs})
}

func (h *MigrationHandler) CancelMigration(c *gin.Context) {
	jobID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil || jobID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid migration job id"})
		return
	}

	job, err := h.repo.GetMigrationJob(c.Request.Context(), jobID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load migration job"})
		return
	}
	if job == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Migration job not found"})
		return
	}

	if !c.GetBool("is_admin") && job.UserID != c.GetInt64("user_id") {
		c.JSON(http.StatusForbidden, gin.H{"error": "No permission to cancel this migration job"})
		return
	}

	switch job.Status {
	case migrationStatusCompleted, migrationStatusFailed, migrationStatusCancelled:
		c.JSON(http.StatusConflict, gin.H{"error": "Migration job cannot be cancelled"})
		return
	}

	if h.cancelTask(job.ID) {
		c.JSON(http.StatusAccepted, gin.H{
			"message": "Migration cancellation requested",
			"status":  migrationStatusRunning,
		})
		return
	}

	h.markMigrationCancelled(c.Request.Context(), job)
	c.JSON(http.StatusOK, gin.H{
		"message": "Migration job cancelled",
		"status":  migrationStatusCancelled,
		"job":     job,
	})
}

func (h *MigrationHandler) GetMigrationJob(c *gin.Context) {
	jobID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil || jobID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid migration job id"})
		return
	}

	job, err := h.repo.GetMigrationJob(c.Request.Context(), jobID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load migration job"})
		return
	}
	if job == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Migration job not found"})
		return
	}

	if !c.GetBool("is_admin") && job.UserID != c.GetInt64("user_id") {
		c.JSON(http.StatusForbidden, gin.H{"error": "No permission to view this migration job"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"job": job})
}

func (h *MigrationHandler) launchMigration(job *metadata.MigrationJob, accessKey, secretKey string) {
	if job == nil || job.ID == 0 {
		return
	}

	ctx, cancel := context.WithCancel(context.Background())
	h.storeTask(job, cancel)

	go func() {
		defer h.removeTask(job.ID)
		h.performMigration(ctx, job, accessKey, secretKey)
	}()
}

func (h *MigrationHandler) storeTask(job *metadata.MigrationJob, cancel context.CancelFunc) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.tasks[job.ID] = &migrationTask{
		job:    job,
		cancel: cancel,
	}
}

func (h *MigrationHandler) removeTask(jobID int64) {
	h.mu.Lock()
	defer h.mu.Unlock()
	delete(h.tasks, jobID)
}

func (h *MigrationHandler) cancelTask(jobID int64) bool {
	h.mu.Lock()
	task := h.tasks[jobID]
	h.mu.Unlock()
	if task == nil || task.cancel == nil {
		return false
	}
	task.cancel()
	return true
}

func (h *MigrationHandler) markMigrationCancelled(ctx context.Context, job *metadata.MigrationJob) {
	if job == nil {
		return
	}
	now := time.Now()
	job.Status = migrationStatusCancelled
	job.LastError = "migration cancelled"
	job.CurrentBucket = ""
	job.CurrentObject = ""
	job.CompletedAt = &now
	persistCtx := context.Background()
	if deadlineCtx, cancel := context.WithTimeout(persistCtx, 5*time.Second); cancel != nil {
		defer cancel()
		h.persistMigrationJob(deadlineCtx, job)
	} else {
		h.persistMigrationJob(persistCtx, job)
	}
	logger.Warnf("Migration job %d cancelled", job.ID)
}

func isMigrationCancelled(ctx context.Context, err error) bool {
	return errors.Is(err, context.Canceled) || errors.Is(ctx.Err(), context.Canceled)
}

func newSignedSourceRequest(ctx context.Context, method, endpoint, bucket, key string, query url.Values, accessKey, secretKey, region string) (*http.Request, error) {
	targetURL, err := buildSourceURL(endpoint, bucket, key, query)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequestWithContext(ctx, method, targetURL.String(), nil)
	if err != nil {
		return nil, err
	}

	signer := auth.NewSignatureV4(accessKey, secretKey, region)
	if err := signer.SignRequest(req, "UNSIGNED-PAYLOAD"); err != nil {
		return nil, err
	}
	return req, nil
}

func normalizeAndValidateSourceEndpoint(raw string) (string, error) {
	sourceEndpoint := strings.TrimSpace(strings.TrimSuffix(raw, "/"))
	if sourceEndpoint == "" {
		return "", fmt.Errorf("sourceEndpoint is required")
	}
	if !strings.HasPrefix(sourceEndpoint, "http://") && !strings.HasPrefix(sourceEndpoint, "https://") {
		sourceEndpoint = "http://" + sourceEndpoint
	}

	parsedEndpoint, err := url.Parse(sourceEndpoint)
	if err != nil {
		return "", fmt.Errorf("invalid sourceEndpoint")
	}
	if err := validateMigrationSourceURL(parsedEndpoint); err != nil {
		return "", err
	}

	return strings.TrimSuffix(parsedEndpoint.String(), "/"), nil
}

func validateMigrationSourceURL(parsed *url.URL) error {
	if parsed == nil || parsed.Host == "" {
		return fmt.Errorf("invalid sourceEndpoint")
	}
	if parsed.Scheme != "http" && parsed.Scheme != "https" {
		return fmt.Errorf("sourceEndpoint must use http or https")
	}
	if parsed.User != nil {
		return fmt.Errorf("sourceEndpoint must not include credentials")
	}

	if err := validateMigrationSourceHost(parsed.Hostname()); err != nil {
		return err
	}
	return nil
}

func validateMigrationSourceHost(host string) error {
	normalizedHost := strings.TrimSpace(strings.TrimSuffix(strings.ToLower(host), "."))
	if normalizedHost == "" {
		return fmt.Errorf("sourceEndpoint host is required")
	}
	if normalizedHost == "localhost" || strings.HasSuffix(normalizedHost, ".local") || strings.HasSuffix(normalizedHost, ".internal") {
		return fmt.Errorf("sourceEndpoint host %q is not allowed", host)
	}

	literalHost := normalizedHost
	if cutHost, _, found := strings.Cut(normalizedHost, "%"); found {
		literalHost = cutHost
	}
	if addr, err := netip.ParseAddr(literalHost); err == nil {
		return validateMigrationSourceAddr(addr)
	}

	lookupCtx, cancel := context.WithTimeout(context.Background(), migrationLookupTimeout)
	defer cancel()

	addrs, err := net.DefaultResolver.LookupIPAddr(lookupCtx, normalizedHost)
	if err != nil {
		return fmt.Errorf("sourceEndpoint host lookup failed")
	}
	if len(addrs) == 0 {
		return fmt.Errorf("sourceEndpoint host lookup returned no addresses")
	}
	for _, resolved := range addrs {
		addr, ok := netip.AddrFromSlice(resolved.IP)
		if !ok {
			continue
		}
		if err := validateMigrationSourceAddr(addr); err != nil {
			return fmt.Errorf("sourceEndpoint resolves to a disallowed address")
		}
	}
	return nil
}

func validateMigrationSourceAddr(addr netip.Addr) error {
	addr = addr.Unmap()
	if !addr.IsValid() {
		return fmt.Errorf("sourceEndpoint resolved to an invalid address")
	}
	for _, prefix := range blockedMigrationSourcePrefixes {
		if prefix.Contains(addr) {
			return fmt.Errorf("sourceEndpoint resolved to a private or reserved address")
		}
	}
	if !addr.IsGlobalUnicast() {
		return fmt.Errorf("sourceEndpoint resolved to a non-routable address")
	}
	return nil
}

func newMigrationHTTPClient(timeout time.Duration) *http.Client {
	transport := http.DefaultTransport.(*http.Transport).Clone()
	dialer := &net.Dialer{
		Timeout:   30 * time.Second,
		KeepAlive: 30 * time.Second,
	}
	transport.DialContext = func(ctx context.Context, network, addr string) (net.Conn, error) {
		return dialMigrationContext(ctx, dialer, network, addr)
	}

	client := &http.Client{
		Timeout:   timeout,
		Transport: transport,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			return http.ErrUseLastResponse
		},
	}
	return client
}

func mustParsePrefix(value string) netip.Prefix {
	prefix, err := netip.ParsePrefix(value)
	if err != nil {
		return netip.Prefix{}
	}
	return prefix
}

func dialMigrationContext(ctx context.Context, dialer *net.Dialer, network, addr string) (net.Conn, error) {
	host, port, err := net.SplitHostPort(addr)
	if err != nil {
		return nil, err
	}

	literalHost := host
	if cutHost, _, found := strings.Cut(host, "%"); found {
		literalHost = cutHost
	}
	if ip, err := netip.ParseAddr(literalHost); err == nil {
		if err := validateMigrationSourceAddr(ip); err != nil {
			return nil, err
		}
		return dialer.DialContext(ctx, network, addr)
	}

	lookupCtx, cancel := context.WithTimeout(ctx, migrationLookupTimeout)
	defer cancel()

	addrs, err := net.DefaultResolver.LookupIPAddr(lookupCtx, host)
	if err != nil {
		return nil, fmt.Errorf("sourceEndpoint host lookup failed")
	}
	if len(addrs) == 0 {
		return nil, fmt.Errorf("sourceEndpoint host lookup returned no addresses")
	}

	targets := make([]string, 0, len(addrs))
	for _, resolved := range addrs {
		ip, ok := netip.AddrFromSlice(resolved.IP)
		if !ok {
			continue
		}
		if err := validateMigrationSourceAddr(ip); err != nil {
			return nil, fmt.Errorf("sourceEndpoint resolves to a disallowed address")
		}
		targets = append(targets, net.JoinHostPort(ip.String(), port))
	}
	if len(targets) == 0 {
		return nil, fmt.Errorf("sourceEndpoint host lookup returned no valid addresses")
	}

	var lastErr error
	for _, target := range targets {
		conn, err := dialer.DialContext(ctx, network, target)
		if err == nil {
			return conn, nil
		}
		lastErr = err
	}
	if lastErr != nil {
		return nil, lastErr
	}
	return nil, fmt.Errorf("failed to connect to sourceEndpoint")
}

func buildSourceURL(endpoint, bucket, key string, query url.Values) (*url.URL, error) {
	baseURL, err := url.Parse(endpoint)
	if err != nil {
		return nil, err
	}

	decodedPath := strings.TrimSuffix(baseURL.Path, "/")
	rawPath := strings.TrimSuffix(baseURL.EscapedPath(), "/")

	appendSegment := func(segment string) {
		if segment == "" {
			return
		}
		decodedPath += "/" + segment
		rawPath += "/" + url.PathEscape(segment)
	}

	appendKey := func(objectKey string) {
		if objectKey == "" {
			return
		}
		for _, segment := range strings.Split(objectKey, "/") {
			decodedPath += "/" + segment
			rawPath += "/" + url.PathEscape(segment)
		}
	}

	appendSegment(bucket)
	appendKey(key)

	if decodedPath == "" {
		decodedPath = "/"
	}
	if rawPath == "" {
		rawPath = "/"
	}

	baseURL.Path = decodedPath
	baseURL.RawPath = rawPath
	if len(query) > 0 {
		baseURL.RawQuery = query.Encode()
	} else {
		baseURL.RawQuery = ""
	}
	return baseURL, nil
}
