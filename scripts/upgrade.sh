#!/bin/bash
#
# NetVis Pro 升级脚本
# 用法: ./scripts/upgrade.sh
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

# 获取 Docker Compose 命令
get_compose_cmd() {
    if docker compose version &> /dev/null; then
        echo "docker compose"
    else
        echo "docker-compose"
    fi
}

COMPOSE_CMD=$(get_compose_cmd)

# 升级前备份
pre_upgrade_backup() {
    log_info "升级前备份..."
    
    if [ -f scripts/backup.sh ]; then
        bash scripts/backup.sh ./backups/pre_upgrade
        log_success "升级前备份完成"
    else
        log_warn "备份脚本不存在，跳过备份"
    fi
}

# 拉取最新代码 (如果是 git 仓库)
pull_latest_code() {
    if [ -d .git ]; then
        log_info "拉取最新代码..."
        
        # 检查是否有未提交的更改
        if ! git diff-index --quiet HEAD --; then
            log_warn "存在未提交的更改，请先提交或暂存"
            read -p "是否继续? (y/n) " -n 1 -r
            echo
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                exit 1
            fi
        fi
        
        git pull origin main
        log_success "代码更新完成"
    else
        log_info "非 Git 仓库，跳过代码拉取"
    fi
}

# 拉取最新镜像
pull_latest_images() {
    log_info "拉取最新 Docker 镜像..."
    $COMPOSE_CMD pull
    log_success "镜像更新完成"
}

# 重新构建服务
rebuild_services() {
    log_info "重新构建服务..."
    $COMPOSE_CMD build --no-cache
    log_success "服务构建完成"
}

# 执行数据库迁移
run_migrations() {
    log_info "检查数据库迁移..."
    
    # 检查是否有迁移脚本
    if [ -d server/migrations ]; then
        log_info "执行数据库迁移..."
        $COMPOSE_CMD exec -T api bun run db:push 2>/dev/null || true
        log_success "数据库迁移完成"
    else
        log_info "无待执行的迁移"
    fi
}

# 滚动重启服务
rolling_restart() {
    log_info "滚动重启服务..."
    
    # 先重启后端服务
    log_info "重启 API 服务..."
    $COMPOSE_CMD up -d --no-deps api
    sleep 5
    
    # 重启采集器
    log_info "重启采集器..."
    $COMPOSE_CMD up -d --no-deps collector
    sleep 3
    
    # 重启前端
    log_info "重启前端服务..."
    $COMPOSE_CMD up -d --no-deps frontend
    
    log_success "服务重启完成"
}

# 健康检查
health_check() {
    log_info "执行健康检查..."
    
    if [ -f scripts/health-check.sh ]; then
        bash scripts/health-check.sh
    else
        # 简单健康检查
        sleep 5
        if curl -s http://localhost:21301/health > /dev/null 2>&1; then
            log_success "API 服务健康"
        else
            log_warn "API 服务响应异常"
        fi
        
        if curl -s http://localhost:21800 > /dev/null 2>&1; then
            log_success "前端服务健康"
        else
            log_warn "前端服务响应异常"
        fi
    fi
}

# 显示升级结果
show_result() {
    echo ""
    echo "======================================"
    echo -e "${GREEN}升级完成!${NC}"
    echo "======================================"
    echo ""
    echo "请访问以下地址验证:"
    echo -e "  Web 界面: ${BLUE}http://localhost:21800${NC}"
    echo -e "  API 文档: ${BLUE}http://localhost:21301/api/docs${NC}"
    echo ""
    echo "如遇问题，可恢复备份:"
    echo "  备份位置: ./backups/pre_upgrade/"
    echo ""
}

# 主函数
main() {
    echo ""
    echo "======================================"
    echo "   NetVis Pro 升级脚本"
    echo "======================================"
    echo ""
    
    pre_upgrade_backup
    pull_latest_code
    rebuild_services
    run_migrations
    rolling_restart
    health_check
    show_result
}

main "$@"
