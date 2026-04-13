package api

import (
	"context"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gooss/server/internal/auth"
	"github.com/gooss/server/internal/metadata"
	"github.com/gooss/server/internal/util"
	"golang.org/x/crypto/bcrypt"
)

var allowedUserStatus = map[string]struct{}{
	"active":   {},
	"disabled": {},
}

var allowedCredentialStatus = map[string]struct{}{
	"active":   {},
	"disabled": {},
}

// LoginRequest 登录请求
type LoginRequest struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
}

// LoginResponse 登录响应
type LoginResponse struct {
	AccessKey    string                       `json:"accessKey"`
	SessionToken string                       `json:"sessionToken"`
	Endpoint     string                       `json:"endpoint"`
	Username     string                       `json:"username"`
	DisplayName  string                       `json:"displayName"`
	IsAdmin      bool                         `json:"isAdmin"`
	Subscription metadata.SubscriptionProfile `json:"subscription"`
	Roles        []metadata.Role              `json:"roles"`
	Permissions  []string                     `json:"permissions"`
}

type userResponse struct {
	ID           int64                        `json:"id"`
	Username     string                       `json:"username"`
	DisplayName  string                       `json:"displayName"`
	Email        string                       `json:"email"`
	Status       string                       `json:"status"`
	IsAdmin      bool                         `json:"isAdmin"`
	Subscription metadata.SubscriptionProfile `json:"subscription"`
	Roles        []metadata.Role              `json:"roles"`
	Permissions  []string                     `json:"permissions"`
	CreatedAt    time.Time                    `json:"createdAt"`
	UpdatedAt    time.Time                    `json:"updatedAt"`
}

type credentialResponse struct {
	ID          int64      `json:"id"`
	UserID      int64      `json:"userId"`
	AccessKey   string     `json:"accessKey"`
	Description string     `json:"description"`
	Status      string     `json:"status"`
	CreatedAt   time.Time  `json:"createdAt"`
	ExpiresAt   *time.Time `json:"expiresAt"`
}

func sanitizeUser(user *metadata.User) userResponse {
	return userResponse{
		ID:           user.ID,
		Username:     user.Username,
		DisplayName:  user.DisplayName,
		Email:        user.Email,
		Status:       user.Status,
		IsAdmin:      user.IsAdmin,
		Subscription: user.Subscription,
		Roles:        user.Roles,
		Permissions:  user.Permissions,
		CreatedAt:    user.CreatedAt,
		UpdatedAt:    user.UpdatedAt,
	}
}

func sanitizeUsers(users []metadata.User) []userResponse {
	items := make([]userResponse, 0, len(users))
	for _, user := range users {
		userCopy := user
		items = append(items, sanitizeUser(&userCopy))
	}
	return items
}

func sanitizeCredential(cred *metadata.Credential) credentialResponse {
	return credentialResponse{
		ID:          cred.ID,
		UserID:      cred.UserID,
		AccessKey:   cred.AccessKey,
		Description: cred.Description,
		Status:      cred.Status,
		CreatedAt:   cred.CreatedAt,
		ExpiresAt:   cred.ExpiresAt,
	}
}

func pickActiveCredential(credentials []metadata.Credential) *metadata.Credential {
	now := time.Now()
	for i := range credentials {
		cred := &credentials[i]
		if cred.Status != "active" {
			continue
		}
		if cred.ExpiresAt != nil && cred.ExpiresAt.Before(now) {
			continue
		}
		return cred
	}
	return nil
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

	cred := pickActiveCredential(credentials)
	if cred == nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "No active credential available"})
		return
	}

	session, err := s.createSession(user.ID, cred.AccessKey)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create session"})
		return
	}

	c.JSON(http.StatusOK, LoginResponse{
		AccessKey:    cred.AccessKey,
		SessionToken: session.Token,
		Endpoint:     s.cfg.Server.APIEndpoint,
		Username:     user.Username,
		DisplayName:  user.DisplayName,
		IsAdmin:      user.IsAdmin,
		Subscription: user.Subscription,
		Roles:        user.Roles,
		Permissions:  user.Permissions,
	})
}

