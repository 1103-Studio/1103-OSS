package main

import (
	"bufio"
	"context"
	"flag"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/gooss/server/internal/auth"
	"github.com/gooss/server/internal/metadata"
	"github.com/gooss/server/pkg/config"
)

type tuiApp struct {
	cfg    *config.Config
	repo   metadata.Repository
	reader *bufio.Reader
}

func main() {
	envPath := flag.String("env", "", "path to .env file (default: deployments/.env or .env)")
	flag.Parse()

	cfg, err := config.Load(*envPath)
	if err != nil {
		fmt.Printf("加载配置失败: %v\n", err)
		os.Exit(1)
	}

	repo, err := metadata.NewPostgresRepository(cfg.Database.DSN())
	if err != nil {
		fmt.Printf("连接数据库失败: %v\n", err)
		os.Exit(1)
	}
	defer repo.Close()

	app := &tuiApp{
		cfg:    cfg,
		repo:   repo,
		reader: bufio.NewReader(os.Stdin),
	}

	if err := app.run(); err != nil {
		fmt.Printf("TUI 退出: %v\n", err)
		os.Exit(1)
	}
}

func (a *tuiApp) run() error {
	for {
		a.clear()
		fmt.Println("MaxIO-OSS TUI 管理端")
		fmt.Println("===================")
		fmt.Println("1. 实例概览")
		fmt.Println("2. 用户管理")
		fmt.Println("3. 存储桶管理")
		fmt.Println("4. 审计日志")
		fmt.Println("5. 退出")
		fmt.Println()

		switch a.prompt("选择操作") {
		case "1":
			a.showOverview()
		case "2":
			a.manageUsers()
		case "3":
			a.showBuckets()
		case "4":
			a.showAuditLogs()
		case "5", "q", "quit", "exit":
			return nil
		default:
			a.pause("无效选项")
		}
	}
}

func (a *tuiApp) showOverview() {
	a.clear()
	ctx := context.Background()

	users, err := a.repo.ListUsers(ctx)
	if err != nil {
		a.pause(fmt.Sprintf("读取用户失败: %v", err))
		return
	}

	buckets, err := a.repo.ListAllBuckets(ctx)
	if err != nil {
		a.pause(fmt.Sprintf("读取存储桶失败: %v", err))
		return
	}

	var totalObjects int64
	var totalSize int64
	for _, bucket := range buckets {
		objectCount, size, err := a.repo.GetBucketStats(ctx, bucket.ID)
		if err != nil {
			continue
		}
		totalObjects += objectCount
		totalSize += size
	}

	stats, err := a.repo.GetAuditLogStats(ctx, time.Now().Add(-7*24*time.Hour), time.Now())
	if err != nil {
		stats = map[string]interface{}{}
	}

	fmt.Println("实例概览")
	fmt.Println("========")
	fmt.Printf("API 入口: %s\n", a.cfg.Server.APIEndpoint)
	fmt.Printf("用户数: %d\n", len(users))
	fmt.Printf("存储桶数: %d\n", len(buckets))
	fmt.Printf("对象数: %d\n", totalObjects)
	fmt.Printf("总容量: %s\n", formatBytes(totalSize))
	fmt.Printf("最近 7 天总操作: %v\n", stats["total_operations"])
	fmt.Printf("最近 7 天失败操作: %v\n", stats["failed_operations"])
	fmt.Println()
	a.pause("")
}

