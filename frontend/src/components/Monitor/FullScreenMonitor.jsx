import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Statistic, Progress, Table, Tag, Typography, Space, Button, Switch } from 'antd';
import {
  DesktopOutlined,
  AlertOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  WarningOutlined,
  FullscreenOutlined,
  FullscreenExitOutlined,
  ReloadOutlined,
} from '@ant-design/icons';

const { Title, Text } = Typography;

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const FullScreenMonitor = () => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [stats, setStats] = useState({
    total: 0,
    online: 0,
    offline: 0,
    warning: 0,
  });
  const [devices, setDevices] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  // 获取Token
  const getToken = () => localStorage.getItem('token');

  // 获取设备统计
  const fetchStats = async () => {
    try {
      const token = getToken();
      const res = await fetch(`${API_BASE}/api/devices?pageSize=1000`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.code === 0) {
        const list = data.data.list || [];
        setDevices(list.slice(0, 10)); // 显示前10个
        setStats({
          total: list.length,
          online: list.filter(d => d.status === 'online').length,
          offline: list.filter(d => d.status === 'offline').length,
          warning: list.filter(d => d.status === 'warning' || d.status === 'error').length,
        });
      }
    } catch (err) {
      console.error('Fetch stats error:', err);
    }
  };

  // 获取最新告警
  const fetchAlerts = async () => {
    try {
      const token = getToken();
      const res = await fetch(`${API_BASE}/api/alerts?pageSize=5&status=active`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.code === 0) {
        setAlerts(data.data.list || []);
      }
    } catch (err) {
      console.error('Fetch alerts error:', err);
    } finally {
      setLoading(false);
      setLastUpdate(new Date());
    }
  };

  // 刷新数据
  const refreshData = () => {
    setLoading(true);
    fetchStats();
    fetchAlerts();
  };

  useEffect(() => {
    refreshData();
    // 自动刷新
    let interval;
    if (autoRefresh) {
      interval = setInterval(refreshData, 30000);
    }
    return () => clearInterval(interval);
  }, [autoRefresh]);

  // 全屏切换
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // 状态颜色
  const getStatusColor = (status) => {
    const colors = {
      online: '#52c41a',
      offline: '#ff4d4f',
      warning: '#faad14',
      error: '#ff4d4f',
    };
    return colors[status] || '#d9d9d9';
  };

  // 设备表格列
  const deviceColumns = [
    {
      title: '设备名称',
      dataIndex: 'name',
      key: 'name',
      render: (text) => <Text strong style={{ color: '#fff' }}>{text}</Text>,
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      render: (type) => <Tag color="blue">{type}</Tag>,
    },
    {
      title: 'IP地址',
      dataIndex: 'ipAddress',
      key: 'ipAddress',
      render: (ip) => <Text style={{ color: '#8c8c8c' }}>{ip || '-'}</Text>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Tag color={getStatusColor(status)}>{status?.toUpperCase()}</Tag>
      ),
    },
  ];

  // 告警表格列
  const alertColumns = [
    {
      title: '级别',
      dataIndex: 'severity',
      key: 'severity',
      width: 80,
      render: (severity) => {
        const colors = { critical: '#ff4d4f', warning: '#faad14', info: '#1890ff' };
        return <Tag color={colors[severity]}>{severity}</Tag>;
      },
    },
    {
      title: '告警内容',
      dataIndex: 'message',
      key: 'message',
      render: (msg) => <Text style={{ color: '#fff' }}>{msg}</Text>,
    },
    {
      title: '时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      render: (t) => <Text style={{ color: '#8c8c8c' }}>{new Date(t).toLocaleString()}</Text>,
    },
  ];

  const containerStyle = {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #0a0a1a 0%, #1a1a3a 50%, #0a0a1a 100%)',
    padding: '24px',
    color: '#fff',
  };

  const cardStyle = {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '12px',
  };

  return (
    <div style={containerStyle}>
      {/* 头部 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <Title level={2} style={{ color: '#fff', margin: 0 }}>
            <DesktopOutlined style={{ marginRight: 12 }} />
            设备监控大屏
          </Title>
          <Text style={{ color: '#8c8c8c' }}>
            最后更新: {lastUpdate.toLocaleTimeString()}
          </Text>
        </div>
        <Space>
          <span style={{ color: '#8c8c8c' }}>自动刷新</span>
          <Switch checked={autoRefresh} onChange={setAutoRefresh} />
          <Button icon={<ReloadOutlined />} onClick={refreshData} loading={loading}>刷新</Button>
          <Button 
            icon={isFullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />} 
            onClick={toggleFullscreen}
          >
            {isFullscreen ? '退出全屏' : '全屏'}
          </Button>
        </Space>
      </div>

      {/* 统计卡片 */}
      <Row gutter={[24, 24]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={6}>
          <Card style={cardStyle} bodyStyle={{ padding: 24 }}>
            <Statistic
              title={<span style={{ color: '#8c8c8c' }}>设备总数</span>}
              value={stats.total}
              prefix={<DesktopOutlined style={{ color: '#1890ff' }} />}
              valueStyle={{ color: '#fff', fontSize: 36 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card style={cardStyle} bodyStyle={{ padding: 24 }}>
            <Statistic
              title={<span style={{ color: '#8c8c8c' }}>在线设备</span>}
              value={stats.online}
              prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
              valueStyle={{ color: '#52c41a', fontSize: 36 }}
            />
            <Progress 
              percent={stats.total ? Math.round(stats.online / stats.total * 100) : 0} 
              strokeColor="#52c41a"
              trailColor="rgba(255,255,255,0.1)"
              showInfo={false}
              style={{ marginTop: 8 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card style={cardStyle} bodyStyle={{ padding: 24 }}>
            <Statistic
              title={<span style={{ color: '#8c8c8c' }}>离线设备</span>}
              value={stats.offline}
              prefix={<CloseCircleOutlined style={{ color: '#ff4d4f' }} />}
              valueStyle={{ color: '#ff4d4f', fontSize: 36 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card style={cardStyle} bodyStyle={{ padding: 24 }}>
            <Statistic
              title={<span style={{ color: '#8c8c8c' }}>告警设备</span>}
              value={stats.warning}
              prefix={<WarningOutlined style={{ color: '#faad14' }} />}
              valueStyle={{ color: '#faad14', fontSize: 36 }}
            />
          </Card>
        </Col>
      </Row>

      {/* 设备列表和告警 */}
      <Row gutter={[24, 24]}>
        <Col xs={24} lg={14}>
          <Card 
            title={<span style={{ color: '#fff' }}><DesktopOutlined /> 设备状态</span>}
            style={cardStyle}
            headStyle={{ background: 'transparent', borderBottom: '1px solid rgba(255,255,255,0.1)' }}
          >
            <Table
              dataSource={devices}
              columns={deviceColumns}
              rowKey="id"
              pagination={false}
              size="small"
              style={{ background: 'transparent' }}
            />
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card 
            title={<span style={{ color: '#fff' }}><AlertOutlined /> 最新告警</span>}
            style={cardStyle}
            headStyle={{ background: 'transparent', borderBottom: '1px solid rgba(255,255,255,0.1)' }}
          >
            {alerts.length > 0 ? (
              <Table
                dataSource={alerts}
                columns={alertColumns}
                rowKey="id"
                pagination={false}
                size="small"
              />
            ) : (
              <div style={{ textAlign: 'center', padding: 40, color: '#8c8c8c' }}>
                <CheckCircleOutlined style={{ fontSize: 48, color: '#52c41a' }} />
                <div style={{ marginTop: 16 }}>暂无活跃告警</div>
              </div>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default FullScreenMonitor;
