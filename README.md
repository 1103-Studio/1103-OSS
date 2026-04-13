# MaxIO-OSS

<div align="center">

**高性能、S3 兼容的对象存储系统**

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Go Version](https://img.shields.io/badge/Go-1.21+-00ADD8?logo=go)](https://go.dev/)
[![React](https://img.shields.io/badge/React-18.2-61DAFB?logo=react)](https://react.dev/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker)](https://www.docker.com/)

[English](README.md) | [中文文档](README_CN.md)

</div>

## 📖 目录

- [项目简介](#项目简介)
- [核心特性](#核心特性)
- [技术栈](#技术栈)
- [系统架构](#系统架构)
- [快速开始](#快速开始)
- [部署指南](#部署指南)
- [API 文档](#api-文档)
- [SDK 使用示例](#sdk-使用示例)
- [配置说明](#配置说明)
- [项目结构](#项目结构)
- [开发指南](#开发指南)
- [路线图](#路线图)
- [贡献指南](#贡献指南)
- [许可证](#许可证)

## 项目简介

MaxIO-OSS 是一个**生产就绪**的对象存储系统，完全兼容 AWS S3 API。采用 Go 语言编写后端，React 构建现代化管理界面，支持 Docker 一键部署。

适用场景：
- 🖼️ 图片/视频存储与 CDN
- 📦 应用静态资源托管
- 💾 备份与归档存储
- 🔄 数据湖构建
- 🏢 私有云存储方案

## 核心特性

### 🚀 高性能
- **Go 并发模型**：利用 goroutine 实现高并发处理
- **零拷贝传输**：使用流式 I/O，内存占用低
- **连接池管理**：PostgreSQL 连接池，数据库性能优化
- **分片上传**：支持大文件分片上传，断点续传

### 🔒 安全可靠
- **AWS Signature V4**：完整实现 AWS 签名验证机制
- **访问控制**：支持 Bucket 级别的 ACL 控制
- **审计日志**：完整记录所有操作，便于追溯
- **密码加密**：bcrypt 加密存储用户密码

### 🔌 完全兼容 S3
- **标准 API**：支持 AWS SDK、CLI 和第三方工具
- **分片上传**：完整实现 Multipart Upload 协议
- **预签名 URL**：支持临时访问链接生成
- **Range 请求**：支持断点续传和分段下载

### 🎨 现代化界面
- **响应式设计**：支持桌面端和移动端
- **企业控制台 UI**：统一采用 Ant Design 组件体系
- **移动端适配**：抽屉导航、表格横滑、表单重排
- **实时更新**：React Query 实现数据自动刷新

### 🐳 云原生
- **容器化部署**：Docker Compose 一键启动
- **开发环境隔离**：支持热重载的开发模式
- **健康检查**：内置容器健康检查机制
- **日志管理**：结构化日志，易于集成监控系统

## 技术栈

### 后端 (Backend)

| 技术 | 版本 | 用途 |
|------|------|------|
| **Go** | 1.21+ | 核心语言，高性能并发处理 |
| **Gin** | 1.9+ | HTTP 框架，路由与中间件 |
| **PostgreSQL** | 16 | 元数据存储，事务支持 |
| **pgx** | v5 | PostgreSQL 驱动，高性能连接池 |
| **Viper** | 1.17+ | 配置管理，支持多格式配置文件 |
| **Zap** | 1.26+ | 结构化日志，高性能日志库 |
| **bcrypt** | - | 密码加密，安全哈希算法 |

### 前端 (Frontend)

| 技术 | 版本 | 用途 |
|------|------|------|
| **React** | 18.2 | UI 框架，组件化开发 |
| **TypeScript** | 5.2+ | 类型安全，代码质量保证 |
| **Vite** | 5.0+ | 构建工具，快速热重载 |
| **React Router** | 6.20+ | 路由管理，SPA 导航 |
| **Ant Design** | 5.27+ | 企业级控制台组件库 |
| **TanStack Query** | 5.8+ | 数据获取与缓存管理 |
| **Axios** | 1.6+ | HTTP 客户端，API 请求 |

### 基础设施 (Infrastructure)

| 技术 | 版本 | 用途 |
|------|------|------|
| **Docker** | 20.10+ | 容器化运行环境 |
| **Docker Compose** | 2.0+ | 多容器编排 |
| **Nginx** | 1.25 | 前端静态文件服务 |
| **Air** | - | Go 热重载工具 |
| **Redis** | 7 | 缓存与会话存储（规划中） |

## 系统架构

```
┌─────────────────────────────────────────────────────────────┐
│                        Client Layer                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │  AWS CLI │  │  AWS SDK │  │ S3 Tools │  │   Web UI │    │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      API Gateway (Gin)                       │
│  ┌────────────────────────────────────────────────────┐     │
│  │  Middleware: Auth │ CORS │ Logging │ Recovery      │     │
│  └────────────────────────────────────────────────────┘     │
│                              │                               │
│       ┌──────────────────────┼──────────────────────┐       │
│       ▼                      ▼                      ▼       │
│  ┌─────────┐          ┌──────────┐          ┌──────────┐   │
│  │ S3 API  │          │ Auth API │          │Admin API │   │
│  │ Handler │          │ Handler  │          │ Handler  │   │
│  └─────────┘          └──────────┘          └──────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Business Layer                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Storage    │  │   Metadata   │  │     Auth     │      │
│  │   Engine     │  │  Repository  │  │   Service    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                              │
                ┌─────────────┼─────────────┐
                ▼                           ▼
┌────────────────────────────┐  ┌───────────────────────────┐
│   Storage Layer (Local)    │  │  Database (PostgreSQL)    │
│  ┌──────────────────────┐  │  │  ┌────────────────────┐  │
│  │  File System         │  │  │  │  users             │  │
│  │  /data/oss/          │  │  │  │  buckets           │  │
│  │   ├── bucket-1/      │  │  │  │  objects           │  │
│  │   │   └── file.jpg   │  │  │  │  credentials       │  │
│  │   └── bucket-2/      │  │  │  │  audit_logs        │  │
│  └──────────────────────┘  │  │  └────────────────────┘  │
└────────────────────────────┘  └───────────────────────────┘
```

### 数据流

**上传对象 (PUT Object)**
```
Client → Auth Middleware → S3 Handler → Storage Engine → File System
                              ↓
                      Metadata Repository → PostgreSQL
```

**下载对象 (GET Object)**
```
Client → Auth Middleware → S3 Handler → Metadata Repository → PostgreSQL
                              ↓
                      Storage Engine → File System → Client
```

## 快速开始

### 前置要求

- Docker 20.10+
- Docker Compose 2.0+
- 8GB+ 可用内存
- 20GB+ 可用磁盘空间

### 开发模式（推荐）

开发模式支持代码热重载，修改代码后自动重启服务。

```bash
# 1. 克隆项目
git clone https://github.com/your-org/1103-OSS.git
cd 1103-OSS

# 2. 配置环境变量
cp .env.example deployments/.env
# 编辑 deployments/.env 修改默认密码（可选）

# 3. 启动开发环境
make dev

# 4. 查看服务状态
make status

# 5. 查看实时日志
make dev-logs
```

**服务访问地址：**
- 🌐 **Web 控制台**: http://localhost:3000 (支持热重载)
- 🔌 **S3 API 端点**: http://localhost:9000
- 💾 **PostgreSQL**: localhost:5432 (用户: oss, 密码: oss_password)

### 首次登录

1. 打开浏览器访问 http://localhost:3000
2. 使用默认凭证登录：
   - 用户名: `admin`
   - 密码: `admin123`
3. 登录后可查看自动生成的 S3 Access Key 和 Secret Key
4. 🔒 **生产环境请务必修改默认密码！**

### 查看凭证

```bash
# 查看容器日志中的初始凭证
make credentials

# 或查看完整日志
docker logs 1103-oss-api-dev | grep "Access Key"
```

### 停止服务

```bash
# 停止但保留数据
make dev-down

# 停止并删除所有数据（谨慎使用）
make clean
```

## 部署指南

提供两种生产环境部署方案，根据你的需求选择：

### 方案一：使用 Make 命令部署（源码部署）

适合需要自定义构建或二次开发的场景。

#### 1. 准备环境

```bash
# 克隆项目
git clone https://github.com/1103-Studio/1103-OSS.git
cd 1103-OSS

# 创建配置文件
cp deployments/.env.example deployments/.env
```

#### 2. 配置环境变量

编辑 `deployments/.env`，修改以下重要配置：

```bash
# 数据库密码（必须修改）
DB_PASSWORD=your_strong_password_here

# 管理员凭证（必须修改）
ROOT_USER=your_admin_username
ROOT_PASSWORD=your_strong_password_here

# S3 访问凭证（可选，留空则自动生成）
INIT_ACCESS_KEY=
INIT_ACCESS_SECRET=
```

#### 3. 启动服务

```bash
# 构建并启动所有服务
make prod

# 查看服务状态
make status

# 查看日志
make prod-logs
```

**访问地址：**
- 🌐 **Web 控制台**: http://localhost:9002
- 🔌 **S3 API 端点**: http://localhost:9000

---

### 方案二：使用 Docker 镜像部署（推荐）

**无需克隆代码，直接拉取镜像快速部署。**

#### 1. 创建部署目录

```bash
# 创建项目目录
mkdir -p ~/1103-oss-deploy
cd ~/1103-oss-deploy
```

#### 2. 下载配置文件

```bash
# 下载 docker-compose.yml
curl -O https://raw.githubusercontent.com/1103-Studio/1103-OSS/main/deployments/docker-compose.yml

# 下载环境变量模板
curl -o .env https://raw.githubusercontent.com/1103-Studio/1103-OSS/main/deployments/.env.example
```

或者从 GitHub Release 下载：

```bash
# 下载最新版本配置文件
VERSION="v1.4.0"
wget https://github.com/1103-Studio/1103-OSS/releases/download/${VERSION}/docker-compose.yml
wget https://github.com/1103-Studio/1103-OSS/releases/download/${VERSION}/.env.example -O .env
```

#### 3. 修改环境变量

编辑 `.env` 文件，**必须修改**以下配置：

```bash
# 数据库配置
DB_NAME=oss
DB_USER=oss
DB_PASSWORD=your_strong_db_password_here    # ⚠️ 必须修改

# 管理员账号配置
ROOT_USER=admin                              # 管理员用户名
ROOT_PASSWORD=your_strong_admin_password     # ⚠️ 必须修改

# S3 访问密钥（可选，留空自动生成）
INIT_ACCESS_KEY=                             # 留空自动生成
INIT_ACCESS_SECRET=                          # 留空自动生成

# API 服务配置（可选）
API_HOST=0.0.0.0
API_PORT=9000
WEB_PORT=9002

# 存储配置
STORAGE_BASE_PATH=/data/oss
```

**环境变量说明：**

| 变量名 | 说明 | 默认值 | 是否必改 |
|--------|------|--------|----------|
| `DB_PASSWORD` | 数据库密码 | `oss_password` | ✅ 必须 |
| `ROOT_USER` | 管理员用户名 | `admin` | 建议修改 |
| `ROOT_PASSWORD` | 管理员密码 | `admin123` | ✅ 必须 |
| `INIT_ACCESS_KEY` | 初始 S3 Access Key | 自动生成 | 可选 |
| `INIT_ACCESS_SECRET` | 初始 S3 Secret Key | 自动生成 | 可选 |
| `API_PORT` | API 服务端口 | `9000` | 可选 |
| `WEB_PORT` | Web 控制台端口 | `9002` | 可选 |
| `STORAGE_BASE_PATH` | 对象存储路径 | `/data/oss` | 可选 |

#### 4. 修改 docker-compose.yml（使用远程镜像）

编辑 `docker-compose.yml`，修改镜像地址为 ghcr.io：

```yaml
services:
  gooss-api:
    image: ghcr.io/1103-studio/1103-oss-api:v1.4.0  # 或使用 :latest
    # ... 其他配置保持不变
    
  gooss-web:
    image: ghcr.io/1103-studio/1103-oss-web:v1.4.0  # 或使用 :latest
    # ... 其他配置保持不变
```

#### 5. 拉取镜像并启动

```bash
# 拉取最新镜像
docker pull ghcr.io/1103-studio/1103-oss-api:v1.4.0
docker pull ghcr.io/1103-studio/1103-oss-web:v1.4.0

# 启动所有服务
docker compose up -d

# 查看服务状态
docker compose ps

# 查看日志
docker compose logs -f
```

**访问地址：**
- 🌐 **Web 控制台**: http://localhost:9002
- 🔌 **S3 API 端点**: http://localhost:9000

#### 6. 查看生成的 S3 凭证

```bash
# 查看 API 日志中的自动生成凭证
docker compose logs gooss-api | grep "Access Key"

# 或登录 Web 控制台查看
# 访问 http://localhost:9002 使用管理员账号登录
```

#### 7. 服务管理

```bash
# 停止服务（保留数据）
docker compose down

# 停止服务并删除数据（谨慎！）
docker compose down -v

# 重启服务
docker compose restart

# 更新到最新版本
docker compose pull
docker compose up -d

# 查看实时日志
docker compose logs -f gooss-api gooss-web
```

#### 4. 配置反向代理（推荐）

使用 Nginx 或 Traefik 配置 HTTPS 和域名：

```nginx
# /etc/nginx/sites-available/oss.example.com
server {
    listen 443 ssl http2;
    server_name oss.example.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    # S3 API
    location / {
        proxy_pass http://localhost:9000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # 允许大文件上传
        client_max_body_size 10G;
        proxy_request_buffering off;
    }
}

server {
    listen 443 ssl http2;
    server_name console.example.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    # Web Console
    location / {
        proxy_pass http://localhost:9002;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

#### 5. 数据持久化

Docker volumes 自动管理数据持久化：

```bash
# 查看 volumes
docker volume ls | grep deployments

# 备份数据
make backup

# 恢复数据
make restore
```

### Docker 环境变量说明

所有配置项都支持通过环境变量覆盖，前缀为 `OSS_`：

| 环境变量 | 说明 | 默认值 |
|---------|------|--------|
| `OSS_SERVER_HOST` | API 服务监听地址 | `0.0.0.0` |
| `OSS_SERVER_PORT` | API 服务端口 | `9000` |
| `OSS_SERVER_REGION` | AWS 区域标识 | `us-east-1` |
| `OSS_DATABASE_HOST` | 数据库地址 | `postgres` |
| `OSS_DATABASE_PORT` | 数据库端口 | `5432` |
| `OSS_DATABASE_PASSWORD` | 数据库密码 | `oss_password` |
| `OSS_AUTH_ROOT_USER` | 初始管理员用户名 | `admin` |
| `OSS_AUTH_ROOT_PASSWORD` | 初始管理员密码 | `admin123` |
| `OSS_AUTH_INIT_ACCESS_KEY` | 初始 S3 Access Key | 自动生成 |
| `OSS_AUTH_INIT_ACCESS_SECRET` | 初始 S3 Secret Key | 自动生成 |

### 使用外部数据库

如果你有独立的 PostgreSQL 实例：

```bash
# deployments/.env
OSS_DATABASE_HOST=your-postgres-host
OSS_DATABASE_PORT=5432
OSS_DATABASE_USER=oss
OSS_DATABASE_PASSWORD=your_password
OSS_DATABASE_DBNAME=oss
```

然后只启动 API 和 Web 服务：

```bash
docker-compose -f deployments/docker-compose.yml up -d gooss-api gooss-web
```

## API 支持

#### Bucket 操作

| 操作 | 方法 | 路径 | 查询参数 | 说明 |
|------|------|------|----------|------|
| **ListBuckets** | GET | `/` | - | 列出所有存储桶 |
| **CreateBucket** | PUT | `/{bucket}` | - | 创建存储桶 |
| **HeadBucket** | HEAD | `/{bucket}` | - | 检查存储桶是否存在 |
| **DeleteBucket** | DELETE | `/{bucket}` | - | 删除存储桶（必须为空） |
| **ListObjects** | GET | `/{bucket}` | `prefix`, `delimiter`, `marker`, `max-keys` | 列出对象 |
| **GetBucketPolicy** | GET | `/{bucket}?policy` | - | 获取存储桶策略 |
| **PutBucketPolicy** | PUT | `/{bucket}?policy` | - | 设置存储桶策略 |
| **DeleteBucketPolicy** | DELETE | `/{bucket}?policy` | - | 删除存储桶策略 |
| **GetBucketSettings** | GET | `/{bucket}?settings` | - | 获取存储桶设置 |
| **UpdateBucketSettings** | PUT | `/{bucket}?settings` | - | 更新存储桶设置 |

**ListObjects 查询参数：**
- `prefix`: 对象键前缀
- `delimiter`: 分隔符（通常为 `/`，用于模拟文件夹）
- `marker`: 分页标记
- `max-keys`: 返回的最大对象数

#### Object 操作

| 操作 | 方法 | 路径 | 请求头 | 说明 |
|------|------|------|--------|------|
| **PutObject** | PUT | `/{bucket}/{key}` | `Content-Type`, `Content-Length` | 上传对象 |
| **GetObject** | GET | `/{bucket}/{key}` | `Range` (可选) | 下载对象 |
| **HeadObject** | HEAD | `/{bucket}/{key}` | - | 获取对象元数据 |
| **DeleteObject** | DELETE | `/{bucket}/{key}` | - | 删除对象 |
| **CopyObject** | PUT | `/{bucket}/{key}` | `x-amz-copy-source` | 复制对象 |

**预签名 URL：**
```bash
# 生成临时访问链接（7天有效期）
GET /{bucket}/{key}?X-Amz-Algorithm=AWS4-HMAC-SHA256&...
```

#### 分片上传 (Multipart Upload)

| 操作 | 方法 | 路径 | 说明 |
|------|------|------|------|
| **CreateMultipartUpload** | POST | `/{bucket}/{key}?uploads` | 初始化分片上传 |
| **UploadPart** | PUT | `/{bucket}/{key}?partNumber={n}&uploadId={id}` | 上传分片 |
| **CompleteMultipartUpload** | POST | `/{bucket}/{key}?uploadId={id}` | 完成分片上传 |
| **AbortMultipartUpload** | DELETE | `/{bucket}/{key}?uploadId={id}` | 取消分片上传 |
| **ListParts** | GET | `/{bucket}/{key}?uploadId={id}` | 列出已上传分片 |

**分片上传流程：**
1. 调用 `CreateMultipartUpload` 获取 `uploadId`
2. 并发上传多个分片（`UploadPart`），记录每个分片的 `ETag`
3. 调用 `CompleteMultipartUpload` 完成上传，提供所有分片的 `ETag`

### 认证方式

#### AWS Signature V4 (推荐)

所有 S3 API 请求必须使用 AWS Signature V4 签名：

```
Authorization: AWS4-HMAC-SHA256 Credential=<access-key>/20231220/us-east-1/s3/aws4_request, 
SignedHeaders=host;x-amz-content-sha256;x-amz-date, 
Signature=<signature>
```

**必需请求头：**
- `Host`: API 端点域名
- `x-amz-content-sha256`: 请求体的 SHA256 哈希
- `x-amz-date`: ISO 8601 格式的时间戳

#### 预签名 URL

用于临时授权访问，无需在请求中包含签名头：

```
GET /bucket/object?X-Amz-Algorithm=AWS4-HMAC-SHA256
  &X-Amz-Credential=<access-key>/20231220/us-east-1/s3/aws4_request
  &X-Amz-Date=20231220T120000Z
  &X-Amz-Expires=604800
  &X-Amz-SignedHeaders=host
  &X-Amz-Signature=<signature>
```

### 错误响应

所有错误响应使用 S3 标准 XML 格式：

```xml
<?xml version="1.0" encoding="UTF-8"?>
<Error>
  <Code>NoSuchBucket</Code>
  <Message>The specified bucket does not exist</Message>
  <Resource>/mybucket</Resource>
  <RequestId>4442587FB7D0A2F9</RequestId>
</Error>
```

**常见错误代码：**
- `NoSuchBucket` (404): 存储桶不存在
- `NoSuchKey` (404): 对象不存在
- `BucketAlreadyExists` (409): 存储桶已存在
- `InvalidAccessKeyId` (403): Access Key 无效
- `SignatureDoesNotMatch` (403): 签名验证失败
- `AccessDenied` (403): 权限不足
- `BucketNotEmpty` (409): 存储桶不为空（无法删除）

## SDK 使用示例

### AWS CLI

```bash
# 配置
aws configure set aws_access_key_id YOUR_ACCESS_KEY
aws configure set aws_secret_access_key YOUR_SECRET_KEY

# 使用
aws --endpoint-url http://localhost:9000 s3 ls
aws --endpoint-url http://localhost:9000 s3 mb s3://my-bucket
aws --endpoint-url http://localhost:9000 s3 cp file.txt s3://my-bucket/
```

### Python (boto3)

```python
import boto3

s3 = boto3.client('s3',
    endpoint_url='http://localhost:9000',
    aws_access_key_id='YOUR_ACCESS_KEY',
    aws_secret_access_key='YOUR_SECRET_KEY'
)

# 创建 Bucket
s3.create_bucket(Bucket='my-bucket')

# 上传文件
s3.upload_file('local_file.txt', 'my-bucket', 'remote_file.txt')

# 列出对象
response = s3.list_objects_v2(Bucket='my-bucket')
for obj in response.get('Contents', []):
    print(obj['Key'])
```

### JavaScript (AWS SDK v3)

```javascript
import { S3Client, ListBucketsCommand, PutObjectCommand } from '@aws-sdk/client-s3';

const client = new S3Client({
  endpoint: 'http://localhost:9000',
  region: 'us-east-1',
  credentials: {
    accessKeyId: 'YOUR_ACCESS_KEY',
    secretAccessKey: 'YOUR_SECRET_KEY'
  },
  forcePathStyle: true
});

// 列出 Buckets
const buckets = await client.send(new ListBucketsCommand({}));
console.log(buckets.Buckets);

// 上传文件
await client.send(new PutObjectCommand({
  Bucket: 'my-bucket',
  Key: 'hello.txt',
  Body: 'Hello, World!'
}));
```

### Go

```go
package main

import (
    "github.com/aws/aws-sdk-go/aws"
    "github.com/aws/aws-sdk-go/aws/credentials"
    "github.com/aws/aws-sdk-go/aws/session"
    "github.com/aws/aws-sdk-go/service/s3"
)

func main() {
    sess := session.Must(session.NewSession(&aws.Config{
        Endpoint:         aws.String("http://localhost:9000"),
        Region:           aws.String("us-east-1"),
        Credentials:      credentials.NewStaticCredentials("ACCESS_KEY", "SECRET_KEY", ""),
        S3ForcePathStyle: aws.Bool(true),
    }))

    svc := s3.New(sess)

    // 列出 Buckets
    result, _ := svc.ListBuckets(nil)
    for _, bucket := range result.Buckets {
        fmt.Println(*bucket.Name)
    }
}
```

## 配置说明

配置文件位于 `configs/config.yaml`：

```yaml
server:
  host: "0.0.0.0"
  port: 9000

storage:
  type: "local"  # local | distributed
  local:
    base_path: "/data/oss"

database:
  host: "localhost"
  port: 5432
  user: "oss"
  password: "oss_password"
  dbname: "oss"

auth:
  root_user: "admin"
  root_password: "admin123"
```

环境变量覆盖（前缀 `OSS_`）：
- `OSS_DATABASE_HOST`
- `OSS_DATABASE_PASSWORD`
- `OSS_STORAGE_LOCAL_BASE_PATH`
- `OSS_AUTH_ROOT_USER`
- `OSS_AUTH_ROOT_PASSWORD`

## 项目结构

```
.
├── cmd/server/          # 主程序入口
├── internal/
│   ├── api/             # HTTP API
│   │   └── s3/          # S3 兼容 API
│   ├── auth/            # 认证模块
│   ├── metadata/        # 元数据管理
│   └── storage/         # 存储引擎
│       └── local/       # 本地存储实现
├── pkg/
│   ├── config/          # 配置管理
│   ├── logger/          # 日志组件
│   └── response/        # S3 响应格式
├── web/                 # 前端管理界面
├── deployments/         # Docker 部署配置
├── configs/             # 配置文件
└── scripts/             # 数据库脚本
```

## 开发指南

### 容器化开发（推荐）

所有开发都在容器内进行，无需本地安装 Go 和 Node.js。

```bash
# 启动开发环境（支持热重载）
make dev

# 查看实时日志
make dev-logs

# 进入 API 容器
make shell-api

# 进入 Web 容器
make shell-web

# 进入数据库
make shell-db

# 重置数据库
make db-reset
```

### 常用命令

```bash
# 查看所有可用命令
make help

# 查看容器状态
make status

# 重启服务
make restart

# 清理所有容器和数据（谨慎使用）
make clean
```

### 代码修改

- **后端代码**: 修改 Go 代码后会自动重新编译并重启（使用 Air）
- **前端代码**: 修改 React 代码后会自动热重载（使用 Vite）
- **配置文件**: 修改配置文件后需要手动重启：`make restart`

### 本地开发（不使用 Docker）

如果需要本地开发环境：

**后端**
```bash
# 安装依赖
go mod download

# 运行数据库迁移
psql -h localhost -U oss -d oss -f scripts/init.sql

# 启动开发服务器
air

# 或直接运行
go run cmd/server/main.go
```

**前端**
```bash
cd web

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

### 调试

**后端调试**
```bash
# 查看 API 日志
docker logs -f 1103-oss-api-dev

# 进入容器调试
docker exec -it 1103-oss-api-dev sh
```

**前端调试**
- 打开浏览器开发者工具 (F12)
- 查看 Console 和 Network 标签
- React DevTools 扩展支持

### 数据库管理

```bash
# 连接数据库
make shell-db

# 或使用 psql
psql -h localhost -p 5432 -U oss -d oss

# 查看表
\dt

# 查看用户
SELECT * FROM users;

# 查看存储桶
SELECT * FROM buckets;
```

### 测试

```bash
# 运行后端测试
cd cmd/server
go test ./...

# 运行前端测试
cd web
npm test

# 端到端测试
./test-system.sh
```

## 性能优化

### 生产环境建议

1. **数据库优化**
   ```sql
   -- 创建索引
   CREATE INDEX idx_objects_bucket_key ON objects(bucket_id, key);
   CREATE INDEX idx_buckets_owner ON buckets(owner_id);
   
   -- 配置连接池
   -- 在 config.yaml 或环境变量中设置
   database:
     max_open_conns: 50
     max_idle_conns: 10
   ```

2. **文件系统选择**
   - 使用 SSD 存储提升 I/O 性能
   - 考虑使用对象存储后端（如 MinIO、Ceph）

3. **反向代理缓存**
   ```nginx
   # 启用静态文件缓存
   location ~* \.(jpg|jpeg|png|gif|ico|css|js)$ {
       expires 1y;
       add_header Cache-Control "public, immutable";
   }
   ```

4. **监控和日志**
   - 集成 Prometheus 采集指标
   - 使用 ELK/Loki 收集日志
   - 配置告警规则

## 路线图

### 已完成 ✅
- [x] 核心 S3 API (Bucket/Object 操作)
- [x] AWS Signature V4 认证
- [x] 分片上传 (Multipart Upload)
- [x] Web 管理界面
- [x] Docker 容器化部署
- [x] 审计日志
- [x] 企业控制台界面
- [x] 手机端控制台适配
- [x] 中文内容 UTF-8 编码支持

### 进行中 🚧
- [ ] 单元测试覆盖
- [ ] API 文档 (Swagger/OpenAPI)
- [ ] 性能基准测试

### 计划中 📋
- [ ] 分布式存储支持
  - [ ] MinIO 后端
  - [ ] Ceph RADOS 后端
- [ ] 高级安全特性
  - [ ] 服务器端加密 (SSE)
  - [ ] 客户端加密支持
  - [ ] IAM 策略引擎
- [ ] 对象生命周期管理
  - [ ] 自动过期删除
  - [ ] 存储类转换
- [ ] 跨区域复制 (CRR)
- [ ] 版本控制
- [ ] 对象锁定 (WORM)
- [ ] 监控与告警
  - [ ] Prometheus metrics
  - [ ] Grafana Dashboard
- [ ] S3 Select (SQL 查询)
- [ ] 事件通知 (Webhook/消息队列)

## 贡献指南

我们欢迎所有形式的贡献！

### 报告问题

- 使用 [GitHub Issues](https://github.com/your-org/1103-OSS/issues) 报告 bug
- 提供详细的复现步骤和环境信息
- 附上相关日志和截图

### 提交代码

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

### 代码规范

- **Go**: 遵循 [Effective Go](https://go.dev/doc/effective_go) 和 `gofmt` 格式
- **TypeScript/React**: 遵循 [Airbnb JavaScript Style Guide](https://github.com/airbnb/javascript)
- 提交前运行 `go fmt` 和 `npm run lint`

## 常见问题 (FAQ)

### Q: 如何修改默认端口？
A: 编辑 `deployments/.env` 文件，设置 `OSS_SERVER_PORT=8000`，然后重启服务。

### Q: 支持 HTTPS 吗？
A: 建议在前面配置 Nginx 反向代理实现 HTTPS，参考 [部署指南](#部署指南) 中的 Nginx 配置。

### Q: 如何备份数据？
A: 使用 `docker volume` 备份 PostgreSQL 数据和对象存储文件：
```bash
docker run --rm -v deployments_postgres-data:/data -v $(pwd):/backup alpine tar czf /backup/postgres-backup.tar.gz /data
docker run --rm -v deployments_oss-data:/data -v $(pwd):/backup alpine tar czf /backup/oss-backup.tar.gz /data
```

### Q: 如何升级到新版本？
A:
```bash
git pull origin main
docker-compose -f deployments/docker-compose.yml pull
docker-compose -f deployments/docker-compose.yml up -d
```

### Q: 支持其他数据库吗？
A: 当前仅支持 PostgreSQL。未来可能支持 MySQL/MariaDB。

### Q: 内存/磁盘占用多少？
A: 
- 最小配置：2GB RAM + 10GB 磁盘
- 推荐配置：8GB RAM + 100GB+ 磁盘
- 实际需求取决于存储的对象数量和大小

## 致谢

本项目使用了以下优秀的开源项目：

- [Gin](https://github.com/gin-gonic/gin) - HTTP Web 框架
- [React](https://react.dev/) - 用户界面库
- [PostgreSQL](https://www.postgresql.org/) - 关系型数据库
- [Ant Design](https://ant.design/) - 企业级 React 组件库
- [Vite](https://vitejs.dev/) - 前端构建工具

## 许可证

本项目采用 MIT 许可证 - 详见 [LICENSE](LICENSE) 文件

## 联系方式

- 项目主页: [https://github.com/your-org/1103-OSS](https://github.com/your-org/1103-OSS)
- 问题反馈: [GitHub Issues](https://github.com/your-org/1103-OSS/issues)
- 电子邮件: dev@1103.studio

---

**⭐ 如果这个项目对你有帮助，请给我们一个 Star！**