func (a *tuiApp) manageUsers() {
	for {
		a.clear()
		ctx := context.Background()
		users, err := a.repo.ListUsers(ctx)
		if err != nil {
			a.pause(fmt.Sprintf("读取用户失败: %v", err))
			return
		}

		fmt.Println("用户管理")
		fmt.Println("========")
		for _, user := range users {
			role := "user"
			if user.IsAdmin {
				role = "admin"
			}
			fmt.Printf("- %-16s status=%-8s role=%s\n", user.Username, user.Status, role)
		}
		fmt.Println()
		fmt.Println("命令:")
		fmt.Println("  new                 创建用户")
		fmt.Println("  toggle <username>   启用/禁用用户")
		fmt.Println("  admin <username>    切换管理员状态")
		fmt.Println("  passwd <username>   重置用户密码")
		fmt.Println("  back                返回")
		fmt.Println()

		command := strings.Fields(a.prompt("输入命令"))
		if len(command) == 0 {
			continue
		}

		switch command[0] {
		case "new":
			a.createUser()
		case "toggle":
			if len(command) < 2 {
				a.pause("缺少用户名")
				continue
			}
			a.toggleUserStatus(command[1])
		case "admin":
			if len(command) < 2 {
				a.pause("缺少用户名")
				continue
			}
			a.toggleUserAdmin(command[1])
		case "passwd":
			if len(command) < 2 {
				a.pause("缺少用户名")
				continue
			}
			a.resetUserPassword(command[1])
		case "back", "b":
			return
		default:
			a.pause("无效命令")
		}
	}
}

func (a *tuiApp) createUser() {
	ctx := context.Background()
	username := a.prompt("用户名")
	password := a.prompt("密码")
	email := a.prompt("邮箱(可留空)")
	isAdmin := strings.EqualFold(a.prompt("是否管理员(y/N)"), "y")

	if username == "" || len(password) < 8 {
		a.pause("用户名不能为空，密码至少 8 位")
		return
	}

	existing, err := a.repo.GetUserByUsername(ctx, username)
	if err != nil {
		a.pause(fmt.Sprintf("查询用户失败: %v", err))
		return
	}
	if existing != nil {
		a.pause("用户名已存在")
		return
	}

	passwordHash, err := auth.HashPassword(password)
	if err != nil {
		a.pause(fmt.Sprintf("密码加密失败: %v", err))
		return
	}

	user := &metadata.User{
		Username:     username,
		PasswordHash: passwordHash,
		Email:        email,
		Status:       "active",
		IsAdmin:      isAdmin,
	}
	if err := a.repo.CreateUser(ctx, user); err != nil {
		a.pause(fmt.Sprintf("创建用户失败: %v", err))
		return
	}

	accessKey, secretKey, err := auth.GenerateCredentials()
	if err != nil {
		a.pause(fmt.Sprintf("生成凭证失败: %v", err))
		return
	}

	if err := a.repo.CreateCredential(ctx, &metadata.Credential{
		UserID:      user.ID,
		AccessKey:   accessKey,
		SecretKey:   secretKey,
		Description: "Created by TUI",
		Status:      "active",
	}); err != nil {
		a.pause(fmt.Sprintf("创建凭证失败: %v", err))
		return
	}

	a.pause(fmt.Sprintf("创建成功\n用户名: %s\n密码: %s\nAccessKey: %s\nSecretKey: %s", username, password, accessKey, secretKey))
}

func (a *tuiApp) toggleUserStatus(username string) {
	ctx := context.Background()
	user, err := a.repo.GetUserByUsername(ctx, username)
	if err != nil || user == nil {
		a.pause("用户不存在")
		return
	}

	if user.Status == "active" {
		user.Status = "disabled"
	} else {
		user.Status = "active"
	}

	if err := a.repo.UpdateUser(ctx, user); err != nil {
		a.pause(fmt.Sprintf("更新用户失败: %v", err))
		return
	}

	a.pause(fmt.Sprintf("用户 %s 状态已切换为 %s", username, user.Status))
}

func (a *tuiApp) toggleUserAdmin(username string) {
	ctx := context.Background()
	user, err := a.repo.GetUserByUsername(ctx, username)
	if err != nil || user == nil {
		a.pause("用户不存在")
		return
	}

	user.IsAdmin = !user.IsAdmin
	if err := a.repo.UpdateUser(ctx, user); err != nil {
		a.pause(fmt.Sprintf("更新用户失败: %v", err))
		return
	}

	a.pause(fmt.Sprintf("用户 %s 管理员状态已切换为 %t", username, user.IsAdmin))
}

