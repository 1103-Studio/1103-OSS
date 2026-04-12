package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"

	"github.com/joho/godotenv"
)

type Config struct {
	Server   ServerConfig
	Storage  StorageConfig
	Database DatabaseConfig
	Redis    RedisConfig
	Auth     AuthConfig
	Logging  LoggingConfig
	Limits   LimitsConfig
}

type ServerConfig struct {
	Host           string
	Port           int
	AdminPort      int
	AllowedOrigins []string
	APIEndpoint    string
}

type StorageConfig struct {
	Type  string
	Local LocalStorage
}

type LocalStorage struct {
	BasePath string
}

type DatabaseConfig struct {
	Host         string
	Port         int
	User         string
	Password     string
	DBName       string
	SSLMode      string
	MaxOpenConns int
	MaxIdleConns int
}

func (d *DatabaseConfig) DSN() string {
	return fmt.Sprintf("host=%s port=%d user=%s password=%s dbname=%s sslmode=%s",
		d.Host, d.Port, d.User, d.Password, d.DBName, d.SSLMode)
}

type RedisConfig struct {
	Host     string
	Port     int
	Password string
	DB       int
}

func (r *RedisConfig) Addr() string {
	return fmt.Sprintf("%s:%d", r.Host, r.Port)
}

type AuthConfig struct {
	RootUser         string
	RootPassword     string
	TokenExpireHours int
	InitAccessKey    string
	InitAccessSecret string
}

type LoggingConfig struct {
	Level    string
	Format   string
	Output   string
	FilePath string
}

type LimitsConfig struct {
	MaxObjectSize      int64
	MaxPartSize        int64
	MinPartSize        int64
	MaxParts           int
	RateLimitPerSecond int
}

var globalConfig *Config

// getEnv 获取环境变量，如果不存在则返回默认值
func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

// getEnvInt 获取整数环境变量
func getEnvInt(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if i, err := strconv.Atoi(value); err == nil {
			return i
		}
	}
	return defaultValue
}

// getEnvInt64 获取 int64 环境变量
func getEnvInt64(key string, defaultValue int64) int64 {
	if value := os.Getenv(key); value != "" {
		if i, err := strconv.ParseInt(value, 10, 64); err == nil {
			return i
		}
	}
	return defaultValue
}

// getEnvSlice 获取字符串切片环境变量（逗号分隔）
func getEnvSlice(key string, defaultValue []string) []string {
	if value := os.Getenv(key); value != "" {
		parts := strings.Split(value, ",")
		var result []string
		for _, p := range parts {
			if trimmed := strings.TrimSpace(p); trimmed != "" {
				result = append(result, trimmed)
			}
		}
		return result
	}
	return defaultValue
}

// Load 从 .env 文件加载配置
func Load(envPath string) (*Config, error) {
	// 尝试加载 .env 文件（如果存在）
	if envPath != "" {
		_ = godotenv.Load(envPath)
	} else {
		// 默认尝试加载多个位置
		_ = godotenv.Load("deployments/.env", ".env")
	}

	cfg := &Config{
		Server: ServerConfig{
			Host:           getEnv("SERVER_HOST", "0.0.0.0"),
			Port:           getEnvInt("SERVER_PORT", 9000),
			AdminPort:      getEnvInt("SERVER_ADMIN_PORT", 9001),
			AllowedOrigins: getEnvSlice("ALLOWED_ORIGINS", []string{"*"}),
			APIEndpoint:    getEnv("API_ENDPOINT", ""),
		},
		Storage: StorageConfig{
			Type: getEnv("STORAGE_TYPE", "local"),
			Local: LocalStorage{
				BasePath: getEnv("STORAGE_PATH", "/data/oss"),
			},
		},
		Database: DatabaseConfig{
			Host:         getEnv("DB_HOST", "localhost"),
			Port:         getEnvInt("DB_PORT", 5432),
			User:         getEnv("DB_USER", "oss"),
			Password:     getEnv("DB_PASSWORD", "oss_password"),
			DBName:       getEnv("DB_NAME", "oss"),
			SSLMode:      getEnv("DB_SSLMODE", "disable"),
			MaxOpenConns: getEnvInt("DB_MAX_OPEN_CONNS", 25),
			MaxIdleConns: getEnvInt("DB_MAX_IDLE_CONNS", 5),
		},
		Redis: RedisConfig{
			Host:     getEnv("REDIS_HOST", "localhost"),
			Port:     getEnvInt("REDIS_PORT", 6379),
			Password: getEnv("REDIS_PASSWORD", ""),
			DB:       getEnvInt("REDIS_DB", 0),
		},
		Auth: AuthConfig{
			RootUser:         getEnv("ROOT_USER", "admin"),
			RootPassword:     getEnv("ROOT_PASSWORD", "admin123"),
			TokenExpireHours: getEnvInt("TOKEN_EXPIRE_HOURS", 24),
			InitAccessKey:    getEnv("INIT_ACCESS_KEY", ""),
			InitAccessSecret: getEnv("INIT_ACCESS_SECRET", ""),
		},
		Logging: LoggingConfig{
			Level:    getEnv("LOG_LEVEL", "info"),
			Format:   getEnv("LOG_FORMAT", "json"),
			Output:   getEnv("LOG_OUTPUT", "stdout"),
			FilePath: getEnv("LOG_FILE_PATH", "/var/log/oss/server.log"),
		},
		Limits: LimitsConfig{
			MaxObjectSize:      getEnvInt64("MAX_OBJECT_SIZE", 5368709120),
			MaxPartSize:        getEnvInt64("MAX_PART_SIZE", 104857600),
			MinPartSize:        getEnvInt64("MIN_PART_SIZE", 5242880),
			MaxParts:           getEnvInt("MAX_PARTS", 10000),
			RateLimitPerSecond: getEnvInt("RATE_LIMIT_PER_SECOND", 1000),
		},
	}

	// 如果 API_ENDPOINT 未设置，自动生成
	if cfg.Server.APIEndpoint == "" {
		cfg.Server.APIEndpoint = fmt.Sprintf("http://localhost:%d", cfg.Server.Port)
	}

	globalConfig = cfg
	return cfg, nil
}

func Get() *Config {
	return globalConfig
}
