package api

import (
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gooss/server/internal/auth"
	"github.com/gooss/server/internal/metadata"
	"golang.org/x/crypto/bcrypt"
)

// LoginRequest 登录请求
type LoginRequest struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
}

// LoginResponse 登录响应
type LoginResponse struct {
	AccessKey   string          `json:"accessKey"`
	SecretKey   string          `json:"secretKey"`
	Endpoint    string          `json:"endpoint"`
	Username    string          `json:"username"`
	DisplayName string          `json:"displayName"`
	IsAdmin     bool            `json:"isAdmin"`
	Roles       []metadata.Role `json:"roles"`
	Permissions []string        `json:"permissions"`
}

// Login 用户登录
func (s *Server) Login(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	// 查找用户
	user, err := s.repo.GetUserByUsername(c.Request.Context(), req.Username)
	if err != nil || user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid username or password"})
		return
	}

	// 验证密码
	err = bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password))
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid username or password"})
		return
	}

	// 检查用户状态
	if user.Status != "active" {
		c.JSON(http.StatusForbidden, gin.H{"error": "User account is disabled"})
		return
	}

	// 获取用户的凭证
	credentials, err := s.repo.GetCredentialsByUserID(c.Request.Context(), user.ID)
	if err != nil || len(credentials) == 0 {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get user credentials"})
		return
	}

	// 返回第一个凭证（通常用户只有一个凭证）
	cred := credentials[0]

	c.JSON(http.StatusOK, LoginResponse{
		AccessKey:   cred.AccessKey,
		SecretKey:   cred.SecretKey,
		Endpoint:    s.cfg.Server.APIEndpoint,
		Username:    user.Username,
		DisplayName: user.DisplayName,
		IsAdmin:     user.IsAdmin,
		Roles:       user.Roles,
		Permissions: user.Permissions,
	})
}

// CreateUserRequest 创建用户请求
type CreateUserRequest struct {
	Username    string   `json:"username" binding:"required"`
	Password    string   `json:"password" binding:"required,min=8"`
	DisplayName string   `json:"displayName"`
	Email       string   `json:"email"`
	IsAdmin     bool     `json:"isAdmin"`
	RoleIDs     []int64  `json:"roleIds"`
	BucketNames []string `json:"bucketNames"`
}

// CreateUser 创建用户（仅管理员）
func (s *Server) CreateUser(c *gin.Context) {
	// 检查当前用户是否是管理员
	isAdmin := c.GetBool("is_admin")
	if !isAdmin {
		c.JSON(http.StatusForbidden, gin.H{"error": "Only administrators can create users"})
		return
	}

	var req CreateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// 检查用户名是否已存在
	existingUser, _ := s.repo.GetUserByUsername(c.Request.Context(), req.Username)
	if existingUser != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "Username already exists"})
		return
	}

	// 哈希密码
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to hash password"})
		return
	}

	// 创建用户
	user := &metadata.User{
		Username:     req.Username,
		PasswordHash: string(hashedPassword),
		DisplayName:  req.DisplayName,
		Email:        req.Email,
		Status:       "active",
		IsAdmin:      req.IsAdmin,
	}

	if err := s.repo.CreateUser(c.Request.Context(), user); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create user"})
		return
	}

	// 为新用户生成访问凭证
	accessKey, secretKey, err := auth.GenerateCredentials()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate credentials"})
		return
	}

	credential := &metadata.Credential{
		UserID:    user.ID,
		AccessKey: accessKey,
		SecretKey: secretKey,
		Status:    "active",
	}

	if err := s.repo.CreateCredential(c.Request.Context(), credential); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create credential"})
		return
	}
	if len(req.RoleIDs) > 0 {
		if err := s.repo.SetUserRoles(c.Request.Context(), user.ID, req.RoleIDs); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to assign roles"})
			return
		}
	}
	for _, bucketName := range req.BucketNames {
		bucket, err := s.repo.GetBucketByName(c.Request.Context(), bucketName)
		if err == nil && bucket != nil {
			_ = s.repo.UpsertBucketAccess(c.Request.Context(), &metadata.BucketAccess{
				BucketID:   bucket.ID,
				UserID:     user.ID,
				Permission: "write",
			})
		}
	}
	createdUser, _ := s.repo.GetUserByID(c.Request.Context(), user.ID)

	c.JSON(http.StatusCreated, gin.H{
		"message":   "User created successfully",
		"user":      createdUser,
		"accessKey": accessKey,
		"secretKey": secretKey,
	})
}

// ListUsers 列出所有用户（仅管理员）
func (s *Server) ListUsers(c *gin.Context) {
	isAdmin := c.GetBool("is_admin")
	if !isAdmin {
		c.JSON(http.StatusForbidden, gin.H{"error": "Only administrators can list users"})
		return
	}

	users, err := s.repo.ListUsers(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to list users"})
		return
	}

	c.JSON(http.StatusOK, users)
}

// UpdateUserRequest 更新用户请求
type UpdateUserRequest struct {
	Password    *string `json:"password,omitempty"`
	DisplayName *string `json:"displayName,omitempty"`
	Email       *string `json:"email,omitempty"`
	Status      *string `json:"status,omitempty"`
	IsAdmin     *bool   `json:"isAdmin,omitempty"`
	RoleIDs     []int64 `json:"roleIds,omitempty"`
}

