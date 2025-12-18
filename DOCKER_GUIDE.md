# Docker 容器化开发指南

## 架构说明

GoOSS 完全容器化，所有服务都运行在 Docker 容器中：

```
┌─────────────────────────────────────────────────────────┐
│                    Docker Network                        │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  PostgreSQL  │  │    Redis     │  │   GoOSS API  │  │
│  │   :5432      │  │   :6379      │  │   :9000      │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│                                              │           │
│                                              ▼           │
│                                      ┌──────────────┐   │
│                                      │  GoOSS Web   │   │
│                                      │   :3000      │   │
│                                      └──────────────┘   │
└─────────────────────────────────────────────────────────┘
```

## 开发模式 vs 生产模式

### 开发模式 (dev)

- **热重载**: 代码修改后自动重启
- **源码挂载**: 容器内直接使用本地源码
- **调试模式**: 详细的日志输出
- **端口映射**: 所有端口都暴露到宿主机

**启动命令:**
```bash
make dev
```

**特性:**
- Go 代码使用 Air 实现热重载
- React 代码使用 Vite HMR
- 无需重新构建镜像
- 适合快速迭代开发

### 生产模式 (production)

- **优化镜像**: 多阶段构建，体积小
- **静态编译**: 无运行时依赖
- **性能优化**: 生产级配置
- **自动重启**: 容器崩溃自动恢复

**启动命令:**
```bash
make prod
```

**特性:**
- 使用编译后的二进制文件
- 前端使用构建后的静态文件
- 适合部署到生产环境

## 容器说明

### gooss-api-dev (开发模式)

```dockerfile
FROM golang:1.21-alpine
# 安装 Air 热重载工具
# 挂载源码目录
# 自动检测代码变化并重启
```

**卷挂载:**
- `../../:/app` - 源码目录
- `go-cache:/go/pkg/mod` - Go 模块缓存
- `oss-data:/data/oss` - 对象存储数据

### gooss-web-dev (开发模式)

```dockerfile
FROM node:20-alpine
# 运行 npm run dev
# Vite 开发服务器
```

**卷挂载:**
- `../../web:/app` - 前端源码
- `node-modules:/app/node_modules` - npm 依赖缓存

### postgres

PostgreSQL 15 数据库，自动执行初始化脚本。

**卷挂载:**
- `postgres-data:/var/lib/postgresql/data` - 数据持久化
- `../scripts/init.sql:/docker-entrypoint-initdb.d/init.sql` - 初始化脚本

### redis

Redis 7 缓存服务，启用 AOF 持久化。

**卷挂载:**
- `redis-data:/data` - 数据持久化

## 常用操作

### 启动服务

```bash
# 开发模式
make dev

# 生产模式
make prod

# 带网关的生产模式
cd deployments
docker-compose --profile production --profile gateway up -d
```

### 查看日志

```bash
# 开发模式日志
make dev-logs

# 生产模式日志
make prod-logs

# 查看特定服务日志
cd deployments
docker-compose logs -f gooss-api-dev
docker-compose logs -f postgres
```

### 进入容器

```bash
# 进入 API 容器
make shell-api

# 进入数据库
make shell-db

# 进入 Web 容器
make shell-web

# 手动进入
docker exec -it gooss-api-dev sh
```

### 数据库操作

```bash
# 查看数据库
make shell-db

# 在容器内执行 SQL
docker exec -i gooss-postgres psql -U oss -d oss < scripts/init.sql

# 重置数据库
make db-reset
```

### 清理和重建

```bash
# 停止所有服务
make dev-down
make prod-down

# 清理所有容器和卷
make clean

# 重新构建镜像
make build

# 完全重建
make clean
make build
make dev
```

## 调试技巧

### 查看 API 日志

```bash
# 实时日志
make dev-logs

# 查看最近 100 行
docker logs --tail 100 gooss-api-dev

# 查看错误日志
docker logs gooss-api-dev 2>&1 | grep ERROR
```

### 查看管理员凭证

```bash
make credentials

# 或手动查看
docker logs gooss-api-dev 2>&1 | grep "Access Key"
```

### 测试 API

```bash
# 进入 API 容器
make shell-api

# 使用 curl 测试
curl http://localhost:9000/health

# 测试 S3 API
aws --endpoint-url http://localhost:9000 s3 ls
```

### 性能分析

```bash
# 查看容器资源使用
docker stats

# 查看特定容器
docker stats gooss-api-dev

# 查看容器详情
docker inspect gooss-api-dev
```

## 网络配置

所有容器都在 `gooss-network` 网络中，可以通过服务名互相访问：

```yaml
# API 访问数据库
OSS_DATABASE_HOST=postgres

# API 访问 Redis
OSS_REDIS_HOST=redis
```

## 数据持久化

### 卷列表

```bash
# 查看所有卷
docker volume ls | grep deployments

# 查看卷详情
docker volume inspect deployments_postgres-data
docker volume inspect deployments_oss-data
```

### 备份数据

```bash
# 备份数据库
docker exec gooss-postgres pg_dump -U oss oss > backup.sql

# 备份对象存储
docker run --rm -v deployments_oss-data:/data -v $(pwd):/backup alpine tar czf /backup/oss-data.tar.gz -C /data .
```

### 恢复数据

```bash
# 恢复数据库
docker exec -i gooss-postgres psql -U oss oss < backup.sql

# 恢复对象存储
docker run --rm -v deployments_oss-data:/data -v $(pwd):/backup alpine tar xzf /backup/oss-data.tar.gz -C /data
```

## 故障排查

### 容器无法启动

```bash
# 查看容器状态
docker ps -a

# 查看容器日志
docker logs gooss-api-dev

# 检查健康状态
docker inspect --format='{{.State.Health.Status}}' gooss-postgres
```

### 端口冲突

```bash
# 检查端口占用
lsof -i :9000
lsof -i :5432

# 修改端口映射
# 编辑 deployments/docker-compose.yml
ports:
  - "9001:9000"  # 改为其他端口
```

### 数据库连接失败

```bash
# 检查数据库是否就绪
docker exec gooss-postgres pg_isready -U oss

# 查看数据库日志
docker logs gooss-postgres

# 重启数据库
cd deployments
docker-compose restart postgres
```

### 热重载不工作

```bash
# 检查 Air 配置
cat .air.toml

# 查看 Air 日志
docker logs gooss-api-dev | grep air

# 手动重启
make restart
```

## 最佳实践

1. **开发时使用 dev 模式**: 支持热重载，提高开发效率
2. **定期清理**: `make clean` 清理未使用的容器和卷
3. **使用 Makefile**: 简化常用操作
4. **查看日志**: 遇到问题先查看日志
5. **备份数据**: 定期备份重要数据
6. **资源限制**: 生产环境设置资源限制

## 环境变量

在 `deployments/.env` 文件中配置：

```bash
# 数据库密码
DB_PASSWORD=your_secure_password

# 管理员凭证
ROOT_USER=admin
ROOT_PASSWORD=your_secure_password

# 选择模式
COMPOSE_PROFILES=dev  # 或 production
```

## 更多信息

- [Docker Compose 文档](https://docs.docker.com/compose/)
- [Air 热重载工具](https://github.com/cosmtrek/air)
- [Vite 开发服务器](https://vitejs.dev/)
