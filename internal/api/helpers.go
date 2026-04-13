package api

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gooss/server/internal/metadata"
)

type sessionInfo struct {
	Token     string
	UserID    int64
	AccessKey string
	ExpiresAt time.Time
}

const (
	sessionTTL       = 24 * time.Hour
	sessionDBTimeout = 5 * time.Second
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

func canReadBucket(c *gin.Context, repo metadata.Repository, bucket *metadata.Bucket) bool {
	if bucket == nil {
		return false
	}

	userID := c.GetInt64("user_id")
	if userID == 0 {
		return false
	}
	if c.GetBool("is_admin") || bucket.OwnerID == userID || hasPermission(c, PermBucketRead) || hasPermission(c, PermBucketManage) {
		return true
	}

	access, err := repo.GetBucketAccess(c.Request.Context(), bucket.ID, userID)
	if err != nil {
		return false
	}
	return bucketAccessAllows(access, false)
}

func extractBearerToken(authHeader string) string {
	if authHeader == "" {
		return ""
	}
	if !strings.HasPrefix(strings.ToLower(authHeader), "bearer ") {
		return ""
	}
	return strings.TrimSpace(authHeader[7:])
}

func generateSessionToken() (string, error) {
	buf := make([]byte, 32)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(buf), nil
}

func hashSessionToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

func (s *Server) createSession(userID int64, accessKey string) (*sessionInfo, error) {
	token, err := generateSessionToken()
	if err != nil {
		return nil, err
	}

	now := time.Now()
	session := &sessionInfo{
		Token:     token,
		UserID:    userID,
		AccessKey: accessKey,
		ExpiresAt: now.Add(sessionTTL),
	}
	ctx, cancel := context.WithTimeout(context.Background(), sessionDBTimeout)
	defer cancel()
	if err := s.repo.CreateSession(ctx, &metadata.Session{
		TokenHash: hashSessionToken(token),
		UserID:    userID,
		AccessKey: accessKey,
		CreatedAt: now,
		ExpiresAt: session.ExpiresAt,
	}); err != nil {
		return nil, err
	}
	return session, nil
}

func (s *Server) getSession(token string) (*sessionInfo, bool) {
	if token == "" {
		return nil, false
	}

	ctx, cancel := context.WithTimeout(context.Background(), sessionDBTimeout)
	defer cancel()
	session, err := s.repo.GetSession(ctx, hashSessionToken(token))
	if err != nil || session == nil {
		return nil, false
	}

	if time.Now().After(session.ExpiresAt) {
		deleteCtx, deleteCancel := context.WithTimeout(context.Background(), sessionDBTimeout)
		defer deleteCancel()
		_ = s.repo.DeleteSession(deleteCtx, hashSessionToken(token))
		return nil, false
	}

	return &sessionInfo{
		Token:     token,
		UserID:    session.UserID,
		AccessKey: session.AccessKey,
		ExpiresAt: session.ExpiresAt,
	}, true
}

func (s *Server) deleteSession(token string) {
	if token == "" {
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), sessionDBTimeout)
	defer cancel()
	_ = s.repo.DeleteSession(ctx, hashSessionToken(token))
}

func (s *Server) startSessionJanitor() {
	go func() {
		ticker := time.NewTicker(10 * time.Minute)
		defer ticker.Stop()

		for range ticker.C {
			ctx, cancel := context.WithTimeout(context.Background(), sessionDBTimeout)
			_ = s.repo.DeleteExpiredSessions(ctx)
			cancel()
		}
	}()
}
