# 1103-OSS 部署信息

## 生产环境访问地址

### Web 控制台
- **URL**: https://ossadmin.spark-ai.top
- **用户名**: maxio
- **密码**: maxioADMIN123

### API 服务
- **S3 API Endpoint**: http://oss.spark-ai.top:19000
- **健康检查**: http://oss.spark-ai.top:19000/health

### S3 凭证
- **Access Key**: maxio
- **Secret Key**: maxioTESTfromDEV

## 服务器部署

### 容器端口映射
- API: 19000 -> 9000 (容器内部)
- API Debug: 19001 -> 9001 (容器内部)
- Web: 3011 -> 3000 (容器内部)

### 使用服务器配置文件
```bash
cd deployments
docker compose -f docker-compose-server.yml --profile dev up -d
```

### 环境变量配置 (.env)
```bash
DB_PASSWORD=oss_password
ROOT_USER=maxio
ROOT_PASSWORD=maxioADMIN123
API_URL=http://oss.spark-ai.top:19000
INIT_ACCESS_KEY=maxio
INIT_ACCESS_SECRET=maxioTESTfromDEV
```

## 本地开发

### 访问地址
- API: http://localhost:9000
- Web: http://localhost:3000

### 使用本地配置文件
```bash
cd deployments
docker compose --profile dev up -d
```

## 测试命令

### 使用 AWS CLI
```bash
export AWS_ACCESS_KEY_ID=maxio
export AWS_SECRET_ACCESS_KEY=maxioTESTfromDEV

# 创建存储桶
aws --endpoint-url=http://oss.spark-ai.top:19000 s3 mb s3://test-bucket

# 列出存储桶
aws --endpoint-url=http://oss.spark-ai.top:19000 s3 ls

# 上传文件
echo "Hello OSS!" > test.txt
aws --endpoint-url=http://oss.spark-ai.top:19000 s3 cp test.txt s3://test-bucket/

# 列出文件
aws --endpoint-url=http://oss.spark-ai.top:19000 s3 ls s3://test-bucket/
```

### 使用 curl 测试 API
```bash
# 健康检查
curl http://oss.spark-ai.top:19000/health

# 登录获取凭证
curl -X POST http://oss.spark-ai.top:19000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"maxio","password":"maxioADMIN123"}'
```

## 架构说明

```
Internet
   |
   v
Nginx/CDN (HTTPS)
   |
   |-- https://ossadmin.spark-ai.top --> :3011 (Web 容器)
   |-- http://oss.spark-ai.top:19000 --> :19000 (API 容器)
   |
   v
Docker Containers
   |-- gooss-api-dev (9000, 9001 -> 19000, 19001)
   |-- gooss-web-dev (3000 -> 3011)
   |-- postgres (5432)
   |-- redis (6379)
```
