# 配置文件说明

## 配置文件位置

**唯一的配置文件**: `deployments/.env`

这个文件同时用于：
1. Docker Compose 容器配置
2. Go 应用程序运行时配置

## 快速开始

### 1. 复制配置模板

```bash
cd deployments
cp .env.example .env
```

### 2. 编辑配置文件

```bash
# 编辑 deployments/.env
nano .env  # 或使用你喜欢的编辑器
```

### 3. 重要配置项

```bash
# 数据库密码
DB_PASSWORD=oss_password

# 管理员账户（首次启动时创建）
ROOT_USER=admin
ROOT_PASSWORD=admin123  # 生产环境请修改为强密码

# 前端 API 地址（生产环境需要设置）
API_URL=http://your-server-ip:9000

# S3 凭证（留空会自动生成）
INIT_ACCESS_KEY=
INIT_ACCESS_SECRET=
```

## 本地开发

```bash
cd deployments

# 启动开发环境（端口：9000, 9001, 3000）
docker compose --profile dev up -d

# 查看日志
docker compose logs -f

# 停止服务
docker compose --profile dev down
```

访问：
- **API**: http://localhost:9000
- **Web 控制台**: http://localhost:3000

## 生产部署

### 服务器端配置

1. **修改配置文件** `deployments/.env`：

```bash
# 管理员密码（必须修改）
ROOT_PASSWORD=your-strong-password

# 前端 API 地址（根据实际域名/IP 设置）
API_URL=http://your-server-ip:9000
# 或
API_URL=http://oss.yourdomain.com:9000

# S3 凭证（首次运行后会自动生成并保存）
INIT_ACCESS_KEY=
INIT_ACCESS_SECRET=
```

2. **使用服务器专用配置启动**：

```bash
cd deployments

# 使用 docker-compose-server.yml（端口：19000, 19001, 3011）
docker compose -f docker-compose-server.yml --profile dev up -d
```

3. **首次启动后检查**：

```bash
# 查看自动生成的 S3 凭证
cat deployments/.env | grep INIT_ACCESS

# 这些凭证会被自动写入 .env 文件，请妥善保管
```

## 配置文件修改后

任何配置修改后都需要重启服务：

```bash
cd deployments

# 本地开发
docker compose --profile dev restart

# 生产环境
docker compose -f docker-compose-server.yml --profile dev restart
```

## 常见问题

### Q: 为什么只有一个配置文件？

**A**: 为了避免配置混乱，我们统一使用 `deployments/.env` 作为唯一的配置文件。它同时被 Docker Compose 和 Go 应用程序读取。

### Q: S3 凭证自动生成后找不到？

**A**: 首次启动后，自动生成的 S3 凭证会保存到 `deployments/.env` 文件中。你可以：

```bash
# 查看凭证
cat deployments/.env | grep INIT_

# 或者登录 Web 控制台后查看
```

### Q: 本地开发和生产环境使用相同的配置文件吗？

**A**: 是的，但通过不同的 docker-compose 文件来区分：

- **本地**: `docker-compose.yml`（端口 9000, 3000）
- **服务器**: `docker-compose-server.yml`（端口 19000, 3011）

配置文件中的 `API_URL` 会根据环境不同而设置不同的值。

### Q: 如何备份配置？

**A**: 只需要备份 `deployments/.env` 文件即可：

```bash
# 备份
cp deployments/.env deployments/.env.backup

# 或上传到安全位置
scp deployments/.env user@backup-server:/backup/
```

**注意**: 不要将 `.env` 文件提交到 Git！它包含敏感信息。

## 安全建议

1. ✅ 修改默认的 `ROOT_PASSWORD`
2. ✅ 妥善保管自动生成的 S3 凭证
3. ✅ 使用强 `DB_PASSWORD`
4. ✅ 定期备份 `deployments/.env` 文件
5. ❌ 不要将 `.env` 文件提交到版本控制系统
6. ❌ 不要在公共场合分享配置文件内容
