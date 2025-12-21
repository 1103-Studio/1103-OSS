package api

import (
	"bytes"
	"context"
	"io"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gooss/server/internal/metadata"
)

// AuditMiddleware 审计日志中间件
func (s *Server) AuditMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// 记录请求开始时间
		startTime := time.Now()

		// 记录请求体（用于某些操作）
		var bodyBytes []byte
		if c.Request.Body != nil {
			bodyBytes, _ = io.ReadAll(c.Request.Body)
			c.Request.Body = io.NopCloser(bytes.NewBuffer(bodyBytes))
		}

		// 处理请求
		c.Next()

		// 跳过健康检查和静态文件
		if c.Request.URL.Path == "/health" || strings.HasPrefix(c.Request.URL.Path, "/static") {
			return
		}

		// 提取用户信息
		var userID *int64
		var username string
		if uid, exists := c.Get("user_id"); exists {
			if id, ok := uid.(int64); ok {
				userID = &id
			}
		}
		if uname, exists := c.Get("username"); exists {
			if name, ok := uname.(string); ok {
				username = name
			}
		}

		// 确定操作类型和资源
		action, resourceType, resourceName := s.parseAction(c)
		
		// 如果无法识别操作，跳过记录
		if action == "" {
			return
		}

		// 提取 bucket 和 object 信息
		bucketName, objectKey := s.extractResourceInfo(c)

		// 获取 IP 地址
		ipAddress := c.ClientIP()

		// 构建审计日志
		log := &metadata.AuditLog{
			UserID:       userID,
			Username:     username,
			Action:       action,
			ResourceType: resourceType,
			ResourceName: resourceName,
			BucketName:   bucketName,
			ObjectKey:    objectKey,
			IPAddress:    ipAddress,
			UserAgent:    c.Request.UserAgent(),
			StatusCode:   c.Writer.Status(),
			CreatedAt:    startTime,
		}

		// 如果有错误，记录错误信息
		if len(c.Errors) > 0 {
			log.ErrorMessage = c.Errors.String()
		}

		// 异步记录日志，避免影响性能
		go func() {
			ctx := context.Background()
			if err := s.repo.CreateAuditLog(ctx, log); err != nil {
				// 仅记录错误到结构化日志，不输出到标准输出
				// TODO: 使用 logger.Error("failed to create audit log", "error", err)
			}
		}()
	}
}

// parseAction 解析操作类型
func (s *Server) parseAction(c *gin.Context) (action, resourceType, resourceName string) {
	method := c.Request.Method
	path := c.Request.URL.Path

	// 跳过认证接口
	if strings.HasPrefix(path, "/auth/") {
		if path == "/auth/login" && method == "POST" {
			return metadata.ActionLogin, "AUTH", ""
		}
		return "", "", ""
	}

	// Bucket 操作
	if strings.HasPrefix(path, "/") && !strings.HasPrefix(path, "/api/") {
		parts := strings.Split(strings.Trim(path, "/"), "/")
		
		// Bucket policy 操作
		if c.Request.URL.RawQuery == "policy" {
			bucketName := parts[0]
			switch method {
			case "PUT":
				return metadata.ActionSetBucketPolicy, metadata.ResourceTypePolicy, bucketName
			case "DELETE":
				return metadata.ActionDeleteBucketPolicy, metadata.ResourceTypePolicy, bucketName
			}
		}

		switch len(parts) {
		case 0, 1:
			// Bucket 级别操作
			if len(parts) == 1 {
				bucketName := parts[0]
				switch method {
				case "PUT":
					return metadata.ActionCreateBucket, metadata.ResourceTypeBucket, bucketName
				case "DELETE":
					return metadata.ActionDeleteBucket, metadata.ResourceTypeBucket, bucketName
				}
			}
		case 2:
			// Object 级别操作
			objectKey := parts[1]
			switch method {
			case "PUT":
				return metadata.ActionUploadObject, metadata.ResourceTypeObject, objectKey
			case "DELETE":
				return metadata.ActionDeleteObject, metadata.ResourceTypeObject, objectKey
			}
		}
	}

	// API 管理接口
	if strings.HasPrefix(path, "/api/") {
		if strings.Contains(path, "/users") {
			switch method {
			case "POST":
				return metadata.ActionCreateUser, metadata.ResourceTypeUser, ""
			case "PUT":
				return metadata.ActionUpdateUser, metadata.ResourceTypeUser, ""
			case "DELETE":
				return metadata.ActionDeleteUser, metadata.ResourceTypeUser, ""
			}
		}
		if strings.Contains(path, "/credentials") {
			switch method {
			case "POST":
				return metadata.ActionCreateCredential, metadata.ResourceTypeCredential, ""
			case "DELETE":
				return metadata.ActionDeleteCredential, metadata.ResourceTypeCredential, ""
			}
		}
	}

	return "", "", ""
}

// extractResourceInfo 提取资源信息
func (s *Server) extractResourceInfo(c *gin.Context) (bucketName, objectKey string) {
	path := c.Request.URL.Path
	if strings.HasPrefix(path, "/") && !strings.HasPrefix(path, "/api/") {
		parts := strings.Split(strings.Trim(path, "/"), "/")
		if len(parts) >= 1 {
			bucketName = parts[0]
		}
		if len(parts) >= 2 {
			objectKey = strings.Join(parts[1:], "/")
		}
	}
	return
}
