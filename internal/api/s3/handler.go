package s3

import (
	"encoding/xml"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/gooss/server/internal/auth"
	"github.com/gooss/server/internal/metadata"
	"github.com/gooss/server/internal/storage"
	"github.com/gooss/server/pkg/response"
)

// Handler S3 API 处理器
type Handler struct {
	storage  storage.Engine
	repo     metadata.Repository
	region   string
}

// NewHandler 创建 S3 处理器
func NewHandler(storage storage.Engine, repo metadata.Repository, region string) *Handler {
	return &Handler{
		storage:  storage,
		repo:     repo,
		region:   region,
	}
}

// ==================== Bucket 操作 ====================

// ListBuckets GET / - 列出所有 Bucket
func (h *Handler) ListBuckets(c *gin.Context) {
	userID := c.GetInt64("user_id")

	buckets, err := h.repo.ListBuckets(c.Request.Context(), userID)
	if err != nil {
		h.sendError(c, http.StatusInternalServerError, response.ErrInternalError, err.Error())
		return
	}

	result := response.ListAllMyBucketsResult{
		Xmlns: response.S3Xmlns,
		Owner: response.Owner{
			ID:          fmt.Sprintf("%d", userID),
			DisplayName: c.GetString("username"),
		},
	}

	for _, b := range buckets {
		result.Buckets.Bucket = append(result.Buckets.Bucket, response.BucketInfo{
			Name:         b.Name,
			CreationDate: response.FormatTime(b.CreatedAt),
		})
	}

	c.XML(http.StatusOK, result)
}

// CreateBucket PUT /{bucket} - 创建 Bucket
func (h *Handler) CreateBucket(c *gin.Context) {
	bucketName := c.Param("bucket")
	userID := c.GetInt64("user_id")

	// 验证 Bucket 名称
	if err := auth.ValidateBucketName(bucketName); err != nil {
		h.sendError(c, http.StatusBadRequest, response.ErrInvalidBucketName, err.Error())
		return
	}

	// 检查是否已存在
	existing, err := h.repo.GetBucketByName(c.Request.Context(), bucketName)
	if err != nil {
		h.sendError(c, http.StatusInternalServerError, response.ErrInternalError, err.Error())
		return
	}
	if existing != nil {
		if existing.OwnerID == userID {
			h.sendError(c, http.StatusConflict, response.ErrBucketAlreadyOwnedByYou, "Bucket already exists")
		} else {
			h.sendError(c, http.StatusConflict, response.ErrBucketAlreadyExists, "Bucket already exists")
		}
		return
	}

	// 创建存储目录
	if err := h.storage.CreateBucket(c.Request.Context(), bucketName); err != nil {
		h.sendError(c, http.StatusInternalServerError, response.ErrInternalError, err.Error())
		return
	}

	// 创建元数据
	bucket := &metadata.Bucket{
		Name:    bucketName,
		OwnerID: userID,
		Region:  h.region,
		ACL:     "private",
	}
	if err := h.repo.CreateBucket(c.Request.Context(), bucket); err != nil {
		h.sendError(c, http.StatusInternalServerError, response.ErrInternalError, err.Error())
		return
	}

	c.Header("Location", "/"+bucketName)
	c.Status(http.StatusOK)
}

// HeadBucket HEAD /{bucket} - 检查 Bucket 是否存在
func (h *Handler) HeadBucket(c *gin.Context) {
	bucketName := c.Param("bucket")

	bucket, err := h.repo.GetBucketByName(c.Request.Context(), bucketName)
	if err != nil {
		h.sendError(c, http.StatusInternalServerError, response.ErrInternalError, err.Error())
		return
	}
	if bucket == nil {
		c.Status(http.StatusNotFound)
		return
	}

	c.Header("x-amz-bucket-region", bucket.Region)
	c.Status(http.StatusOK)
}

