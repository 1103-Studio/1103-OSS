package api

import (
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/gooss/server/internal/metadata"
)

const (
	PermUserManage       = "user:manage"
	PermCredentialManage = "credential:manage"
	PermRoleManage       = "role:manage"
	PermBucketManage     = "bucket:manage"
	PermBucketRead       = "bucket:read"
	PermBucketWrite      = "bucket:write"
	PermBucketAssign     = "bucket:assign"
	PermBucketPolicy     = "bucket:policy"
	PermBucketQuota      = "bucket:quota"
	PermBucketTraffic    = "bucket:traffic"
	PermTicketCreate     = "ticket:create"
	PermTicketRead       = "ticket:read"
	PermTicketManage     = "ticket:manage"
)

func hasPermission(c *gin.Context, permission string) bool {
	if c.GetBool("is_admin") {
		return true
	}

	raw, exists := c.Get("permissions")
	if !exists {
		return false
	}

	permissions, ok := raw.([]string)
	if !ok {
		return false
	}

	for _, granted := range permissions {
		if granted == "*" || granted == permission {
			return true
		}
		if strings.HasSuffix(granted, ":*") {
			prefix := strings.TrimSuffix(granted, "*")
			if strings.HasPrefix(permission, prefix) {
				return true
			}
		}
	}
	return false
}

func (s *Server) requirePermission(permission string) gin.HandlerFunc {
	return func(c *gin.Context) {
		if hasPermission(c, permission) {
			c.Next()
			return
		}
		c.JSON(403, gin.H{"error": "Permission denied", "required": permission})
		c.Abort()
	}
}

func bucketAccessAllows(access *metadata.BucketAccess, write bool) bool {
	if access == nil {
		return false
	}
	switch access.Permission {
	case "admin":
		return true
	case "write":
		return write || !write
	case "read":
		return !write
	default:
		return false
	}
}
