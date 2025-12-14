#!/bin/bash
# NetVis Pro 数据备份脚本
# 用法: ./scripts/backup.sh

set -e

BACKUP_DIR="./backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_NAME="netvis_backup_${TIMESTAMP}"

echo "=========================================="
echo "   NetVis Pro 数据备份"
echo "=========================================="
echo ""
echo "📅 备份时间: $(date)"
echo "📂 备份目录: ${BACKUP_DIR}/${BACKUP_NAME}"
echo ""

# 创建备份目录
mkdir -p "${BACKUP_DIR}/${BACKUP_NAME}"

# 备份数据库
echo "🗄️  备份数据库..."
if [ -f "./server/data/netvis.db" ]; then
    cp "./server/data/netvis.db" "${BACKUP_DIR}/${BACKUP_NAME}/netvis.db"
    echo "   ✅ SQLite 数据库已备份"
elif [ -f "./data/netvis.db" ]; then
    cp "./data/netvis.db" "${BACKUP_DIR}/${BACKUP_NAME}/netvis.db"
    echo "   ✅ SQLite 数据库已备份"
else
    echo "   ⚠️  未找到 SQLite 数据库文件"
fi

# 备份配置文件
echo "📝 备份配置文件..."
if [ -f ".env" ]; then
    cp ".env" "${BACKUP_DIR}/${BACKUP_NAME}/.env"
    echo "   ✅ 环境配置已备份"
fi

if [ -f "docker-compose.yml" ]; then
    cp "docker-compose.yml" "${BACKUP_DIR}/${BACKUP_NAME}/docker-compose.yml"
    echo "   ✅ Docker Compose 配置已备份"
fi

if [ -f "nginx.conf" ]; then
    cp "nginx.conf" "${BACKUP_DIR}/${BACKUP_NAME}/nginx.conf"
    echo "   ✅ Nginx 配置已备份"
fi

# 备份上传文件（如有）
if [ -d "./uploads" ]; then
    echo "📁 备份上传文件..."
    cp -r "./uploads" "${BACKUP_DIR}/${BACKUP_NAME}/uploads"
    echo "   ✅ 上传文件已备份"
fi

# 创建备份信息文件
echo ""
echo "📋 生成备份信息..."
cat > "${BACKUP_DIR}/${BACKUP_NAME}/backup_info.txt" << EOF
NetVis Pro 备份信息
================================
备份时间: $(date)
备份版本: $(cat package.json 2>/dev/null | grep '"version"' | head -1 | awk -F'"' '{print $4}' || echo "unknown")
主机名称: $(hostname)
操作系统: $(uname -s)

备份内容:
- netvis.db (SQLite数据库)
- .env (环境配置)
- docker-compose.yml (Docker配置)
- nginx.conf (Nginx配置)
- uploads/ (上传文件)
EOF

# 压缩备份
echo ""
echo "📦 压缩备份文件..."
cd "${BACKUP_DIR}"
tar -czf "${BACKUP_NAME}.tar.gz" "${BACKUP_NAME}"
rm -rf "${BACKUP_NAME}"
cd - > /dev/null

# 清理旧备份（保留最近7个）
echo ""
echo "🧹 清理旧备份..."
cd "${BACKUP_DIR}"
ls -t *.tar.gz 2>/dev/null | tail -n +8 | xargs -r rm
cd - > /dev/null

# 显示结果
BACKUP_SIZE=$(du -h "${BACKUP_DIR}/${BACKUP_NAME}.tar.gz" | cut -f1)

echo ""
echo "=========================================="
echo "   ✅ 备份完成！"
echo "=========================================="
echo ""
echo "📂 备份文件: ${BACKUP_DIR}/${BACKUP_NAME}.tar.gz"
echo "📊 文件大小: ${BACKUP_SIZE}"
echo ""
echo "💡 恢复命令:"
echo "   tar -xzf ${BACKUP_DIR}/${BACKUP_NAME}.tar.gz"
echo ""
