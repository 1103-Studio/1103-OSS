package api

import (
	"fmt"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/gooss/server/internal/metadata"
)

const (
	PermUserManage         = "user:manage"
	PermCredentialManage   = "credential:manage"
	PermRoleManage         = "role:manage"
	PermBucketManage       = "bucket:manage"
	PermBucketRead         = "bucket:read"
	PermBucketWrite        = "bucket:write"
	PermBucketAssign       = "bucket:assign"
	PermBucketPolicy       = "bucket:policy"
	PermBucketQuota        = "bucket:quota"
	PermBucketTraffic      = "bucket:traffic"
	PermTicketCreate       = "ticket:create"
	PermTicketRead         = "ticket:read"
	PermTicketManage       = "ticket:manage"
	PermSubscriptionManage = "subscription:manage"
	PermSubscriptionRead   = "subscription:read"
	PermRedemptionManage   = "redemption:manage"
	PermRedemptionUse      = "redemption:use"
)

var allowedPermissionSet = map[string]struct{}{
	PermUserManage:         {},
	PermCredentialManage:   {},
	PermRoleManage:         {},
	PermBucketManage:       {},
	PermBucketRead:         {},
	PermBucketWrite:        {},
	PermBucketAssign:       {},
	PermBucketPolicy:       {},
	PermBucketQuota:        {},
	PermBucketTraffic:      {},
	PermTicketCreate:       {},
	PermTicketRead:         {},
	PermTicketManage:       {},
	PermSubscriptionManage: {},
	PermSubscriptionRead:   {},
	PermRedemptionManage:   {},
	PermRedemptionUse:      {},
}

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

func (s *Server) requireAnyPermission(permissions ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		for _, permission := range permissions {
			if hasPermission(c, permission) {
				c.Next()
				return
			}
		}
		c.JSON(403, gin.H{"error": "Permission denied", "required": permissions})
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
		return true
	case "read":
		return !write
	default:
		return false
	}
}

func normalizePermissions(permissions []string) ([]string, error) {
	normalized := make([]string, 0, len(permissions))
	seen := make(map[string]struct{}, len(permissions))
	for _, permission := range permissions {
		permission = strings.TrimSpace(permission)
		if permission == "" {
			continue
		}
		if _, ok := allowedPermissionSet[permission]; !ok {
			return nil, fmt.Errorf("invalid permission: %s", permission)
		}
		if _, ok := seen[permission]; ok {
			continue
		}
		seen[permission] = struct{}{}
		normalized = append(normalized, permission)
	}
	return normalized, nil
}
