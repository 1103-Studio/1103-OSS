# 配置说明

## 配置文件位置

项目约定：**唯一的环境变量配置文件** 为 `deployments/.env`。

它会同时影响：

- Docker Compose 容器编排（端口/环境变量等）
- Go 应用程序运行时配置（通过环境变量注入）

## 快速开始

```bash
cp deployments/.env.example deployments/.env
```

## 常用配置项

```bash
# 数据库密码（生产建议修改）
DB_PASSWORD=your_strong_db_password

# 管理员账号（首次启动会创建/初始化）
ROOT_USER=admin
ROOT_PASSWORD=your_strong_admin_password

# 前端 API 地址（生产环境需要按域名/IP 设置）
API_URL=http://your-domain-or-ip:9000

# 初始化 S3 凭证（留空会自动生成并写回 .env）
INIT_ACCESS_KEY=
INIT_ACCESS_SECRET=
```

## configs/config.yaml

仓库中的 `configs/config.yaml` 提供了另一套配置格式（适合非 Docker 场景或本地调试）。

主要字段包括：

- `server.host / server.port`
- `server.allowed_origins`
- `storage.type`（默认 `local`）与 `storage.local.base_path`
- `database.*`
- `logging.*`
- `limits.*`

## 环境变量覆盖（OSS_ 前缀）

运行时可通过环境变量覆盖配置（以代码实现为准），例如：

- `OSS_DATABASE_HOST`
- `OSS_DATABASE_PASSWORD`
- `OSS_STORAGE_LOCAL_BASE_PATH`
- `OSS_AUTH_ROOT_USER`
- `OSS_AUTH_ROOT_PASSWORD`
