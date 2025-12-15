import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Space, Tag, Typography, Row, Col, Statistic, Tabs } from 'antd';
import { DatabaseOutlined, ReloadOutlined, CloudServerOutlined, WifiOutlined, SafetyOutlined, LinkOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const CmdbManagement = () => {
  const [assets, setAssets] = useState([]);
  const [types, setTypes] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeType, setActiveType] = useState('all');

  const getToken = () => localStorage.getItem('token');

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [typesRes, assetsRes, statsRes] = await Promise.all([
        fetch(`${API_BASE}/api/cmdb/types`, { headers: { Authorization: `Bearer ${getToken()}` } }),
        fetch(`${API_BASE}/api/cmdb/assets${activeType !== 'all' ? `?type=${activeType}` : ''}`, { headers: { Authorization: `Bearer ${getToken()}` } }),
        fetch(`${API_BASE}/api/cmdb/stats`, { headers: { Authorization: `Bearer ${getToken()}` } }),
      ]);
      const [typesData, assetsData, statsData] = await Promise.all([typesRes.json(), assetsRes.json(), statsRes.json()]);
      if (typesData.code === 0) setTypes(typesData.data || []);
      if (assetsData.code === 0) setAssets(assetsData.data || []);
      if (statsData.code === 0) setStats(statsData.data);
    } catch { /* ignore */ } finally { setLoading(false); }
  };

  useEffect(() => { 
    fetchAll(); 
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeType]);

  const columns = [
    { title: '名称', dataIndex: 'name' },
    { title: '类型', dataIndex: 'type', render: (t) => <Tag>{t}</Tag> },
    { title: 'IP', dataIndex: 'ip' },
    { title: '厂商', dataIndex: 'vendor' },
    { title: '型号', dataIndex: 'model' },
    { title: '状态', dataIndex: 'status', render: (s) => <Tag color={s === 'online' ? 'green' : 'red'}>{s}</Tag> },
    { title: '位置', dataIndex: 'location' },
  ];

  return (
    <div style={{ padding: '24px 32px' }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <Col><Title level={3} style={{ margin: 0 }}><DatabaseOutlined style={{ marginRight: 12 }} />CMDB配置管理</Title></Col>
        <Col><Button icon={<ReloadOutlined />} onClick={fetchAll}>刷新</Button></Col>
      </Row>

      {stats && (
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={6}><Card size="small"><Statistic title="总资产数" value={stats.totalAssets} prefix={<DatabaseOutlined />} /></Card></Col>
          <Col span={6}><Card size="small"><Statistic title="服务器" value={types.find(t => t.id === 'server')?.count || 0} prefix={<CloudServerOutlined />} /></Card></Col>
          <Col span={6}><Card size="small"><Statistic title="网络设备" value={types.find(t => t.id === 'network')?.count || 0} prefix={<WifiOutlined />} /></Card></Col>
          <Col span={6}><Card size="small"><Statistic title="资产关系" value={stats.relations} prefix={<LinkOutlined />} /></Card></Col>
        </Row>
      )}

      <Card>
        <Tabs 
          activeKey={activeType} 
          onChange={setActiveType}
          items={[
            { key: 'all', label: '全部' },
            ...types.map(t => ({ key: t.id, label: t.name })),
          ]} 
        />
        <Table columns={columns} dataSource={assets} rowKey="id" loading={loading} />
      </Card>
    </div>
  );
};

export default CmdbManagement;
