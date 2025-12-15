#!/bin/bash
#
# NetVis Pro 高可用健康检查脚本
# 用法: ./scripts/health-check-ha.sh
#

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 计数器
PASS_COUNT=0
FAIL_COUNT=0
WARN_COUNT=0

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
    WARN_COUNT=$((WARN_COUNT + 1))
}

# 获取 Docker Compose 命令
get_compose_cmd() {
    if docker compose version &> /dev/null; then
        echo "docker compose -f docker-compose.ha.yml"
    else
        echo "docker-compose -f docker-compose.ha.yml"
    fi
}

COMPOSE_CMD=$(get_compose_cmd)

# 检查容器状态
check_containers() {
    echo ""
    echo -e "${BLUE}[容器状态]${NC}"
    
    CONTAINERS=(
        "netvis-pg-primary"
        "netvis-pg-replica"
        "netvis-redis-master"
        "netvis-redis-replica"
        "netvis-sentinel-1"
        "netvis-sentinel-2"
        "netvis-sentinel-3"
        "netvis-api-1"
        "netvis-api-2"
        "netvis-frontend-1"
        "netvis-frontend-2"
        "netvis-lb"
    )
    
    for container in "${CONTAINERS[@]}"; do
        if docker ps --format '{{.Names}}' | grep -q "^${container}$"; then
            STATUS=$(docker inspect --format='{{.State.Status}}' "$container" 2>/dev/null)
            if [ "$STATUS" = "running" ]; then
                check_pass "$container: 运行中"
            else
                check_fail "$container: $STATUS"
            fi
        else
            check_warn "$container: 未部署"
        fi
    done
}

# 检查 PostgreSQL 复制状态
check_pg_replication() {
    echo ""
    echo -e "${BLUE}[PostgreSQL 复制]${NC}"
    
    # 检查主库
    if docker exec netvis-pg-primary pg_isready -U netvis -d netvis > /dev/null 2>&1; then
        check_pass "主库连接正常"
        
        # 检查复制状态
        REPL_STATUS=$(docker exec netvis-pg-primary psql -U netvis -d netvis -t -c "SELECT count(*) FROM pg_stat_replication;" 2>/dev/null | tr -d ' ')
        if [ "$REPL_STATUS" -gt 0 ]; then
            check_pass "复制连接数: $REPL_STATUS"
            
            # 检查复制延迟
            LAG=$(docker exec netvis-pg-primary psql -U netvis -d netvis -t -c "SELECT COALESCE(pg_wal_lsn_diff(pg_current_wal_lsn(), replay_lsn), 0) FROM pg_stat_replication LIMIT 1;" 2>/dev/null | tr -d ' ')
            if [ -n "$LAG" ] && [ "$LAG" -lt 1048576 ]; then
                check_pass "复制延迟: ${LAG} bytes"
            else
                check_warn "复制延迟过大: ${LAG} bytes"
            fi
        else
            check_warn "无复制连接"
        fi
    else
        check_fail "主库连接失败"
    fi
    
    # 检查从库
    if docker exec netvis-pg-replica pg_isready -U netvis -d netvis > /dev/null 2>&1; then
        check_pass "从库连接正常"
    else
        check_warn "从库连接失败"
    fi
}

# 检查 Redis Sentinel 状态
check_redis_sentinel() {
    echo ""
    echo -e "${BLUE}[Redis Sentinel]${NC}"
    
    # 检查 Redis 主节点
    if docker exec netvis-redis-master redis-cli -a "${REDIS_PASSWORD:-redis_secure_2024}" ping 2>/dev/null | grep -q "PONG"; then
        check_pass "Redis Master: 正常"
    else
        check_fail "Redis Master: 异常"
    fi
    
    # 检查 Redis 从节点
    if docker exec netvis-redis-replica redis-cli -a "${REDIS_PASSWORD:-redis_secure_2024}" ping 2>/dev/null | grep -q "PONG"; then
        check_pass "Redis Replica: 正常"
    else
        check_warn "Redis Replica: 异常"
    fi
    
    # 检查 Sentinel
    for i in 1 2 3; do
        SENTINEL_CONTAINER="netvis-sentinel-$i"
        if docker exec $SENTINEL_CONTAINER redis-cli -p 26379 SENTINEL masters 2>/dev/null | grep -q "netvis-master"; then
            check_pass "Sentinel $i: 正常"
        else
            check_warn "Sentinel $i: 异常"
        fi
    done
    
    # 获取当前 Master
    MASTER_INFO=$(docker exec netvis-sentinel-1 redis-cli -p 26379 SENTINEL get-master-addr-by-name netvis-master 2>/dev/null)
    if [ -n "$MASTER_INFO" ]; then
        check_pass "当前Master: $MASTER_INFO"
    fi
}

# 检查 API 集群
check_api_cluster() {
    echo ""
    echo -e "${BLUE}[API 集群]${NC}"
    
    for i in 1 2; do
        API_CONTAINER="netvis-api-$i"
        if docker exec $API_CONTAINER curl -sf http://localhost:3001/health > /dev/null 2>&1; then
            check_pass "API $i: 健康"
        else
            check_warn "API $i: 不健康"
        fi
    done
}

# 检查负载均衡
check_load_balancer() {
    echo ""
    echo -e "${BLUE}[负载均衡]${NC}"
    
    # 检查 Nginx
    if docker exec netvis-lb nginx -t > /dev/null 2>&1; then
        check_pass "Nginx 配置: 有效"
    else
        check_fail "Nginx 配置: 无效"
    fi
    
    # 检查健康端点
    if curl -sf http://localhost:21800/nginx-health > /dev/null 2>&1; then
        check_pass "负载均衡健康: 正常"
    else
        check_warn "负载均衡健康: 异常"
    fi
    
    # 检查 API 代理
    if curl -sf http://localhost:21800/health > /dev/null 2>&1; then
        check_pass "API 代理: 正常"
    else
        check_warn "API 代理: 异常"
    fi
}

# 显示总结
show_summary() {
    echo ""
    echo "======================================"
    echo -e "${BLUE}高可用健康检查总结${NC}"
    echo "======================================"
    echo ""
    echo -e "  通过: ${GREEN}${PASS_COUNT}${NC} 项"
    echo -e "  警告: ${YELLOW}${WARN_COUNT}${NC} 项"
    echo -e "  失败: ${RED}${FAIL_COUNT}${NC} 项"
    echo ""
    
    if [ "$FAIL_COUNT" -eq 0 ]; then
        if [ "$WARN_COUNT" -eq 0 ]; then
            echo -e "${GREEN}所有检查通过! 高可用集群运行正常。${NC}"
        else
            echo -e "${YELLOW}存在 ${WARN_COUNT} 个警告，建议检查。${NC}"
        fi
        exit 0
    else
        echo -e "${RED}存在 ${FAIL_COUNT} 个失败项，需要立即处理!${NC}"
        exit 1
    fi
}

# 主函数
main() {
    echo ""
    echo "======================================"
    echo "   NetVis Pro 高可用健康检查"
    echo "======================================"
    
    check_containers
    check_pg_replication
    check_redis_sentinel
    check_api_cluster
    check_load_balancer
    show_summary
}

main "$@"
