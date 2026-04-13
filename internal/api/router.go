package api

import (
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gooss/server/internal/api/s3"
	"github.com/gooss/server/internal/auth"
	"github.com/gooss/server/internal/metadata"
	"github.com/gooss/server/internal/storage"
	"github.com/gooss/server/pkg/config"
	"github.com/gooss/server/pkg/response"
)

// Server API 服务器
type Server struct {
	cfg              *config.Config
	engine           *gin.Engine
	s3Handler        *s3.Handler
	migrationHandler *MigrationHandler
	repo             metadata.Repository
	auditQueue       chan *metadata.AuditLog
}

// NewServer 创建 API 服务器
func NewServer(cfg *config.Config, storageEngine storage.Engine, repo metadata.Repository) *Server {
	gin.SetMode(gin.ReleaseMode)
	engine := gin.New()
	engine.Use(gin.Recovery())

	s3Handler := s3.NewHandler(storageEngine, repo, "us-east-1")
	migrationHandler := NewMigrationHandler(storageEngine, repo)

	server := &Server{
		cfg:              cfg,
		engine:           engine,
		s3Handler:        s3Handler,
		migrationHandler: migrationHandler,
		repo:             repo,
		auditQueue:       make(chan *metadata.AuditLog, auditLogQueueSize),
	}

	server.startAuditWorkers(auditLogWorkers)
	server.startSessionJanitor()
	server.setupRoutes()
	return server
}

func (s *Server) setupRoutes() {
	// CORS 中间件
	s.engine.Use(s.corsMiddleware())

	s.registerRoutes(s.engine)
	s.registerRoutes(s.engine.Group("/api"))
}

