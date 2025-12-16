import React, { useState, useEffect } from 'react';
import { 
  Card, Row, Col, Statistic, Typography, Progress, Table, 
  Spin, Space 
} from 'antd';
import { 
  DesktopOutlined, UserOutlined, BellOutlined, 
  RiseOutlined, FallOutlined, DashboardOutlined
} from '@ant-design/icons';
import { useAuth } from '../../context/AuthContext';

const { Title, Text } = Typography;

import { API_BASE_URL } from '../../config';
const API_BASE = API_BASE_URL;

const AnalyticsDashboard = () => {
  const { token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [dashboardData, setDashboardData] = useState(null);
  const [topDevices, setTopDevices] = useState(null);

  useEffect(() => {
    fetchDashboardData();
    fetchTopDevices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/analytics/dashboard`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.code === 0) {
        setDashboardData(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchTopDevices = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/analytics/top-devices`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.code === 0) {
        setTopDevices(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch top devices:', err);
    }
  };

  const topColumns = [
    { title: '设备名称', dataIndex: 'name', key: 'name' },
    { title: 'IP地址', dataIndex: 'ip', key: 'ip' },
    { 
      title: '数值', 
      dataIndex: 'value', 
      key: 'value',
      render: (val) => (
        <Progress 
          percent={val > 100 ? 100 : val} 
          size="small" 
          format={() => val > 100 ? `${val} Mbps` : `${val}%`}
        />
      ),
    },
  ];

  if (loading && !dashboardData) {
    return (
      <div style={{ padding: 48, textAlign: 'center' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div style={{ padding: '32px 48px' }}>
      <Title level={4} style={{ marginBottom: 24 }}>
        <DashboardOutlined style={{ marginRight: 8 }} />
        数据分析报表
      </Title>

      {/* 统计卡片 */}
      <Row gutter={[24, 24]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={8}>
          <Card style={{ background: 'var(--glass-card-bg)', border: '1px solid var(--glass-border)' }}>
            <Statistic
              title="总设备数"
              value={dashboardData?.summary?.totalDevices || 0}
              prefix={<DesktopOutlined />}
              valueStyle={{ color: '#1677ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card style={{ background: 'var(--glass-card-bg)', border: '1px solid var(--glass-border)' }}>
            <Statistic
              title="总用户数"
              value={dashboardData?.summary?.totalUsers || 0}
              prefix={<UserOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card style={{ background: 'var(--glass-card-bg)', border: '1px solid var(--glass-border)' }}>
            <Statistic
              title="总告警数"
              value={dashboardData?.summary?.totalAlerts || 0}
              prefix={<BellOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
      </Row>

      {/* TOP设备列表 */}
      <Row gutter={[24, 24]}>
        <Col xs={24} lg={8}>
          <Card 
            title="CPU TOP 5" 
            size="small"
            style={{ background: 'var(--glass-card-bg)', border: '1px solid var(--glass-border)' }}
          >
            <Table
              columns={topColumns}
              dataSource={topDevices?.byCpu || []}
              rowKey="name"
              pagination={false}
              size="small"
            />
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card 
            title="内存 TOP 5" 
            size="small"
            style={{ background: 'var(--glass-card-bg)', border: '1px solid var(--glass-border)' }}
          >
            <Table
              columns={topColumns}
              dataSource={topDevices?.byMemory || []}
              rowKey="name"
              pagination={false}
              size="small"
            />
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card 
            title="流量 TOP 5" 
            size="small"
            style={{ background: 'var(--glass-card-bg)', border: '1px solid var(--glass-border)' }}
          >
            <Table
              columns={topColumns}
              dataSource={topDevices?.byTraffic || []}
              rowKey="name"
              pagination={false}
              size="small"
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default AnalyticsDashboard;
