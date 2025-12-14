#!/bin/bash
# NetVis Pro 一键安装脚本
# 用法: ./scripts/install.sh

set -e

echo "=========================================="
echo "   NetVis Pro 安装脚本"
echo "=========================================="
echo ""

# 检查 Docker
if ! command -v docker &> /dev/null; then
    echo "❌ 错误: 未安装 Docker"
    echo "请先安装 Docker: https://docs.docker.com/get-docker/"
    exit 1
fi

# 检查 Docker Compose
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo "❌ 错误: 未安装 Docker Compose"
    exit 1
fi

echo "✅ Docker 环境检查通过"

# 创建环境配置文件
if [ ! -f .env ]; then
    echo ""
    echo "📝 创建环境配置文件..."
    cp .env.example .env 2>/dev/null || cat > .env << 'EOF'
# NetVis Pro 环境配置

# 数据库配置
DATABASE_URL=file:./data/netvis.db

# JWT配置
JWT_SECRET=netvis-jwt-secret-change-in-production
JWT_EXPIRE=24h

# 服务端口
API_PORT=3001
FRONTEND_PORT=3000

# 日志级别
LOG_LEVEL=info

# License公钥（可选）
LICENSE_PUBLIC_KEY=
EOF
    echo "✅ 环境配置文件已创建: .env"
    echo "⚠️  请编辑 .env 文件配置您的环境变量"
fi

# 创建数据目录
echo ""
echo "📁 创建数据目录..."
mkdir -p data backups logs

# 初始化数据库
echo ""
echo "🗄️  初始化数据库..."
cd server
if [ -f "package.json" ]; then
    bun install --frozen-lockfile 2>/dev/null || npm install
    bun run db:push 2>/dev/null || echo "数据库迁移跳过（使用 SQLite）"
fi
cd ..

# 构建前端
echo ""
echo "🔨 构建前端..."
cd frontend
if [ -f "package.json" ]; then
    bun install --frozen-lockfile 2>/dev/null || npm install
    bun run build 2>/dev/null || npm run build
fi
cd ..

# 启动服务
echo ""
echo "🚀 启动服务..."
docker-compose up -d --build

# 等待服务启动
echo ""
echo "⏳ 等待服务启动..."
sleep 10

# 健康检查
echo ""
echo "🏥 健康检查..."
if curl -sf http://localhost:3001/api/health >/dev/null 2>&1; then
    echo "✅ API 服务正常"
else
    echo "⚠️  API 服务启动中..."
fi

if curl -sf http://localhost:3000 >/dev/null 2>&1; then
    echo "✅ 前端服务正常"
else
    echo "⚠️  前端服务启动中..."
fi

echo ""
echo "=========================================="
echo "   ✅ NetVis Pro 安装完成！"
echo "=========================================="
echo ""
echo "🌐 访问地址: http://localhost:3000"
echo "📚 API 文档: http://localhost:3001/api"
echo ""
echo "📖 默认管理员账号:"
echo "   用户名: admin"
echo "   密码:   admin123"
echo ""
echo "⚠️  请及时修改默认密码!"
echo ""