// DeleteBucket DELETE /{bucket} - 删除 Bucket
func (h *Handler) DeleteBucket(c *gin.Context) {
	bucketName := c.Param("bucket")
	userID := c.GetInt64("user_id")

	bucket, err := h.repo.GetBucketByName(c.Request.Context(), bucketName)
	if err != nil {
		h.sendError(c, http.StatusInternalServerError, response.ErrInternalError, err.Error())
		return
	}
	if bucket == nil {
		h.sendError(c, http.StatusNotFound, response.ErrNoSuchBucket, "Bucket not found")
		return
	}

	// 检查权限
	if bucket.OwnerID != userID {
		h.sendError(c, http.StatusForbidden, response.ErrAccessDenied, "Access denied")
		return
	}

	// 检查是否为空
	count, _, err := h.repo.GetBucketStats(c.Request.Context(), bucket.ID)
	if err != nil {
		h.sendError(c, http.StatusInternalServerError, response.ErrInternalError, err.Error())
		return
	}
	if count > 0 {
		h.sendError(c, http.StatusConflict, response.ErrBucketNotEmpty, "Bucket is not empty")
		return
	}

	// 删除存储目录
	if err := h.storage.DeleteBucket(c.Request.Context(), bucketName); err != nil {
		h.sendError(c, http.StatusInternalServerError, response.ErrInternalError, err.Error())
		return
	}

	// 删除元数据
	if err := h.repo.DeleteBucket(c.Request.Context(), bucket.ID); err != nil {
		h.sendError(c, http.StatusInternalServerError, response.ErrInternalError, err.Error())
		return
	}

	c.Status(http.StatusNoContent)
}

// ==================== Object 操作 ====================

// ListObjects GET /{bucket} - 列出对象
func (h *Handler) ListObjects(c *gin.Context) {
	bucketName := c.Param("bucket")

	bucket, err := h.repo.GetBucketByName(c.Request.Context(), bucketName)
	if err != nil {
		h.sendError(c, http.StatusInternalServerError, response.ErrInternalError, err.Error())
		return
	}
	if bucket == nil {
		h.sendError(c, http.StatusNotFound, response.ErrNoSuchBucket, "Bucket not found")
		return
	}

	// 解析参数
	prefix := c.Query("prefix")
	delimiter := c.Query("delimiter")
	marker := c.Query("marker")
	maxKeys := 1000
	if mk := c.Query("max-keys"); mk != "" {
		if v, err := strconv.Atoi(mk); err == nil && v > 0 && v <= 1000 {
			maxKeys = v
		}
	}

	// 查询对象
	opts := metadata.ListObjectsOptions{
		Prefix:    prefix,
		Delimiter: delimiter,
		Marker:    marker,
		MaxKeys:   maxKeys,
	}
	result, err := h.repo.ListObjects(c.Request.Context(), bucket.ID, opts)
	if err != nil {
		h.sendError(c, http.StatusInternalServerError, response.ErrInternalError, err.Error())
		return
	}

	// 构建响应
	resp := response.ListBucketResult{
		Xmlns:       response.S3Xmlns,
		Name:        bucketName,
		Prefix:      prefix,
		Marker:      marker,
		MaxKeys:     maxKeys,
		Delimiter:   delimiter,
		IsTruncated: result.IsTruncated,
		NextMarker:  result.NextMarker,
	}

	for _, obj := range result.Objects {
		resp.Contents = append(resp.Contents, response.ObjectInfo{
			Key:          obj.Key,
			LastModified: response.FormatTime(obj.UpdatedAt),
			ETag:         fmt.Sprintf("\"%s\"", obj.ETag),
			Size:         obj.Size,
			StorageClass: obj.StorageClass,
		})
	}

	for _, prefix := range result.CommonPrefixes {
		resp.CommonPrefixes = append(resp.CommonPrefixes, response.CommonPrefix{Prefix: prefix})
	}

	c.XML(http.StatusOK, resp)
}

