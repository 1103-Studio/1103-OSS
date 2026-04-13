package api

import (
	"errors"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/gooss/server/internal/metadata"
	"github.com/gooss/server/internal/util"
	"github.com/jackc/pgx/v5/pgconn"
)

type CreateRoleRequest struct {
	Name        string   `json:"name" binding:"required"`
	Description string   `json:"description"`
	Permissions []string `json:"permissions"`
}

func (s *Server) ListRoles(c *gin.Context) {
	roles, err := s.repo.ListRoles(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to list roles"})
		return
	}
	c.JSON(http.StatusOK, roles)
}

func (s *Server) CreateRole(c *gin.Context) {
	var req CreateRoleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	permissions, err := normalizePermissions(req.Permissions)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	name := strings.TrimSpace(req.Name)
	if name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Role name is required"})
		return
	}
	role := &metadata.Role{
		Name:        name,
		Description: strings.TrimSpace(req.Description),
		Permissions: permissions,
	}
	if err := s.repo.CreateRole(c.Request.Context(), role); err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			c.JSON(http.StatusConflict, gin.H{"error": "Role name already exists"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create role"})
		return
	}
	c.JSON(http.StatusCreated, role)
}

func (s *Server) UpdateRole(c *gin.Context) {
	roleID := parseInt64(c.Param("id"))
	role, err := s.repo.GetRoleByID(c.Request.Context(), roleID)
	if err != nil || role == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Role not found"})
		return
	}

	var req CreateRoleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	permissions, err := normalizePermissions(req.Permissions)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	name := strings.TrimSpace(req.Name)
	if name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Role name is required"})
		return
	}
	role.Name = name
	role.Description = strings.TrimSpace(req.Description)
	role.Permissions = permissions
	if err := s.repo.UpdateRole(c.Request.Context(), role); err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			c.JSON(http.StatusConflict, gin.H{"error": "Role name already exists"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update role"})
		return
	}
	c.JSON(http.StatusOK, role)
}

func (s *Server) DeleteRole(c *gin.Context) {
	roleID := parseInt64(c.Param("id"))
	role, err := s.repo.GetRoleByID(c.Request.Context(), roleID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load role"})
		return
	}
	if role == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Role not found"})
		return
	}
	if err := s.repo.DeleteRole(c.Request.Context(), roleID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete role"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Role deleted successfully"})
}

type BucketQuotaRequest struct {
	DefaultExpiry   *string `json:"defaultExpiry"`
	MaxSizeBytes    *int64  `json:"maxSizeBytes"`
	MaxTrafficBytes *int64  `json:"maxTrafficBytes"`
	MaxObjects      *int64  `json:"maxObjects"`
	ACL             *string `json:"acl"`
}

func (s *Server) ListAllBuckets(c *gin.Context) {
	buckets, err := s.repo.ListAllBuckets(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to list buckets"})
		return
	}
	c.JSON(http.StatusOK, buckets)
}

