# 1103-OSS API 接入指南

## 📋 概述

1103-OSS 是一个完全兼容 AWS S3 API 的对象存储系统，支持标准的 S3 SDK 和工具。

## 🔑 认证方式

### AWS Signature V4 签名认证

1103-OSS 使用标准的 AWS Signature V4 签名算法进行身份验证：

- **Access Key ID**: 用于标识用户身份
- **Secret Access Key**: 用于生成签名
- **签名算法**: AWS Signature V4 (HMAC-SHA256)

### 获取凭证

联系系统管理员获取您的访问凭证：
```
Access Key: AKIAXXXXXXXXXXXXXXXXX
Secret Key: xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
Endpoint: http://your-domain.com:9000
```

## 🌐 API 端点

### 基础配置

```
API 端点: http://your-domain.com:9000
区域 (Region): us-east-1
签名版本: v4
```

### 主要 API 接口

| 操作 | HTTP 方法 | 路径 | 说明 |
|------|-----------|------|------|
| 列出所有 Bucket | GET | / | 返回用户所有的存储桶 |
| 创建 Bucket | PUT | /{bucket} | 创建新的存储桶 |
| 删除 Bucket | DELETE | /{bucket} | 删除空的存储桶 |
| 列出对象 | GET | /{bucket} | 列出存储桶中的对象 |
| 上传对象 | PUT | /{bucket}/{key} | 上传文件到存储桶 |
| 下载对象 | GET | /{bucket}/{key} | 下载文件 |
| 删除对象 | DELETE | /{bucket}/{key} | 删除文件 |
| 分片上传初始化 | POST | /{bucket}/{key}?uploads | 初始化分片上传 |
| 上传分片 | PUT | /{bucket}/{key}?partNumber=N&uploadId=xxx | 上传单个分片 |
| 完成分片上传 | POST | /{bucket}/{key}?uploadId=xxx | 完成分片上传 |

## 💻 SDK 集成示例

### 1. AWS SDK for JavaScript/Node.js

```bash
npm install @aws-sdk/client-s3
```

```javascript
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';

// 配置客户端
const s3Client = new S3Client({
  region: 'us-east-1',
  endpoint: 'http://your-domain.com:9000',
  credentials: {
    accessKeyId: 'YOUR_ACCESS_KEY',
    secretAccessKey: 'YOUR_SECRET_KEY'
  },
  forcePathStyle: true, // 必须设置为 true
  tls: false // HTTP 时设置为 false，HTTPS 时设置为 true
});

// 上传文件
async function uploadFile() {
  const command = new PutObjectCommand({
    Bucket: 'my-bucket',
    Key: 'my-file.txt',
    Body: 'Hello, 1103-OSS!'
  });
  
  const response = await s3Client.send(command);
  console.log('Upload successful:', response);
}

// 下载文件
async function downloadFile() {
  const command = new GetObjectCommand({
    Bucket: 'my-bucket',
    Key: 'my-file.txt'
  });
  
  const response = await s3Client.send(command);
  const str = await response.Body.transformToString();
  console.log('File content:', str);
}
```

### 2. Python (boto3)

```bash
pip install boto3
```

```python
import boto3
from botocore.client import Config

# 配置客户端
s3 = boto3.client(
    's3',
    endpoint_url='http://your-domain.com:9000',
    aws_access_key_id='YOUR_ACCESS_KEY',
    aws_secret_access_key='YOUR_SECRET_KEY',
    config=Config(signature_version='s3v4'),
    region_name='us-east-1'
)

# 上传文件
s3.upload_file('local-file.txt', 'my-bucket', 'remote-file.txt')

# 下载文件
s3.download_file('my-bucket', 'remote-file.txt', 'downloaded-file.txt')

# 列出存储桶
response = s3.list_buckets()
for bucket in response['Buckets']:
    print(bucket['Name'])
```

### 3. Java (AWS SDK for Java)

```xml
<!-- pom.xml -->
<dependency>
    <groupId>com.amazonaws</groupId>
    <artifactId>aws-java-sdk-s3</artifactId>
    <version>1.12.x</version>
</dependency>
```

```java
import com.amazonaws.auth.AWSStaticCredentialsProvider;
import com.amazonaws.auth.BasicAWSCredentials;
import com.amazonaws.client.builder.AwsClientBuilder;
import com.amazonaws.services.s3.AmazonS3;
import com.amazonaws.services.s3.AmazonS3ClientBuilder;
import com.amazonaws.services.s3.model.PutObjectRequest;

public class S3Example {
    public static void main(String[] args) {
        // 配置凭证
        BasicAWSCredentials credentials = new BasicAWSCredentials(
            "YOUR_ACCESS_KEY",
            "YOUR_SECRET_KEY"
        );
        
        // 创建客户端
        AmazonS3 s3Client = AmazonS3ClientBuilder.standard()
            .withEndpointConfiguration(
                new AwsClientBuilder.EndpointConfiguration(
                    "http://your-domain.com:9000",
                    "us-east-1"
                )
            )
            .withCredentials(new AWSStaticCredentialsProvider(credentials))
            .withPathStyleAccessEnabled(true)
            .build();
        
        // 上传文件
        s3Client.putObject(new PutObjectRequest(
            "my-bucket",
            "my-file.txt",
            new File("local-file.txt")
        ));
        
        System.out.println("Upload successful!");
    }
}
```

### 4. Go

```bash
go get github.com/aws/aws-sdk-go/aws
go get github.com/aws/aws-sdk-go/service/s3
```

