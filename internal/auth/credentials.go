package auth

import (
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"strings"

	"golang.org/x/crypto/bcrypt"
)

const (
	AccessKeyLength = 20
	SecretKeyLength = 40
)

// GenerateAccessKey 生成 Access Key
func GenerateAccessKey() (string, error) {
	bytes := make([]byte, 15)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	// 格式: AKIA + base64 编码 (类似 AWS 格式)
	encoded := base64.StdEncoding.EncodeToString(bytes)
	encoded = strings.ReplaceAll(encoded, "+", "")
	encoded = strings.ReplaceAll(encoded, "/", "")
	encoded = strings.ReplaceAll(encoded, "=", "")
	if len(encoded) > 16 {
		encoded = encoded[:16]
	}
	return "AKIA" + strings.ToUpper(encoded), nil
}

// GenerateSecretKey 生成 Secret Key
func GenerateSecretKey() (string, error) {
	bytes := make([]byte, 30)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	encoded := base64.StdEncoding.EncodeToString(bytes)
	encoded = strings.ReplaceAll(encoded, "+", "")
	encoded = strings.ReplaceAll(encoded, "/", "")
	encoded = strings.ReplaceAll(encoded, "=", "")
	if len(encoded) > SecretKeyLength {
		encoded = encoded[:SecretKeyLength]
	}
	return encoded, nil
}

// GenerateCredentials 生成一对凭证
func GenerateCredentials() (accessKey, secretKey string, err error) {
	accessKey, err = GenerateAccessKey()
	if err != nil {
		return "", "", fmt.Errorf("failed to generate access key: %w", err)
	}

	secretKey, err = GenerateSecretKey()
	if err != nil {
		return "", "", fmt.Errorf("failed to generate secret key: %w", err)
	}

	return accessKey, secretKey, nil
}

// HashPassword 密码哈希
func HashPassword(password string) (string, error) {
	bytes, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	return string(bytes), err
}

// CheckPassword 验证密码
func CheckPassword(password, hash string) bool {
	err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(password))
	return err == nil
}

// ValidateBucketName 验证 Bucket 名称
func ValidateBucketName(name string) error {
	if len(name) < 3 || len(name) > 63 {
		return fmt.Errorf("bucket name must be between 3 and 63 characters")
	}

	// 必须以字母或数字开头和结尾
	if !isAlphanumeric(name[0]) || !isAlphanumeric(name[len(name)-1]) {
		return fmt.Errorf("bucket name must start and end with a letter or number")
	}

	// 只能包含小写字母、数字和连字符
	for _, c := range name {
		if !isAlphanumeric(byte(c)) && c != '-' {
			return fmt.Errorf("bucket name can only contain lowercase letters, numbers, and hyphens")
		}
	}

	// 不能包含连续的连字符
	if strings.Contains(name, "--") {
		return fmt.Errorf("bucket name cannot contain consecutive hyphens")
	}

	// 不能是 IP 地址格式
	if isIPAddress(name) {
		return fmt.Errorf("bucket name cannot be formatted as an IP address")
	}

	return nil
}

func isAlphanumeric(c byte) bool {
	return (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9')
}

func isIPAddress(s string) bool {
	parts := strings.Split(s, ".")
	if len(parts) != 4 {
		return false
	}
	for _, part := range parts {
		if len(part) == 0 || len(part) > 3 {
			return false
		}
		for _, c := range part {
			if c < '0' || c > '9' {
				return false
			}
		}
	}
	return true
}

// ValidateObjectKey 验证对象 Key
func ValidateObjectKey(key string) error {
	if len(key) == 0 {
		return fmt.Errorf("object key cannot be empty")
	}
	if len(key) > 1024 {
		return fmt.Errorf("object key cannot exceed 1024 characters")
	}
	return nil
}