// PutObject PUT /{bucket}/{key} - 上传对象
func (h *Handler) PutObject(c *gin.Context) {
	bucketName := c.Param("bucket")
	key := c.Param("key")
	key = strings.TrimPrefix(key, "/")

	// 验证 key
	if err := auth.ValidateObjectKey(key); err != nil {
		h.sendError(c, http.StatusBadRequest, response.ErrInvalidArgument, err.Error())
		return
	}

	// 检查是否是复制操作
	copySource := c.GetHeader("x-amz-copy-source")
	if copySource != "" {
		h.CopyObject(c)
		return
	}

	bucket, err := h.repo.GetBucketByName(c.Request.Context(), bucketName)
	if err != nil {
		h.sendError(c, http.StatusInternalServerError, response.ErrInternalError, err.Error())
		return
	}
	if bucket == nil {
		h.sendError(c, http.StatusNotFound, response.ErrNoSuchBucket, "Bucket not found")
		return
	}

	// 获取 Content-Type
	contentType := c.GetHeader("Content-Type")
	if contentType == "" {
		contentType = "application/octet-stream"
	}

	// 获取 Content-Length
	contentLength := c.Request.ContentLength

	// 存储对象
	objInfo, err := h.storage.Put(c.Request.Context(), bucketName, key, c.Request.Body, contentLength, contentType)
	if err != nil {
		h.sendError(c, http.StatusInternalServerError, response.ErrInternalError, err.Error())
		return
	}

	// 保存元数据
	obj := &metadata.Object{
		BucketID:     bucket.ID,
		Key:          key,
		Size:         objInfo.Size,
		ETag:         objInfo.ETag,
		ContentType:  contentType,
		StorageClass: "STANDARD",
		StoragePath:  objInfo.StoragePath,
	}
	if err := h.repo.CreateObject(c.Request.Context(), obj); err != nil {
		h.sendError(c, http.StatusInternalServerError, response.ErrInternalError, err.Error())
		return
	}

	c.Header("ETag", fmt.Sprintf("\"%s\"", objInfo.ETag))
	c.Status(http.StatusOK)
}

// GetObject GET /{bucket}/{key} - 下载对象
func (h *Handler) GetObject(c *gin.Context) {
	bucketName := c.Param("bucket")
	key := c.Param("key")
	key = strings.TrimPrefix(key, "/")

	bucket, err := h.repo.GetBucketByName(c.Request.Context(), bucketName)
	if err != nil {
		h.sendError(c, http.StatusInternalServerError, response.ErrInternalError, err.Error())
		return
	}
	if bucket == nil {
		h.sendError(c, http.StatusNotFound, response.ErrNoSuchBucket, "Bucket not found")
		return
	}

	// 获取元数据
	obj, err := h.repo.GetObject(c.Request.Context(), bucket.ID, key)
	if err != nil {
		h.sendError(c, http.StatusInternalServerError, response.ErrInternalError, err.Error())
		return
	}
	if obj == nil {
		h.sendError(c, http.StatusNotFound, response.ErrNoSuchKey, "Object not found")
		return
	}

	// 处理 Range 请求
	rangeHeader := c.GetHeader("Range")
	if rangeHeader != "" {
		h.handleRangeRequest(c, bucketName, key, obj, rangeHeader)
		return
	}

	// 获取对象内容
	reader, _, err := h.storage.Get(c.Request.Context(), bucketName, key)
	if err != nil {
		h.sendError(c, http.StatusInternalServerError, response.ErrInternalError, err.Error())
		return
	}
	defer reader.Close()

	c.Header("Content-Type", obj.ContentType)
	c.Header("Content-Length", fmt.Sprintf("%d", obj.Size))
	c.Header("ETag", fmt.Sprintf("\"%s\"", obj.ETag))
	c.Header("Last-Modified", obj.UpdatedAt.UTC().Format(http.TimeFormat))
	c.Header("Accept-Ranges", "bytes")

	c.Status(http.StatusOK)
	io.Copy(c.Writer, reader)
}