func (a *tuiApp) resetUserPassword(username string) {
	ctx := context.Background()
	user, err := a.repo.GetUserByUsername(ctx, username)
	if err != nil || user == nil {
		a.pause("用户不存在")
		return
	}

	password := a.prompt("新密码")
	if len(password) < 8 {
		a.pause("密码至少 8 位")
		return
	}

	passwordHash, err := auth.HashPassword(password)
	if err != nil {
		a.pause(fmt.Sprintf("密码加密失败: %v", err))
		return
	}
	user.PasswordHash = passwordHash

	if err := a.repo.UpdateUser(ctx, user); err != nil {
		a.pause(fmt.Sprintf("更新密码失败: %v", err))
		return
	}

	a.pause(fmt.Sprintf("用户 %s 密码已重置为: %s", username, password))
}

func (a *tuiApp) showBuckets() {
	a.clear()
	ctx := context.Background()
	buckets, err := a.repo.ListAllBuckets(ctx)
	if err != nil {
		a.pause(fmt.Sprintf("读取存储桶失败: %v", err))
		return
	}

	users, _ := a.repo.ListUsers(ctx)
	usernames := make(map[int64]string, len(users))
	for _, user := range users {
		usernames[user.ID] = user.Username
	}

	fmt.Println("存储桶管理")
	fmt.Println("==========")
	for _, bucket := range buckets {
		objectCount, totalSize, _ := a.repo.GetBucketStats(ctx, bucket.ID)
		visibility := "private"
		if policyData, err := a.repo.GetBucketPolicy(ctx, bucket.ID); err == nil && len(policyData) > 0 {
			if policy, err := metadata.ParseBucketPolicy(policyData); err == nil && policy.IsPublicRead() {
				visibility = "public-read"
			}
		}

		fmt.Printf("- %-24s owner=%-12s objects=%-6d size=%-10s acl=%s\n",
			bucket.Name,
			usernames[bucket.OwnerID],
			objectCount,
			formatBytes(totalSize),
			visibility,
		)
	}
	fmt.Println()
	a.pause("")
}

func (a *tuiApp) showAuditLogs() {
	a.clear()
	ctx := context.Background()
	logs, err := a.repo.GetRecentActions(ctx, 20)
	if err != nil {
		a.pause(fmt.Sprintf("读取审计日志失败: %v", err))
		return
	}

	fmt.Println("最近审计日志")
	fmt.Println("============")
	for _, entry := range logs {
		fmt.Printf("- %s %-18s user=%-12s status=%d resource=%s\n",
			entry.CreatedAt.Format("2006-01-02 15:04:05"),
			entry.Action,
			entry.Username,
			entry.StatusCode,
			firstNonEmpty(entry.ResourceName, entry.BucketName, entry.ObjectKey),
		)
	}
	fmt.Println()
	a.pause("")
}

func (a *tuiApp) prompt(label string) string {
	fmt.Printf("%s: ", label)
	input, _ := a.reader.ReadString('\n')
	return strings.TrimSpace(input)
}

func (a *tuiApp) pause(message string) {
	if message != "" {
		fmt.Println()
		fmt.Println(message)
	}
	fmt.Println()
	fmt.Print("回车继续...")
	_, _ = a.reader.ReadString('\n')
}

func (a *tuiApp) clear() {
	fmt.Print("\033[H\033[2J")
}

func formatBytes(bytes int64) string {
	if bytes <= 0 {
		return "0 B"
	}

	units := []string{"B", "KB", "MB", "GB", "TB"}
	size := float64(bytes)
	unit := 0
	for size >= 1024 && unit < len(units)-1 {
		size /= 1024
		unit++
	}

	return fmt.Sprintf("%.2f %s", size, units[unit])
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return value
		}
	}
	return "-"
}
