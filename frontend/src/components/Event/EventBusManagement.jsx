import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Space, Tag, Typography, Row, Col, Statistic, Modal, Form, Input, message, Popconfirm, Switch } from 'antd';
import { ThunderboltOutlined, ReloadOutlined, PlusOutlined, DeleteOutlined, NotificationOutlined } from '@ant-design/icons';

const { Title } = Typography;
import { API_BASE_URL } from '../../config';
const API_BASE = API_BASE_URL;

const EventBusManagement = () => {
  const [topics, setTopics] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();

  const getToken = () => localStorage.getItem('token');

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [topicsRes, subsRes, statsRes] = await Promise.all([
        fetch(`${API_BASE}/api/events/topics`, { headers: { Authorization: `Bearer ${getToken()}` } }),
        fetch(`${API_BASE}/api/events/subscriptions`, { headers: { Authorization: `Bearer ${getToken()}` } }),
        fetch(`${API_BASE}/api/events/stats`, { headers: { Authorization: `Bearer ${getToken()}` } }),
      ]);
      const [topicsData, subsData, statsData] = await Promise.all([topicsRes.json(), subsRes.json(), statsRes.json()]);
      if (topicsData.code === 0) setTopics(topicsData.data || []);
      if (subsData.code === 0) setSubscriptions(subsData.data || []);
      if (statsData.code === 0) setStats(statsData.data);
    } catch { /* ignore */ } finally { setLoading(false); }
  };

  useEffect(() => { 
    fetchAll(); 
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreate = async (values) => {
    try {
      const res = await fetch(`${API_BASE}/api/events/subscriptions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (data.code === 0) { message.success('订阅已创建'); setModalOpen(false); form.resetFields(); fetchAll(); }
    } catch { message.error('创建失败'); }
  };

  const handleToggle = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/api/events/subscriptions/${id}/toggle`, { method: 'POST', headers: { Authorization: `Bearer ${getToken()}` } });
      const data = await res.json();
      if (data.code === 0) { message.success(data.message); fetchAll(); }
    } catch { message.error('操作失败'); }
  };

  const handleDelete = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/api/events/subscriptions/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${getToken()}` } });
      const data = await res.json();
      if (data.code === 0) { message.success('已删除'); fetchAll(); }
    } catch { message.error('删除失败'); }
  };

  const topicColumns = [
    { title: '事件ID', dataIndex: 'id', render: (id) => <Tag color="blue">{id}</Tag> },
    { title: '名称', dataIndex: 'name' },
    { title: '描述', dataIndex: 'description' },
  ];

  const subColumns = [
    { title: '主题', dataIndex: 'topic', render: (t) => <Tag>{t}</Tag> },
    { title: '回调URL', dataIndex: 'callback', ellipsis: true },
    { title: '状态', dataIndex: 'enabled', render: (e, r) => <Switch checked={e} onChange={() => handleToggle(r.id)} /> },
    { title: '创建时间', dataIndex: 'createdAt', render: (t) => new Date(t).toLocaleDateString() },
    { title: '操作', render: (_, r) => <Popconfirm title="确定删除？" onConfirm={() => handleDelete(r.id)}><Button type="link" danger size="small" icon={<DeleteOutlined />}>删除</Button></Popconfirm> },
  ];

  return (
    <div style={{ padding: '24px 32px' }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <Col><Title level={3} style={{ margin: 0 }}><ThunderboltOutlined style={{ marginRight: 12 }} />事件总线</Title></Col>
        <Col><Space><Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>新建订阅</Button><Button icon={<ReloadOutlined />} onClick={fetchAll}>刷新</Button></Space></Col>
      </Row>

      {stats && (
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={6}><Card size="small"><Statistic title="事件主题" value={stats.totalTopics} /></Card></Col>
          <Col span={6}><Card size="small"><Statistic title="订阅数" value={stats.totalSubscriptions} /></Card></Col>
          <Col span={6}><Card size="small"><Statistic title="活跃订阅" value={stats.activeSubscriptions} valueStyle={{ color: '#52c41a' }} /></Card></Col>
          <Col span={6}><Card size="small"><Statistic title="总事件" value={stats.totalEvents} /></Card></Col>
        </Row>
      )}

      <Card title="事件主题" style={{ marginBottom: 24 }}><Table columns={topicColumns} dataSource={topics} rowKey="id" loading={loading} pagination={false} size="small" /></Card>
      <Card title="订阅列表"><Table columns={subColumns} dataSource={subscriptions} rowKey="id" loading={loading} /></Card>

      <Modal title="新建事件订阅" open={modalOpen} onCancel={() => setModalOpen(false)} onOk={() => form.submit()}>
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item name="topic" label="事件主题" rules={[{ required: true }]}><Input placeholder="device.status" /></Form.Item>
          <Form.Item name="callback" label="回调URL" rules={[{ required: true, type: 'url' }]}><Input placeholder="https://your-service.com/webhook" /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default EventBusManagement;