func (s *Server) Logout(c *gin.Context) {
	token := extractBearerToken(c.GetHeader("Authorization"))
	if token != "" {
		s.deleteSession(token)
	}
	c.JSON(http.StatusOK, gin.H{"message": "Logged out"})
}

func (s *Server) GetPresignedURL(c *gin.Context) {
	bucketName := strings.TrimSpace(c.Query("bucket"))
	key := strings.TrimSpace(c.Query("key"))
	method := strings.ToUpper(strings.TrimSpace(c.DefaultQuery("method", http.MethodGet)))
	expiresInSeconds := parseInt64(c.Query("expiresInSeconds"))

	if bucketName == "" || key == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "bucket and key are required"})
		return
	}
	if method != http.MethodGet {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Only GET presign is supported"})
		return
	}
	if err := auth.ValidateObjectKey(key); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	bucket, err := s.repo.GetBucketByName(c.Request.Context(), bucketName)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load bucket"})
		return
	}
	if bucket == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Bucket not found"})
		return
	}
	if !canReadBucket(c, s.repo, bucket) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}

	sessionAccessKey := c.GetString("access_key")
	cred, err := s.repo.GetCredentialByAccessKey(c.Request.Context(), sessionAccessKey)
	if err != nil || cred == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Credential not found"})
		return
	}

	expires := bucket.DefaultExpiry
	var duration time.Duration
	if expiresInSeconds > 0 {
		duration = time.Duration(expiresInSeconds) * time.Second
	} else {
		if expires == "" {
			expires = "7d"
		}
		duration, err = util.ParseDuration(expires)
		if err != nil {
			duration = 7 * 24 * time.Hour
		}
	}

	host := strings.TrimPrefix(strings.TrimPrefix(s.cfg.Server.APIEndpoint, "https://"), "http://")
	signer := auth.NewSignatureV4(cred.AccessKey, cred.SecretKey, "us-east-1")
	url := signer.GeneratePresignedURL(method, bucketName, key, duration, host)
	c.JSON(http.StatusOK, gin.H{"url": url})
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
	var req CreateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	req.Username = strings.TrimSpace(req.Username)
	req.DisplayName = strings.TrimSpace(req.DisplayName)
	req.Email = strings.TrimSpace(req.Email)
	if req.Username == "" || strings.TrimSpace(req.Password) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Username and password are required"})
		return
	}
	if req.IsAdmin && !c.GetBool("is_admin") {
		c.JSON(http.StatusForbidden, gin.H{"error": "Only administrators can create admin users"})
		return
	}
	if len(req.RoleIDs) > 0 && !canManageRoles(c) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Role assignment requires role management permission"})
		return
	}
	if len(req.BucketNames) > 0 && !canAssignBuckets(c) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Bucket assignment requires bucket assignment permission"})
		return
	}

	// 检查用户名是否已存在
	existingUser, _ := s.repo.GetUserByUsername(c.Request.Context(), req.Username)
	if existingUser != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "Username already exists"})
		return
	}
	if err := validateRoleIDs(c.Request.Context(), s.repo, req.RoleIDs); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	assignedBuckets, err := validateBucketNames(c.Request.Context(), s.repo, req.BucketNames)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
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

	txRepo, err := s.repo.BeginTx(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to start transaction"})
		return
	}
	defer txRepo.Rollback()

	if err := txRepo.CreateUser(c.Request.Context(), user); err != nil {
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

	if err := txRepo.CreateCredential(c.Request.Context(), credential); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create credential"})
		return
	}
	if len(req.RoleIDs) > 0 {
		if err := txRepo.SetUserRoles(c.Request.Context(), user.ID, req.RoleIDs); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to assign roles"})
			return
		}
	}
	for _, bucket := range assignedBuckets {
		if err := txRepo.UpsertBucketAccess(c.Request.Context(), &metadata.BucketAccess{
			BucketID:   bucket.ID,
			UserID:     user.ID,
			Permission: "write",
		}); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to assign bucket access"})
			return
		}
	}
	if err := txRepo.Commit(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to commit user creation"})
		return
	}
	createdUser, _ := s.repo.GetUserByID(c.Request.Context(), user.ID)

	c.JSON(http.StatusCreated, gin.H{
		"message":   "User created successfully",
		"user":      sanitizeUser(createdUser),
		"accessKey": accessKey,
		"secretKey": secretKey,
	})
}

