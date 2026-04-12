package api

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/gooss/server/internal/metadata"
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
	role := &metadata.Role{
		Name:        req.Name,
		Description: req.Description,
		Permissions: req.Permissions,
	}
	if err := s.repo.CreateRole(c.Request.Context(), role); err != nil {
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
	role.Name = req.Name
	role.Description = req.Description
	role.Permissions = req.Permissions
	if err := s.repo.UpdateRole(c.Request.Context(), role); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update role"})
		return
	}
	c.JSON(http.StatusOK, role)
}

func (s *Server) DeleteRole(c *gin.Context) {
	roleID := parseInt64(c.Param("id"))
	if err := s.repo.DeleteRole(c.Request.Context(), roleID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete role"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Role deleted successfully"})
}

type BucketQuotaRequest struct {
	DefaultExpiry   string `json:"defaultExpiry"`
	MaxSizeBytes    int64  `json:"maxSizeBytes"`
	MaxTrafficBytes int64  `json:"maxTrafficBytes"`
	MaxObjects      int64  `json:"maxObjects"`
	ACL             string `json:"acl"`
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
	if req.DefaultExpiry != "" {
		bucket.DefaultExpiry = req.DefaultExpiry
	}
	if req.ACL != "" {
		bucket.ACL = req.ACL
	}
	bucket.MaxSizeBytes = req.MaxSizeBytes
	bucket.MaxTrafficBytes = req.MaxTrafficBytes
	bucket.MaxObjects = req.MaxObjects

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
