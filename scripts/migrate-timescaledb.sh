#!/bin/bash
#
# NetVis Pro TimescaleDB 迁移脚本
# 用法: ./scripts/migrate-timescaledb.sh [container_name]
#

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

CONTAINER=${1:-netvis-postgres}

echo ""
echo -e "${BLUE}=====================================${NC}"
echo -e "${BLUE}   TimescaleDB 迁移脚本${NC}"
echo -e "${BLUE}=====================================${NC}"
echo ""

# 检查容器
echo -e "${YELLOW}[1/5] 检查 PostgreSQL 容器...${NC}"
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
    echo -e "${RED}错误: 容器 ${CONTAINER} 未运行${NC}"
    exit 1
fi
echo -e "${GREEN}✓ 容器运行正常${NC}"

# 启用 TimescaleDB 扩展
echo ""
echo -e "${YELLOW}[2/5] 启用 TimescaleDB 扩展...${NC}"
docker exec -i $CONTAINER psql -U netvis -d netvis << 'EOF'
CREATE EXTENSION IF NOT EXISTS timescaledb;
SELECT extname, extversion FROM pg_extension WHERE extname = 'timescaledb';
EOF
echo -e "${GREEN}✓ TimescaleDB 扩展已启用${NC}"

# 创建 Hypertable
echo ""
echo -e "${YELLOW}[3/5] 创建 Hypertable...${NC}"
docker exec -i $CONTAINER psql -U netvis -d netvis << 'EOF'
-- 设备指标表
SELECT create_hypertable('device_metrics', 'timestamp', 
    chunk_time_interval => INTERVAL '1 day',
    if_not_exists => TRUE
);

-- 接口流量表
SELECT create_hypertable('interface_metrics', 'timestamp',
    chunk_time_interval => INTERVAL '1 day', 
    if_not_exists => TRUE
);
EOF
echo -e "${GREEN}✓ Hypertable 创建完成${NC}"

# 配置保留策略
echo ""
echo -e "${YELLOW}[4/5] 配置数据保留策略 (90天)...${NC}"
docker exec -i $CONTAINER psql -U netvis -d netvis << 'EOF'
SELECT add_retention_policy('device_metrics', INTERVAL '90 days', if_not_exists => TRUE);
SELECT add_retention_policy('interface_metrics', INTERVAL '90 days', if_not_exists => TRUE);
EOF
echo -e "${GREEN}✓ 保留策略配置完成${NC}"

# 创建索引
echo ""
echo -e "${YELLOW}[5/5] 创建优化索引...${NC}"
docker exec -i $CONTAINER psql -U netvis -d netvis << 'EOF'
-- 设备ID + 时间复合索引
CREATE INDEX IF NOT EXISTS idx_device_metrics_device_time 
ON device_metrics (device_id, timestamp DESC);

-- 状态索引（用于告警查询）
CREATE INDEX IF NOT EXISTS idx_device_metrics_status 
ON device_metrics (status) 
WHERE status = 'offline';

-- 接口索引
CREATE INDEX IF NOT EXISTS idx_interface_metrics_device_if 
ON interface_metrics (device_id, interface_name, timestamp DESC);
EOF
echo -e "${GREEN}✓ 索引创建完成${NC}"

# 显示统计
echo ""
echo -e "${BLUE}=====================================${NC}"
echo -e "${BLUE}   迁移完成${NC}"
echo -e "${BLUE}=====================================${NC}"
echo ""

docker exec -i $CONTAINER psql -U netvis -d netvis << 'EOF'
SELECT 
    hypertable_name,
    num_chunks,
    compression_enabled
FROM timescaledb_information.hypertables;
EOF

echo ""
echo -e "${GREEN}TimescaleDB 配置成功!${NC}"
echo ""