// ListUsers 列出所有用户（仅管理员）
func (s *Server) ListUsers(c *gin.Context) {
	users, err := s.repo.ListUsers(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to list users"})
		return
	}

	c.JSON(http.StatusOK, sanitizeUsers(users))
}

func (s *Server) ListUserCredentials(c *gin.Context) {
	userID := parseInt64(c.Param("id"))
	if userID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "User ID is required"})
		return
	}

	user, err := s.repo.GetUserByID(c.Request.Context(), userID)
	if err != nil || user == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}
	if !canManageAdminUser(c, user) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Only administrators can view credentials for admin users"})
		return
	}

	credentials, err := s.repo.GetCredentialsByUserID(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to list credentials"})
		return
	}

	items := make([]credentialResponse, 0, len(credentials))
	for i := range credentials {
		items = append(items, sanitizeCredential(&credentials[i]))
	}

	c.JSON(http.StatusOK, items)
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
	if !canManageAdminUser(c, user) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Only administrators can manage admin users"})
		return
	}
	if req.IsAdmin != nil && !c.GetBool("is_admin") {
		c.JSON(http.StatusForbidden, gin.H{"error": "Only administrators can change admin status"})
		return
	}
	if req.RoleIDs != nil && !canManageRoles(c) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Role assignment requires role management permission"})
		return
	}
	if req.Password != nil && len(*req.Password) < 8 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Password must be at least 8 characters"})
		return
	}
	if req.Status != nil {
		status := strings.TrimSpace(*req.Status)
		if _, ok := allowedUserStatus[status]; !ok {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user status"})
			return
		}
		*req.Status = status
	}
	if req.DisplayName != nil {
		value := strings.TrimSpace(*req.DisplayName)
		*req.DisplayName = value
	}
	if req.Email != nil {
		value := strings.TrimSpace(*req.Email)
		*req.Email = value
	}
	if req.RoleIDs != nil {
		if err := validateRoleIDs(c.Request.Context(), s.repo, req.RoleIDs); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
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

	txRepo, err := s.repo.BeginTx(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to start transaction"})
		return
	}
	defer txRepo.Rollback()

	if err := txRepo.UpdateUser(c.Request.Context(), user); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update user"})
		return
	}
	if req.RoleIDs != nil {
		if err := txRepo.SetUserRoles(c.Request.Context(), user.ID, req.RoleIDs); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update user roles"})
			return
		}
	}
	if err := txRepo.Commit(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to commit user update"})
		return
	}
	updatedUser, _ := s.repo.GetUserByID(c.Request.Context(), user.ID)

	c.JSON(http.StatusOK, gin.H{"message": "User updated successfully", "user": sanitizeUser(updatedUser)})
}

