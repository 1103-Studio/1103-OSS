package main

import (
	"bufio"
	"context"
	"flag"
	"fmt"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/gooss/server/internal/api"
	"github.com/gooss/server/internal/auth"
	"github.com/gooss/server/internal/metadata"
	"github.com/gooss/server/internal/storage/local"
	"github.com/gooss/server/pkg/config"
	"github.com/gooss/server/pkg/logger"
)

func main() {
	configPath := flag.String("config", "configs/config.yaml", "config file path")
	flag.Parse()

	// 加载配置
	cfg, err := config.Load(*configPath)
	if err != nil {
		fmt.Printf("Failed to load config: %v\n", err)
		os.Exit(1)
	}

	// 初始化日志
	if err := logger.Init(cfg.Logging.Level, cfg.Logging.Format, cfg.Logging.Output, cfg.Logging.FilePath); err != nil {
		fmt.Printf("Failed to init logger: %v\n", err)
		os.Exit(1)
	}
	defer logger.Sync()

	logger.Info("Starting 1103-OSS Server...")

	// 初始化数据库
	repo, err := metadata.NewPostgresRepository(cfg.Database.DSN())
	if err != nil {
		logger.Errorf("Failed to connect to database: %v", err)
		os.Exit(1)
	}
	defer repo.Close()
	logger.Infof("Connected to database")

	// 初始化存储引擎
	var storageEngine *local.LocalStorage
	if cfg.Storage.Type == "local" {
		storageEngine, err = local.New(cfg.Storage.Local.BasePath)
		if err != nil {
			logger.Errorf("Failed to init storage: %v", err)
			os.Exit(1)
		}
		logger.Infof("Initialized local storage at %s", cfg.Storage.Local.BasePath)
	} else {
		logger.Errorf("Unsupported storage type: %s", cfg.Storage.Type)
		os.Exit(1)
	}

	// 初始化管理员用户和凭证
	if err := initAdminUser(repo, cfg); err != nil {
		logger.Errorf("Failed to init admin user: %v", err)
		os.Exit(1)
	}

	// 创建 API 服务器
	server := api.NewServer(cfg, storageEngine, repo)

	// 启动服务器
	addr := fmt.Sprintf("%s:%d", cfg.Server.Host, cfg.Server.Port)
	logger.Infof("Server listening on %s", addr)

	// 优雅关闭
	go func() {
		if err := server.Run(addr); err != nil {
			logger.Errorf("Server error: %v", err)
		}
	}()

	// 等待中断信号
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	logger.Infof("Shutting down server...")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_ = ctx

	logger.Infof("Server stopped")
}

func initAdminUser(repo metadata.Repository, cfg *config.Config) error {
	ctx := context.Background()

	// 检查管理员用户是否存在
	user, err := repo.GetUserByUsername(ctx, cfg.Auth.RootUser)
	if err != nil {
		return err
	}

	if user == nil {
		// 创建管理员用户
		passwordHash, err := auth.HashPassword(cfg.Auth.RootPassword)
		if err != nil {
			return err
		}

		user = &metadata.User{
			Username:     cfg.Auth.RootUser,
			PasswordHash: passwordHash,
			Status:       "active",
			IsAdmin:      true,
		}
		if err := repo.CreateUser(ctx, user); err != nil {
			return err
		}
		logger.Infof("Created admin user: %s", user.Username)
	}

	// 为管理员生成初始凭证
	credentials, err := repo.GetCredentialsByUserID(ctx, user.ID)
	if err != nil {
		return err
	}

	if len(credentials) == 0 {
		var accessKey, secretKey string
		var err error

		// 检查环境变量中是否已设置初始凭证
		if cfg.Auth.InitAccessKey != "" && cfg.Auth.InitAccessSecret != "" {
			accessKey = cfg.Auth.InitAccessKey
			secretKey = cfg.Auth.InitAccessSecret
			logger.Infof("Using initial credentials from environment variables")
		} else {
			// 生成新凭证
			accessKey, secretKey, err = auth.GenerateCredentials()
			if err != nil {
				return err
			}
			logger.Infof("Generated new admin credentials")

			// 将生成的凭证写入 .env 文件
			if err := saveCredentialsToEnv(accessKey, secretKey); err != nil {
				logger.Warnf("Failed to save credentials to .env file: %v", err)
			}
		}

		cred := &metadata.Credential{
			UserID:      user.ID,
			AccessKey:   accessKey,
			SecretKey:   secretKey,
			Description: "Default admin credentials",
			Status:      "active",
		}
		if err := repo.CreateCredential(ctx, cred); err != nil {
			return err
		}

		logger.Infof("Admin credentials:")
		logger.Infof("  Access Key: %s", accessKey)
		logger.Infof("  Secret Key: %s", secretKey)
		logger.Infof("Please save these credentials securely!")
	}

	return nil
}

// saveCredentialsToEnv 将生成的凭证保存到 .env 文件
func saveCredentialsToEnv(accessKey, secretKey string) error {
	envPath := ".env"

	// 检查 .env 文件是否存在
	if _, err := os.Stat(envPath); os.IsNotExist(err) {
		// 如果不存在，从 .env.example 复制
		if _, err := os.Stat(".env.example"); err == nil {
			content, err := os.ReadFile(".env.example")
			if err != nil {
				return fmt.Errorf("failed to read .env.example: %w", err)
			}
			if err := os.WriteFile(envPath, content, 0644); err != nil {
				return fmt.Errorf("failed to create .env from template: %w", err)
			}
		} else {
			// 创建新的 .env 文件
			if err := os.WriteFile(envPath, []byte(""), 0644); err != nil {
				return fmt.Errorf("failed to create .env: %w", err)
			}
		}
	}

	// 读取现有的 .env 文件
	file, err := os.Open(envPath)
	if err != nil {
		return fmt.Errorf("failed to open .env: %w", err)
	}
	defer file.Close()

	var lines []string
	scanner := bufio.NewScanner(file)
	foundAccessKey := false
	foundSecretKey := false

	for scanner.Scan() {
		line := scanner.Text()
		trimmed := strings.TrimSpace(line)

		// 检查是否是 INIT_ACCESS_KEY 行
		if strings.HasPrefix(trimmed, "INIT_ACCESS_KEY=") {
			lines = append(lines, fmt.Sprintf("INIT_ACCESS_KEY=%s", accessKey))
			foundAccessKey = true
		} else if strings.HasPrefix(trimmed, "INIT_ACCESS_SECRET=") {
			lines = append(lines, fmt.Sprintf("INIT_ACCESS_SECRET=%s", secretKey))
			foundSecretKey = true
		} else {
			lines = append(lines, line)
		}
	}

	if err := scanner.Err(); err != nil {
		return fmt.Errorf("failed to read .env: %w", err)
	}

	// 如果没有找到配置项，追加到文件末尾
	if !foundAccessKey || !foundSecretKey {
		if len(lines) > 0 && lines[len(lines)-1] != "" {
			lines = append(lines, "")
		}
		if !foundAccessKey {
			lines = append(lines, fmt.Sprintf("INIT_ACCESS_KEY=%s", accessKey))
		}
		if !foundSecretKey {
			lines = append(lines, fmt.Sprintf("INIT_ACCESS_SECRET=%s", secretKey))
		}
	}

	// 写回文件
	content := strings.Join(lines, "\n") + "\n"
	if err := os.WriteFile(envPath, []byte(content), 0644); err != nil {
		return fmt.Errorf("failed to write .env: %w", err)
	}

	logger.Infof("Credentials saved to .env file")
	return nil
}
