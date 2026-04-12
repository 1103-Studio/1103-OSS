package api

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

func normalizeRequestPath(path string) string {
	if path == "/api" {
		return "/"
	}
	if strings.HasPrefix(path, "/api/") {
		return strings.TrimPrefix(path, "/api")
	}
	return path
}

func (s *Server) adminMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		if !c.GetBool("is_admin") {
			c.JSON(http.StatusForbidden, gin.H{"error": "Only administrators can access this resource"})
			c.Abort()
			return
		}

		c.Next()
	}
}
