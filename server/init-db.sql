-- NetVis Pro 数据库初始化脚本

-- 启用 UUID 扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 用户表
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    display_name VARCHAR(100),
    avatar TEXT,
    role VARCHAR(20) NOT NULL DEFAULT 'user',
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_login_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 角色表
CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(50) NOT NULL UNIQUE,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    permissions TEXT[],
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 审计日志表
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    action VARCHAR(50) NOT NULL,
    resource VARCHAR(50) NOT NULL,
    resource_id VARCHAR(255),
    details TEXT,
    ip_address VARCHAR(50),
    user_agent TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 设备分组表
CREATE TABLE IF NOT EXISTS device_groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    parent_id UUID REFERENCES device_groups(id),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 设备表
CREATE TABLE IF NOT EXISTS devices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    label VARCHAR(100),
    type VARCHAR(50) NOT NULL,
    vendor VARCHAR(50),
    model VARCHAR(100),
    ip_address VARCHAR(50),
    mac_address VARCHAR(50),
    location VARCHAR(255),
    group_id UUID REFERENCES device_groups(id),
    status VARCHAR(20) NOT NULL DEFAULT 'unknown',
    last_seen TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 告警规则表
CREATE TABLE IF NOT EXISTS alert_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    type VARCHAR(50) NOT NULL,
    conditions TEXT NOT NULL,
    severity VARCHAR(20) NOT NULL DEFAULT 'warning',
    is_enabled BOOLEAN NOT NULL DEFAULT true,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 告警表
CREATE TABLE IF NOT EXISTS alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rule_id UUID REFERENCES alert_rules(id),
    device_id UUID REFERENCES devices(id),
    severity VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    message TEXT NOT NULL,
    details TEXT,
    acknowledged_by UUID REFERENCES users(id),
    acknowledged_at TIMESTAMP,
    resolved_by UUID REFERENCES users(id),
    resolved_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- License表
CREATE TABLE IF NOT EXISTS licenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    license_key VARCHAR(255) NOT NULL UNIQUE,
    edition VARCHAR(50) NOT NULL,
    modules TEXT[],
    max_devices INTEGER NOT NULL DEFAULT 100,
    max_users INTEGER NOT NULL DEFAULT 5,
    customer_id VARCHAR(100),
    customer_name VARCHAR(255),
    issued_at TIMESTAMP NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 采集器表
CREATE TABLE IF NOT EXISTS collectors (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    version TEXT,
    status TEXT NOT NULL DEFAULT 'offline',
    last_heartbeat TIMESTAMP,
    started_at TIMESTAMP,
    config TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 设备指标表 (TimescaleDB Hypertable)
CREATE TABLE IF NOT EXISTS device_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    device_id UUID REFERENCES devices(id),
    collector_id TEXT REFERENCES collectors(id),
    status TEXT NOT NULL,
    latency INTEGER,
    packet_loss INTEGER,
    cpu_usage INTEGER,
    memory_usage INTEGER,
    uptime INTEGER,
    timestamp TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 启用 Hypertable
SELECT create_hypertable('device_metrics', 'timestamp', if_not_exists => TRUE);

-- 接口指标表 (TimescaleDB Hypertable)
CREATE TABLE IF NOT EXISTS interface_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    device_id UUID REFERENCES devices(id),
    interface_name TEXT NOT NULL,
    in_bytes INTEGER,
    out_bytes INTEGER,
    in_errors INTEGER,
    out_errors INTEGER,
    status TEXT,
    timestamp TIMESTAMP NOT NULL DEFAULT NOW()
);
-- 启用 Hypertable
SELECT create_hypertable('interface_metrics', 'timestamp', if_not_exists => TRUE);

-- 拓扑连接表
CREATE TABLE IF NOT EXISTS topology_links (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_id UUID NOT NULL REFERENCES devices(id),
    target_id UUID NOT NULL REFERENCES devices(id),
    source_port TEXT,
    target_port TEXT,
    link_type TEXT NOT NULL DEFAULT 'ethernet',
    bandwidth INTEGER,
    utilization INTEGER DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'up',
    description TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_devices_type ON devices(type);
CREATE INDEX IF NOT EXISTS idx_devices_status ON devices(status);
CREATE INDEX IF NOT EXISTS idx_devices_group_id ON devices(group_id);
CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status);
CREATE INDEX IF NOT EXISTS idx_alerts_device_id ON alerts(device_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_device_metrics_device_id ON device_metrics(device_id);
CREATE INDEX IF NOT EXISTS idx_device_metrics_timestamp ON device_metrics(timestamp DESC);

-- 插入默认管理员用户 (密码: admin123)
INSERT INTO users (username, email, password, display_name, role)
VALUES ('admin', 'admin@netvis.local', '$2a$10$rKN3KCqT3Y2FDsO2Gu5XcO8j0YqXb.vYwqH6P9xqYZHXNtD.ZXHXW', '系统管理员', 'admin')
ON CONFLICT (username) DO NOTHING;

-- 插入默认角色
INSERT INTO roles (name, display_name, description, permissions) VALUES
('admin', '系统管理员', '拥有全部权限', ARRAY['*']),
('user', '普通用户', '可以查看和编辑资源', ARRAY['read', 'write']),
('viewer', '访客', '只读权限', ARRAY['read'])
ON CONFLICT (name) DO NOTHING;

-- 插入示例设备分组
INSERT INTO device_groups (name, description) VALUES
('数据中心A', '主数据中心'),
('数据中心B', '备用数据中心'),
('分支机构', '各分支机构网络设备')
ON CONFLICT DO NOTHING;

COMMENT ON TABLE users IS '用户表';
COMMENT ON TABLE devices IS '网络设备表';
COMMENT ON TABLE alerts IS '告警表';
COMMENT ON TABLE audit_logs IS '审计日志表';
