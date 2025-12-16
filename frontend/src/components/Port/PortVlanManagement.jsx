import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Space, Tag, Typography, Row, Col, Statistic, Tabs } from 'antd';
import { ApiOutlined, ReloadOutlined, LinkOutlined, BranchesOutlined } from '@ant-design/icons';

const { Title } = Typography;
import { API_BASE_URL } from '../../config';
const API_BASE = API_BASE_URL;

const PortVlanManagement = () => {
  const [mappings, setMappings] = useState([]);
  const [vlans, setVlans] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);

  const getToken = () => localStorage.getItem('token');

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [mappingsRes, vlansRes, statsRes] = await Promise.all([
        fetch(`${API_BASE}/api/port-mapping/mappings`, { headers: { Authorization: `Bearer ${getToken()}` } }),
        fetch(`${API_BASE}/api/port-mapping/vlans`, { headers: { Authorization: `Bearer ${getToken()}` } }),
        fetch(`${API_BASE}/api/port-mapping/stats`, { headers: { Authorization: `Bearer ${getToken()}` } }),
      ]);
      const [mappingsData, vlansData, statsData] = await Promise.all([mappingsRes.json(), vlansRes.json(), statsRes.json()]);
      if (mappingsData.code === 0) setMappings(mappingsData.data || []);
      if (vlansData.code === 0) setVlans(vlansData.data || []);
      if (statsData.code === 0) setStats(statsData.data);
    } catch { /* ignore */ } finally { setLoading(false); }
  };

  useEffect(() => { 
    fetchAll(); 
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const mappingColumns = [
    { title: '名称', dataIndex: 'name' },
    { title: '本地设备', dataIndex: 'deviceId' },
    { title: '本地端口', dataIndex: 'devicePort' },
    { title: '远端设备', dataIndex: 'remoteDevice' },
    { title: '远端端口', dataIndex: 'remotePort' },
    { title: '协议', dataIndex: 'protocol', render: (p) => <Tag color={p === 'trunk' ? 'blue' : 'green'}>{p.toUpperCase()}</Tag> },
    { title: 'VLAN', dataIndex: 'vlan' },
    { title: '速率', dataIndex: 'speed' },
    { title: '状态', dataIndex: 'status', render: (s) => <Tag color={s === 'active' ? 'green' : 'default'}>{s === 'active' ? '活动' : '非活动'}</Tag> },
  ];

  const vlanColumns = [
    { title: 'VLAN ID', dataIndex: 'vlanId', render: (v) => <Tag color="blue">{v}</Tag> },
    { title: '名称', dataIndex: 'name' },
    { title: '描述', dataIndex: 'description' },
    { title: '端口数', dataIndex: 'portCount' },
  ];

  const tabItems = [
    {
      key: 'mappings',
      label: <><LinkOutlined /> 端口映射</>,
      children: <Table columns={mappingColumns} dataSource={mappings} rowKey="id" loading={loading} />,
    },
    {
      key: 'vlans',
      label: <><BranchesOutlined /> VLAN管理</>,
      children: <Table columns={vlanColumns} dataSource={vlans} rowKey="id" loading={loading} />,
    },
  ];

  return (
    <div style={{ padding: '24px 32px' }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <Col><Title level={3} style={{ margin: 0 }}><ApiOutlined style={{ marginRight: 12 }} />端口与VLAN管理</Title></Col>
        <Col><Button icon={<ReloadOutlined />} onClick={fetchAll}>刷新</Button></Col>
      </Row>

      {stats && (
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={4}><Card size="small"><Statistic title="总端口" value={stats.totalPorts} /></Card></Col>
          <Col span={4}><Card size="small"><Statistic title="活动端口" value={stats.activePorts} valueStyle={{ color: '#52c41a' }} /></Card></Col>
          <Col span={4}><Card size="small"><Statistic title="Trunk端口" value={stats.trunkPorts} /></Card></Col>
          <Col span={4}><Card size="small"><Statistic title="Access端口" value={stats.accessPorts} /></Card></Col>
          <Col span={4}><Card size="small"><Statistic title="VLAN数量" value={stats.vlanCount} /></Card></Col>
          <Col span={4}><Card size="small"><Statistic title="10G端口" value={stats.speedDistribution?.['10G'] || 0} /></Card></Col>
        </Row>
      )}

      <Card><Tabs items={tabItems} /></Card>
    </div>
  );
};

export default PortVlanManagement;
