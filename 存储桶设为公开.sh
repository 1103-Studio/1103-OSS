#!/bin/bash

# MinIO存储桶批量公开访问权限设置脚本
# 预配置MinIO连接信息，只需输入存储桶名称

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}MinIO存储桶批量公开访问权限设置脚本${NC}"
echo "=============================================="

# === 请在这里配置您的MinIO连接信息 ===
MINIO_URL="http://localhost:9000"      # MinIO服务器地址
ACCESS_KEY="AKIAMXTQDA4ZWISCZVUK"           # 访问密钥
SECRET_KEY="mSYgH7KnWsejNZ5imUowbP8p3pfT80xeryPI1Z"           # 秘密密钥
# =====================================

# 显示当前配置
echo -e "${YELLOW}当前配置:${NC}"
echo "MinIO地址: $MINIO_URL"
echo "Access Key: $ACCESS_KEY"
echo -e "Secret Key: ${RED}(已隐藏)${NC}"
echo "----------------------------------------------"

# 验证配置
if [[ "$ACCESS_KEY" == "your-access-key" || "$SECRET_KEY" == "your-secret-key" ]]; then
    echo -e "${RED}错误：请先在脚本中配置正确的Access Key和Secret Key！${NC}"
    exit 1
fi

# 配置AWS CLI使用MinIO
export AWS_ACCESS_KEY_ID=$ACCESS_KEY
export AWS_SECRET_ACCESS_KEY=$SECRET_KEY
export AWS_DEFAULT_REGION=us-east-1

# 获取存储桶名称
read -p "请输入存储桶名称（多个用空格分隔）: " -a BUCKET_NAMES

if [ ${#BUCKET_NAMES[@]} -eq 0 ]; then
    echo -e "${RED}错误：至少需要输入一个存储桶名称！${NC}"
    exit 1
fi

echo
echo -e "${YELLOW}开始处理 ${#BUCKET_NAMES[@]} 个存储桶...${NC}"
echo "----------------------------------------------"

# 计数器
SUCCESS_COUNT=0
FAIL_COUNT=0

# 处理每个存储桶
for BUCKET_NAME in "${BUCKET_NAMES[@]}"; do
    echo -n "正在设置存储桶 '$BUCKET_NAME'... "
    
    # 创建公开访问策略
    POLICY_JSON='{
        "Version": "2012-10-17",
        "Statement": [
            {
                "Effect": "Allow",
                "Principal": "*",
                "Action": "s3:GetObject",
                "Resource": "arn:aws:s3:::'$BUCKET_NAME'/*"
            }
        ]
    }'
    
    # 保存策略到临时文件
    echo "$POLICY_JSON" > /tmp/bucket_policy_${BUCKET_NAME}.json
    
    # 使用awscli设置策略
    aws --endpoint-url="$MINIO_URL" s3api put-bucket-policy \
        --bucket "$BUCKET_NAME" \
        --policy file:///tmp/bucket_policy_${BUCKET_NAME}.json \
        > /dev/null 2>&1
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ 成功${NC}"
        SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
        echo -e "   公开访问URL: ${MINIO_URL}/${BUCKET_NAME}/<文件名>"
    else
        echo -e "${RED}✗ 失败${NC}"
        FAIL_COUNT=$((FAIL_COUNT + 1))
    fi
    
    # 清理临时文件
    rm -f /tmp/bucket_policy_${BUCKET_NAME}.json
done

echo "----------------------------------------------"
echo -e "${YELLOW}处理完成！${NC}"
echo -e "成功: ${GREEN}${SUCCESS_COUNT}${NC} 个"
echo -e "失败: ${RED}${FAIL_COUNT}${NC} 个"

if [ $FAIL_COUNT -eq 0 ]; then
    echo -e "${GREEN}所有存储桶已成功设置为公开访问！${NC}"
else
    echo -e "${YELLOW}部分存储桶设置失败，请检查存储桶名称和权限。${NC}"
fi
