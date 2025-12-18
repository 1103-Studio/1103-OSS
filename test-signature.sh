#!/bin/bash

# 测试 AWS Signature V4 签名验证

echo "=========================================="
echo "AWS Signature V4 签名验证测试"
echo "=========================================="
echo ""

ACCESS_KEY="AKIAMXTQDA4ZWISCZVUK"
SECRET_KEY="mSYgH7KnWsejNZ5imUowbP8p3pfT80xeryPI1Z"
ENDPOINT="http://localhost:9000"

echo "1. 测试无签名请求（应该失败）"
echo "---"
curl -s -o /dev/null -w "HTTP Status: %{http_code}\n" "$ENDPOINT/"
echo ""

echo "2. 测试无效签名（应该失败）"
echo "---"
curl -s -o /dev/null -w "HTTP Status: %{http_code}\n" \
  -H "Authorization: AWS4-HMAC-SHA256 Credential=$ACCESS_KEY/20251218/us-east-1/s3/aws4_request, SignedHeaders=host, Signature=invalid" \
  -H "X-Amz-Date: 20251218T110000Z" \
  -H "X-Amz-Content-Sha256: UNSIGNED-PAYLOAD" \
  "$ENDPOINT/"
echo ""

echo "3. 测试健康检查端点（不需要签名，应该成功）"
echo "---"
HEALTH_RESPONSE=$(curl -s "$ENDPOINT/health")
echo "响应: $HEALTH_RESPONSE"
if echo "$HEALTH_RESPONSE" | grep -q "ok"; then
    echo "✓ 健康检查通过"
else
    echo "✗ 健康检查失败"
fi
echo ""

echo "4. 前端签名测试说明"
echo "---"
echo "前端现在配置为直接连接到 $ENDPOINT"
echo "签名将基于实际的后端 URL 生成"
echo ""
echo "测试步骤："
echo "1. 打开浏览器访问 http://localhost:3000"
echo "2. 使用以下凭证登录："
echo "   Endpoint: $ENDPOINT"
echo "   Access Key: $ACCESS_KEY"
echo "   Secret Key: $SECRET_KEY"
echo "3. 尝试列出 Buckets 或创建新 Bucket"
echo ""
echo "如果看到 403 错误，请检查浏览器控制台的详细错误信息"
echo ""

echo "=========================================="
echo "配置信息"
echo "=========================================="
echo "API 端点: $ENDPOINT"
echo "Web 前端: http://localhost:3000"
echo "Access Key: $ACCESS_KEY"
echo ""
