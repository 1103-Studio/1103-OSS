#!/bin/bash

echo "=== 测试审计日志功能 ==="

# 1. 登录获取凭证
echo "1. 登录系统..."
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:9000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}')

ACCESS_KEY=$(echo $LOGIN_RESPONSE | grep -o '"accessKey":"[^"]*"' | cut -d'"' -f4)
echo "   登录成功，Access Key: $ACCESS_KEY"

# 2. 列出存储桶（会生成审计日志）
echo -e "\n2. 列出存储桶..."
curl -s -X GET "http://localhost:9000/" \
  -H "Authorization: AWS4-HMAC-SHA256 Credential=$ACCESS_KEY/20231201/us-east-1/s3/aws4_request, SignedHeaders=host;x-amz-date, Signature=dummy" \
  > /dev/null

# 3. 等待异步日志写入
sleep 2

# 4. 检查数据库中的审计日志
echo -e "\n3. 检查审计日志数据库..."
docker exec 1103-oss-postgres psql -U oss -d oss -c \
  "SELECT id, username, action, resource_type, bucket_name, status_code, created_at 
   FROM audit_logs 
   ORDER BY created_at DESC 
   LIMIT 5;"

echo -e "\n4. 审计日志总数："
docker exec 1103-oss-postgres psql -U oss -d oss -c \
  "SELECT COUNT(*) as total_logs FROM audit_logs;"

echo -e "\n=== 测试完成 ==="
echo "如果看到审计日志记录，说明功能正常。"
echo "如果仍然是0条记录，请在浏览器中操作后再检查。"
