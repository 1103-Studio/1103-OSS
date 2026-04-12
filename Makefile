.PHONY: help dev dev-logs dev-down prod prod-logs prod-down build clean restart shell-api shell-db shell-web db-migrate db-reset status credentials test test-web

COMPOSE ?= docker compose
DEPLOY_DIR := deployments
WEB_PORT ?= 3001

help:
	@echo "1103-OSS 常用命令"
	@echo ""
	@echo "开发:"
	@echo "  make dev           启动开发环境"
	@echo "  make dev-logs      查看开发日志"
	@echo "  make dev-down      停止开发环境"
	@echo ""
	@echo "生产:"
	@echo "  make prod          启动生产环境"
	@echo "  make prod-logs     查看生产日志"
	@echo "  make prod-down     停止生产环境"
	@echo ""
	@echo "本地:"
	@echo "  make test          运行 Go 测试"
	@echo "  make test-web      构建 Web"
	@echo "  make build         构建镜像"
	@echo "  make status        查看容器状态"

dev:
	cd $(DEPLOY_DIR) && WEB_PORT=$(WEB_PORT) $(COMPOSE) --profile dev up -d

dev-logs:
	cd $(DEPLOY_DIR) && WEB_PORT=$(WEB_PORT) $(COMPOSE) --profile dev logs -f

dev-down:
	cd $(DEPLOY_DIR) && WEB_PORT=$(WEB_PORT) $(COMPOSE) --profile dev down

prod:
	cd $(DEPLOY_DIR) && $(COMPOSE) --profile production up -d

prod-logs:
	cd $(DEPLOY_DIR) && $(COMPOSE) --profile production logs -f

prod-down:
	cd $(DEPLOY_DIR) && $(COMPOSE) --profile production down

build:
	cd $(DEPLOY_DIR) && $(COMPOSE) build

clean:
	cd $(DEPLOY_DIR) && $(COMPOSE) --profile dev --profile production down -v

restart:
	cd $(DEPLOY_DIR) && $(COMPOSE) restart

shell-api:
	docker exec -it 1103-oss-api-dev sh

shell-db:
	docker exec -it 1103-oss-postgres psql -U oss -d oss

shell-web:
	docker exec -it 1103-oss-web-dev sh

db-migrate:
	docker exec -i 1103-oss-postgres psql -U oss -d oss < scripts/init.sql

db-reset:
	cd $(DEPLOY_DIR) && $(COMPOSE) stop postgres
	cd $(DEPLOY_DIR) && $(COMPOSE) rm -f postgres
	docker volume rm deployments_postgres-data || true
	cd $(DEPLOY_DIR) && $(COMPOSE) --profile dev up -d postgres

status:
	cd $(DEPLOY_DIR) && $(COMPOSE) ps

credentials:
	docker logs 1103-oss-api-dev 2>&1 | grep -A 2 "Access Key" || true

test:
	go test ./...

test-web:
	cd web && npm run build
