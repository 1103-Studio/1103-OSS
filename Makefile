.PHONY: help dev dev-logs dev-down prod prod-logs prod-down build clean restart shell-api shell-db shell-web db-migrate db-reset status credentials test test-web

COMPOSE ?= docker compose
DEPLOY_DIR := deployments
WEB_PORT ?= 3001
DEV_COMPOSE := cd $(DEPLOY_DIR) && WEB_PORT=$(WEB_PORT) $(COMPOSE) --profile dev
PROD_COMPOSE := cd $(DEPLOY_DIR) && $(COMPOSE) --profile production

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
	@$(DEV_COMPOSE) up -d

dev-logs:
	@$(DEV_COMPOSE) logs -f

dev-down:
	@$(DEV_COMPOSE) down

prod:
	@$(PROD_COMPOSE) up -d

prod-logs:
	@$(PROD_COMPOSE) logs -f

prod-down:
	@$(PROD_COMPOSE) down

build:
	@$(DEV_COMPOSE) build gooss-api-dev gooss-web-dev
	@$(PROD_COMPOSE) build gooss-api gooss-web nginx

clean:
	cd $(DEPLOY_DIR) && $(COMPOSE) --profile dev --profile production down -v

restart:
	cd $(DEPLOY_DIR) && $(COMPOSE) restart

shell-api:
	@$(DEV_COMPOSE) exec gooss-api-dev sh

shell-db:
	@$(DEV_COMPOSE) exec postgres psql -U oss -d oss

shell-web:
	@$(DEV_COMPOSE) exec gooss-web-dev sh

db-migrate:
	@$(DEV_COMPOSE) exec -T postgres psql -U oss -d oss < scripts/init.sql

db-reset:
	@$(DEV_COMPOSE) stop postgres
	@$(DEV_COMPOSE) rm -f postgres
	@docker volume rm deployments_postgres-data 2>/dev/null || docker volume rm oss_proj_postgres-data 2>/dev/null || true
	@$(DEV_COMPOSE) up -d postgres

status:
	cd $(DEPLOY_DIR) && $(COMPOSE) ps

credentials:
	@$(DEV_COMPOSE) logs gooss-api-dev 2>&1 | grep -A 2 "Access Key" || true

test:
	go test ./...

test-web:
	cd web && npm run build
