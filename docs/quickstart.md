# 快速开始

本文档以 **Docker Compose（开发模式）** 为默认推荐方式。

## 前置要求

- Docker 20.10+
- Docker Compose 2.0+

## 开发模式启动（推荐）

1. 准备配置文件

```bash
cp deployments/.env.example deployments/.env
```

2. 启动开发环境（支持热重载）

```bash
make dev
```

3. 访问服务

- Web 控制台: http://localhost:3000
- S3 API Endpoint: http://localhost:9000
- PostgreSQL: localhost:5432

4. 首次登录（请在生产环境务必修改默认密码）

- 用户名: `admin`
- 密码: `admin123`

## 生产模式启动（本机）

```bash
make prod
```

- Web 控制台: http://localhost:9002
- S3 API Endpoint: http://localhost:9000

## 快速验证（AWS CLI）

```bash
# 以实际生成/配置的 AccessKey/SecretKey 为准
export AWS_ACCESS_KEY_ID=YOUR_ACCESS_KEY
export AWS_SECRET_ACCESS_KEY=YOUR_SECRET_KEY

aws --endpoint-url http://localhost:9000 s3 ls
aws --endpoint-url http://localhost:9000 s3 mb s3://test-bucket
aws --endpoint-url http://localhost:9000 s3 cp ./test-upload.txt s3://test-bucket/
aws --endpoint-url http://localhost:9000 s3 ls s3://test-bucket/
```

## 停止服务

```bash
make dev-down
# 或
make prod-down
```
