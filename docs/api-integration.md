# API 接入

1103-OSS 目标是兼容 AWS S3 API，推荐使用 AWS Signature V4。

## 基础参数

- Endpoint: `http://<your-host>:9000`
- Region: `us-east-1`
- Signature Version: `v4`

## AWS CLI

```bash
export AWS_ACCESS_KEY_ID=YOUR_ACCESS_KEY
export AWS_SECRET_ACCESS_KEY=YOUR_SECRET_KEY

aws --endpoint-url http://localhost:9000 s3 ls
aws --endpoint-url http://localhost:9000 s3 mb s3://my-bucket
aws --endpoint-url http://localhost:9000 s3 cp ./file.txt s3://my-bucket/
```

## SDK 使用要点

- 使用自定义 `endpoint`
- 设置 `forcePathStyle` / `pathStyleAccess`（不同 SDK 字段名不同）
- 确保客户端时间与服务器时间基本一致（签名会受时间偏差影响）

更完整的示例可参考仓库根目录的 `API_INTEGRATION_GUIDE.md`。
