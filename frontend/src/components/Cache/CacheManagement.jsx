import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Space, Tag, Typography, Row, Col, Statistic, Modal, message, Popconfirm, Input, Badge } from 'antd';
import { DatabaseOutlined, ReloadOutlined, DeleteOutlined, ClearOutlined, SearchOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;
const { Search } = Input;
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const CacheManagement = () => {
  const [status, setStatus] = useState(null);
  const [keys, setKeys] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchPattern, setSearchPattern] = useState('*');

  const getToken = () => localStorage.getItem('token');

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [statusRes, keysRes, statsRes] = await Promise.all([
        fetch(`${API_BASE}/api/cache/status`, { headers: { Authorization: `Bearer ${getToken()}` } }),
        fetch(`${API_BASE}/api/cache/keys?pattern=${searchPattern}`, { headers: { Authorization: `Bearer ${getToken()}` } }),
        fetch(`${API_BASE}/api/cache/stats`, { headers: { Authorization: `Bearer ${getToken()}` } }),
      ]);
      const [statusData, keysData, statsData] = await Promise.all([statusRes.json(), keysRes.json(), statsRes.json()]);
      if (statusData.code === 0) setStatus(statusData.data);
      if (keysData.code === 0) setKeys(keysData.data || []);
      if (statsData.code === 0) setStats(statsData.data);
    } catch { /* ignore */ } finally { setLoading(false); }
  };

  useEffect(() => { 
    fetchAll(); 
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchPattern]);

  const handleDelete = async (key) => {
    try {
      const res = await fetch(`${API_BASE}/api/cache/keys/${encodeURIComponent(key)}`, { method: 'DELETE', headers: { Authorization: `Bearer ${getToken()}` } });
      const data = await res.json();
      if (data.code === 0) { message.success('已删除'); fetchAll(); }
    } catch { message.error('删除失败'); }
  };

  const handleFlush = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/cache/flush`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ confirm: true }),
      });
      const data = await res.json();
      if (data.code === 0) { message.success(data.message); fetchAll(); }
    } catch { message.error('操作失败'); }
  };

  const columns = [
    { title: '键名', dataIndex: 'key', ellipsis: true },
    { title: '类型', dataIndex: 'type', render: (t) => <Tag color={t === 'string' ? 'blue' : t === 'hash' ? 'green' : t === 'list' ? 'orange' : 'purple'}>{t}</Tag> },
    { title: '大小', dataIndex: 'size', render: (s) => s >= 1024 ? `${(s / 1024).toFixed(1)} KB` : `${s} B` },
    { title: 'TTL', dataIndex: 'ttl', render: (t) => t === -1 ? <Tag>永久</Tag> : `${t}s` },
    { title: '最后访问', dataIndex: 'lastAccess', render: (t) => new Date(t).toLocaleString() },
    { title: '操作', render: (_, r) => <Popconfirm title="确定删除？" onConfirm={() => handleDelete(r.key)}><Button type="link" danger size="small" icon={<DeleteOutlined />}>删除</Button></Popconfirm> },
  ];

  return (
    <div style={{ padding: '24px 32px' }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <Col><Title level={3} style={{ margin: 0 }}><DatabaseOutlined style={{ marginRight: 12 }} />Redis缓存管理</Title></Col>
        <Col><Space><Popconfirm title="确定清空所有缓存？" onConfirm={handleFlush}><Button danger icon={<ClearOutlined />}>清空缓存</Button></Popconfirm><Button icon={<ReloadOutlined />} onClick={fetchAll}>刷新</Button></Space></Col>
      </Row>

      {status && (
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={3}><Card size="small"><Statistic title="状态" valueRender={() => status.connected ? <Badge status="success" text="已连接" /> : <Badge status="error" text="断开" />} /></Card></Col>
          <Col span={3}><Card size="small"><Statistic title="内存" value={status.usedMemory} /></Card></Col>
          <Col span={3}><Card size="small"><Statistic title="键总数" value={status.keys} /></Card></Col>
          <Col span={3}><Card size="small"><Statistic title="命中率" value={status.hitRate} suffix="%" valueStyle={{ color: '#52c41a' }} /></Card></Col>
          <Col span={3}><Card size="small"><Statistic title="客户端" value={status.clients} /></Card></Col>
          <Col span={3}><Card size="small"><Statistic title="OPS/s" value={status.ops} /></Card></Col>
          <Col span={3}><Card size="small"><Statistic title="运行时间" value={status.uptime} /></Card></Col>
          <Col span={3}><Card size="small"><Statistic title="地址" valueRender={() => <Text code style={{ fontSize: 12 }}>{status.host}</Text>} /></Card></Col>
        </Row>
      )}

      <Card title="缓存键列表">
        <Space style={{ marginBottom: 16 }}>
          <Search placeholder="搜索键名..." onSearch={setSearchPattern} style={{ width: 300 }} allowClear />
          {stats && <Text type="secondary">类型分布: String({stats.byType?.string}) Hash({stats.byType?.hash}) List({stats.byType?.list})</Text>}
        </Space>
        <Table columns={columns} dataSource={keys} rowKey="key" loading={loading} size="small" />
      </Card>
    </div>
  );
};

export default CacheManagement;
