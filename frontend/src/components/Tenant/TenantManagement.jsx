import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Space, Tag, Typography, Row, Col, Statistic, Modal, Form, Input, InputNumber, message, Popconfirm, Switch, Progress } from 'antd';
import { TeamOutlined, ReloadOutlined, PlusOutlined, DeleteOutlined, CheckCircleOutlined, PauseCircleOutlined, ClockCircleOutlined } from '@ant-design/icons';

const { Title } = Typography;
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const TenantManagement = () => {
  const [tenants, setTenants] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();

  const getToken = () => localStorage.getItem('token');

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [tenantsRes, statsRes] = await Promise.all([
        fetch(`${API_BASE}/api/tenants`, { headers: { Authorization: `Bearer ${getToken()}` } }),
        fetch(`${API_BASE}/api/tenants/stats/overview`, { headers: { Authorization: `Bearer ${getToken()}` } }),
      ]);
      const [tenantsData, statsData] = await Promise.all([tenantsRes.json(), statsRes.json()]);
      if (tenantsData.code === 0) setTenants(tenantsData.data || []);
      if (statsData.code === 0) setStats(statsData.data);
    } catch { /* ignore */ } finally { setLoading(false); }
  };

  useEffect(() => { 
    fetchAll(); 
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreate = async (values) => {
    try {
      const res = await fetch(`${API_BASE}/api/tenants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (data.code === 0) { message.success('租户已创建'); setModalOpen(false); form.resetFields(); fetchAll(); }
    } catch { message.error('创建失败'); }
  };

  const handleToggle = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/api/tenants/${id}/toggle`, { method: 'POST', headers: { Authorization: `Bearer ${getToken()}` } });
      const data = await res.json();
      if (data.code === 0) { message.success(data.message); fetchAll(); }
    } catch { message.error('操作失败'); }
  };

  const handleDelete = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/api/tenants/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${getToken()}` } });
      const data = await res.json();
      if (data.code === 0) { message.success('已删除'); fetchAll(); }
    } catch { message.error('删除失败'); }
  };

  const columns = [
    { title: '租户名称', dataIndex: 'name' },
    { title: '编码', dataIndex: 'code', render: (c) => <Tag color="blue">{c}</Tag> },
    { title: '域名', dataIndex: 'domain', ellipsis: true },
    { title: '联系人', dataIndex: 'contact' },
    { title: '设备配额', render: (_, r) => <Progress percent={Math.round((r.usage?.deviceCount || 0) / r.maxDevices * 100)} size="small" format={() => `${r.usage?.deviceCount || 0}/${r.maxDevices}`} /> },
    { title: '用户配额', render: (_, r) => <Progress percent={Math.round((r.usage?.userCount || 0) / r.maxUsers * 100)} size="small" format={() => `${r.usage?.userCount || 0}/${r.maxUsers}`} /> },
    { title: '状态', dataIndex: 'status', render: (s) => {
      const map = { active: { icon: <CheckCircleOutlined />, color: 'green', text: '活跃' }, suspended: { icon: <PauseCircleOutlined />, color: 'red', text: '暂停' }, trial: { icon: <ClockCircleOutlined />, color: 'orange', text: '试用' } };
      return <Tag color={map[s]?.color} icon={map[s]?.icon}>{map[s]?.text}</Tag>;
    }},
    { title: '操作', render: (_, r) => (
      <Space>
        <Button type="link" size="small" onClick={() => handleToggle(r.id)}>{r.status === 'suspended' ? '恢复' : '暂停'}</Button>
        <Popconfirm title="确定删除？" onConfirm={() => handleDelete(r.id)}><Button type="link" danger size="small" icon={<DeleteOutlined />}>删除</Button></Popconfirm>
      </Space>
    )},
  ];

  return (
    <div style={{ padding: '24px 32px' }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <Col><Title level={3} style={{ margin: 0 }}><TeamOutlined style={{ marginRight: 12 }} />多租户管理</Title></Col>
        <Col><Space><Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>新建租户</Button><Button icon={<ReloadOutlined />} onClick={fetchAll}>刷新</Button></Space></Col>
      </Row>

      {stats && (
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={4}><Card size="small"><Statistic title="租户总数" value={stats.total} /></Card></Col>
          <Col span={4}><Card size="small"><Statistic title="活跃" value={stats.active} valueStyle={{ color: '#52c41a' }} /></Card></Col>
          <Col span={4}><Card size="small"><Statistic title="试用" value={stats.trial} valueStyle={{ color: '#faad14' }} /></Card></Col>
          <Col span={4}><Card size="small"><Statistic title="设备总数" value={stats.totalDevices} /></Card></Col>
          <Col span={4}><Card size="small"><Statistic title="用户总数" value={stats.totalUsers} /></Card></Col>
          <Col span={4}><Card size="small"><Statistic title="存储使用" value={stats.totalStorage} /></Card></Col>
        </Row>
      )}

      <Card><Table columns={columns} dataSource={tenants} rowKey="id" loading={loading} /></Card>

      <Modal title="新建租户" open={modalOpen} onCancel={() => setModalOpen(false)} onOk={() => form.submit()} width={600}>
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Row gutter={16}>
            <Col span={12}><Form.Item name="name" label="租户名称" rules={[{ required: true }]}><Input /></Form.Item></Col>
            <Col span={12}><Form.Item name="code" label="租户编码" rules={[{ required: true }]}><Input /></Form.Item></Col>
          </Row>
          <Form.Item name="domain" label="域名" rules={[{ required: true }]}><Input /></Form.Item>
          <Row gutter={16}>
            <Col span={8}><Form.Item name="contact" label="联系人" rules={[{ required: true }]}><Input /></Form.Item></Col>
            <Col span={8}><Form.Item name="email" label="邮箱" rules={[{ required: true, type: 'email' }]}><Input /></Form.Item></Col>
            <Col span={8}><Form.Item name="phone" label="电话" rules={[{ required: true }]}><Input /></Form.Item></Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}><Form.Item name="maxDevices" label="设备配额" rules={[{ required: true }]}><InputNumber min={1} style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={12}><Form.Item name="maxUsers" label="用户配额" rules={[{ required: true }]}><InputNumber min={1} style={{ width: '100%' }} /></Form.Item></Col>
          </Row>
        </Form>
      </Modal>
    </div>
  );
};

export default TenantManagement;
