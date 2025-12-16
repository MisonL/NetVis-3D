import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Space, Tag, Typography, Row, Col, Statistic, Modal, Form, Input, Select, InputNumber, message, Popconfirm, Switch } from 'antd';
import { LockOutlined, ReloadOutlined, PlusOutlined, DeleteOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';

const { Title } = Typography;
import { API_BASE_URL } from '../../config';
const API_BASE = API_BASE_URL;

const AccessControlManagement = () => {
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
        fetch(`${API_BASE}/api/acl/rules`, { headers: { Authorization: `Bearer ${getToken()}` } }),
        fetch(`${API_BASE}/api/acl/stats`, { headers: { Authorization: `Bearer ${getToken()}` } }),
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
      const res = await fetch(`${API_BASE}/api/acl/rules`, {
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
      const res = await fetch(`${API_BASE}/api/acl/rules/${id}/toggle`, { method: 'POST', headers: { Authorization: `Bearer ${getToken()}` } });
      const data = await res.json();
      if (data.code === 0) { message.success(data.message); fetchAll(); }
    } catch { message.error('操作失败'); }
  };

  const handleDelete = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/api/acl/rules/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${getToken()}` } });
      const data = await res.json();
      if (data.code === 0) { message.success('已删除'); fetchAll(); }
    } catch { message.error('删除失败'); }
  };

  const columns = [
    { title: '优先级', dataIndex: 'priority', width: 80, sorter: (a, b) => a.priority - b.priority },
    { title: '名称', dataIndex: 'name' },
    { title: '动作', dataIndex: 'type', render: (t) => <Tag color={t === 'allow' ? 'green' : 'red'} icon={t === 'allow' ? <CheckCircleOutlined /> : <CloseCircleOutlined />}>{t === 'allow' ? '允许' : '拒绝'}</Tag> },
    { title: '源', dataIndex: 'source' },
    { title: '目标', dataIndex: 'destination' },
    { title: '协议', dataIndex: 'protocol', render: (p) => <Tag>{p.toUpperCase()}</Tag> },
    { title: '端口', dataIndex: 'port' },
    { title: '命中次数', dataIndex: 'hitCount', render: (h) => h.toLocaleString() },
    { title: '状态', dataIndex: 'enabled', render: (e, r) => <Switch checked={e} onChange={() => handleToggle(r.id)} /> },
    { title: '操作', render: (_, r) => <Popconfirm title="确定删除？" onConfirm={() => handleDelete(r.id)}><Button type="link" danger size="small" icon={<DeleteOutlined />}>删除</Button></Popconfirm> },
  ];

  return (
    <div style={{ padding: '24px 32px' }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <Col><Title level={3} style={{ margin: 0 }}><LockOutlined style={{ marginRight: 12 }} />访问控制(ACL)</Title></Col>
        <Col><Space><Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>新建规则</Button><Button icon={<ReloadOutlined />} onClick={fetchAll}>刷新</Button></Space></Col>
      </Row>

      {stats && (
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={4}><Card size="small"><Statistic title="规则总数" value={stats.totalRules} /></Card></Col>
          <Col span={4}><Card size="small"><Statistic title="已启用" value={stats.enabledRules} valueStyle={{ color: '#52c41a' }} /></Card></Col>
          <Col span={4}><Card size="small"><Statistic title="允许规则" value={stats.allowRules} /></Card></Col>
          <Col span={4}><Card size="small"><Statistic title="拒绝规则" value={stats.denyRules} /></Card></Col>
          <Col span={8}><Card size="small"><Statistic title="总命中次数" value={stats.totalHits?.toLocaleString()} /></Card></Col>
        </Row>
      )}

      <Card><Table columns={columns} dataSource={rules} rowKey="id" loading={loading} /></Card>

      <Modal title="新建ACL规则" open={modalOpen} onCancel={() => setModalOpen(false)} onOk={() => form.submit()} width={600}>
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Row gutter={16}>
            <Col span={12}><Form.Item name="name" label="规则名称" rules={[{ required: true }]}><Input /></Form.Item></Col>
            <Col span={12}><Form.Item name="priority" label="优先级" rules={[{ required: true }]}><InputNumber min={1} max={1000} style={{ width: '100%' }} /></Form.Item></Col>
          </Row>
          <Form.Item name="type" label="动作" rules={[{ required: true }]}><Select options={[{ value: 'allow', label: '允许' }, { value: 'deny', label: '拒绝' }]} /></Form.Item>
          <Row gutter={16}>
            <Col span={12}><Form.Item name="source" label="源地址" rules={[{ required: true }]}><Input placeholder="10.0.0.0/8 或 any" /></Form.Item></Col>
            <Col span={12}><Form.Item name="destination" label="目标地址" rules={[{ required: true }]}><Input placeholder="192.168.1.100 或 any" /></Form.Item></Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}><Form.Item name="protocol" label="协议" rules={[{ required: true }]}><Select options={[{ value: 'tcp', label: 'TCP' }, { value: 'udp', label: 'UDP' }, { value: 'icmp', label: 'ICMP' }, { value: 'any', label: '任意' }]} /></Form.Item></Col>
            <Col span={12}><Form.Item name="port" label="端口" rules={[{ required: true }]}><Input placeholder="22 或 any" /></Form.Item></Col>
          </Row>
        </Form>
      </Modal>
    </div>
  );
};

export default AccessControlManagement;
