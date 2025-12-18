package s3

import (
	"encoding/json"
	"io"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/gooss/server/internal/metadata"
	"github.com/gooss/server/pkg/response"
)

// PutBucketPolicy PUT /{bucket}?policy - 设置 Bucket 策略
func (h *Handler) PutBucketPolicy(c *gin.Context) {
	bucketName := c.Param("bucket")

	// 获取 bucket
	bucket, err := h.repo.GetBucketByName(c.Request.Context(), bucketName)
	if err != nil || bucket == nil {
		h.sendError(c, http.StatusNotFound, response.ErrNoSuchBucket, "Bucket not found")
		return
	}

	// 读取策略 JSON
	body, err := io.ReadAll(c.Request.Body)
	if err != nil {
		h.sendError(c, http.StatusBadRequest, response.ErrMalformedPOSTRequest, "Failed to read policy")
		return
	}

	// 验证策略格式
	var policy metadata.BucketPolicy
	if err := json.Unmarshal(body, &policy); err != nil {
		h.sendError(c, http.StatusBadRequest, response.ErrMalformedPolicy, "Invalid policy JSON")
		return
	}

	// 保存策略
	if err := h.repo.SetBucketPolicy(c.Request.Context(), bucket.ID, body); err != nil {
		h.sendError(c, http.StatusInternalServerError, response.ErrInternalError, err.Error())
		return
	}

	c.Status(http.StatusNoContent)
}

// GetBucketPolicy GET /{bucket}?policy - 获取 Bucket 策略
func (h *Handler) GetBucketPolicy(c *gin.Context) {
	bucketName := c.Param("bucket")

	// 获取 bucket
	bucket, err := h.repo.GetBucketByName(c.Request.Context(), bucketName)
	if err != nil || bucket == nil {
		h.sendError(c, http.StatusNotFound, response.ErrNoSuchBucket, "Bucket not found")
		return
	}

	// 获取策略
	policyData, err := h.repo.GetBucketPolicy(c.Request.Context(), bucket.ID)
	if err != nil {
		h.sendError(c, http.StatusNotFound, response.ErrNoSuchBucketPolicy, "Policy not found")
		return
	}

	c.Data(http.StatusOK, "application/json", policyData)
}

// DeleteBucketPolicy DELETE /{bucket}?policy - 删除 Bucket 策略
func (h *Handler) DeleteBucketPolicy(c *gin.Context) {
	bucketName := c.Param("bucket")

	// 获取 bucket
	bucket, err := h.repo.GetBucketByName(c.Request.Context(), bucketName)
	if err != nil || bucket == nil {
		h.sendError(c, http.StatusNotFound, response.ErrNoSuchBucket, "Bucket not found")
		return
	}

	// 删除策略
	if err := h.repo.DeleteBucketPolicy(c.Request.Context(), bucket.ID); err != nil {
		h.sendError(c, http.StatusInternalServerError, response.ErrInternalError, err.Error())
		return
	}

	c.Status(http.StatusNoContent)
}
