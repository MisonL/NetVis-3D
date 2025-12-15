import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Space, Tag, Typography, Row, Col, Statistic, Progress } from 'antd';
import { LinkOutlined, ReloadOutlined, CheckCircleOutlined, CloseCircleOutlined, WarningOutlined } from '@ant-design/icons';

const { Title } = Typography;
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const LinkMonitor = () => {
  const [links, setLinks] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);

  const getToken = () => localStorage.getItem('token');

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [linksRes, statsRes] = await Promise.all([
        fetch(`${API_BASE}/api/links`, { headers: { Authorization: `Bearer ${getToken()}` } }),
        fetch(`${API_BASE}/api/links/stats/overview`, { headers: { Authorization: `Bearer ${getToken()}` } }),
      ]);
      const [linksData, statsData] = await Promise.all([linksRes.json(), statsRes.json()]);
      if (linksData.code === 0) setLinks(linksData.data || []);
      if (statsData.code === 0) setStats(statsData.data);
    } catch { /* ignore */ } finally { setLoading(false); }
  };

  useEffect(() => { 
    fetchAll(); 
    const i = setInterval(fetchAll, 10000);
    return () => clearInterval(i);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getStatusIcon = (status) => {
    if (status === 'up') return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
    if (status === 'down') return <CloseCircleOutlined style={{ color: '#f5222d' }} />;
    return <WarningOutlined style={{ color: '#faad14' }} />;
  };

  const columns = [
    { title: '链路名称', dataIndex: 'name' },
    { title: '源设备', dataIndex: 'sourceDevice' },
    { title: '源端口', dataIndex: 'sourcePort' },
    { title: '目标设备', dataIndex: 'targetDevice' },
    { title: '目标端口', dataIndex: 'targetPort' },
    { title: '带宽', dataIndex: 'bandwidth', render: (b) => `${b >= 1000 ? b / 1000 + 'G' : b + 'M'}` },
    { title: '状态', dataIndex: 'status', render: (s) => <>{getStatusIcon(s)} {s.toUpperCase()}</> },
    { title: '延迟', dataIndex: 'latency', render: (l) => `${l.toFixed(1)}ms` },
    { title: '利用率', dataIndex: 'utilization', render: (u) => <Progress percent={u} size="small" strokeColor={u > 80 ? '#f5222d' : u > 60 ? '#faad14' : '#52c41a'} /> },
  ];

  return (
    <div style={{ padding: '24px 32px' }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <Col><Title level={3} style={{ margin: 0 }}><LinkOutlined style={{ marginRight: 12 }} />链路监控</Title></Col>
        <Col><Button icon={<ReloadOutlined />} onClick={fetchAll}>刷新</Button></Col>
      </Row>

      {stats && (
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={4}><Card size="small"><Statistic title="总链路" value={stats.total} /></Card></Col>
          <Col span={4}><Card size="small"><Statistic title="正常" value={stats.up} valueStyle={{ color: '#52c41a' }} prefix={<CheckCircleOutlined />} /></Card></Col>
          <Col span={4}><Card size="small"><Statistic title="故障" value={stats.down} valueStyle={{ color: '#f5222d' }} prefix={<CloseCircleOutlined />} /></Card></Col>
          <Col span={4}><Card size="small"><Statistic title="降级" value={stats.degraded} valueStyle={{ color: '#faad14' }} prefix={<WarningOutlined />} /></Card></Col>
          <Col span={4}><Card size="small"><Statistic title="平均延迟" value={stats.avgLatency} suffix="ms" /></Card></Col>
          <Col span={4}><Card size="small"><Statistic title="高负载链路" value={stats.highUtilization} valueStyle={{ color: stats.highUtilization > 0 ? '#faad14' : '#52c41a' }} /></Card></Col>
        </Row>
      )}

      <Card><Table columns={columns} dataSource={links} rowKey="id" loading={loading} /></Card>
    </div>
  );
};

export default LinkMonitor;
