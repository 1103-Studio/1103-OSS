#!/bin/bash

# 测试 ListBuckets API
ACCESS_KEY="AKIAMXTQDA4ZWISCZVUK"
SECRET_KEY="mSYgH7KnWsejNZ5imUowbP8p3pfT80xeryPI1Z"

echo "Testing ListBuckets API..."
echo "Access Key: $ACCESS_KEY"
echo ""

# 使用 aws-cli 测试
docker run --rm --network deployments_gooss-network \
  -e AWS_ACCESS_KEY_ID=$ACCESS_KEY \
  -e AWS_SECRET_ACCESS_KEY=$SECRET_KEY \
  amazon/aws-cli \
  --endpoint-url=http://gooss-api-dev:9000 \
  s3 ls

echo ""
echo "Done!"