func (s *Server) registerRoutes(router gin.IRouter) {
	// 健康检查
	router.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	// 认证相关路由（不需要签名）
	auth := router.Group("/auth")
	{
		auth.POST("/login", s.Login)
		auth.POST("/logout", s.authMiddleware(), s.Logout)
	}

	// 用户个人操作路由（需要认证）
	user := router.Group("/user")
	user.Use(s.authMiddleware())
	user.Use(s.AuditMiddleware())
	{
		user.POST("/change-password", s.ChangePassword)
		user.GET("/presign", s.GetPresignedURL)
		user.GET("/tickets", s.ListTickets)
		user.POST("/tickets", s.CreateTicket)
		user.GET("/tickets/:id", s.GetTicket)
		user.PUT("/tickets/:id", s.UpdateTicket)
		user.POST("/tickets/:id/messages", s.CreateTicketMessage)
		user.GET("/subscription/profile", s.GetMySubscriptionProfile)
		user.GET("/subscription/plans", s.ListActiveSubscriptionPlans)
		user.POST("/subscription/redeem", s.RedeemResourcePackCode)
	}

	// 用户管理路由（需要管理员权限）
	admin := router.Group("/admin")
	admin.Use(s.authMiddleware())
	admin.Use(s.AuditMiddleware())
	{
		admin.GET("/users", s.requirePermission(PermUserManage), s.ListUsers)
		admin.POST("/users", s.requirePermission(PermUserManage), s.CreateUser)
		admin.PUT("/users/:id", s.requirePermission(PermUserManage), s.UpdateUser)
		admin.DELETE("/users/:id", s.requirePermission(PermUserManage), s.DeleteUser)
		admin.POST("/credentials", s.requirePermission(PermCredentialManage), s.CreateCredential)
		admin.PUT("/credentials/:id", s.requirePermission(PermCredentialManage), s.UpdateCredential)
		admin.DELETE("/credentials/:id", s.requirePermission(PermCredentialManage), s.DeleteCredential)
		admin.GET("/roles", s.requirePermission(PermRoleManage), s.ListRoles)
		admin.POST("/roles", s.requirePermission(PermRoleManage), s.CreateRole)
		admin.PUT("/roles/:id", s.requirePermission(PermRoleManage), s.UpdateRole)
		admin.DELETE("/roles/:id", s.requirePermission(PermRoleManage), s.DeleteRole)
		admin.GET("/buckets", s.requireAnyPermission(PermBucketManage, PermBucketAssign, PermBucketQuota, PermBucketTraffic, PermBucketPolicy), s.ListAllBuckets)
		admin.PUT("/buckets/:id", s.requireAnyPermission(PermBucketManage, PermBucketQuota, PermBucketTraffic, PermBucketPolicy), s.UpdateBucketAdmin)
		admin.GET("/buckets/:id/access", s.requireAnyPermission(PermBucketManage, PermBucketAssign), s.ListBucketAccess)
		admin.POST("/buckets/:id/access", s.requireAnyPermission(PermBucketManage, PermBucketAssign), s.UpsertBucketAccess)
		admin.DELETE("/buckets/:id/access/:userId", s.requireAnyPermission(PermBucketManage, PermBucketAssign), s.DeleteBucketAccess)
		admin.GET("/tickets", s.requirePermission(PermTicketManage), s.ListTickets)
		admin.GET("/tickets/:id", s.requirePermission(PermTicketManage), s.GetTicket)
		admin.PUT("/tickets/:id", s.requirePermission(PermTicketManage), s.UpdateTicket)
		admin.POST("/tickets/:id/messages", s.requirePermission(PermTicketManage), s.CreateTicketMessage)
		admin.GET("/subscription/plans", s.requireAnyPermission(PermSubscriptionManage, PermSubscriptionRead), s.ListSubscriptionPlans)
		admin.POST("/subscription/plans", s.requirePermission(PermSubscriptionManage), s.CreateSubscriptionPlan)
		admin.PUT("/subscription/plans/:id", s.requirePermission(PermSubscriptionManage), s.UpdateSubscriptionPlan)
		admin.GET("/resource-pack-codes", s.requireAnyPermission(PermRedemptionManage, PermSubscriptionManage, PermSubscriptionRead), s.ListResourcePackCodes)
		admin.POST("/resource-pack-codes", s.requireAnyPermission(PermRedemptionManage, PermSubscriptionManage), s.CreateResourcePackCode)

		// 审计日志路由
		admin.GET("/audit-logs", s.adminMiddleware(), s.GetAuditLogs)
		admin.GET("/audit-logs/stats", s.adminMiddleware(), s.GetAuditLogStats)
		admin.GET("/audit-logs/recent", s.adminMiddleware(), s.GetRecentActions)

		// 迁移路由
		admin.POST("/migration/start", s.requirePermission(PermBucketManage), s.migrationHandler.StartMigration)
		admin.GET("/migration/jobs", s.requirePermission(PermBucketManage), s.migrationHandler.ListMigrationJobs)
		admin.GET("/migration/jobs/:id", s.requirePermission(PermBucketManage), s.migrationHandler.GetMigrationJob)
		admin.POST("/migration/jobs/:id/cancel", s.requirePermission(PermBucketManage), s.migrationHandler.CancelMigration)
	}

	// S3 API 路由组
	s3Group := router.Group("")
	s3Group.Use(s.authMiddleware())
	s3Group.Use(s.AuditMiddleware())
	{
		// Service 操作
		s3Group.GET("/", s.s3Handler.ListBuckets)

		// Bucket 操作
		s3Group.HEAD("/:bucket", s.s3Handler.HeadBucket)
		s3Group.PUT("/:bucket", func(c *gin.Context) {
			// 检查是否为 Settings 操作
			if _, ok := c.GetQuery("settings"); ok {
				s.UpdateBucketSettings(c)
				return
			}
			// 检查是否为 Policy 操作
			if _, ok := c.GetQuery("policy"); ok {
				s.s3Handler.PutBucketPolicy(c)
				return
			}
			s.s3Handler.CreateBucket(c)
		})
		s3Group.DELETE("/:bucket", func(c *gin.Context) {
			// 检查是否为 Policy 操作
			if _, ok := c.GetQuery("policy"); ok {
				s.s3Handler.DeleteBucketPolicy(c)
				return
			}
			s.s3Handler.DeleteBucket(c)
		})
		s3Group.GET("/:bucket", func(c *gin.Context) {
			// 检查是否为 Settings 操作
			if _, ok := c.GetQuery("settings"); ok {
				s.GetBucketSettings(c)
				return
			}
			// 检查是否为 Policy 操作
			if _, ok := c.GetQuery("policy"); ok {
				s.s3Handler.GetBucketPolicy(c)
				return
			}
			s.s3Handler.ListObjects(c)
		})

		// Object 操作
		s3Group.PUT("/:bucket/*key", s.objectPutHandler)
		s3Group.GET("/:bucket/*key", s.objectGetHandler)
		s3Group.HEAD("/:bucket/*key", s.s3Handler.HeadObject)
		s3Group.DELETE("/:bucket/*key", s.objectDeleteHandler)
		s3Group.POST("/:bucket/*key", s.objectPostHandler)
	}
}

