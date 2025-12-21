package config

import (
	"fmt"
	"strings"

	"github.com/spf13/viper"
)

type Config struct {
	Server   ServerConfig   `mapstructure:"server"`
	Storage  StorageConfig  `mapstructure:"storage"`
	Database DatabaseConfig `mapstructure:"database"`
	Redis    RedisConfig    `mapstructure:"redis"`
	Auth     AuthConfig     `mapstructure:"auth"`
	Logging  LoggingConfig  `mapstructure:"logging"`
	Limits   LimitsConfig   `mapstructure:"limits"`
}

type ServerConfig struct {
	Host           string   `mapstructure:"host"`
	Port           int      `mapstructure:"port"`
	AdminPort      int      `mapstructure:"admin_port"`
	AllowedOrigins []string `mapstructure:"allowed_origins"`
	APIEndpoint    string   `mapstructure:"api_endpoint"`
}

type StorageConfig struct {
	Type        string            `mapstructure:"type"`
	Local       LocalStorage      `mapstructure:"local"`
	Distributed DistributedConfig `mapstructure:"distributed"`
}

type LocalStorage struct {
	BasePath string `mapstructure:"base_path"`
}

type DistributedConfig struct {
	Nodes []string `mapstructure:"nodes"`
}

type DatabaseConfig struct {
	Host         string `mapstructure:"host"`
	Port         int    `mapstructure:"port"`
	User         string `mapstructure:"user"`
	Password     string `mapstructure:"password"`
	DBName       string `mapstructure:"dbname"`
	SSLMode      string `mapstructure:"sslmode"`
	MaxOpenConns int    `mapstructure:"max_open_conns"`
	MaxIdleConns int    `mapstructure:"max_idle_conns"`
}

func (d *DatabaseConfig) DSN() string {
	return fmt.Sprintf("host=%s port=%d user=%s password=%s dbname=%s sslmode=%s",
		d.Host, d.Port, d.User, d.Password, d.DBName, d.SSLMode)
}

type RedisConfig struct {
	Host     string `mapstructure:"host"`
	Port     int    `mapstructure:"port"`
	Password string `mapstructure:"password"`
	DB       int    `mapstructure:"db"`
}

func (r *RedisConfig) Addr() string {
	return fmt.Sprintf("%s:%d", r.Host, r.Port)
}

type AuthConfig struct {
	RootUser         string `mapstructure:"root_user"`
	RootPassword     string `mapstructure:"root_password"`
	TokenExpireHours int    `mapstructure:"token_expire_hours"`
	InitAccessKey    string `mapstructure:"init_access_key"`
	InitAccessSecret string `mapstructure:"init_access_secret"`
}

type LoggingConfig struct {
	Level    string `mapstructure:"level"`
	Format   string `mapstructure:"format"`
	Output   string `mapstructure:"output"`
	FilePath string `mapstructure:"file_path"`
}

type LimitsConfig struct {
	MaxObjectSize      int64 `mapstructure:"max_object_size"`
	MaxPartSize        int64 `mapstructure:"max_part_size"`
	MinPartSize        int64 `mapstructure:"min_part_size"`
	MaxParts           int   `mapstructure:"max_parts"`
	RateLimitPerSecond int   `mapstructure:"rate_limit_per_second"`
}

var globalConfig *Config

func Load(configPath string) (*Config, error) {
	viper.SetConfigFile(configPath)
	viper.SetConfigType("yaml")

	// 环境变量覆盖
	viper.SetEnvPrefix("OSS")
	viper.SetEnvKeyReplacer(strings.NewReplacer(".", "_"))
	viper.AutomaticEnv()

	if err := viper.ReadInConfig(); err != nil {
		return nil, fmt.Errorf("failed to read config: %w", err)
	}

	var cfg Config
	if err := viper.Unmarshal(&cfg); err != nil {
		return nil, fmt.Errorf("failed to unmarshal config: %w", err)
	}

	globalConfig = &cfg
	return &cfg, nil
}

func Get() *Config {
	return globalConfig
}
