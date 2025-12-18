.PHONY: help dev prod build up down logs clean restart shell

# 默认目标
help:
	@echo "1103-OSS 容器化开发命令"
	@echo ""
	@echo "开发模式:"
	@echo "  make dev          - 启动开发环境 (支持热重载)"
	@echo "  make dev-logs     - 查看开发环境日志"
	@echo "  make dev-down     - 停止开发环境"
	@echo ""
	@echo "生产模式:"
	@echo "  make prod         - 启动生产环境"
	@echo "  make prod-logs    - 查看生产环境日志"
	@echo "  make prod-down    - 停止生产环境"
	@echo ""
	@echo "通用命令:"
	@echo "  make build        - 构建所有镜像"
	@echo "  make clean        - 清理所有容器和卷"
	@echo "  make restart      - 重启服务"
	@echo "  make shell-api    - 进入 API 容器"
	@echo "  make shell-db     - 进入数据库容器"
	@echo "  make db-migrate   - 运行数据库迁移"

# 开发模式
dev:
	@echo "🚀 启动开发环境..."
	cd deployments && docker-compose --profile dev up -d
	@echo "✅ 开发环境已启动"
	@echo "📝 API 服务: http://localhost:9000"
	@echo "🌐 Web 控制台: http://localhost:3000"
	@echo "💾 PostgreSQL: localhost:5432"
	@echo ""
	@echo "查看日志: make dev-logs"

dev-logs:
	cd deployments && docker-compose --profile dev logs -f

dev-down:
	@echo "🛑 停止开发环境..."
	cd deployments && docker-compose --profile dev down
	@echo "✅ 开发环境已停止"

# 生产模式
prod:
	@echo "🚀 启动生产环境..."
	cd deployments && docker-compose --profile production up -d
	@echo "✅ 生产环境已启动"
	@echo "📝 API 服务: http://localhost:9000"
	@echo "🌐 Web 控制台: http://localhost:9002"
	@echo ""
	@echo "查看日志: make prod-logs"

prod-logs:
	cd deployments && docker-compose --profile production logs -f

prod-down:
	@echo "🛑 停止生产环境..."
	cd deployments && docker-compose --profile production down
	@echo "✅ 生产环境已停止"

# 构建
build:
	@echo "🔨 构建所有镜像..."
	cd deployments && docker-compose build
	@echo "✅ 镜像构建完成"

# 清理
clean:
	@echo "🧹 清理所有容器和卷..."
	cd deployments && docker-compose --profile dev --profile production down -v
	@echo "✅ 清理完成"

# 重启
restart:
	@echo "🔄 重启服务..."
	cd deployments && docker-compose restart
	@echo "✅ 服务已重启"

# Shell 访问
shell-api:
	@echo "🐚 进入 API 容器..."
	docker exec -it 1103-oss-api-dev sh

shell-db:
	@echo "🐚 进入数据库容器..."
	docker exec -it 1103-oss-postgres psql -U oss -d oss

shell-web:
	@echo "🐚 进入 Web 容器..."
	docker exec -it 1103-oss-web-dev sh

# 数据库操作
db-migrate:
	@echo "📊 运行数据库迁移..."
	docker exec -i 1103-oss-postgres psql -U oss -d oss < scripts/init.sql
	@echo "✅ 数据库迁移完成"

db-reset:
	@echo "⚠️  重置数据库..."
	cd deployments && docker-compose stop postgres
	cd deployments && docker-compose rm -f postgres
	docker volume rm deployments_postgres-data
	cd deployments && docker-compose --profile dev up -d postgres
	@echo "✅ 数据库已重置"

# 查看状态
status:
	@echo "📊 容器状态:"
	cd deployments && docker-compose ps

# 查看凭证
credentials:
	@echo "🔑 查看管理员凭证:"
	docker logs 1103-oss-api-dev 2>&1 | grep -A 2 "Access Key"
