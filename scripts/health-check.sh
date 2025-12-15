#!/bin/bash
#
# NetVis Pro 健康检查脚本
# 用法: ./scripts/health-check.sh
#

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 配置
API_HOST="localhost"
API_PORT="21301"
WEB_HOST="localhost"
WEB_PORT="21800"

# 计数器
PASS_COUNT=0
FAIL_COUNT=0

# 检查函数
check_pass() {
    echo -e "  ${GREEN}✓${NC} $1"
    PASS_COUNT=$((PASS_COUNT + 1))
}

check_fail() {
    echo -e "  ${RED}✗${NC} $1"
    FAIL_COUNT=$((FAIL_COUNT + 1))
}

check_warn() {
    echo -e "  ${YELLOW}!${NC} $1"
}

# 获取 Docker Compose 命令
get_compose_cmd() {
    if docker compose version &> /dev/null; then
        echo "docker compose"
    else
        echo "docker-compose"
    fi
}

COMPOSE_CMD=$(get_compose_cmd)

# 检查 Docker 容器状态
check_containers() {
    echo ""
    echo -e "${BLUE}[容器状态]${NC}"
    
    CONTAINERS=("netvis-postgres" "netvis-redis" "netvis-api" "netvis-frontend" "netvis-collector")
    
    for container in "${CONTAINERS[@]}"; do
        if docker ps --format '{{.Names}}' | grep -q "^${container}$"; then
            STATUS=$(docker inspect --format='{{.State.Status}}' "$container" 2>/dev/null)
            if [ "$STATUS" = "running" ]; then
                check_pass "$container: 运行中"
            else
                check_fail "$container: $STATUS"
            fi
        else
            check_fail "$container: 未找到"
        fi
    done
}

# 检查 PostgreSQL 连接
check_postgres() {
    echo ""
    echo -e "${BLUE}[PostgreSQL]${NC}"
    
    if $COMPOSE_CMD exec -T postgres pg_isready -U netvis -d netvis > /dev/null 2>&1; then
        check_pass "数据库连接正常"
        
        # 检查表数量
        TABLE_COUNT=$($COMPOSE_CMD exec -T postgres psql -U netvis -d netvis -t -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null | tr -d ' ')
        if [ -n "$TABLE_COUNT" ] && [ "$TABLE_COUNT" -gt 0 ]; then
            check_pass "数据表: ${TABLE_COUNT} 个"
        else
            check_warn "数据表为空"
        fi
    else
        check_fail "数据库连接失败"
    fi
}

# 检查 Redis 连接
check_redis() {
    echo ""
    echo -e "${BLUE}[Redis]${NC}"
    
    if $COMPOSE_CMD exec -T redis redis-cli ping 2>/dev/null | grep -q "PONG"; then
        check_pass "Redis 连接正常"
        
        # 检查内存使用
        MEMORY=$($COMPOSE_CMD exec -T redis redis-cli info memory 2>/dev/null | grep "used_memory_human" | cut -d: -f2 | tr -d '\r')
        if [ -n "$MEMORY" ]; then
            check_pass "内存使用: ${MEMORY}"
        fi
    else
        check_fail "Redis 连接失败"
    fi
}

# 检查 API 服务
check_api() {
    echo ""
    echo -e "${BLUE}[API 服务]${NC}"
    
    # 健康检查端点
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://${API_HOST}:${API_PORT}/health" 2>/dev/null || echo "000")
    
    if [ "$HTTP_CODE" = "200" ]; then
        check_pass "健康检查: HTTP $HTTP_CODE"
        
        # 获取详细健康信息
        HEALTH_INFO=$(curl -s "http://${API_HOST}:${API_PORT}/health" 2>/dev/null)
        if echo "$HEALTH_INFO" | grep -q "healthy\|ok"; then
            check_pass "服务状态: 健康"
        fi
    else
        check_fail "健康检查: HTTP $HTTP_CODE"
    fi
    
    # API 文档
    DOC_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://${API_HOST}:${API_PORT}/api/docs" 2>/dev/null || echo "000")
    if [ "$DOC_CODE" = "200" ]; then
        check_pass "API 文档: 可访问"
    else
        check_warn "API 文档: 不可访问 (HTTP $DOC_CODE)"
    fi
}

# 检查前端服务
check_frontend() {
    echo ""
    echo -e "${BLUE}[前端服务]${NC}"
    
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://${WEB_HOST}:${WEB_PORT}" 2>/dev/null || echo "000")
    
    if [ "$HTTP_CODE" = "200" ]; then
        check_pass "Web 界面: HTTP $HTTP_CODE"
    else
        check_fail "Web 界面: HTTP $HTTP_CODE"
    fi
}

# 检查采集器
check_collector() {
    echo ""
    echo -e "${BLUE}[采集器]${NC}"
    
    # 检查容器日志是否有错误
    if docker logs netvis-collector 2>&1 | tail -5 | grep -qi "error\|fatal"; then
        check_warn "采集器日志有错误"
    else
        check_pass "采集器运行正常"
    fi
    
    # 检查指标端点
    METRICS_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://${API_HOST}:21900/metrics" 2>/dev/null || echo "000")
    if [ "$METRICS_CODE" = "200" ]; then
        check_pass "Prometheus 指标: 可访问"
    else
        check_warn "Prometheus 指标: 不可访问 (HTTP $METRICS_CODE)"
    fi
}

# 显示总结
show_summary() {
    echo ""
    echo "======================================"
    echo -e "${BLUE}健康检查总结${NC}"
    echo "======================================"
    echo ""
    echo -e "  通过: ${GREEN}${PASS_COUNT}${NC} 项"
    echo -e "  失败: ${RED}${FAIL_COUNT}${NC} 项"
    echo ""
    
    if [ "$FAIL_COUNT" -eq 0 ]; then
        echo -e "${GREEN}所有检查通过!${NC}"
        exit 0
    else
        echo -e "${YELLOW}存在 ${FAIL_COUNT} 个问题需要关注${NC}"
        exit 1
    fi
}

# 主函数
main() {
    echo ""
    echo "======================================"
    echo "   NetVis Pro 健康检查"
    echo "======================================"
    
    check_containers
    check_postgres
    check_redis
    check_api
    check_frontend
    check_collector
    show_summary
}

main "$@"
