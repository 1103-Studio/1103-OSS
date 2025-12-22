# Docker Compose（开发/生产）

项目默认提供 Docker Compose 编排文件：

- `deployments/docker-compose.yml`
- `deployments/docker-compose-server.yml`（用于服务器/自定义端口的示例）

## 唯一配置文件：deployments/.env

项目约定 **唯一的配置文件** 为：`deployments/.env`。

你可以从模板复制：

```bash
cp deployments/.env.example deployments/.env
```

### 必须关注的配置项（示例）

```bash
DB_PASSWORD=your_strong_db_password
ROOT_USER=admin
ROOT_PASSWORD=your_strong_admin_password

# 生产环境前端需要知道 API 地址（按实际域名/IP 设置）
API_URL=http://your-domain-or-ip:9000

# 可选：初始化 S3 凭证（留空会自动生成）
INIT_ACCESS_KEY=
INIT_ACCESS_SECRET=
```

## 开发模式（dev profile）

```bash
make dev
```

等价于：

```bash
cd deployments
docker compose --profile dev up -d
```

默认端口：

- API: `9000`
- API Debug: `9001`
- Web: `3000`

## 生产模式（production profile）

```bash
make prod
```

等价于：

```bash
cd deployments
docker compose --profile production up -d
```

默认端口：

- API: `9000`
- Web: `9002`

## 服务器部署示例（docker-compose-server.yml）

如果你需要在服务器上以不同端口提供服务，可以参考：

```bash
cd deployments
docker compose -f docker-compose-server.yml --profile dev up -d
```

请根据你的域名/反向代理/防火墙策略调整端口映射与 `API_URL`。
