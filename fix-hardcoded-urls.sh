#!/bin/bash

# 批量替换前端代码中硬编码的 localhost:9000
# 将其替换为从 API_BASE_URL 导入

cd /Users/summer/OSS_Proj/web/src

echo "修复硬编码的 localhost:9000..."

# AuditLogs.tsx - 添加导入并替换 URL
sed -i '' '1a\
import { API_BASE_URL } from "../lib/api"
' pages/AuditLogs.tsx

sed -i '' 's|http://localhost:9000/admin/audit-logs|`${API_BASE_URL}/admin/audit-logs`|g' pages/AuditLogs.tsx
sed -i '' 's|http://localhost:9000/admin/audit-logs/stats|`${API_BASE_URL}/admin/audit-logs/stats`|g' pages/AuditLogs.tsx

# Buckets.tsx - 添加导入并替换 URL
sed -i '' '8a\
import { API_BASE_URL } from "../lib/api"
' pages/Buckets.tsx

sed -i '' 's|http://localhost:9000/|`${API_BASE_URL}/|g' pages/Buckets.tsx
sed -i '' 's|s3://localhost:9000/|`s3://${API_BASE_URL.replace("http://", "").replace("https://", "")}/|g' pages/Buckets.tsx

# Settings.tsx - 添加导入并替换 URL
sed -i '' '1a\
import { API_BASE_URL } from "../lib/api"
' pages/Settings.tsx

sed -i '' 's|http://localhost:9000/user/change-password|`${API_BASE_URL}/user/change-password`|g' pages/Settings.tsx

echo "完成！"