```go
package main

import (
    "bytes"
    "github.com/aws/aws-sdk-go/aws"
    "github.com/aws/aws-sdk-go/aws/credentials"
    "github.com/aws/aws-sdk-go/aws/session"
    "github.com/aws/aws-sdk-go/service/s3"
    "log"
)

func main() {
    // 配置会话
    sess, err := session.NewSession(&aws.Config{
        Endpoint:         aws.String("http://your-domain.com:9000"),
        Region:           aws.String("us-east-1"),
        Credentials:      credentials.NewStaticCredentials("YOUR_ACCESS_KEY", "YOUR_SECRET_KEY", ""),
        S3ForcePathStyle: aws.Bool(true),
    })
    if err != nil {
        log.Fatal(err)
    }
    
    // 创建 S3 服务客户端
    svc := s3.New(sess)
    
    // 上传文件
    _, err = svc.PutObject(&s3.PutObjectInput{
        Bucket: aws.String("my-bucket"),
        Key:    aws.String("my-file.txt"),
        Body:   bytes.NewReader([]byte("Hello, 1103-OSS!")),
    })
    if err != nil {
        log.Fatal(err)
    }
    
    log.Println("Upload successful!")
}
```

### 5. PHP

```bash
composer require aws/aws-sdk-php
```

```php
<?php
require 'vendor/autoload.php';

use Aws\S3\S3Client;

// 创建 S3 客户端
$s3 = new S3Client([
    'version' => 'latest',
    'region'  => 'us-east-1',
    'endpoint' => 'http://your-domain.com:9000',
    'use_path_style_endpoint' => true,
    'credentials' => [
        'key'    => 'YOUR_ACCESS_KEY',
        'secret' => 'YOUR_SECRET_KEY',
    ],
]);

// 上传文件
$result = $s3->putObject([
    'Bucket' => 'my-bucket',
    'Key'    => 'my-file.txt',
    'Body'   => 'Hello, 1103-OSS!',
]);

echo "Upload successful!\n";
```

## 🛠️ 命令行工具

### AWS CLI

```bash
# 安装 AWS CLI
pip install awscli

# 配置凭证
aws configure
# AWS Access Key ID: YOUR_ACCESS_KEY
# AWS Secret Access Key: YOUR_SECRET_KEY
# Default region name: us-east-1
# Default output format: json

# 使用 --endpoint-url 参数
aws --endpoint-url http://your-domain.com:9000 s3 ls
aws --endpoint-url http://your-domain.com:9000 s3 mb s3://my-bucket
aws --endpoint-url http://your-domain.com:9000 s3 cp local-file.txt s3://my-bucket/
```

### s3cmd

```bash
# 安装 s3cmd
pip install s3cmd

# 配置
s3cmd --configure
# Access Key: YOUR_ACCESS_KEY
# Secret Key: YOUR_SECRET_KEY
# S3 Endpoint: your-domain.com:9000
# DNS-style bucket+hostname: %(bucket)s.your-domain.com

# 使用
s3cmd ls
s3cmd mb s3://my-bucket
s3cmd put local-file.txt s3://my-bucket/
```

## 📝 最佳实践

### 1. 错误处理

```javascript
try {
  const response = await s3Client.send(command);
  console.log('Success:', response);
} catch (error) {
  if (error.name === 'NoSuchBucket') {
    console.error('Bucket does not exist');
  } else if (error.name === 'AccessDenied') {
    console.error('Access denied');
  } else {
    console.error('Error:', error);
  }
}
```

### 2. 分片上传大文件

```javascript
import { Upload } from '@aws-sdk/lib-storage';
import { createReadStream } from 'fs';

const upload = new Upload({
  client: s3Client,
  params: {
    Bucket: 'my-bucket',
    Key: 'large-file.zip',
    Body: createReadStream('large-file.zip'),
  },
  queueSize: 4, // 并发上传 4 个分片
  partSize: 5 * 1024 * 1024, // 每个分片 5MB
});

upload.on('httpUploadProgress', (progress) => {
  console.log(`Uploaded ${progress.loaded} of ${progress.total} bytes`);
});

await upload.done();
```

### 3. 预签名 URL（待实现）

```javascript
// 注意：当前版本暂不支持预签名 URL
// 预计在后续版本中实现
```

## 🔍 常见问题

### Q: 为什么无法连接？
**A**: 检查以下几点：
- 端点地址是否正确
- 防火墙是否开放端口
- 网络是否可达

### Q: 403 Forbidden 错误
**A**: 可能的原因：
- Access Key 或 Secret Key 不正确
- 签名计算错误（检查时间同步）
- 没有相应的权限

### Q: 如何设置 Bucket 权限？
**A**: 当前版本所有 Bucket 默认为私有，仅创建者可访问。后续版本将支持 ACL 和 Bucket Policy。

### Q: 支持哪些 S3 特性？
**A**: 当前支持：
- ✅ 基本的对象操作（上传、下载、删除）
- ✅ 分片上传
- ✅ Bucket 管理
- ⚠️ 部分支持：对象元数据
- ❌ 暂不支持：版本控制、生命周期、跨域配置

## 📞 技术支持

如有问题，请联系系统管理员或查看以下资源：

- 项目仓库: `<your-repo-url>`
- 文档: `DOCKER_GUIDE.md`
- AWS S3 API 参考: https://docs.aws.amazon.com/s3/

## 📄 相关文档

- [公网部署安全配置](./PRODUCTION_DEPLOYMENT.md)
- [Docker 部署指南](./DOCKER_GUIDE.md)
- [系统测试报告](./TEST_REPORT.md)
