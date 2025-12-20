#!/bin/bash
# 批量修复 Buckets.tsx 中的硬编码 localhost:9000

FILE="/Users/summer/OSS_Proj/web/src/pages/Buckets.tsx"

# 备份原文件
cp "$FILE" "${FILE}.bak"

# 在导入部分添加 API_BASE_URL
sed -i '' '8i\
import { API_BASE_URL } from "../lib/api"
' "$FILE"

# 替换所有 http://localhost:9000 为 ${API_BASE_URL}
sed -i '' 's|http://localhost:9000|${API_BASE_URL}|g' "$FILE"

# 替换 s3://localhost:9000 
# 需要特殊处理，因为S3 URL格式不同
sed -i '' 's|s3://localhost:9000|s3://${API_BASE_URL.replace(/^https?:\/\//, "")}|g' "$FILE"

# 修复 endpoint-url 参数
sed -i '' 's|--endpoint-url=${API_BASE_URL}|--endpoint-url=\\${API_BASE_URL}|g' "$FILE"

echo "✅ Buckets.tsx 修复完成"
echo "备份文件: ${FILE}.bak"