func (s *Server) UpdateBucketAdmin(c *gin.Context) {
	bucketID := parseInt64(c.Param("id"))
	bucket, err := s.repo.GetBucketByID(c.Request.Context(), bucketID)
	if err != nil || bucket == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Bucket not found"})
		return
	}

	var req BucketQuotaRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	canManage := c.GetBool("is_admin") || hasPermission(c, PermBucketManage)
	canManageQuota := canManage || hasPermission(c, PermBucketQuota)
	canManageTraffic := canManage || hasPermission(c, PermBucketTraffic)
	canManagePolicy := canManage || hasPermission(c, PermBucketPolicy)

	if req.DefaultExpiry != nil {
		if !canManageQuota {
			c.JSON(http.StatusForbidden, gin.H{"error": "Permission denied", "required": []string{PermBucketManage, PermBucketQuota}})
			return
		}
		if *req.DefaultExpiry != "" {
			if _, err := util.ParseDuration(*req.DefaultExpiry); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid defaultExpiry"})
				return
			}
		}
		bucket.DefaultExpiry = *req.DefaultExpiry
	}
	if req.ACL != nil {
		if !canManagePolicy {
			c.JSON(http.StatusForbidden, gin.H{"error": "Permission denied", "required": []string{PermBucketManage, PermBucketPolicy}})
			return
		}
		acl := strings.TrimSpace(*req.ACL)
		if acl != "private" && acl != "public-read" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid acl"})
			return
		}
		bucket.ACL = acl
	}
	if req.MaxSizeBytes != nil {
		if !canManageQuota {
			c.JSON(http.StatusForbidden, gin.H{"error": "Permission denied", "required": []string{PermBucketManage, PermBucketQuota}})
			return
		}
		if *req.MaxSizeBytes < 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Quota values cannot be negative"})
			return
		}
		bucket.MaxSizeBytes = *req.MaxSizeBytes
	}
	if req.MaxTrafficBytes != nil {
		if !canManageTraffic {
			c.JSON(http.StatusForbidden, gin.H{"error": "Permission denied", "required": []string{PermBucketManage, PermBucketTraffic}})
			return
		}
		if *req.MaxTrafficBytes < 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Quota values cannot be negative"})
			return
		}
		bucket.MaxTrafficBytes = *req.MaxTrafficBytes
	}
	if req.MaxObjects != nil {
		if !canManageQuota {
			c.JSON(http.StatusForbidden, gin.H{"error": "Permission denied", "required": []string{PermBucketManage, PermBucketQuota}})
			return
		}
		if *req.MaxObjects < 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Quota values cannot be negative"})
			return
		}
		bucket.MaxObjects = *req.MaxObjects
	}
	if req.DefaultExpiry == nil && req.ACL == nil && req.MaxSizeBytes == nil && req.MaxTrafficBytes == nil && req.MaxObjects == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No updatable fields provided"})
		return
	}

	if err := s.repo.UpdateBucket(c.Request.Context(), bucket); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update bucket"})
		return
	}
	c.JSON(http.StatusOK, bucket)
}

type BucketAccessRequest struct {
	UserID     int64  `json:"userId" binding:"required"`
	Permission string `json:"permission" binding:"required"`
}

func (s *Server) ListBucketAccess(c *gin.Context) {
	bucketID := parseInt64(c.Param("id"))
	bucket, err := s.repo.GetBucketByID(c.Request.Context(), bucketID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load bucket"})
		return
	}
	if bucket == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Bucket not found"})
		return
	}
	records, err := s.repo.ListBucketAccess(c.Request.Context(), bucketID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to list bucket access"})
		return
	}
	c.JSON(http.StatusOK, records)
}

func (s *Server) UpsertBucketAccess(c *gin.Context) {
	bucketID := parseInt64(c.Param("id"))
	var req BucketAccessRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if req.Permission != "read" && req.Permission != "write" && req.Permission != "admin" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid bucket permission"})
		return
	}
	bucket, err := s.repo.GetBucketByID(c.Request.Context(), bucketID)
	if err != nil || bucket == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Bucket not found"})
		return
	}
	user, err := s.repo.GetUserByID(c.Request.Context(), req.UserID)
	if err != nil || user == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}
	if bucket.OwnerID == req.UserID {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Bucket owner already has full access"})
		return
	}
	record := &metadata.BucketAccess{
		BucketID:   bucketID,
		UserID:     req.UserID,
		Permission: req.Permission,
	}
	if err := s.repo.UpsertBucketAccess(c.Request.Context(), record); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save bucket access"})
		return
	}
	c.JSON(http.StatusOK, record)
}

func (s *Server) DeleteBucketAccess(c *gin.Context) {
	bucketID := parseInt64(c.Param("id"))
	userID := parseInt64(c.Param("userId"))
	if err := s.repo.DeleteBucketAccess(c.Request.Context(), bucketID, userID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete bucket access"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Bucket access deleted successfully"})
}
