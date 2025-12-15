import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Space, Tag, Typography, Row, Col, Statistic, Modal, Form, Input, Select, message, Popconfirm, Switch, Badge } from 'antd';
import { NotificationOutlined, ReloadOutlined, PlusOutlined, DeleteOutlined, SendOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';

const { Title } = Typography;
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const AlertChannelManagement = () => {
  const [channels, setChannels] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [channelType, setChannelType] = useState('email');

  const getToken = () => localStorage.getItem('token');

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [channelsRes, statsRes] = await Promise.all([
        fetch(`${API_BASE}/api/alert-channels`, { headers: { Authorization: `Bearer ${getToken()}` } }),
        fetch(`${API_BASE}/api/alert-channels/stats/overview`, { headers: { Authorization: `Bearer ${getToken()}` } }),
      ]);
      const [channelsData, statsData] = await Promise.all([channelsRes.json(), statsRes.json()]);
      if (channelsData.code === 0) setChannels(channelsData.data || []);
      if (statsData.code === 0) setStats(statsData.data);
    } catch { /* ignore */ } finally { setLoading(false); }
  };

  useEffect(() => { 
    fetchAll(); 
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreate = async (values) => {
    try {
      const res = await fetch(`${API_BASE}/api/alert-channels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ name: values.name, type: values.type, config: { [values.configKey]: values.configValue } }),
      });
      const data = await res.json();
      if (data.code === 0) { message.success('渠道已创建'); setModalOpen(false); form.resetFields(); fetchAll(); }
    } catch { message.error('创建失败'); }
  };

  const handleTest = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/api/alert-channels/${id}/test`, { method: 'POST', headers: { Authorization: `Bearer ${getToken()}` } });
      const data = await res.json();
      if (data.code === 0) { message.info(data.data.success ? '测试成功' : '测试失败: ' + data.data.message); fetchAll(); }
    } catch { message.error('测试失败'); }
  };

  const handleToggle = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/api/alert-channels/${id}/toggle`, { method: 'POST', headers: { Authorization: `Bearer ${getToken()}` } });
      const data = await res.json();
      if (data.code === 0) { message.success(data.message); fetchAll(); }
    } catch { message.error('操作失败'); }
  };

  const handleDelete = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/api/alert-channels/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${getToken()}` } });
      const data = await res.json();
      if (data.code === 0) { message.success('已删除'); fetchAll(); }
    } catch { message.error('删除失败'); }
  };

  const typeColors = { email: 'blue', webhook: 'purple', sms: 'green', dingtalk: 'orange', wechat: 'cyan' };

  const columns = [
    { title: '名称', dataIndex: 'name' },
    { title: '类型', dataIndex: 'type', render: (t) => <Tag color={typeColors[t]}>{t.toUpperCase()}</Tag> },
    { title: '状态', dataIndex: 'enabled', render: (e, r) => <Switch checked={e} onChange={() => handleToggle(r.id)} /> },
    { title: '测试结果', dataIndex: 'testResult', render: (r) => r ? (r.success ? <Badge status="success" text="成功" /> : <Badge status="error" text="失败" />) : <Badge status="default" text="未测试" /> },
    { title: '操作', render: (_, r) => (
      <Space>
        <Button type="link" size="small" icon={<SendOutlined />} onClick={() => handleTest(r.id)}>测试</Button>
        <Popconfirm title="确定删除？" onConfirm={() => handleDelete(r.id)}><Button type="link" danger size="small" icon={<DeleteOutlined />}>删除</Button></Popconfirm>
      </Space>
    )},
  ];

  return (
    <div style={{ padding: '24px 32px' }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <Col><Title level={3} style={{ margin: 0 }}><NotificationOutlined style={{ marginRight: 12 }} />告警通知渠道</Title></Col>
        <Col><Space><Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>新建渠道</Button><Button icon={<ReloadOutlined />} onClick={fetchAll}>刷新</Button></Space></Col>
      </Row>

      {stats && (
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={6}><Card size="small"><Statistic title="渠道总数" value={stats.total} /></Card></Col>
          <Col span={6}><Card size="small"><Statistic title="已启用" value={stats.enabled} valueStyle={{ color: '#52c41a' }} /></Card></Col>
          <Col span={6}><Card size="small"><Statistic title="邮件渠道" value={stats.byType?.email || 0} /></Card></Col>
          <Col span={6}><Card size="small"><Statistic title="Webhook" value={stats.byType?.webhook || 0} /></Card></Col>
        </Row>
      )}

      <Card><Table columns={columns} dataSource={channels} rowKey="id" loading={loading} /></Card>

      <Modal title="新建告警渠道" open={modalOpen} onCancel={() => setModalOpen(false)} onOk={() => form.submit()}>
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item name="name" label="渠道名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="type" label="渠道类型" rules={[{ required: true }]}>
            <Select onChange={setChannelType} options={[{ value: 'email', label: '邮件' }, { value: 'webhook', label: 'Webhook' }, { value: 'sms', label: '短信' }, { value: 'dingtalk', label: '钉钉' }, { value: 'wechat', label: '企业微信' }]} />
          </Form.Item>
          <Form.Item name="configKey" label="配置项" rules={[{ required: true }]}><Input placeholder={channelType === 'email' ? 'recipients' : 'webhook'} /></Form.Item>
          <Form.Item name="configValue" label="配置值" rules={[{ required: true }]}><Input placeholder={channelType === 'email' ? 'ops@example.com' : 'https://...'} /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default AlertChannelManagement;
