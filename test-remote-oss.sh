#!/bin/bash

# 测试远程 OSS 服务
BASE_URL="http://oss.spark-ai.top:19000"
USERNAME="maxio"
PASSWORD="maxioADMIN123"

echo "=== 1. 测试登录 ==="
LOGIN_RESPONSE=$(curl -s -X POST "${BASE_URL}/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"${USERNAME}\",\"password\":\"${PASSWORD}\"}")

echo "登录响应: ${LOGIN_RESPONSE}"

# 提取 accessKey 和 secretKey
ACCESS_KEY=$(echo ${LOGIN_RESPONSE} | grep -o '"accessKey":"[^"]*"' | cut -d'"' -f4)
SECRET_KEY=$(echo ${LOGIN_RESPONSE} | grep -o '"secretKey":"[^"]*"' | cut -d'"' -f4)
ENDPOINT=$(echo ${LOGIN_RESPONSE} | grep -o '"endpoint":"[^"]*"' | cut -d'"' -f4)

if [ -z "$ACCESS_KEY" ]; then
    echo "❌ 登录失败！"
    exit 1
fi
echo "✅ 登录成功！"
echo "   Access Key: ${ACCESS_KEY}"
echo "   Secret Key: ${SECRET_KEY:0:20}..."
echo "   Endpoint: ${ENDPOINT}"

echo -e "\n=== 2. 测试列出存储桶 (S3 API) ==="
aws --endpoint-url="${BASE_URL}" \
    --region=us-east-1 \
    s3 ls 2>&1 || echo "需要安装 aws-cli: brew install awscli"

echo -e "\n=== 3. 使用 AWS CLI 测试 (需要配置凭证) ==="
echo "请手动运行以下命令测试:"
echo "  export AWS_ACCESS_KEY_ID=${ACCESS_KEY}"
echo "  export AWS_SECRET_ACCESS_KEY=${SECRET_KEY}"
echo "  aws --endpoint-url=http://oss.spark-ai.top:19000 s3 mb s3://test-bucket"
echo "  aws --endpoint-url=http://oss.spark-ai.top:19000 s3 ls"
echo "  echo 'Hello OSS' > test.txt"
echo "  aws --endpoint-url=http://oss.spark-ai.top:19000 s3 cp test.txt s3://test-bucket/"
echo "  aws --endpoint-url=http://oss.spark-ai.top:19000 s3 ls s3://test-bucket/"

echo -e "\n=== 4. 或使用 s3cmd 测试 ==="
echo "配置 s3cmd:"
echo "  s3cmd --configure"
echo "  # 输入 Access Key: ${ACCESS_KEY}"
echo "  # 输入 Secret Key: ${SECRET_KEY}"
echo "  # 输入 S3 Endpoint: oss.spark-ai.top:19000"
echo "  # 使用 HTTP (不是 HTTPS)"

echo -e "\n=== 测试完成 ==="