// UpdateUser 更新用户（仅管理员）
func (s *Server) UpdateUser(c *gin.Context) {
	isAdmin := c.GetBool("is_admin")
	if !isAdmin {
		c.JSON(http.StatusForbidden, gin.H{"error": "Only administrators can update users"})
		return
	}

	userID := c.Param("id")
	if userID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "User ID is required"})
		return
	}

	var req UpdateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	user, err := s.repo.GetUserByID(c.Request.Context(), parseInt64(userID))
	if err != nil || user == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	// 更新密码
	if req.Password != nil {
		hashedPassword, err := bcrypt.GenerateFromPassword([]byte(*req.Password), bcrypt.DefaultCost)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to hash password"})
			return
		}
		user.PasswordHash = string(hashedPassword)
	}

	// 更新其他字段
	if req.Email != nil {
		user.Email = *req.Email
	}
	if req.DisplayName != nil {
		user.DisplayName = *req.DisplayName
	}
	if req.Status != nil {
		user.Status = *req.Status
	}
	if req.IsAdmin != nil {
		user.IsAdmin = *req.IsAdmin
	}

	if err := s.repo.UpdateUser(c.Request.Context(), user); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update user"})
		return
	}
	if req.RoleIDs != nil {
		if err := s.repo.SetUserRoles(c.Request.Context(), user.ID, req.RoleIDs); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update user roles"})
			return
		}
	}
	updatedUser, _ := s.repo.GetUserByID(c.Request.Context(), user.ID)

	c.JSON(http.StatusOK, gin.H{"message": "User updated successfully", "user": updatedUser})
}

// DeleteUser 删除用户（仅管理员）
func (s *Server) DeleteUser(c *gin.Context) {
	isAdmin := c.GetBool("is_admin")
	if !isAdmin {
		c.JSON(http.StatusForbidden, gin.H{"error": "Only administrators can delete users"})
		return
	}

	userID := c.Param("id")
	if userID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "User ID is required"})
		return
	}

	currentUserID := c.GetInt64("user_id")
	if parseInt64(userID) == currentUserID {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot delete your own account"})
		return
	}

	if err := s.repo.DeleteUser(c.Request.Context(), parseInt64(userID)); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete user"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "User deleted successfully"})
}

type CreateCredentialRequest struct {
	UserID      int64   `json:"userId" binding:"required"`
	Description string  `json:"description"`
	ExpiresAt   *string `json:"expiresAt"`
}

func (s *Server) CreateCredential(c *gin.Context) {
	var req CreateCredentialRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	user, err := s.repo.GetUserByID(c.Request.Context(), req.UserID)
	if err != nil || user == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	accessKey, secretKey, err := auth.GenerateCredentials()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate credentials"})
		return
	}

	var expiresAt *time.Time
	if req.ExpiresAt != nil && *req.ExpiresAt != "" {
		parsed, err := time.Parse(time.RFC3339, *req.ExpiresAt)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid expiresAt"})
			return
		}
		expiresAt = &parsed
	}

	credential := &metadata.Credential{
		UserID:      user.ID,
		AccessKey:   accessKey,
		SecretKey:   secretKey,
		Description: req.Description,
		Status:      "active",
		ExpiresAt:   expiresAt,
	}
	if err := s.repo.CreateCredential(c.Request.Context(), credential); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create credential"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"message": "Credential created successfully", "credential": credential})
}

type UpdateCredentialRequest struct {
	Description *string `json:"description,omitempty"`
	Status      *string `json:"status,omitempty"`
	ExpiresAt   *string `json:"expiresAt,omitempty"`
}

func (s *Server) UpdateCredential(c *gin.Context) {
	credentialID := parseInt64(c.Param("id"))
	credential, err := s.repo.GetCredentialByID(c.Request.Context(), credentialID)
	if err != nil || credential == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Credential not found"})
		return
	}

	var req UpdateCredentialRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.Description != nil {
		credential.Description = *req.Description
	}
	if req.Status != nil {
		credential.Status = *req.Status
	}
	if req.ExpiresAt != nil {
		if *req.ExpiresAt == "" {
			credential.ExpiresAt = nil
		} else {
			parsed, err := time.Parse(time.RFC3339, *req.ExpiresAt)
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid expiresAt"})
				return
			}
			credential.ExpiresAt = &parsed
		}
	}

	if err := s.repo.UpdateCredential(c.Request.Context(), credential); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update credential"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Credential updated successfully", "credential": credential})
}

func (s *Server) DeleteCredential(c *gin.Context) {
	credentialID := parseInt64(c.Param("id"))
	if err := s.repo.DeleteCredential(c.Request.Context(), credentialID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete credential"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Credential deleted successfully"})
}

// ChangePasswordRequest 修改密码请求
type ChangePasswordRequest struct {
	OldPassword string `json:"oldPassword" binding:"required"`
	NewPassword string `json:"newPassword" binding:"required,min=8"`
}

// ChangePassword 修改当前用户密码
func (s *Server) ChangePassword(c *gin.Context) {
	var req ChangePasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	userID := c.GetInt64("user_id")
	if userID == 0 {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	// 获取当前用户
	user, err := s.repo.GetUserByID(c.Request.Context(), userID)
	if err != nil || user == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	// 验证旧密码
	err = bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.OldPassword))
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Old password is incorrect"})
		return
	}

	// 哈希新密码
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to hash password"})
		return
	}

	// 更新密码
	user.PasswordHash = string(hashedPassword)
	if err := s.repo.UpdateUser(c.Request.Context(), user); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update password"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Password updated successfully"})
}

func parseInt64(s string) int64 {
	val, err := strconv.ParseInt(s, 10, 64)
	if err != nil {
		return 0
	}
	return val
}
