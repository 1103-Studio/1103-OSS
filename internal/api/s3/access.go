package s3

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/gooss/server/internal/metadata"
	"github.com/gooss/server/pkg/response"
)

const (
	permBucketManage = "bucket:manage"
	permBucketRead   = "bucket:read"
	permBucketWrite  = "bucket:write"
	permBucketAssign = "bucket:assign"
)

func hasPermission(c *gin.Context, permission string) bool {
	if c.GetBool("is_admin") {
		return true
	}

	raw, exists := c.Get("permissions")
	if !exists {
		return false
	}

	permissions, ok := raw.([]string)
	if !ok {
		return false
	}

	for _, granted := range permissions {
		if granted == "*" || granted == permission {
			return true
		}
		if strings.HasSuffix(granted, ":*") {
			prefix := strings.TrimSuffix(granted, "*")
			if strings.HasPrefix(permission, prefix) {
				return true
			}
		}
	}
	return false
}

func bucketAccessAllows(access *metadata.BucketAccess, write bool) bool {
	if access == nil {
		return false
	}

	switch access.Permission {
	case "admin":
		return true
	case "write":
		return true
	case "read":
		return !write
	default:
		return false
	}
}

func (h *Handler) requireBucketAdminAccess(c *gin.Context, bucket *metadata.Bucket) bool {
	userID := c.GetInt64("user_id")
	if userID == 0 {
		h.sendError(c, http.StatusForbidden, response.ErrAccessDenied, "Access denied")
		return false
	}
	if c.GetBool("is_admin") || bucket.OwnerID == userID {
		return true
	}

	access, err := h.repo.GetBucketAccess(c.Request.Context(), bucket.ID, userID)
	if err == nil && access != nil && access.Permission == "admin" {
		return true
	}

	if !hasPermission(c, permBucketManage) {
		h.sendError(c, http.StatusForbidden, response.ErrAccessDenied, "Access denied")
		return false
	}

	return true
}

func (h *Handler) requireBucketReadAccess(c *gin.Context, bucket *metadata.Bucket) bool {
	if c.GetBool("public_access") {
		return true
	}

	userID := c.GetInt64("user_id")
	if userID == 0 {
		h.sendError(c, http.StatusForbidden, response.ErrAccessDenied, "Access denied")
		return false
	}
	if c.GetBool("is_admin") || bucket.OwnerID == userID || hasPermission(c, permBucketRead) || hasPermission(c, permBucketManage) {
		return true
	}
	access, err := h.repo.GetBucketAccess(c.Request.Context(), bucket.ID, userID)
	if err == nil && bucketAccessAllows(access, false) {
		return true
	}
	h.sendError(c, http.StatusForbidden, response.ErrAccessDenied, "Access denied")
	return false
}

func (h *Handler) requireBucketWriteAccess(c *gin.Context, bucket *metadata.Bucket) bool {
	userID := c.GetInt64("user_id")
	if userID == 0 {
		h.sendError(c, http.StatusForbidden, response.ErrAccessDenied, "Access denied")
		return false
	}
	if c.GetBool("is_admin") || bucket.OwnerID == userID || hasPermission(c, permBucketWrite) || hasPermission(c, permBucketManage) {
		return true
	}
	access, err := h.repo.GetBucketAccess(c.Request.Context(), bucket.ID, userID)
	if err == nil && bucketAccessAllows(access, true) {
		return true
	}
	h.sendError(c, http.StatusForbidden, response.ErrAccessDenied, "Access denied")
	return false
}

func (h *Handler) requireMultipartUploadAccess(c *gin.Context, bucket *metadata.Bucket, key string, upload *metadata.MultipartUpload) bool {
	if !h.requireBucketWriteAccess(c, bucket) {
		return false
	}

	if upload.BucketID != bucket.ID || upload.Key != key {
		h.sendError(c, http.StatusNotFound, response.ErrNoSuchUpload, "Upload not found")
		return false
	}
	if upload.Status != "in_progress" {
		h.sendError(c, http.StatusNotFound, response.ErrNoSuchUpload, "Upload not found")
		return false
	}

	return true
}

func (h *Handler) checkBucketQuota(c *gin.Context, bucket *metadata.Bucket, incomingSize int64) bool {
	objectCount, totalSize, err := h.repo.GetBucketStats(c.Request.Context(), bucket.ID)
	if err != nil {
		h.sendError(c, http.StatusInternalServerError, response.ErrInternalError, err.Error())
		return false
	}

	if bucket.MaxObjects > 0 && objectCount+1 > bucket.MaxObjects {
		h.sendError(c, http.StatusForbidden, response.ErrAccessDenied, "Bucket object quota exceeded")
		return false
	}
	if bucket.MaxSizeBytes > 0 && totalSize+incomingSize > bucket.MaxSizeBytes {
		h.sendError(c, http.StatusForbidden, response.ErrAccessDenied, "Bucket size quota exceeded")
		return false
	}
	if bucket.MaxTrafficBytes > 0 && bucket.UsedTrafficBytes+incomingSize > bucket.MaxTrafficBytes {
		h.sendError(c, http.StatusForbidden, response.ErrAccessDenied, "Bucket traffic quota exceeded")
		return false
	}
	if !h.checkUserSubscriptionQuota(c, bucket.OwnerID, objectCount+1, totalSize+incomingSize, incomingSize) {
		return false
	}
	return true
}

