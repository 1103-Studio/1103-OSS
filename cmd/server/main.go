package main

import (
	"context"
	"flag"
	"fmt"
	"os"
	"os/signal"
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
		// 生成凭证
		accessKey, secretKey, err := auth.GenerateCredentials()
		if err != nil {
			return err
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

		logger.Infof("Generated admin credentials:")
		logger.Infof("  Access Key: %s", accessKey)
		logger.Infof("  Secret Key: %s", secretKey)
		logger.Infof("Please save these credentials securely!")
	}

	return nil
}
