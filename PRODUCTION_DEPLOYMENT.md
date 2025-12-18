# 1103-OSS 生产环境部署指南

## 🚀 概述

本文档介绍如何将 1103-OSS 部署到生产环境并暴露到公网，包括安全配置、性能优化和监控方案。

## 🔒 安全配置

### 1. HTTPS/TLS 配置

**强烈建议**在生产环境中使用 HTTPS。

#### 使用 Nginx 反向代理

创建 `nginx-production.conf`:

```nginx
# Nginx 配置文件
upstream oss_backend {
    server 127.0.0.1:9000;
    keepalive 32;
}

# HTTP 重定向到 HTTPS
server {
    listen 80;
    server_name oss.yourdomain.com;
    
    location / {
        return 301 https://$server_name$request_uri;
    }
}

# HTTPS 配置
server {
    listen 443 ssl http2;
    server_name oss.yourdomain.com;
    
    # SSL 证书配置
    ssl_certificate /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;
    
    # SSL 安全配置
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384';
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    
    # HSTS (可选但推荐)
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    
    # 上传大小限制
    client_max_body_size 10G;
    client_body_timeout 300s;
    
    # 代理配置
    location / {
        proxy_pass http://oss_backend;
        proxy_http_version 1.1;
        
        # 保持连接
        proxy_set_header Connection "";
        
        # 传递原始请求信息
        proxy_set_header Host $http_host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # 超时设置
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
        
        # 缓冲设置
        proxy_buffering off;
        proxy_request_buffering off;
    }
    
    # 健康检查端点
    location /health {
        proxy_pass http://oss_backend/health;
        access_log off;
    }
}
```

#### 获取免费 SSL 证书（Let's Encrypt）

```bash
# 安装 certbot
sudo apt-get update
sudo apt-get install certbot python3-certbot-nginx

# 自动配置 Nginx + SSL
sudo certbot --nginx -d oss.yourdomain.com

# 自动续期（添加到 crontab）
0 0 * * * certbot renew --quiet
```

### 2. 防火墙配置

```bash
# UFW 防火墙配置
sudo ufw allow 22/tcp      # SSH
sudo ufw allow 80/tcp      # HTTP
sudo ufw allow 443/tcp     # HTTPS
sudo ufw enable

# 确保内部端口（9000）不对外暴露
sudo ufw deny 9000/tcp
```

### 3. 访问控制

#### IP 白名单（可选）

在 `nginx.conf` 中添加：

```nginx
# 仅允许特定 IP 访问
location / {
    allow 203.0.113.0/24;  # 允许的 IP 段
    allow 198.51.100.5;    # 允许的单个 IP
    deny all;              # 拒绝其他所有 IP
    
    proxy_pass http://oss_backend;
}
```

#### Rate Limiting（速率限制）

```nginx
# 在 http 块中定义速率限制
http {
    limit_req_zone $binary_remote_addr zone=oss_limit:10m rate=10r/s;
    
    server {
        location / {
            limit_req zone=oss_limit burst=20 nodelay;
            proxy_pass http://oss_backend;
        }
    }
}
```

### 4. 数据库安全

修改 `deployments/docker-compose.yml`:

```yaml
postgres:
  environment:
    # 使用强密码
    POSTGRES_PASSWORD: ${DB_PASSWORD:-YOUR_STRONG_PASSWORD_HERE}
  # 不要暴露端口到公网
  # ports:
  #   - "5432:5432"  # 注释掉这行
```

创建 `.env` 文件存储敏感信息：

```bash
# .env
DB_PASSWORD=your_very_strong_password_here
REDIS_PASSWORD=your_redis_password_here
```

### 5. 系统加固

```bash
# 修改配置文件权限
chmod 600 configs/config.yaml
chmod 600 .env

# 确保存储目录权限正确
sudo chown -R 1000:1000 /data/oss
sudo chmod 755 /data/oss
```

## 📊 性能优化

### 1. Docker Compose 生产配置

创建 `docker-compose.prod.yml`:

```yaml
version: '3.8'

services:
  postgres:
    restart: always
    shm_size: 256mb
    command:
      - "postgres"
      - "-c"
      - "max_connections=200"
      - "-c"
      - "shared_buffers=256MB"
      - "-c"
      - "effective_cache_size=1GB"
      - "-c"
      - "work_mem=4MB"
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          cpus: '0.5'
          memory: 512M

  redis:
    restart: always
    command: redis-server --maxmemory 512mb --maxmemory-policy allkeys-lru
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 1G

  gooss-api:
    restart: always
    environment:
      - OSS_SERVER_PORT=9000
      - OSS_LOGGING_LEVEL=warn  # 生产环境使用 warn
    deploy:
      resources:
        limits:
          cpus: '4'
          memory: 4G
        reservations:
          cpus: '1'
          memory: 1G

  nginx:
    image: nginx:alpine
    restart: always
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx-production.conf:/etc/nginx/conf.d/default.conf
      - ./ssl:/etc/nginx/ssl:ro
      - nginx_logs:/var/log/nginx
    depends_on:
      - gooss-api
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 1G

volumes:
  nginx_logs:
```

启动生产环境：

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### 2. 系统优化

```bash
# 增加文件描述符限制
echo "* soft nofile 65536" | sudo tee -a /etc/security/limits.conf
echo "* hard nofile 65536" | sudo tee -a /etc/security/limits.conf

# 优化网络参数
sudo sysctl -w net.core.somaxconn=4096
sudo sysctl -w net.ipv4.tcp_max_syn_backlog=4096
sudo sysctl -w net.ipv4.ip_local_port_range="1024 65535"
```

## 📈 监控和日志

### 1. 日志管理

