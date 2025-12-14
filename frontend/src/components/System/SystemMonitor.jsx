import React, { useState, useEffect } from 'react';
import { 
  Card, Table, Typography, Tag, Space, Button, Row, Col, 
  Statistic, Tabs, Progress, List, message, Modal
} from 'antd';
import { 
  DashboardOutlined, CloudServerOutlined, DatabaseOutlined,
  ClockCircleOutlined, CheckCircleOutlined, WarningOutlined,
  ReloadOutlined, DeleteOutlined, CloudUploadOutlined
} from '@ant-design/icons';
import { useAuth } from '../../context/AuthContext';

const { Title, Text } = Typography;

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const SystemMonitor = () => {
  const { token } = useAuth();
  const [_loading, setLoading] = useState(false);
  const [health, setHealth] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [logs, setLogs] = useState([]);
  const [backups, setBackups] = useState([]);

  useEffect(() => {
    fetchHealth();
    fetchMetrics();
    fetchTasks();
    fetchLogs();
    fetchBackups();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchHealth = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/system/health`);
      const data = await res.json();
      if (data.code === 0) {
        setHealth(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch health:', err);
    }
  };

  const fetchMetrics = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/system/metrics`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.code === 0) {
        setMetrics(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch metrics:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchTasks = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/system/tasks`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.code === 0) {
        setTasks(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch tasks:', err);
    }
  };

  const fetchLogs = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/system/logs?limit=20`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.code === 0) {
        setLogs(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch logs:', err);
    }
  };

  const fetchBackups = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/system/backups`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.code === 0) {
        setBackups(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch backups:', err);
    }
  };

  const handleMaintenance = async (type) => {
    try {
      const res = await fetch(`${API_BASE}/api/system/maintenance/${type}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.code === 0) {
        message.success(data.message);
      }
    } catch {
      message.error('操作失败');
    }
  };

  const handleCreateBackup = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/system/backups`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.code === 0) {
        message.success(data.message);
        fetchBackups();
      }
    } catch {
      message.error('创建备份失败');
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      healthy: 'success',
      degraded: 'warning',
      unhealthy: 'error',
      running: 'processing',
      idle: 'default',
      completed: 'success',
    };
    return colors[status] || 'default';
  };

  const getLevelColor = (level) => {
    const colors = {
      info: 'blue',
      warn: 'orange',
      error: 'red',
    };
    return colors[level] || 'default';
  };

  const formatBytes = (bytes) => {
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + ' MB';
    return (bytes / 1024 / 1024 / 1024).toFixed(2) + ' GB';
  };

  const taskColumns = [
    { title: '任务名称', dataIndex: 'name', key: 'name' },
    { title: '类型', dataIndex: 'type', key: 'type', render: (v) => <Tag>{v}</Tag> },
    { title: '状态', dataIndex: 'status', key: 'status', render: (v) => <Tag color={getStatusColor(v)}>{v}</Tag> },
    { title: '周期', dataIndex: 'interval', key: 'interval' },
    { title: '上次执行', dataIndex: 'lastRun', key: 'lastRun', render: (v) => new Date(v).toLocaleString() },
  ];

  const backupColumns = [
    { title: '备份名称', dataIndex: 'name', key: 'name' },
    { title: '类型', dataIndex: 'type', key: 'type', render: (v) => <Tag>{v}</Tag> },
    { title: '大小', dataIndex: 'size', key: 'size', render: formatBytes },
    { title: '状态', dataIndex: 'status', key: 'status', render: (v) => <Tag color={getStatusColor(v)}>{v}</Tag> },
    { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', render: (v) => new Date(v).toLocaleString() },
  ];

  const tabItems = [
    {
      key: 'overview',
      label: <span><DashboardOutlined /> 系统概览</span>,
      children: (
        <Row gutter={[24, 24]}>
          <Col xs={24} md={12}>
            <Card title="系统资源" style={{ height: '100%' }}>
              <Row gutter={16}>
                <Col span={12}>
                  <Statistic title="CPU 核心" value={metrics?.cpu?.cores || '-'} />
                  <Progress percent={metrics?.cpu?.usage || 0} status={metrics?.cpu?.usage > 80 ? 'exception' : 'active'} />
                </Col>
                <Col span={12}>
                  <Statistic title="内存使用" value={metrics?.memory?.usagePercent || 0} suffix="%" />
                  <Progress percent={metrics?.memory?.usagePercent || 0} status={metrics?.memory?.usagePercent > 80 ? 'exception' : 'active'} />
                </Col>
              </Row>
            </Card>
          </Col>
          <Col xs={24} md={12}>
            <Card title="数据统计" style={{ height: '100%' }}>
              <Row gutter={16}>
                <Col span={8}>
                  <Statistic title="设备数" value={metrics?.database?.devices || 0} prefix={<CloudServerOutlined />} />
                </Col>
                <Col span={8}>
                  <Statistic title="用户数" value={metrics?.database?.users || 0} />
                </Col>
                <Col span={8}>
                  <Statistic title="告警数" value={metrics?.database?.alerts || 0} />
                </Col>
              </Row>
            </Card>
          </Col>
        </Row>
      ),
    },
    {
      key: 'tasks',
      label: <span><ClockCircleOutlined /> 任务队列</span>,
      children: (
        <Table columns={taskColumns} dataSource={tasks} rowKey="id" pagination={false} />
      ),
    },
    {
      key: 'logs',
      label: <span><DatabaseOutlined /> 系统日志</span>,
      children: (
        <List
          size="small"
          dataSource={logs}
          renderItem={(item) => (
            <List.Item>
              <Space>
                <Tag color={getLevelColor(item.level)}>{item.level.toUpperCase()}</Tag>
                <Text>{item.message}</Text>
                <Text type="secondary" style={{ fontSize: 12 }}>{new Date(item.timestamp).toLocaleString()}</Text>
              </Space>
            </List.Item>
          )}
        />
      ),
    },
    {
      key: 'backups',
      label: <span><CloudUploadOutlined /> 数据备份</span>,
      children: (
        <>
          <div style={{ marginBottom: 16, textAlign: 'right' }}>
            <Button type="primary" icon={<CloudUploadOutlined />} onClick={handleCreateBackup}>
              创建备份
            </Button>
          </div>
          <Table columns={backupColumns} dataSource={backups} rowKey="id" pagination={false} />
        </>
      ),
    },
    {
      key: 'maintenance',
      label: <span><ReloadOutlined /> 运维工具</span>,
      children: (
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} md={8}>
            <Card hoverable onClick={() => handleMaintenance('db-vacuum')}>
              <Card.Meta
                avatar={<DatabaseOutlined style={{ fontSize: 32, color: '#1677ff' }} />}
                title="数据库优化"
                description="清理碎片，优化查询性能"
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Card hoverable onClick={() => handleMaintenance('clear-cache')}>
              <Card.Meta
                avatar={<DeleteOutlined style={{ fontSize: 32, color: '#52c41a' }} />}
                title="清理缓存"
                description="清除系统缓存，释放内存"
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Card hoverable onClick={() => { fetchHealth(); fetchMetrics(); message.success('已刷新'); }}>
              <Card.Meta
                avatar={<ReloadOutlined style={{ fontSize: 32, color: '#faad14' }} />}
                title="刷新状态"
                description="重新获取系统状态信息"
              />
            </Card>
          </Col>
        </Row>
      ),
    },
  ];

  return (
    <div style={{ padding: '32px 48px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={4} style={{ margin: 0 }}>
          <DashboardOutlined style={{ marginRight: 8 }} />
          系统监控
        </Title>
        <Space>
          {health && (
            <Tag color={getStatusColor(health.status)} icon={health.status === 'healthy' ? <CheckCircleOutlined /> : <WarningOutlined />}>
              {health.status === 'healthy' ? '系统正常' : '系统异常'}
            </Tag>
          )}
          <Text type="secondary">运行时间: {health?.uptimeFormatted || '-'}</Text>
        </Space>
      </div>

      {/* 状态卡片 */}
      <Row gutter={[24, 24]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={6}>
          <Card style={{ background: 'var(--glass-card-bg)', border: '1px solid var(--glass-border)' }}>
            <Statistic 
              title="系统状态" 
              value={health?.status === 'healthy' ? '正常' : '异常'}
              valueStyle={{ color: health?.status === 'healthy' ? '#52c41a' : '#ff4d4f' }}
              prefix={health?.status === 'healthy' ? <CheckCircleOutlined /> : <WarningOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card style={{ background: 'var(--glass-card-bg)', border: '1px solid var(--glass-border)' }}>
            <Statistic title="API版本" value={health?.version || '-'} />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card style={{ background: 'var(--glass-card-bg)', border: '1px solid var(--glass-border)' }}>
            <Statistic title="内存使用" value={health?.memory?.heapUsed || 0} suffix="MB" />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card style={{ background: 'var(--glass-card-bg)', border: '1px solid var(--glass-border)' }}>
            <Statistic title="任务数" value={tasks.length} prefix={<ClockCircleOutlined />} />
          </Card>
        </Col>
      </Row>

      <Card style={{ background: 'var(--glass-card-bg)', border: '1px solid var(--glass-border)' }}>
        <Tabs items={tabItems} />
      </Card>
    </div>
  );
};

export default SystemMonitor;
