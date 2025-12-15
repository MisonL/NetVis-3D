import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Space, Tag, Typography, Row, Col, Statistic, Modal, Form, Input, InputNumber, Select, message, Popconfirm, Switch } from 'antd';
import { ThunderboltOutlined, ReloadOutlined, PlusOutlined, DeleteOutlined, ApiOutlined } from '@ant-design/icons';

const { Title } = Typography;
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const RateLimitManagement = () => {
  const [rules, setRules] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();

  const getToken = () => localStorage.getItem('token');

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [rulesRes, statsRes] = await Promise.all([
        fetch(`${API_BASE}/api/rate-limit/rules`, { headers: { Authorization: `Bearer ${getToken()}` } }),
        fetch(`${API_BASE}/api/rate-limit/stats`, { headers: { Authorization: `Bearer ${getToken()}` } }),
      ]);
      const [rulesData, statsData] = await Promise.all([rulesRes.json(), statsRes.json()]);
      if (rulesData.code === 0) setRules(rulesData.data || []);
      if (statsData.code === 0) setStats(statsData.data);
    } catch { /* ignore */ } finally { setLoading(false); }
  };

  useEffect(() => { 
    fetchAll(); 
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreate = async (values) => {
    try {
      const res = await fetch(`${API_BASE}/api/rate-limit/rules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (data.code === 0) { message.success('规则已创建'); setModalOpen(false); form.resetFields(); fetchAll(); }
    } catch { message.error('创建失败'); }
  };

  const handleToggle = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/api/rate-limit/rules/${id}/toggle`, { method: 'POST', headers: { Authorization: `Bearer ${getToken()}` } });
      const data = await res.json();
      if (data.code === 0) { message.success(data.message); fetchAll(); }
    } catch { message.error('操作失败'); }
  };

  const handleDelete = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/api/rate-limit/rules/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${getToken()}` } });
      const data = await res.json();
      if (data.code === 0) { message.success('已删除'); fetchAll(); }
    } catch { message.error('删除失败'); }
  };

  const columns = [
    { title: '名称', dataIndex: 'name' },
    { title: '路径', dataIndex: 'path', render: (p) => <code>{p}</code> },
    { title: '方法', dataIndex: 'method', render: (m) => <Tag color="blue">{m}</Tag> },
    { title: '限制', render: (_, r) => `${r.limit} / ${r.window}s` },
    { title: '命中', dataIndex: 'hitCount', render: (h) => h.toLocaleString() },
    { title: '阻止', dataIndex: 'blockedCount', render: (b) => <span style={{ color: b > 0 ? '#f5222d' : '#52c41a' }}>{b.toLocaleString()}</span> },
    { title: '状态', dataIndex: 'enabled', render: (e, r) => <Switch checked={e} onChange={() => handleToggle(r.id)} /> },
    { title: '操作', render: (_, r) => <Popconfirm title="确定删除？" onConfirm={() => handleDelete(r.id)}><Button type="link" danger size="small" icon={<DeleteOutlined />}>删除</Button></Popconfirm> },
  ];

  return (
    <div style={{ padding: '24px 32px' }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <Col><Title level={3} style={{ margin: 0 }}><ThunderboltOutlined style={{ marginRight: 12 }} />API限流管理</Title></Col>
        <Col><Space><Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>新建规则</Button><Button icon={<ReloadOutlined />} onClick={fetchAll}>刷新</Button></Space></Col>
      </Row>

      {stats && (
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={4}><Card size="small"><Statistic title="总请求" value={stats.totalRequests?.toLocaleString()} /></Card></Col>
          <Col span={4}><Card size="small"><Statistic title="被阻止" value={stats.blockedRequests?.toLocaleString()} valueStyle={{ color: '#f5222d' }} /></Card></Col>
          <Col span={4}><Card size="small"><Statistic title="平均延迟" value={stats.avgLatency?.toFixed(1)} suffix="ms" /></Card></Col>
          <Col span={4}><Card size="small"><Statistic title="峰值RPS" value={stats.peakRps} /></Card></Col>
          <Col span={4}><Card size="small"><Statistic title="规则数" value={stats.rulesCount} /></Card></Col>
          <Col span={4}><Card size="small"><Statistic title="已启用" value={stats.enabledRules} valueStyle={{ color: '#52c41a' }} /></Card></Col>
        </Row>
      )}

      <Card><Table columns={columns} dataSource={rules} rowKey="id" loading={loading} /></Card>

      <Modal title="新建限流规则" open={modalOpen} onCancel={() => setModalOpen(false)} onOk={() => form.submit()} width={600}>
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item name="name" label="规则名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Row gutter={16}>
            <Col span={16}><Form.Item name="path" label="API路径" rules={[{ required: true }]}><Input placeholder="/api/*" /></Form.Item></Col>
            <Col span={8}><Form.Item name="method" label="方法" rules={[{ required: true }]}><Select options={[{ value: 'ALL', label: '全部' }, { value: 'GET', label: 'GET' }, { value: 'POST', label: 'POST' }]} /></Form.Item></Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}><Form.Item name="limit" label="请求次数限制" rules={[{ required: true }]}><InputNumber min={1} style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={12}><Form.Item name="window" label="时间窗口(秒)" rules={[{ required: true }]}><InputNumber min={1} style={{ width: '100%' }} /></Form.Item></Col>
          </Row>
        </Form>
      </Modal>
    </div>
  );
};

export default RateLimitManagement;