// bucketOrObjectHandler 处理 GET /{bucket} 请求
func (s *Server) bucketOrObjectHandler(c *gin.Context) {
	s.s3Handler.ListObjects(c)
}

// objectPutHandler 处理 PUT /{bucket}/{key} 请求
func (s *Server) objectPutHandler(c *gin.Context) {
	// 检查是否是分片上传
	if c.Query("partNumber") != "" && c.Query("uploadId") != "" {
		s.s3Handler.UploadPart(c)
		return
	}
	s.s3Handler.PutObject(c)
}

// objectGetHandler 处理 GET /{bucket}/{key} 请求
func (s *Server) objectGetHandler(c *gin.Context) {
	// 检查是否是列出分片
	if c.Query("uploadId") != "" {
		s.s3Handler.ListParts(c)
		return
	}
	s.s3Handler.GetObject(c)
}

// objectDeleteHandler 处理 DELETE /{bucket}/{key} 请求
func (s *Server) objectDeleteHandler(c *gin.Context) {
	// 检查是否是取消分片上传
	if c.Query("uploadId") != "" {
		s.s3Handler.AbortMultipartUpload(c)
		return
	}
	s.s3Handler.DeleteObject(c)
}

// objectPostHandler 处理 POST /{bucket}/{key} 请求
func (s *Server) objectPostHandler(c *gin.Context) {
	// 初始化分片上传
	if _, ok := c.GetQuery("uploads"); ok {
		s.s3Handler.CreateMultipartUpload(c)
		return
	}
	// 完成分片上传
	if c.Query("uploadId") != "" {
		s.s3Handler.CompleteMultipartUpload(c)
		return
	}
	c.Status(http.StatusBadRequest)
}

// corsMiddleware CORS 中间件
func (s *Server) corsMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		origin := c.Request.Header.Get("Origin")

		// 从配置中获取允许的来源
		allowedOrigins := s.cfg.Server.AllowedOrigins
		if len(allowedOrigins) == 0 {
			// 如果未配置，默认允许所有来源（向后兼容）
			allowedOrigins = []string{"*"}
		}

		// 检查来源是否在允许列表中
		allowed := false
		for _, allowedOrigin := range allowedOrigins {
			if allowedOrigin == "*" {
				c.Header("Access-Control-Allow-Origin", "*")
				allowed = true
				break
			} else if allowedOrigin == origin {
				c.Header("Access-Control-Allow-Origin", origin)
				c.Header("Access-Control-Allow-Credentials", "true")
				allowed = true
				break
			}
		}

		// 如果来源不在白名单中且不为空，拒绝请求
		if !allowed && origin != "" && len(allowedOrigins) > 0 && allowedOrigins[0] != "*" {
			c.AbortWithStatus(http.StatusForbidden)
			return
		}

		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, HEAD, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Authorization, Content-Type, X-Amz-Date, X-Amz-Content-Sha256, X-Amz-Security-Token")
		c.Header("Access-Control-Expose-Headers", "ETag, X-Amz-Request-Id")
		c.Header("Access-Control-Max-Age", "86400")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(http.StatusOK)
			return
		}
		c.Next()
	}
}

