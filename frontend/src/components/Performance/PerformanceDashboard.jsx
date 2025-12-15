import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Row,
  Col,
  Statistic,
  Progress,
  Typography,
  Table,
  Tag,
  Space,
  Button
} from 'antd';
import { 
  DashboardOutlined, 
  ReloadOutlined,
  CloudServerOutlined,
  DatabaseOutlined,
  WifiOutlined,
  ThunderboltOutlined,
  CheckCircleOutlined
} from '@ant-design/icons';

const { Title, Text } = Typography;

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const PerformanceDashboard = () => {
  const [overview, setOverview] = useState(null);
  const [services, setServices] = useState([]);
  const [topDevices, setTopDevices] = useState([]);
  const [loading, setLoading] = useState(false);

  const getToken = () => localStorage.getItem('token');

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [overviewRes, servicesRes, topRes] = await Promise.all([
        fetch(`${API_BASE}/api/performance/overview`, { headers: { Authorization: `Bearer ${getToken()}` } }),
        fetch(`${API_BASE}/api/performance/services`, { headers: { Authorization: `Bearer ${getToken()}` } }),
        fetch(`${API_BASE}/api/performance/top-devices?metric=cpu`, { headers: { Authorization: `Bearer ${getToken()}` } }),
      ]);

      const [overviewData, servicesData, topData] = await Promise.all([
        overviewRes.json(), servicesRes.json(), topRes.json(),
      ]);

      if (overviewData.code === 0) setOverview(overviewData.data);
      if (servicesData.code === 0) setServices(servicesData.data || []);
      if (topData.code === 0) setTopDevices(topData.data || []);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 30000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getStatusColor = (value, thresholds = [60, 80]) => {
    if (value < thresholds[0]) return '#52c41a';
    if (value < thresholds[1]) return '#faad14';
    return '#f5222d';
  };

  const serviceColumns = [
    { title: '服务', dataIndex: 'name', render: (n) => <><CloudServerOutlined /> {n}</> },
    { 
      title: '状态', 
      dataIndex: 'status', 
      render: (s) => <Tag color={s === 'healthy' ? 'green' : 'red'}>{s === 'healthy' ? '健康' : '异常'}</Tag>
    },
    { title: '运行时长', dataIndex: 'uptime' },
    { title: '响应时间', dataIndex: 'responseTime', render: (t) => t ? `${t}ms` : '-' },
  ];

  const deviceColumns = [
    { title: '排名', dataIndex: 'rank', width: 60 },
    { title: '设备', dataIndex: 'name' },
    { title: 'IP', dataIndex: 'ip' },
    { 
      title: 'CPU使用率', 
      dataIndex: 'value', 
      render: (v) => <Progress percent={v} size="small" strokeColor={getStatusColor(v)} />
    },
  ];

  return (
    <div style={{ padding: '24px 32px' }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <Col>
          <Title level={3} style={{ margin: 0 }}>
            <DashboardOutlined style={{ marginRight: 12 }} />
            性能监控
          </Title>
        </Col>
        <Col>
          <Button icon={<ReloadOutlined />} onClick={fetchAll} loading={loading}>刷新</Button>
        </Col>
      </Row>

      {/* 系统资源概览 */}
      {overview && (
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={6}>
            <Card title={<><ThunderboltOutlined /> CPU</>} size="small">
              <Progress 
                type="dashboard" 
                percent={overview.cpu.current} 
                strokeColor={getStatusColor(overview.cpu.current)}
                format={(p) => `${p}%`}
              />
              <Text type="secondary" style={{ display: 'block', textAlign: 'center', marginTop: 8 }}>
                24h峰值: {overview.cpu.peak24h}%
              </Text>
            </Card>
          </Col>
          <Col span={6}>
            <Card title={<><DatabaseOutlined /> 内存</>} size="small">
              <Progress 
                type="dashboard" 
                percent={overview.memory.current} 
                strokeColor={getStatusColor(overview.memory.current)}
                format={(p) => `${p}%`}
              />
              <Text type="secondary" style={{ display: 'block', textAlign: 'center', marginTop: 8 }}>
                {(overview.memory.used / 1024).toFixed(1)}GB / {(overview.memory.total / 1024).toFixed(0)}GB
              </Text>
            </Card>
          </Col>
          <Col span={6}>
            <Card title={<><DatabaseOutlined /> 磁盘</>} size="small">
              <Progress 
                type="dashboard" 
                percent={overview.disk.current} 
                strokeColor={getStatusColor(overview.disk.current)}
                format={(p) => `${p}%`}
              />
              <Text type="secondary" style={{ display: 'block', textAlign: 'center', marginTop: 8 }}>
                {overview.disk.used}GB / {overview.disk.total}GB
              </Text>
            </Card>
          </Col>
          <Col span={6}>
            <Card title={<><WifiOutlined /> 网络</>} size="small">
              <Statistic title="入站" value={overview.network.inbound} suffix="Mbps" />
              <Statistic title="出站" value={overview.network.outbound} suffix="Mbps" style={{ marginTop: 8 }} />
            </Card>
          </Col>
        </Row>
      )}

      {/* 数据库和服务状态 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        {overview && (
          <Col span={8}>
            <Card title={<><DatabaseOutlined /> 数据库</>} size="small">
              <Space direction="vertical" style={{ width: '100%' }}>
                <Row justify="space-between">
                  <Text>连接数:</Text>
                  <Text strong>{overview.database.connections} / {overview.database.maxConnections}</Text>
                </Row>
                <Row justify="space-between">
                  <Text>查询响应:</Text>
                  <Text strong>{overview.database.queryTime}ms</Text>
                </Row>
                <Row justify="space-between">
                  <Text>活跃查询:</Text>
                  <Text strong>{overview.database.activeQueries}</Text>
                </Row>
              </Space>
            </Card>
          </Col>
        )}
        <Col span={16}>
          <Card title={<><CheckCircleOutlined /> 服务状态</>} size="small">
            <Table 
              columns={serviceColumns} 
              dataSource={services} 
              rowKey="name" 
              pagination={false} 
              size="small"
              loading={loading}
            />
          </Card>
        </Col>
      </Row>

      {/* TOP设备 */}
      <Card title="CPU使用率 TOP设备">
        <Table 
          columns={deviceColumns} 
          dataSource={topDevices} 
          rowKey="id" 
          pagination={false}
          loading={loading}
        />
      </Card>
    </div>
  );
};

export default PerformanceDashboard;