// DeleteUser 删除用户（仅管理员）
func (s *Server) DeleteUser(c *gin.Context) {
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
	user, err := s.repo.GetUserByID(c.Request.Context(), parseInt64(userID))
	if err != nil || user == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}
	if !canManageAdminUser(c, user) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Only administrators can delete admin users"})
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
	if !canManageAdminUser(c, user) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Only administrators can create credentials for admin users"})
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
		if !parsed.After(time.Now()) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "expiresAt must be in the future"})
			return
		}
		expiresAt = &parsed
	}

	credential := &metadata.Credential{
		UserID:      user.ID,
		AccessKey:   accessKey,
		SecretKey:   secretKey,
		Description: strings.TrimSpace(req.Description),
		Status:      "active",
		ExpiresAt:   expiresAt,
	}
	if err := s.repo.CreateCredential(c.Request.Context(), credential); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create credential"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"message": "Credential created successfully", "credential": sanitizeCredential(credential), "secretKey": credential.SecretKey})
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
	user, err := s.repo.GetUserByID(c.Request.Context(), credential.UserID)
	if err != nil || user == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}
	if !canManageAdminUser(c, user) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Only administrators can manage credentials for admin users"})
		return
	}

	var req UpdateCredentialRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.Description != nil {
		credential.Description = strings.TrimSpace(*req.Description)
	}
	if req.Status != nil {
		status := strings.TrimSpace(*req.Status)
		if _, ok := allowedCredentialStatus[status]; !ok {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid credential status"})
			return
		}
		credential.Status = status
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
			if !parsed.After(time.Now()) {
				c.JSON(http.StatusBadRequest, gin.H{"error": "expiresAt must be in the future"})
				return
			}
			credential.ExpiresAt = &parsed
		}
	}

	if err := s.repo.UpdateCredential(c.Request.Context(), credential); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update credential"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Credential updated successfully", "credential": sanitizeCredential(credential)})
}

func (s *Server) DeleteCredential(c *gin.Context) {
	credentialID := parseInt64(c.Param("id"))
	credential, err := s.repo.GetCredentialByID(c.Request.Context(), credentialID)
	if err != nil || credential == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Credential not found"})
		return
	}
	user, err := s.repo.GetUserByID(c.Request.Context(), credential.UserID)
	if err != nil || user == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}
	if !canManageAdminUser(c, user) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Only administrators can delete credentials for admin users"})
		return
	}
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

func isReservedRoutePrefix(path string) bool {
	trimmed := strings.TrimPrefix(path, "/")
	for _, prefix := range []string{"api/", "auth/", "user/", "admin/"} {
		if strings.HasPrefix(trimmed, prefix) {
			return true
		}
	}
	switch trimmed {
	case "api", "auth", "user", "admin", "health":
		return true
	default:
		return false
	}
}

func canManageAdminUser(c *gin.Context, user *metadata.User) bool {
	if user == nil {
		return false
	}
	if !user.IsAdmin {
		return true
	}
	return c.GetBool("is_admin")
}

func canManageRoles(c *gin.Context) bool {
	return c.GetBool("is_admin") || hasPermission(c, PermRoleManage)
}

func canAssignBuckets(c *gin.Context) bool {
	return c.GetBool("is_admin") || hasPermission(c, PermBucketAssign) || hasPermission(c, PermBucketManage)
}

func validateRoleIDs(ctx context.Context, repo metadata.Repository, roleIDs []int64) error {
	seen := make(map[int64]struct{}, len(roleIDs))
	for _, roleID := range roleIDs {
		if roleID <= 0 {
			return fmt.Errorf("invalid role id: %d", roleID)
		}
		if _, ok := seen[roleID]; ok {
			continue
		}
		seen[roleID] = struct{}{}
		role, err := repo.GetRoleByID(ctx, roleID)
		if err != nil {
			return err
		}
		if role == nil {
			return fmt.Errorf("role %d not found", roleID)
		}
	}
	return nil
}

func validateBucketNames(ctx context.Context, repo metadata.Repository, bucketNames []string) ([]*metadata.Bucket, error) {
	buckets := make([]*metadata.Bucket, 0, len(bucketNames))
	seen := make(map[string]struct{}, len(bucketNames))
	for _, bucketName := range bucketNames {
		bucketName = strings.TrimSpace(bucketName)
		if bucketName == "" {
			continue
		}
		if _, ok := seen[bucketName]; ok {
			continue
		}
		seen[bucketName] = struct{}{}
		bucket, err := repo.GetBucketByName(ctx, bucketName)
		if err != nil {
			return nil, err
		}
		if bucket == nil {
			return nil, fmt.Errorf("bucket %s not found", bucketName)
		}
		buckets = append(buckets, bucket)
	}
	return buckets, nil
}
