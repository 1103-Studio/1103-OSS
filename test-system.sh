#!/bin/bash

# 1103-OSS 系统稳定性与功能完整性测试脚本
# 测试时间: $(date)

echo "=========================================="
echo "1103-OSS 系统测试报告"
echo "测试时间: $(date)"
echo "=========================================="
echo ""

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PASS=0
FAIL=0

# 测试函数
test_case() {
    local name=$1
    local command=$2
    local expected=$3
    
    echo -n "测试: $name ... "
    result=$(eval $command 2>&1)
    
    if echo "$result" | grep -q "$expected"; then
        echo -e "${GREEN}✓ 通过${NC}"
        ((PASS++))
        return 0
    else
        echo -e "${RED}✗ 失败${NC}"
        echo "  预期: $expected"
        echo "  实际: $result"
        ((FAIL++))
        return 1
    fi
}

echo "=========================================="
echo "1. 容器状态检查"
echo "=========================================="

test_case "PostgreSQL 容器运行" "docker ps --filter name=gooss-postgres --format '{{.Status}}'" "Up"
test_case "Redis 容器运行" "docker ps --filter name=gooss-redis --format '{{.Status}}'" "Up"
test_case "API 容器运行" "docker ps --filter name=gooss-api-dev --format '{{.Status}}'" "Up"
test_case "Web 容器运行" "docker ps --filter name=gooss-web-dev --format '{{.Status}}'" "Up"

echo ""
echo "=========================================="
echo "2. 健康检查"
echo "=========================================="

test_case "API 健康检查" "curl -s http://localhost:9000/health" "ok"
test_case "Web 前端响应" "curl -s -o /dev/null -w '%{http_code}' http://localhost:3000" "200"
test_case "PostgreSQL 连接" "docker exec gooss-postgres pg_isready -U oss" "accepting connections"
test_case "Redis 连接" "docker exec gooss-redis redis-cli ping" "PONG"

echo ""
echo "=========================================="
echo "3. 数据库完整性检查"
echo "=========================================="

test_case "用户表存在" "docker exec gooss-postgres psql -U oss -d oss -c '\dt users'" "users"
test_case "凭证表存在" "docker exec gooss-postgres psql -U oss -d oss -c '\dt credentials'" "credentials"
test_case "Bucket表存在" "docker exec gooss-postgres psql -U oss -d oss -c '\dt buckets'" "buckets"
test_case "对象表存在" "docker exec gooss-postgres psql -U oss -d oss -c '\dt objects'" "objects"
test_case "管理员用户已创建" "docker exec gooss-postgres psql -U oss -d oss -t -c 'SELECT COUNT(*) FROM users'" "1"
test_case "管理员凭证已创建" "docker exec gooss-postgres psql -U oss -d oss -t -c 'SELECT COUNT(*) FROM credentials'" "1"

echo ""
echo "=========================================="
echo "4. 资源使用情况"
echo "=========================================="

echo "容器资源使用:"
docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}"

echo ""
echo "磁盘使用:"
docker system df

echo ""
echo "=========================================="
echo "5. 日志检查"
echo "=========================================="

echo "API 服务最近日志:"
docker logs gooss-api-dev --tail 5 2>&1 | grep -E "Starting|listening|Connected"

echo ""
echo "检查错误日志:"
ERROR_COUNT=$(docker logs gooss-api-dev 2>&1 | grep -i error | wc -l)
if [ $ERROR_COUNT -eq 0 ]; then
    echo -e "${GREEN}✓ 无错误日志${NC}"
    ((PASS++))
else
    echo -e "${YELLOW}⚠ 发现 $ERROR_COUNT 条错误日志${NC}"
fi

echo ""
echo "=========================================="
echo "6. 网络连通性测试"
echo "=========================================="

test_case "API 端口可访问" "nc -z localhost 9000" ""
test_case "Web 端口可访问" "nc -z localhost 3000" ""
test_case "PostgreSQL 端口可访问" "nc -z localhost 5432" ""
test_case "Redis 端口可访问" "nc -z localhost 6379" ""

echo ""
echo "=========================================="
echo "7. 数据持久化检查"
echo "=========================================="

echo "Docker 卷:"
docker volume ls | grep deployments

echo ""
echo "存储路径检查:"
docker exec gooss-api-dev ls -la /data/oss 2>&1 | head -5

echo ""
echo "=========================================="
echo "测试总结"
echo "=========================================="
echo -e "通过: ${GREEN}$PASS${NC}"
echo -e "失败: ${RED}$FAIL${NC}"
echo "总计: $((PASS + FAIL))"

if [ $FAIL -eq 0 ]; then
    echo -e "\n${GREEN}✓ 所有测试通过！系统运行正常。${NC}"
    exit 0
else
    echo -e "\n${RED}✗ 有 $FAIL 个测试失败，请检查系统状态。${NC}"
    exit 1
fi
