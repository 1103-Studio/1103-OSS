#!/bin/bash

echo "=== 测试环境变量注入 ==="

# 1. 检查 Docker Compose 配置
echo -e "\n1. 检查 docker-compose-server.yml 中的 VITE_API_URL 配置："
grep -A 2 "VITE_API_URL" deployments/docker-compose-server.yml

# 2. 重启前端容器
echo -e "\n2. 重启前端容器以应用新配置..."
cd deployments
docker compose -f docker-compose-server.yml restart gooss-web-dev

# 3. 等待容器启动
echo -e "\n3. 等待容器启动（10秒）..."
sleep 10

# 4. 检查容器中的环境变量
echo -e "\n4. 检查容器中的环境变量："
docker exec 1103-oss-web-dev env | grep VITE_API_URL || echo "环境变量未找到"

# 5. 检查前端日志
echo -e "\n5. 检查前端日志（查找 Vite dev server 启动信息）："
docker logs 1103-oss-web-dev 2>&1 | tail -20

echo -e "\n=== 测试完成 ==="
echo "如果看到 'VITE_API_URL=http://oss.spark-ai.top:19000'，说明环境变量已正确注入"
echo "访问 https://ossadmin.spark-ai.top 并打开浏览器控制台，检查 API 请求地址"
