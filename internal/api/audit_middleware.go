package api

import (
	"context"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gooss/server/internal/metadata"
	"github.com/gooss/server/pkg/logger"
)

const (
	auditLogQueueSize = 2048
	auditLogWorkers   = 2
	auditDBTimeout    = 5 * time.Second
)

func (s *Server) startAuditWorkers(workerCount int) {
	if workerCount <= 0 || s.auditQueue == nil {
		return
	}
	for i := 0; i < workerCount; i++ {
		go func() {
			for logEntry := range s.auditQueue {
				if logEntry == nil {
					continue
				}
				ctx, cancel := context.WithTimeout(context.Background(), auditDBTimeout)
				err := s.repo.CreateAuditLog(ctx, logEntry)
				cancel()
				if err != nil {
					logger.Warnf("failed to create audit log: %v", err)
				}
			}
		}()
	}
}

// AuditMiddleware 审计日志中间件
func (s *Server) AuditMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// 记录请求开始时间
		startTime := time.Now()

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

		// 使用有界队列做异步写入，避免为每个请求无限起 goroutine。
		select {
		case s.auditQueue <- log:
		default:
			logger.Warn("audit log queue full, dropping log entry")
		}
	}
}

// parseAction 解析操作类型
func (s *Server) parseAction(c *gin.Context) (action, resourceType, resourceName string) {
	method := c.Request.Method
	path := normalizeRequestPath(c.Request.URL.Path)

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
		if _, ok := c.GetQuery("policy"); ok && len(parts) > 0 && parts[0] != "" {
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
		default:
			// Object 级别操作
			objectKey := strings.Join(parts[1:], "/")
			switch method {
			case "PUT":
				return metadata.ActionUploadObject, metadata.ResourceTypeObject, objectKey
			case "DELETE":
				return metadata.ActionDeleteObject, metadata.ResourceTypeObject, objectKey
			}
		}
	}

	if strings.HasPrefix(path, "/admin/") {
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
			case "PUT":
				return metadata.ActionUpdateCredential, metadata.ResourceTypeCredential, ""
			case "DELETE":
				return metadata.ActionDeleteCredential, metadata.ResourceTypeCredential, ""
			}
		}
		if strings.Contains(path, "/roles") {
			switch method {
			case "POST":
				return metadata.ActionCreateRole, metadata.ResourceTypeRole, ""
			case "PUT":
				return metadata.ActionUpdateRole, metadata.ResourceTypeRole, ""
			case "DELETE":
				return metadata.ActionDeleteRole, metadata.ResourceTypeRole, ""
			}
		}
		if strings.Contains(path, "/buckets") {
			switch method {
			case "PUT":
				if strings.Contains(path, "/access") {
					return metadata.ActionUpdateBucketAccess, metadata.ResourceTypeBucketAccess, ""
				}
				return metadata.ActionUpdateBucket, metadata.ResourceTypeBucket, ""
			case "POST":
				if strings.Contains(path, "/access") {
					return metadata.ActionUpdateBucketAccess, metadata.ResourceTypeBucketAccess, ""
				}
			case "DELETE":
				if strings.Contains(path, "/access") {
					return metadata.ActionDeleteBucketAccess, metadata.ResourceTypeBucketAccess, ""
				}
			}
		}
		if strings.Contains(path, "/tickets") {
			switch method {
			case "GET":
				return metadata.ActionUpdateTicket, metadata.ResourceTypeTicket, ""
			case "PUT":
				return metadata.ActionUpdateTicket, metadata.ResourceTypeTicket, ""
			case "POST":
				return metadata.ActionCreateTicketReply, metadata.ResourceTypeTicket, ""
			}
		}
	}

	if strings.HasPrefix(path, "/user/") {
		if path == "/user/change-password" && method == "POST" {
			return metadata.ActionUpdateUser, metadata.ResourceTypeUser, "change-password"
		}
		if path == "/user/tickets" && method == "POST" {
			return metadata.ActionCreateTicket, metadata.ResourceTypeTicket, ""
		}
		if strings.Contains(path, "/user/tickets/") {
			switch method {
			case "PUT":
				return metadata.ActionUpdateTicket, metadata.ResourceTypeTicket, ""
			case "POST":
				return metadata.ActionCreateTicketReply, metadata.ResourceTypeTicket, ""
			}
		}
	}

	return "", "", ""
}

// extractResourceInfo 提取资源信息
func (s *Server) extractResourceInfo(c *gin.Context) (bucketName, objectKey string) {
	path := normalizeRequestPath(c.Request.URL.Path)
	if strings.HasPrefix(path, "/") &&
		!strings.HasPrefix(path, "/auth/") &&
		!strings.HasPrefix(path, "/admin/") &&
		!strings.HasPrefix(path, "/user/") {
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
