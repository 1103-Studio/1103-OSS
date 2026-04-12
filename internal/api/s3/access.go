package s3

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/gooss/server/internal/metadata"
	"github.com/gooss/server/pkg/response"
)

func (h *Handler) requireBucketOwner(c *gin.Context, bucket *metadata.Bucket) bool {
	userID := c.GetInt64("user_id")
	if userID == 0 || bucket.OwnerID != userID {
		h.sendError(c, http.StatusForbidden, response.ErrAccessDenied, "Access denied")
		return false
	}

	return true
}

func (h *Handler) requireBucketReadAccess(c *gin.Context, bucket *metadata.Bucket) bool {
	if c.GetBool("public_access") {
		return true
	}

	return h.requireBucketOwner(c, bucket)
}

func (h *Handler) requireMultipartUploadAccess(c *gin.Context, bucket *metadata.Bucket, key string, upload *metadata.MultipartUpload) bool {
	if !h.requireBucketOwner(c, bucket) {
		return false
	}

	if upload.BucketID != bucket.ID || upload.Key != key {
		h.sendError(c, http.StatusNotFound, response.ErrNoSuchUpload, "Upload not found")
		return false
	}

	return true
}