func (h *Handler) handleRangeRequest(c *gin.Context, bucket, key string, obj *metadata.Object, rangeHeader string) {
	// 解析 Range: bytes=start-end
	var start, end int64
	rangeHeader = strings.TrimPrefix(rangeHeader, "bytes=")
	parts := strings.Split(rangeHeader, "-")
	if len(parts) != 2 {
		h.sendError(c, http.StatusBadRequest, response.ErrInvalidArgument, "Invalid range")
		return
	}

	if parts[0] != "" {
		start, _ = strconv.ParseInt(parts[0], 10, 64)
	}
	if parts[1] != "" {
		end, _ = strconv.ParseInt(parts[1], 10, 64)
	} else {
		end = obj.Size - 1
	}

	if start > end || start >= obj.Size {
		c.Status(http.StatusRequestedRangeNotSatisfiable)
		return
	}

	reader, _, err := h.storage.GetRange(c.Request.Context(), bucket, key, start, end)
	if err != nil {
		h.sendError(c, http.StatusInternalServerError, response.ErrInternalError, err.Error())
		return
	}
	defer reader.Close()

	contentLength := end - start + 1
	c.Header("Content-Type", obj.ContentType)
	c.Header("Content-Length", fmt.Sprintf("%d", contentLength))
	c.Header("Content-Range", fmt.Sprintf("bytes %d-%d/%d", start, end, obj.Size))
	c.Header("ETag", fmt.Sprintf("\"%s\"", obj.ETag))
	c.Header("Accept-Ranges", "bytes")

	c.Status(http.StatusPartialContent)
	io.Copy(c.Writer, reader)
}

// HeadObject HEAD /{bucket}/{key} - 获取对象元数据
func (h *Handler) HeadObject(c *gin.Context) {
	bucketName := c.Param("bucket")
	key := c.Param("key")
	key = strings.TrimPrefix(key, "/")

	bucket, err := h.repo.GetBucketByName(c.Request.Context(), bucketName)
	if err != nil {
		h.sendError(c, http.StatusInternalServerError, response.ErrInternalError, err.Error())
		return
	}
	if bucket == nil {
		c.Status(http.StatusNotFound)
		return
	}

	obj, err := h.repo.GetObject(c.Request.Context(), bucket.ID, key)
	if err != nil {
		h.sendError(c, http.StatusInternalServerError, response.ErrInternalError, err.Error())
		return
	}
	if obj == nil {
		c.Status(http.StatusNotFound)
		return
	}

	c.Header("Content-Type", obj.ContentType)
	c.Header("Content-Length", fmt.Sprintf("%d", obj.Size))
	c.Header("ETag", fmt.Sprintf("\"%s\"", obj.ETag))
	c.Header("Last-Modified", obj.UpdatedAt.UTC().Format(http.TimeFormat))
	c.Header("Accept-Ranges", "bytes")
	c.Status(http.StatusOK)
}

// DeleteObject DELETE /{bucket}/{key} - 删除对象
func (h *Handler) DeleteObject(c *gin.Context) {
	bucketName := c.Param("bucket")
	key := c.Param("key")
	key = strings.TrimPrefix(key, "/")

	bucket, err := h.repo.GetBucketByName(c.Request.Context(), bucketName)
	if err != nil {
		h.sendError(c, http.StatusInternalServerError, response.ErrInternalError, err.Error())
		return
	}
	if bucket == nil {
		h.sendError(c, http.StatusNotFound, response.ErrNoSuchBucket, "Bucket not found")
		return
	}

	// 删除存储
	if err := h.storage.Delete(c.Request.Context(), bucketName, key); err != nil {
		// 忽略不存在的错误
	}

	// 删除元数据
	if err := h.repo.DeleteObject(c.Request.Context(), bucket.ID, key); err != nil {
		h.sendError(c, http.StatusInternalServerError, response.ErrInternalError, err.Error())
		return
	}

	c.Status(http.StatusNoContent)
}