```yaml
# docker-compose.prod.yml 中添加日志配置
services:
  gooss-api:
    logging:
      driver: "json-file"
      options:
        max-size: "100m"
        max-file: "10"
```

### 2. Prometheus + Grafana 监控（可选）

创建 `monitoring/prometheus.yml`:

```yaml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: '1103-oss'
    static_configs:
      - targets: ['gooss-api:9000']
```

添加到 `docker-compose.yml`:

```yaml
  prometheus:
    image: prom/prometheus
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus
    ports:
      - "9090:9090"

  grafana:
    image: grafana/grafana
    ports:
      - "3001:3000"
    volumes:
      - grafana_data:/var/lib/grafana

volumes:
  prometheus_data:
  grafana_data:
```

### 3. 健康检查脚本

创建 `scripts/health_check.sh`:

```bash
#!/bin/bash

# 健康检查脚本
ENDPOINT="https://oss.yourdomain.com/health"

response=$(curl -s -o /dev/null -w "%{http_code}" "$ENDPOINT")

if [ "$response" = "200" ]; then
    echo "✓ Service is healthy"
    exit 0
else
    echo "✗ Service is down (HTTP $response)"
    # 发送告警（可选）
    # 可以集成 Slack/Email/短信通知
    exit 1
fi
```

添加到 crontab:

```bash
# 每 5 分钟检查一次
*/5 * * * * /path/to/health_check.sh >> /var/log/oss_health.log 2>&1
```

## 🔄 备份策略

### 1. 数据库备份

```bash
#!/bin/bash
# scripts/backup_db.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backup/database"
mkdir -p $BACKUP_DIR

# 备份数据库
docker exec 1103-oss-postgres pg_dump -U oss oss | gzip > "$BACKUP_DIR/oss_backup_$DATE.sql.gz"

# 保留最近 7 天的备份
find $BACKUP_DIR -name "oss_backup_*.sql.gz" -mtime +7 -delete

echo "Backup completed: $BACKUP_DIR/oss_backup_$DATE.sql.gz"
```

添加到 crontab（每天凌晨 2 点备份）:

```bash
0 2 * * * /path/to/backup_db.sh
```

### 2. 对象存储备份

```bash
#!/bin/bash
# scripts/backup_storage.sh

DATE=$(date +%Y%m%d)
BACKUP_DIR="/backup/storage"
STORAGE_DIR="/data/oss"

mkdir -p $BACKUP_DIR

# 使用 rsync 增量备份
rsync -avz --delete $STORAGE_DIR/ $BACKUP_DIR/current/

# 创建每周快照
if [ $(date +%u) -eq 7 ]; then
    cp -al $BACKUP_DIR/current $BACKUP_DIR/snapshot_$DATE
fi
```

## 🚨 故障恢复

### 数据库恢复

```bash
# 停止服务
docker compose down

# 恢复数据库
gunzip < /backup/database/oss_backup_20251218_020000.sql.gz | \
  docker exec -i 1103-oss-postgres psql -U oss oss

# 重启服务
docker compose up -d
```

### 完整系统恢复

```bash
# 1. 恢复配置文件
cp /backup/configs/* ./configs/

# 2. 恢复数据库
# (见上方)

# 3. 恢复存储数据
rsync -avz /backup/storage/current/ /data/oss/

# 4. 重启服务
docker compose up -d
```

## 📋 部署检查清单

在正式部署前，请确认以下事项：

### 安全检查
- [ ] 已配置 HTTPS/TLS
- [ ] 使用强密码（数据库、Redis）
- [ ] 防火墙已正确配置
- [ ] 敏感端口未暴露到公网
- [ ] `.env` 文件权限正确（600）
- [ ] 日志级别设置为 `warn` 或 `error`

### 性能检查
- [ ] 资源限制已配置
- [ ] 连接池参数已优化
- [ ] 文件上传大小限制已设置
- [ ] 日志轮转已配置

### 监控检查
- [ ] 健康检查脚本已配置
- [ ] 备份脚本已配置并测试
- [ ] 监控系统已部署（可选）
- [ ] 告警通知已配置（可选）

### 测试检查
- [ ] API 端点可访问
- [ ] SDK 连接测试通过
- [ ] 文件上传/下载测试通过
- [ ] 分片上传测试通过
- [ ] 负载测试通过

## 🌐 DNS 配置

配置域名指向您的服务器：

```
# A 记录
oss.yourdomain.com    A    203.0.113.10

# 或使用 CNAME（如果有负载均衡器）
oss.yourdomain.com    CNAME    lb.yourdomain.com
```

## 📞 故障排查

### 无法访问服务

```bash
# 检查服务状态
docker compose ps

# 查看日志
docker compose logs gooss-api
docker compose logs nginx

# 检查端口监听
sudo netstat -tlnp | grep -E "80|443|9000"

# 测试 Nginx 配置
sudo nginx -t
```

### 性能问题

```bash
# 查看资源使用
docker stats

# 查看慢查询日志
docker exec 1103-oss-postgres psql -U oss -c "SELECT * FROM pg_stat_statements ORDER BY total_time DESC LIMIT 10;"

# 查看连接数
docker exec 1103-oss-postgres psql -U oss -c "SELECT count(*) FROM pg_stat_activity;"
```

## 📚 相关资源

- [API 接入指南](./API_INTEGRATION_GUIDE.md)
- [Docker 部署指南](./DOCKER_GUIDE.md)
- [AWS S3 API 文档](https://docs.aws.amazon.com/s3/)
- [Nginx 文档](https://nginx.org/en/docs/)
- [Let's Encrypt](https://letsencrypt.org/)

## ⚖️ 许可证声明

请确保在生产环境中遵守相关开源协议和法律法规。
