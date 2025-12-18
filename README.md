# 1103-OSS - 自研对象存储系统

一个高性能、S3 兼容的对象存储系统，基于 Go 语言开发，支持 Docker 部署。

## 特性

- **S3 兼容** - 支持 AWS S3 API，可使用任何 S3 SDK 接入
- **高性能** - Go 语言实现，支持高并发请求
- **安全可靠** - AWS Signature V4 签名验证，支持预签名 URL
- **易于部署** - Docker Compose 一键部署
- **Web 管理界面** - 现代化的管理控制台
- **可扩展** - 预留分布式存储接口

## 快速开始

### 开发模式（推荐）

开发模式支持代码热重载，修改代码后自动重启服务。

```bash
# 启动开发环境
make dev

# 查看日志
make dev-logs

# 停止开发环境
make dev-down
```

服务启动后：
- **S3 API**: http://localhost:9000
- **Web 控制台**: http://localhost:3000 (支持热重载)
- **PostgreSQL**: localhost:5432

### 生产模式

生产模式使用优化的镜像，适合部署到生产环境。

```bash
# 启动生产环境
make prod

# 查看日志
make prod-logs

# 停止生产环境
make prod-down
```

服务启动后：
- **S3 API**: http://localhost:9000
- **Web 控制台**: http://localhost:9002

### 首次启动

首次启动时，系统会自动创建管理员用户并生成 Access Key 和 Secret Key。
查看凭证：

```bash
make credentials
```

## API 支持

### Bucket 操作

| 操作 | 方法 | 路径 |
|------|------|------|
| ListBuckets | GET | `/` |
| CreateBucket | PUT | `/{bucket}` |
| HeadBucket | HEAD | `/{bucket}` |
| DeleteBucket | DELETE | `/{bucket}` |

### Object 操作

| 操作 | 方法 | 路径 |
|------|------|------|
| ListObjects | GET | `/{bucket}` |
| PutObject | PUT | `/{bucket}/{key}` |
| GetObject | GET | `/{bucket}/{key}` |
| HeadObject | HEAD | `/{bucket}/{key}` |
| DeleteObject | DELETE | `/{bucket}/{key}` |
| CopyObject | PUT | `/{bucket}/{key}` + `x-amz-copy-source` |

### 分片上传

| 操作 | 方法 | 路径 |
|------|------|------|
| CreateMultipartUpload | POST | `/{bucket}/{key}?uploads` |
| UploadPart | PUT | `/{bucket}/{key}?partNumber=&uploadId=` |
| CompleteMultipartUpload | POST | `/{bucket}/{key}?uploadId=` |
| AbortMultipartUpload | DELETE | `/{bucket}/{key}?uploadId=` |
| ListParts | GET | `/{bucket}/{key}?uploadId=` |

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

## 开发

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

# 清理所有容器和数据
make clean
```

### 代码修改

- **后端代码**: 修改 Go 代码后会自动重新编译并重启（使用 Air）
- **前端代码**: 修改 React 代码后会自动热重载（使用 Vite）
- **配置文件**: 修改配置文件后需要手动重启：`make restart`

## 路线图

- [x] 核心 S3 API
- [x] 分片上传
- [x] Web 管理界面
- [x] Docker 部署
- [ ] 分布式存储支持
- [ ] 数据加密
- [ ] 生命周期管理
- [ ] 跨域复制
- [ ] 监控指标 (Prometheus)

## License

MIT
# 1103-OSS