// CopyObject PUT /{bucket}/{key} with x-amz-copy-source - 复制对象
func (h *Handler) CopyObject(c *gin.Context) {
	dstBucket := c.Param("bucket")
	dstKey := c.Param("key")
	dstKey = strings.TrimPrefix(dstKey, "/")

	copySource := c.GetHeader("x-amz-copy-source")
	copySource = strings.TrimPrefix(copySource, "/")
	parts := strings.SplitN(copySource, "/", 2)
	if len(parts) != 2 {
		h.sendError(c, http.StatusBadRequest, response.ErrInvalidArgument, "Invalid copy source")
		return
	}
	srcBucket, srcKey := parts[0], parts[1]

	// 验证源 Bucket
	srcBucketMeta, err := h.repo.GetBucketByName(c.Request.Context(), srcBucket)
	if err != nil || srcBucketMeta == nil {
		h.sendError(c, http.StatusNotFound, response.ErrNoSuchBucket, "Source bucket not found")
		return
	}

	// 验证目标 Bucket
	dstBucketMeta, err := h.repo.GetBucketByName(c.Request.Context(), dstBucket)
	if err != nil || dstBucketMeta == nil {
		h.sendError(c, http.StatusNotFound, response.ErrNoSuchBucket, "Destination bucket not found")
		return
	}

	// 获取源对象
	srcObj, err := h.repo.GetObject(c.Request.Context(), srcBucketMeta.ID, srcKey)
	if err != nil || srcObj == nil {
		h.sendError(c, http.StatusNotFound, response.ErrNoSuchKey, "Source object not found")
		return
	}

	// 复制存储
	objInfo, err := h.storage.Copy(c.Request.Context(), srcBucket, srcKey, dstBucket, dstKey)
	if err != nil {
		h.sendError(c, http.StatusInternalServerError, response.ErrInternalError, err.Error())
		return
	}

	// 保存元数据
	obj := &metadata.Object{
		BucketID:     dstBucketMeta.ID,
		Key:          dstKey,
		Size:         objInfo.Size,
		ETag:         objInfo.ETag,
		ContentType:  srcObj.ContentType,
		StorageClass: "STANDARD",
		StoragePath:  objInfo.StoragePath,
	}
	if err := h.repo.CreateObject(c.Request.Context(), obj); err != nil {
		h.sendError(c, http.StatusInternalServerError, response.ErrInternalError, err.Error())
		return
	}

	result := response.CopyObjectResult{
		LastModified: response.FormatTime(objInfo.LastModified),
		ETag:         fmt.Sprintf("\"%s\"", objInfo.ETag),
	}
	c.XML(http.StatusOK, result)
}

// ==================== 分片上传 ====================

// CreateMultipartUpload POST /{bucket}/{key}?uploads - 初始化分片上传
func (h *Handler) CreateMultipartUpload(c *gin.Context) {
	bucketName := c.Param("bucket")
	key := c.Param("key")
	key = strings.TrimPrefix(key, "/")

	bucket, err := h.repo.GetBucketByName(c.Request.Context(), bucketName)
	if err != nil || bucket == nil {
		h.sendError(c, http.StatusNotFound, response.ErrNoSuchBucket, "Bucket not found")
		return
	}

	uploadID := uuid.New().String()

	// 初始化存储
	if err := h.storage.InitMultipartUpload(c.Request.Context(), bucketName, key, uploadID); err != nil {
		h.sendError(c, http.StatusInternalServerError, response.ErrInternalError, err.Error())
		return
	}

	// 保存元数据
	upload := &metadata.MultipartUpload{
		UploadID:    uploadID,
		BucketID:    bucket.ID,
		Key:         key,
		ContentType: c.GetHeader("Content-Type"),
		Status:      "in_progress",
	}
	if err := h.repo.CreateMultipartUpload(c.Request.Context(), upload); err != nil {
		h.sendError(c, http.StatusInternalServerError, response.ErrInternalError, err.Error())
		return
	}

	result := response.InitiateMultipartUploadResult{
		Xmlns:    response.S3Xmlns,
		Bucket:   bucketName,
		Key:      key,
		UploadId: uploadID,
	}
	c.XML(http.StatusOK, result)
}

