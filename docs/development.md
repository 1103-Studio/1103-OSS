# 开发指南

## 推荐：容器化开发

项目提供 Makefile 封装常用命令。

### 启动开发环境

```bash
make dev
```

### 查看日志

```bash
make dev-logs
```

### 进入容器

```bash
make shell-api
make shell-web
make shell-db
```

## 常用命令

```bash
make help
make status
make restart
```

## 本地开发（不使用 Docker）

如果你选择本地运行（需要自行安装 Go/Node/PostgreSQL 等依赖）：

- 后端：`go run cmd/server/main.go`
- 前端：在 `web/` 下 `npm install && npm run dev`

更详细的容器化开发说明请参考仓库根目录的 `DOCKER_GUIDE.md`。
