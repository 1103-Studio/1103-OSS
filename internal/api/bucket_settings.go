package api

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/gooss/server/internal/util"
	"github.com/gooss/server/pkg/response"
)

// UpdateBucketSettings 更新存储桶设置
func (s *Server) UpdateBucketSettings(c *gin.Context) {
	bucketName := c.Param("bucket")

	var req struct {
		DefaultExpiry string `json:"default_expiry"` // 如 "7d", "4w", "2h30m"
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, response.Error{
			Code:    response.ErrInvalidArgument,
			Message: "Invalid request body",
		})
		return
	}

	// 验证时间格式
	if req.DefaultExpiry != "" {
		duration, err := util.ParseDuration(req.DefaultExpiry)
		if err != nil {
			c.JSON(http.StatusBadRequest, response.Error{
				Code:    response.ErrInvalidArgument,
				Message: "Invalid duration format: " + err.Error(),
			})
			return
		}

		// 限制最小有效期为 10 秒，最大有效期为 30 天
		minDuration := 10             // 10 seconds
		maxDuration := 30 * 24 * 3600 // 30 days in seconds
		if duration.Seconds() < float64(minDuration) {
			c.JSON(http.StatusBadRequest, response.Error{
				Code:    response.ErrInvalidArgument,
				Message: "Expiry time must be at least 10 seconds",
			})
			return
		}
		if duration.Seconds() > float64(maxDuration) {
			c.JSON(http.StatusBadRequest, response.Error{
				Code:    response.ErrInvalidArgument,
				Message: "Expiry time cannot exceed 30 days",
			})
			return
		}
	}

	// 获取存储桶
	bucket, err := s.repo.GetBucketByName(c.Request.Context(), bucketName)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if bucket == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Bucket not found"})
		return
	}

	// 更新设置
	bucket.DefaultExpiry = req.DefaultExpiry
	if err := s.repo.UpdateBucket(c.Request.Context(), bucket); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":        "Bucket settings updated successfully",
		"default_expiry": bucket.DefaultExpiry,
	})
}

// GetBucketSettings 获取存储桶设置
func (s *Server) GetBucketSettings(c *gin.Context) {
	bucketName := c.Param("bucket")

	bucket, err := s.repo.GetBucketByName(c.Request.Context(), bucketName)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if bucket == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Bucket not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"default_expiry": bucket.DefaultExpiry,
	})
}