// UploadPart PUT /{bucket}/{key}?partNumber=&uploadId= - 上传分片
func (h *Handler) UploadPart(c *gin.Context) {
	bucketName := c.Param("bucket")
	key := c.Param("key")
	key = strings.TrimPrefix(key, "/")
	uploadID := c.Query("uploadId")
	partNumber, _ := strconv.Atoi(c.Query("partNumber"))

	if partNumber < 1 || partNumber > 10000 {
		h.sendError(c, http.StatusBadRequest, response.ErrInvalidArgument, "Invalid part number")
		return
	}

	// 验证上传任务
	upload, err := h.repo.GetMultipartUpload(c.Request.Context(), uploadID)
	if err != nil || upload == nil {
		h.sendError(c, http.StatusNotFound, response.ErrNoSuchUpload, "Upload not found")
		return
	}

	// 上传分片
	etag, err := h.storage.PutPart(c.Request.Context(), bucketName, key, uploadID, partNumber, c.Request.Body, c.Request.ContentLength)
	if err != nil {
		h.sendError(c, http.StatusInternalServerError, response.ErrInternalError, err.Error())
		return
	}

	// 保存分片元数据
	part := &metadata.UploadPart{
		UploadID:   uploadID,
		PartNumber: partNumber,
		Size:       c.Request.ContentLength,
		ETag:       etag,
	}
	if err := h.repo.CreateUploadPart(c.Request.Context(), part); err != nil {
		h.sendError(c, http.StatusInternalServerError, response.ErrInternalError, err.Error())
		return
	}

	c.Header("ETag", fmt.Sprintf("\"%s\"", etag))
	c.Status(http.StatusOK)
}

// CompleteMultipartUpload POST /{bucket}/{key}?uploadId= - 完成分片上传
func (h *Handler) CompleteMultipartUpload(c *gin.Context) {
	bucketName := c.Param("bucket")
	key := c.Param("key")
	key = strings.TrimPrefix(key, "/")
	uploadID := c.Query("uploadId")

	bucket, err := h.repo.GetBucketByName(c.Request.Context(), bucketName)
	if err != nil || bucket == nil {
		h.sendError(c, http.StatusNotFound, response.ErrNoSuchBucket, "Bucket not found")
		return
	}

	upload, err := h.repo.GetMultipartUpload(c.Request.Context(), uploadID)
	if err != nil || upload == nil {
		h.sendError(c, http.StatusNotFound, response.ErrNoSuchUpload, "Upload not found")
		return
	}

	// 解析请求体
	var completeReq response.CompleteMultipartUpload
	if err := xml.NewDecoder(c.Request.Body).Decode(&completeReq); err != nil {
		h.sendError(c, http.StatusBadRequest, response.ErrMalformedXML, "Invalid XML")
		return
	}

	// 获取分片信息
	dbParts, err := h.repo.GetUploadParts(c.Request.Context(), uploadID)
	if err != nil {
		h.sendError(c, http.StatusInternalServerError, response.ErrInternalError, err.Error())
		return
	}

	// 构建分片列表
	var parts []storage.PartInfo
	for _, p := range completeReq.Parts {
		found := false
		for _, dbp := range dbParts {
			if dbp.PartNumber == p.PartNumber {
				parts = append(parts, storage.PartInfo{
					PartNumber: p.PartNumber,
					ETag:       dbp.ETag,
					Size:       dbp.Size,
				})
				found = true
				break
			}
		}
		if !found {
			h.sendError(c, http.StatusBadRequest, response.ErrInvalidPart, fmt.Sprintf("Part %d not found", p.PartNumber))
			return
		}
	}

	// 合并分片
	objInfo, err := h.storage.CompleteParts(c.Request.Context(), bucketName, key, uploadID, parts)
	if err != nil {
		h.sendError(c, http.StatusInternalServerError, response.ErrInternalError, err.Error())
		return
	}

	// 保存对象元数据
	obj := &metadata.Object{
		BucketID:     bucket.ID,
		Key:          key,
		Size:         objInfo.Size,
		ETag:         objInfo.ETag,
		ContentType:  upload.ContentType,
		StorageClass: "STANDARD",
		StoragePath:  objInfo.StoragePath,
	}
	if err := h.repo.CreateObject(c.Request.Context(), obj); err != nil {
		h.sendError(c, http.StatusInternalServerError, response.ErrInternalError, err.Error())
		return
	}

	// 清理分片元数据
	h.repo.DeleteUploadParts(c.Request.Context(), uploadID)
	h.repo.DeleteMultipartUpload(c.Request.Context(), uploadID)

	result := response.CompleteMultipartUploadResult{
		Xmlns:    response.S3Xmlns,
		Location: fmt.Sprintf("/%s/%s", bucketName, key),
		Bucket:   bucketName,
		Key:      key,
		ETag:     fmt.Sprintf("\"%s\"", objInfo.ETag),
	}
	c.XML(http.StatusOK, result)
}

