#!/bin/bash
# NetVis Pro 升级脚本
# 用法: ./scripts/upgrade.sh

set -e

echo "=========================================="
echo "   NetVis Pro 升级脚本"
echo "=========================================="
echo ""

# 检查参数
VERSION=${1:-"latest"}
echo "📦 目标版本: ${VERSION}"

# 1. 备份当前数据
echo ""
echo "📋 步骤1: 备份当前数据..."
if [ -f "./scripts/backup.sh" ]; then
    ./scripts/backup.sh
else
    echo "⚠️  备份脚本不存在，跳过备份"
fi

# 2. 拉取最新代码
echo ""
echo "📋 步骤2: 拉取最新代码..."
if [ -d ".git" ]; then
    git fetch origin
    git pull origin main 2>/dev/null || git pull origin master
    echo "✅ 代码更新完成"
else
    echo "⚠️  非Git仓库，跳过代码拉取"
fi

# 3. 更新依赖
echo ""
echo "📋 步骤3: 更新依赖..."

echo "   更新后端依赖..."
cd server
bun install 2>/dev/null || npm install
cd ..

echo "   更新前端依赖..."
cd frontend
bun install 2>/dev/null || npm install
cd ..

echo "✅ 依赖更新完成"

# 4. 数据库迁移
echo ""
echo "📋 步骤4: 数据库迁移..."
cd server
bun run db:push 2>/dev/null || echo "迁移跳过（SQLite）"
cd ..
echo "✅ 数据库迁移完成"

# 5. 重新构建
echo ""
echo "📋 步骤5: 重新构建..."

echo "   构建前端..."
cd frontend
bun run build 2>/dev/null || npm run build
cd ..

echo "✅ 构建完成"

# 6. 重启服务
echo ""
echo "📋 步骤6: 重启服务..."
if command -v docker-compose &> /dev/null; then
    docker-compose down
    docker-compose up -d --build
    echo "✅ Docker 服务已重启"
else
    echo "⚠️  请手动重启服务"
fi

# 7. 健康检查
echo ""
echo "📋 步骤7: 健康检查..."
sleep 10
if [ -f "./scripts/health-check.sh" ]; then
    ./scripts/health-check.sh
fi

echo ""
echo "=========================================="
echo "   ✅ 升级完成！"
echo "=========================================="
echo ""
echo "📖 如遇问题，可通过以下方式回滚:"
echo "   1. 恢复备份: tar -xzf backups/netvis_backup_*.tar.gz"
echo "   2. 重启服务: docker-compose up -d"
echo ""
