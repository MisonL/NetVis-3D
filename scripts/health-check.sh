#!/bin/bash
# NetVis Pro 健康检查脚本
# 用法: ./scripts/health-check.sh

set -e

API_URL="${API_URL:-http://localhost:3001}"
FRONTEND_URL="${FRONTEND_URL:-http://localhost:3000}"

echo "=========================================="
echo "   NetVis Pro 健康检查"
echo "=========================================="
echo ""
echo "📅 检查时间: $(date)"
echo ""

ERRORS=0

# 检查 API 服务
echo "🔍 检查 API 服务..."
if curl -sf "${API_URL}/api/health" >/dev/null 2>&1; then
    HEALTH_RESPONSE=$(curl -s "${API_URL}/api/health" 2>/dev/null)
    echo "   ✅ API 服务: 正常"
    echo "   📊 版本: $(echo $HEALTH_RESPONSE | grep -o '"version":"[^"]*"' | head -1 | cut -d'"' -f4)"
else
    echo "   ❌ API 服务: 无法连接"
    ERRORS=$((ERRORS + 1))
fi

# 检查前端服务
echo ""
echo "🔍 检查前端服务..."
if curl -sf "${FRONTEND_URL}" >/dev/null 2>&1; then
    echo "   ✅ 前端服务: 正常"
else
    echo "   ❌ 前端服务: 无法连接"
    ERRORS=$((ERRORS + 1))
fi

# 检查数据库连接
echo ""
echo "🔍 检查数据库..."
if curl -sf "${API_URL}/api/system/health" >/dev/null 2>&1; then
    DB_STATUS=$(curl -s "${API_URL}/api/system/health" 2>/dev/null | grep -o '"database":{[^}]*}' | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
    if [ "$DB_STATUS" = "ok" ]; then
        echo "   ✅ 数据库: 连接正常"
    else
        echo "   ⚠️  数据库: 状态异常"
        ERRORS=$((ERRORS + 1))
    fi
else
    echo "   ⚠️  数据库: 无法获取状态"
fi

# 检查磁盘空间
echo ""
echo "🔍 检查磁盘空间..."
DISK_USAGE=$(df -h . | tail -1 | awk '{print $5}' | tr -d '%')
if [ "$DISK_USAGE" -lt 80 ]; then
    echo "   ✅ 磁盘使用: ${DISK_USAGE}%"
elif [ "$DISK_USAGE" -lt 90 ]; then
    echo "   ⚠️  磁盘使用: ${DISK_USAGE}% (警告)"
else
    echo "   ❌ 磁盘使用: ${DISK_USAGE}% (临界)"
    ERRORS=$((ERRORS + 1))
fi

# 检查内存
echo ""
echo "🔍 检查内存..."
if command -v free &> /dev/null; then
    MEM_USAGE=$(free | grep Mem | awk '{printf "%.0f", $3/$2 * 100}')
    echo "   📊 内存使用: ${MEM_USAGE}%"
else
    echo "   📊 内存使用: $(vm_stat 2>/dev/null | head -1 || echo "无法获取")"
fi

# 检查 Docker 容器
echo ""
echo "🔍 检查 Docker 容器..."
if command -v docker &> /dev/null; then
    RUNNING=$(docker ps --format "{{.Names}}" 2>/dev/null | grep -E "netvis|frontend|api" | wc -l)
    TOTAL=$(docker ps -a --format "{{.Names}}" 2>/dev/null | grep -E "netvis|frontend|api" | wc -l)
    echo "   📦 运行中容器: ${RUNNING}/${TOTAL}"
else
    echo "   ⚠️  Docker 未安装"
fi

# 总结
echo ""
echo "=========================================="
if [ $ERRORS -eq 0 ]; then
    echo "   ✅ 所有检查通过！"
else
    echo "   ⚠️  发现 ${ERRORS} 个问题"
fi
echo "=========================================="
echo ""

exit $ERRORS
