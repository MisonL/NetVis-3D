#!/bin/bash
#
# NetVis Pro 一键安装脚本
# 用法: ./scripts/install.sh
#

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

# 检查必要工具
check_requirements() {
    log_info "检查系统环境..."
    
    # 检查 Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker 未安装，请先安装 Docker"
        exit 1
    fi
    
    DOCKER_VERSION=$(docker --version | grep -oE '[0-9]+\.[0-9]+' | head -1)
    log_success "Docker 已安装 (版本: $DOCKER_VERSION)"
    
    # 检查 Docker Compose
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        log_error "Docker Compose 未安装，请先安装 Docker Compose"
        exit 1
    fi
    
    log_success "Docker Compose 已安装"
    
    # 检查 Docker 是否运行
    if ! docker info &> /dev/null; then
        log_error "Docker 服务未运行，请先启动 Docker"
        exit 1
    fi
    
    log_success "Docker 服务运行正常"
}

# 配置环境变量
setup_env() {
    log_info "配置环境变量..."
    
    if [ ! -f .env ]; then
        if [ -f .env.example ]; then
            cp .env.example .env
            log_success "已从 .env.example 创建 .env 文件"
            
            # 生成随机 JWT Secret
            JWT_SECRET=$(openssl rand -base64 32 2>/dev/null || head -c 32 /dev/urandom | base64)
            if [[ "$OSTYPE" == "darwin"* ]]; then
                sed -i '' "s/please_change_this_secret_in_production/$JWT_SECRET/" .env
            else
                sed -i "s/please_change_this_secret_in_production/$JWT_SECRET/" .env
            fi
            log_success "已生成随机 JWT Secret"
        else
            log_warn ".env.example 不存在，将使用默认配置"
        fi
    else
        log_info ".env 文件已存在，跳过创建"
    fi
}

# 构建并启动服务
start_services() {
    log_info "构建并启动服务..."
    
    # 使用 docker compose (v2) 或 docker-compose (v1)
    if docker compose version &> /dev/null; then
        COMPOSE_CMD="docker compose"
    else
        COMPOSE_CMD="docker-compose"
    fi
    
    # 构建镜像
    log_info "构建 Docker 镜像..."
    $COMPOSE_CMD build --no-cache
    
    # 启动服务
    log_info "启动服务..."
    $COMPOSE_CMD up -d
    
    log_success "服务已启动"
}

# 等待服务就绪
wait_for_services() {
    log_info "等待服务就绪..."
    
    # 等待 API 服务
    MAX_RETRIES=30
    RETRY_COUNT=0
    
    while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
        if curl -s http://localhost:21301/health > /dev/null 2>&1; then
            log_success "API 服务已就绪"
            break
        fi
        RETRY_COUNT=$((RETRY_COUNT + 1))
        echo -n "."
        sleep 2
    done
    
    if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
        log_warn "API 服务启动超时，请检查日志"
    fi
    
    echo ""
}

# 显示访问信息
show_access_info() {
    echo ""
    echo "======================================"
    echo -e "${GREEN}NetVis Pro 安装完成!${NC}"
    echo "======================================"
    echo ""
    echo "访问地址:"
    echo -e "  Web 界面:    ${BLUE}http://localhost:21800${NC}"
    echo -e "  API 文档:    ${BLUE}http://localhost:21301/api/docs${NC}"
    echo -e "  健康检查:    ${BLUE}http://localhost:21301/health${NC}"
    echo ""
    echo "默认账号:"
    echo "  用户名: admin"
    echo "  密码:   admin123"
    echo ""
    echo "常用命令:"
    echo "  查看日志:     docker compose logs -f"
    echo "  停止服务:     docker compose down"
    echo "  重启服务:     docker compose restart"
    echo ""
}

# 主函数
main() {
    echo ""
    echo "======================================"
    echo "   NetVis Pro 一键安装脚本"
    echo "======================================"
    echo ""
    
    check_requirements
    setup_env
    start_services
    wait_for_services
    show_access_info
}

main "$@"
