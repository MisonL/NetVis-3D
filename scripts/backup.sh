#!/bin/bash
#
# NetVis Pro 数据备份脚本
# 用法: ./scripts/backup.sh [backup_dir]
#

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 配置
BACKUP_DIR="${1:-./backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="netvis_backup_${TIMESTAMP}"
BACKUP_PATH="${BACKUP_DIR}/${BACKUP_NAME}"
RETENTION_DAYS=7

# 获取 Docker Compose 命令
get_compose_cmd() {
    if docker compose version &> /dev/null; then
        echo "docker compose"
    else
        echo "docker-compose"
    fi
}

# 创建备份目录
prepare_backup_dir() {
    log_info "准备备份目录..."
    mkdir -p "${BACKUP_PATH}"
    log_success "备份目录: ${BACKUP_PATH}"
}

# 备份 PostgreSQL 数据库
backup_database() {
    log_info "备份 PostgreSQL 数据库..."
    
    COMPOSE_CMD=$(get_compose_cmd)
    
    # 检查 postgres 容器是否运行
    if ! $COMPOSE_CMD ps postgres | grep -q "running"; then
        log_error "PostgreSQL 容器未运行"
        return 1
    fi
    
    # 执行 pg_dump
    $COMPOSE_CMD exec -T postgres pg_dump -U netvis -d netvis > "${BACKUP_PATH}/database.sql"
    
    if [ -s "${BACKUP_PATH}/database.sql" ]; then
        log_success "数据库备份完成: database.sql"
    else
        log_warn "数据库备份文件为空"
    fi
}

# 备份配置文件
backup_config() {
    log_info "备份配置文件..."
    
    mkdir -p "${BACKUP_PATH}/config"
    
    # 备份 .env
    if [ -f .env ]; then
        cp .env "${BACKUP_PATH}/config/"
        log_success "已备份 .env"
    fi
    
    # 备份 docker-compose.yml
    if [ -f docker-compose.yml ]; then
        cp docker-compose.yml "${BACKUP_PATH}/config/"
        log_success "已备份 docker-compose.yml"
    fi
    
    # 备份采集器配置
    if [ -f collector/config.yaml ]; then
        cp collector/config.yaml "${BACKUP_PATH}/config/"
        log_success "已备份 collector/config.yaml"
    fi
}

# 压缩备份
compress_backup() {
    log_info "压缩备份文件..."
    
    cd "${BACKUP_DIR}"
    tar -czf "${BACKUP_NAME}.tar.gz" "${BACKUP_NAME}"
    rm -rf "${BACKUP_NAME}"
    cd - > /dev/null
    
    BACKUP_SIZE=$(du -h "${BACKUP_DIR}/${BACKUP_NAME}.tar.gz" | cut -f1)
    log_success "备份压缩完成: ${BACKUP_NAME}.tar.gz (${BACKUP_SIZE})"
}

# 清理旧备份
cleanup_old_backups() {
    log_info "清理 ${RETENTION_DAYS} 天前的旧备份..."
    
    OLD_COUNT=$(find "${BACKUP_DIR}" -name "netvis_backup_*.tar.gz" -mtime +${RETENTION_DAYS} 2>/dev/null | wc -l)
    
    if [ "$OLD_COUNT" -gt 0 ]; then
        find "${BACKUP_DIR}" -name "netvis_backup_*.tar.gz" -mtime +${RETENTION_DAYS} -delete
        log_success "已清理 ${OLD_COUNT} 个旧备份"
    else
        log_info "无需清理旧备份"
    fi
}

# 显示备份列表
show_backup_list() {
    echo ""
    echo "现有备份文件:"
    ls -lh "${BACKUP_DIR}"/netvis_backup_*.tar.gz 2>/dev/null || echo "  (无)"
    echo ""
}

# 主函数
main() {
    echo ""
    echo "======================================"
    echo "   NetVis Pro 数据备份"
    echo "======================================"
    echo ""
    
    prepare_backup_dir
    backup_database
    backup_config
    compress_backup
    cleanup_old_backups
    show_backup_list
    
    echo -e "${GREEN}备份完成!${NC}"
    echo "备份文件: ${BACKUP_DIR}/${BACKUP_NAME}.tar.gz"
    echo ""
}

main "$@"