// authMiddleware 认证中间件
func (s *Server) authMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		path := normalizeRequestPath(c.Request.URL.Path)

		// 跳过不需要认证的路径
		if path == "/health" || path == "/auth/login" {
			c.Next()
			return
		}

		// 检查是否为公开读访问 (只对对象路径生效，避免误伤 /user /admin 等 API)
		if (c.Request.Method == "GET" || c.Request.Method == "HEAD") && strings.Count(path, "/") >= 2 && !isReservedRoutePrefix(path) {
			// 路径格式: /{bucket}/{key...}
			parts := strings.SplitN(strings.TrimPrefix(path, "/"), "/", 2)
			if len(parts) == 2 {
				bucketName := parts[0]
				bucket, err := s.repo.GetBucketByName(c.Request.Context(), bucketName)
				if err == nil && bucket != nil {
					// 尝试获取 bucket policy
					policyData, err := s.repo.GetBucketPolicy(c.Request.Context(), bucket.ID)
					if err == nil && policyData != nil {
						policy, err := metadata.ParseBucketPolicy(policyData)
						if err == nil && policy.IsPublicRead() {
							// 公开读，允许匿名访问
							c.Set("public_access", true)
							c.Set("bucket_id", bucket.ID)
							c.Next()
							return
						}
					}
				}
			}
		}

		authHeader := c.GetHeader("Authorization")
		if token := extractBearerToken(authHeader); token != "" {
			session, ok := s.getSession(token)
			if !ok {
				c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Invalid or expired session"})
				return
			}

			user, err := s.repo.GetUserByID(c.Request.Context(), session.UserID)
			if err != nil || user == nil {
				c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "User not found"})
				return
			}
			if user.Status != "active" {
				c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "User account is disabled"})
				return
			}

			c.Set("user_id", user.ID)
			c.Set("username", user.Username)
			c.Set("is_admin", user.IsAdmin)
			c.Set("access_key", session.AccessKey)
			c.Set("display_name", user.DisplayName)
			c.Set("roles", user.Roles)
			c.Set("permissions", user.Permissions)

			c.Next()
			return
		}

		// 解析认证信息
		var accessKey string

		if authHeader != "" {
			// Header 签名
			parsedAuth, err := auth.ParseAuthorizationHeader(authHeader)
			if err != nil {
				c.XML(http.StatusForbidden, response.NewError(response.ErrAccessDenied, err.Error(), c.Request.URL.Path))
				c.Abort()
				return
			}
			accessKey = parsedAuth.AccessKey
		} else if c.Query("X-Amz-Algorithm") != "" {
			// 预签名 URL
			parsedAuth, err := auth.ParseQueryAuth(c.Request.URL.Query())
			if err != nil {
				c.XML(http.StatusForbidden, response.NewError(response.ErrAccessDenied, err.Error(), c.Request.URL.Path))
				c.Abort()
				return
			}
			accessKey = parsedAuth.AccessKey
		} else {
			c.XML(http.StatusForbidden, response.NewError(response.ErrAccessDenied, "Missing authentication", c.Request.URL.Path))
			c.Abort()
			return
		}

		// 查找凭证
		cred, err := s.repo.GetCredentialByAccessKey(c.Request.Context(), accessKey)
		if err != nil || cred == nil {
			c.XML(http.StatusForbidden, response.NewError(response.ErrInvalidAccessKeyId, "Invalid access key", c.Request.URL.Path))
			c.Abort()
			return
		}
		if cred.ExpiresAt != nil && cred.ExpiresAt.Before(time.Now()) {
			c.XML(http.StatusForbidden, response.NewError(response.ErrAccessDenied, "Credential expired", c.Request.URL.Path))
			c.Abort()
			return
		}

		// 验证签名
		c.Header("Server", "MaxIO-OSS/1.0")
		signer := auth.NewSignatureV4(cred.AccessKey, cred.SecretKey, "us-east-1")
		if err := signer.VerifyRequest(c.Request, cred.SecretKey); err != nil {
			c.XML(http.StatusForbidden, response.NewError(response.ErrSignatureDoesNotMatch, err.Error(), c.Request.URL.Path))
			c.Abort()
			return
		}

		// 获取用户信息
		user, err := s.repo.GetUserByID(c.Request.Context(), cred.UserID)
		if err != nil || user == nil {
			c.XML(http.StatusForbidden, response.NewError(response.ErrAccessDenied, "User not found", c.Request.URL.Path))
			c.Abort()
			return
		}
		if user.Status != "active" {
			c.XML(http.StatusForbidden, response.NewError(response.ErrAccessDenied, "User account is disabled", c.Request.URL.Path))
			c.Abort()
			return
		}

		// 设置上下文
		c.Set("user_id", user.ID)
		c.Set("username", user.Username)
		c.Set("is_admin", user.IsAdmin)
		c.Set("access_key", accessKey)
		c.Set("display_name", user.DisplayName)
		c.Set("roles", user.Roles)
		c.Set("permissions", user.Permissions)

		c.Next()
	}
}

// Run 启动服务器
func (s *Server) Run(addr string) error {
	return s.engine.Run(addr)
}

// Engine 获取 Gin 引擎
func (s *Server) Engine() *gin.Engine {
	return s.engine
}
