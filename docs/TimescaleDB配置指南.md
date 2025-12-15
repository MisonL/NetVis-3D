# TimescaleDB 时序数据存储配置

> 版本：v1.0
> 日期：2025-12-15

---

## 一、概述

TimescaleDB 是 PostgreSQL 的时序数据扩展，用于高效存储和查询设备指标数据。

### 优势

- 自动时间分区 (hypertable)
- 高效的时间范围查询
- 数据压缩减少存储空间
- 连续聚合实时汇总
- 完全兼容 PostgreSQL

---

## 二、Docker 部署

### 更新 docker-compose.yml

```yaml
services:
  postgres:
    image: timescale/timescaledb:latest-pg15
    container_name: netvis-postgres
    environment:
      POSTGRES_USER: netvis
      POSTGRES_PASSWORD: ${PG_PASSWORD}
      POSTGRES_DB: netvis
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "21432:5432"
```

---

## 三、数据库迁移

### 3.1 启用 TimescaleDB 扩展

```sql
-- 启用扩展
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- 验证安装
SELECT extversion FROM pg_extension WHERE extname = 'timescaledb';
```

### 3.2 转换为 Hypertable

```sql
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
```

### 3.3 配置数据保留策略

```sql
-- 保留90天的原始数据
SELECT add_retention_policy('device_metrics', INTERVAL '90 days');
SELECT add_retention_policy('interface_metrics', INTERVAL '90 days');
```

### 3.4 创建连续聚合（汇总视图）

```sql
-- 设备指标小时汇总
CREATE MATERIALIZED VIEW device_metrics_hourly
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 hour', timestamp) AS bucket,
    device_id,
    AVG(cpu_usage) AS avg_cpu,
    MAX(cpu_usage) AS max_cpu,
    AVG(memory_usage) AS avg_memory,
    MAX(memory_usage) AS max_memory,
    AVG(latency) AS avg_latency,
    COUNT(*) AS sample_count
FROM device_metrics
GROUP BY bucket, device_id
WITH NO DATA;

-- 设备指标每日汇总
CREATE MATERIALIZED VIEW device_metrics_daily
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 day', timestamp) AS bucket,
    device_id,
    AVG(cpu_usage) AS avg_cpu,
    MAX(cpu_usage) AS max_cpu,
    AVG(memory_usage) AS avg_memory,
    MAX(memory_usage) AS max_memory,
    AVG(latency) AS avg_latency,
    SUM(CASE WHEN status = 'offline' THEN 1 ELSE 0 END) AS offline_count,
    COUNT(*) AS sample_count
FROM device_metrics
GROUP BY bucket, device_id
WITH NO DATA;

-- 刷新策略
SELECT add_continuous_aggregate_policy('device_metrics_hourly',
    start_offset => INTERVAL '3 hours',
    end_offset => INTERVAL '1 hour',
    schedule_interval => INTERVAL '1 hour');

SELECT add_continuous_aggregate_policy('device_metrics_daily',
    start_offset => INTERVAL '3 days',
    end_offset => INTERVAL '1 day',
    schedule_interval => INTERVAL '1 day');
```

### 3.5 创建索引优化查询

```sql
-- 设备ID + 时间复合索引
CREATE INDEX idx_device_metrics_device_time
ON device_metrics (device_id, timestamp DESC);

-- 状态索引（用于告警查询）
CREATE INDEX idx_device_metrics_status
ON device_metrics (status)
WHERE status = 'offline';
```

---

## 四、数据压缩

```sql
-- 启用压缩
ALTER TABLE device_metrics SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'device_id'
);

-- 7天后自动压缩
SELECT add_compression_policy('device_metrics', INTERVAL '7 days');
```

---

## 五、查询示例

### 5.1 最近 24 小时 CPU 趋势

```sql
SELECT
    time_bucket('1 hour', timestamp) AS hour,
    AVG(cpu_usage) AS avg_cpu
FROM device_metrics
WHERE device_id = 'xxx'
  AND timestamp > NOW() - INTERVAL '24 hours'
GROUP BY hour
ORDER BY hour;
```

### 5.2 使用连续聚合查询

```sql
-- 查询小时汇总（更快）
SELECT * FROM device_metrics_hourly
WHERE device_id = 'xxx'
  AND bucket > NOW() - INTERVAL '7 days'
ORDER BY bucket;
```

---

## 六、迁移脚本

```bash
#!/bin/bash
# scripts/migrate-timescaledb.sh

set -e

CONTAINER=${1:-netvis-postgres}

echo "=== TimescaleDB 迁移 ==="

# 启用扩展
docker exec -i $CONTAINER psql -U netvis -d netvis << 'EOF'
CREATE EXTENSION IF NOT EXISTS timescaledb;
EOF

# 创建 Hypertable
docker exec -i $CONTAINER psql -U netvis -d netvis << 'EOF'
SELECT create_hypertable('device_metrics', 'timestamp', if_not_exists => TRUE);
SELECT create_hypertable('interface_metrics', 'timestamp', if_not_exists => TRUE);
EOF

# 配置保留策略
docker exec -i $CONTAINER psql -U netvis -d netvis << 'EOF'
SELECT add_retention_policy('device_metrics', INTERVAL '90 days', if_not_exists => TRUE);
EOF

echo "=== 迁移完成 ==="
```
