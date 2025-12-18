package api

import (
	"net/http"
	"strings"

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
	engine    *gin.Engine
	s3Handler *s3.Handler
	repo      metadata.Repository
	config    *config.Config
}

// NewServer 创建 API 服务器
func NewServer(cfg *config.Config, storageEngine storage.Engine, repo metadata.Repository) *Server {
	gin.SetMode(gin.ReleaseMode)
	engine := gin.New()
	engine.Use(gin.Recovery())

	s3Handler := s3.NewHandler(storageEngine, repo, "us-east-1")

	server := &Server{
		engine:    engine,
		s3Handler: s3Handler,
		repo:      repo,
		config:    cfg,
	}

	server.setupRoutes()
	return server
}

func (s *Server) setupRoutes() {
	// CORS 中间件
	s.engine.Use(s.corsMiddleware())

	// 健康检查
	s.engine.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	// S3 API 路由组
	s3Group := s.engine.Group("")
	s3Group.Use(s.authMiddleware())
	{
		// Service 操作
		s3Group.GET("/", s.s3Handler.ListBuckets)

		// Bucket 操作
		s3Group.PUT("/:bucket", s.s3Handler.CreateBucket)
		s3Group.HEAD("/:bucket", s.s3Handler.HeadBucket)
		s3Group.DELETE("/:bucket", s.s3Handler.DeleteBucket)
		s3Group.GET("/:bucket", s.bucketOrObjectHandler)

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
		c.Header("Access-Control-Allow-Origin", "*")
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
		// 健康检查跳过认证
		if c.Request.URL.Path == "/health" {
			c.Next()
			return
		}

		// 解析认证信息
		authHeader := c.GetHeader("Authorization")
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

		// 验证签名
		signer := auth.NewSignatureV4(cred.AccessKey, cred.SecretKey, "us-east-1")
		if err := signer.VerifyRequest(c.Request, cred.SecretKey); err != nil {
			// 开发模式下可以跳过签名验证
			if !strings.Contains(err.Error(), "signature mismatch") || s.config.Logging.Level != "debug" {
				c.XML(http.StatusForbidden, response.NewError(response.ErrSignatureDoesNotMatch, err.Error(), c.Request.URL.Path))
				c.Abort()
				return
			}
		}

		// 获取用户信息
		user, err := s.repo.GetUserByID(c.Request.Context(), cred.UserID)
		if err != nil || user == nil {
			c.XML(http.StatusForbidden, response.NewError(response.ErrAccessDenied, "User not found", c.Request.URL.Path))
			c.Abort()
			return
		}

		// 设置上下文
		c.Set("user_id", user.ID)
		c.Set("username", user.Username)
		c.Set("is_admin", user.IsAdmin)
		c.Set("access_key", accessKey)

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