// AbortMultipartUpload DELETE /{bucket}/{key}?uploadId= - 取消分片上传
func (h *Handler) AbortMultipartUpload(c *gin.Context) {
	bucketName := c.Param("bucket")
	key := c.Param("key")
	key = strings.TrimPrefix(key, "/")
	uploadID := c.Query("uploadId")

	upload, err := h.repo.GetMultipartUpload(c.Request.Context(), uploadID)
	if err != nil || upload == nil {
		h.sendError(c, http.StatusNotFound, response.ErrNoSuchUpload, "Upload not found")
		return
	}

	// 清理存储
	h.storage.AbortMultipartUpload(c.Request.Context(), bucketName, key, uploadID)

	// 清理元数据
	h.repo.DeleteUploadParts(c.Request.Context(), uploadID)
	h.repo.DeleteMultipartUpload(c.Request.Context(), uploadID)

	c.Status(http.StatusNoContent)
}

// ListParts GET /{bucket}/{key}?uploadId= - 列出分片
func (h *Handler) ListParts(c *gin.Context) {
	bucketName := c.Param("bucket")
	key := c.Param("key")
	key = strings.TrimPrefix(key, "/")
	uploadID := c.Query("uploadId")

	upload, err := h.repo.GetMultipartUpload(c.Request.Context(), uploadID)
	if err != nil || upload == nil {
		h.sendError(c, http.StatusNotFound, response.ErrNoSuchUpload, "Upload not found")
		return
	}

	parts, err := h.repo.GetUploadParts(c.Request.Context(), uploadID)
	if err != nil {
		h.sendError(c, http.StatusInternalServerError, response.ErrInternalError, err.Error())
		return
	}

	result := response.ListPartsResult{
		Xmlns:    response.S3Xmlns,
		Bucket:   bucketName,
		Key:      key,
		UploadId: uploadID,
		MaxParts: 1000,
	}

	for _, p := range parts {
		result.Parts = append(result.Parts, response.PartInfo{
			PartNumber:   p.PartNumber,
			LastModified: response.FormatTime(p.CreatedAt),
			ETag:         fmt.Sprintf("\"%s\"", p.ETag),
			Size:         p.Size,
		})
	}

	c.XML(http.StatusOK, result)
}

// sendError 发送错误响应
func (h *Handler) sendError(c *gin.Context, status int, code, message string) {
	c.XML(status, response.NewError(code, message, c.Request.URL.Path))
}