func (h *Handler) checkBucketQuotaForObject(c *gin.Context, bucket *metadata.Bucket, key string, incomingSize int64) bool {
	return h.checkBucketQuotaForObjectWithTraffic(c, bucket, key, incomingSize, true)
}

func (h *Handler) checkBucketStorageQuotaForObject(c *gin.Context, bucket *metadata.Bucket, key string, incomingSize int64) bool {
	return h.checkBucketQuotaForObjectWithTraffic(c, bucket, key, incomingSize, false)
}

func (h *Handler) checkBucketQuotaForObjectWithTraffic(c *gin.Context, bucket *metadata.Bucket, key string, incomingSize int64, includeTraffic bool) bool {
	objectCount, totalSize, err := h.repo.GetBucketStats(c.Request.Context(), bucket.ID)
	if err != nil {
		h.sendError(c, http.StatusInternalServerError, response.ErrInternalError, err.Error())
		return false
	}

	var existingSize int64
	var existingCount int64
	existing, err := h.repo.GetObject(c.Request.Context(), bucket.ID, key)
	if err != nil {
		h.sendError(c, http.StatusInternalServerError, response.ErrInternalError, err.Error())
		return false
	}
	if existing != nil {
		existingSize = existing.Size
		existingCount = 1
	}

	newCount := objectCount + 1 - existingCount
	newSize := totalSize + incomingSize - existingSize

	if bucket.MaxObjects > 0 && newCount > bucket.MaxObjects {
		h.sendError(c, http.StatusForbidden, response.ErrAccessDenied, "Bucket object quota exceeded")
		return false
	}
	if bucket.MaxSizeBytes > 0 && newSize > bucket.MaxSizeBytes {
		h.sendError(c, http.StatusForbidden, response.ErrAccessDenied, "Bucket size quota exceeded")
		return false
	}
	if includeTraffic && bucket.MaxTrafficBytes > 0 && incomingSize >= 0 && bucket.UsedTrafficBytes+incomingSize > bucket.MaxTrafficBytes {
		h.sendError(c, http.StatusForbidden, response.ErrAccessDenied, "Bucket traffic quota exceeded")
		return false
	}
	trafficDelta := int64(0)
	if includeTraffic && incomingSize > 0 {
		trafficDelta = incomingSize
	}
	if !h.checkUserSubscriptionQuota(c, bucket.OwnerID, newCount, newSize, trafficDelta) {
		return false
	}
	return true
}

func (h *Handler) checkUserSubscriptionQuota(c *gin.Context, ownerID, objectCount, totalSize, trafficDelta int64) bool {
	if ownerID == 0 {
		return true
	}
	profile, err := h.repo.GetUserSubscriptionProfile(c.Request.Context(), ownerID)
	if err != nil || profile == nil {
		return true
	}
	if profile.TotalStorageBytes <= 0 && profile.TotalTrafficBytes <= 0 && profile.TotalObjectQuota <= 0 {
		return true
	}

	currentObjects, currentSize, currentTraffic, err := h.repo.GetUserResourceUsage(c.Request.Context(), ownerID)
	if err != nil {
		h.sendError(c, http.StatusInternalServerError, response.ErrInternalError, err.Error())
		return false
	}

	nextObjects := currentObjects
	if objectCount > 0 {
		nextObjects = objectCount
	}
	nextSize := currentSize
	if totalSize > 0 {
		nextSize = totalSize
	}
	nextTraffic := currentTraffic
	if trafficDelta > 0 {
		nextTraffic = currentTraffic + trafficDelta
	}

	if profile.TotalObjectQuota > 0 && nextObjects > profile.TotalObjectQuota {
		h.sendError(c, http.StatusForbidden, response.ErrAccessDenied, "User object package quota exceeded")
		return false
	}
	if profile.TotalStorageBytes > 0 && nextSize > profile.TotalStorageBytes {
		h.sendError(c, http.StatusForbidden, response.ErrAccessDenied, "User storage package quota exceeded")
		return false
	}
	if profile.TotalTrafficBytes > 0 && nextTraffic > profile.TotalTrafficBytes {
		h.sendError(c, http.StatusForbidden, response.ErrAccessDenied, "User traffic package quota exceeded")
		return false
	}
	return true
}
