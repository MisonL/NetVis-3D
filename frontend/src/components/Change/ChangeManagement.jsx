import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Space, Tag, Typography, Row, Col, Modal, Form, Input, Select, message, Steps, Popconfirm } from 'antd';
import { SwapOutlined, ReloadOutlined, PlusOutlined, CheckOutlined, CloseOutlined, RollbackOutlined, SendOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const ChangeManagement = () => {
  const [changes, setChanges] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();

  const getToken = () => localStorage.getItem('token');

  const fetchChanges = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/changes`, { headers: { Authorization: `Bearer ${getToken()}` } });
      const data = await res.json();
      if (data.code === 0) setChanges(data.data || []);
    } catch { /* ignore */ } finally { setLoading(false); }
  };

  useEffect(() => {
    fetchChanges();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreate = async (values) => {
    try {
      const res = await fetch(`${API_BASE}/api/changes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ ...values, affectedDevices: ['dev-1', 'dev-2'] }),
      });
      const data = await res.json();
      if (data.code === 0) { message.success('变更请求已创建'); setModalOpen(false); form.resetFields(); fetchChanges(); }
    } catch { message.error('创建失败'); }
  };

  const handleAction = async (id, action) => {
    try {
      const body = action === 'reject' ? JSON.stringify({ reason: '不符合要求' }) : undefined;
      const res = await fetch(`${API_BASE}/api/changes/${id}/${action}`, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body,
      });
      const data = await res.json();
      if (data.code === 0) { message.success(data.message); fetchChanges(); }
    } catch { message.error('操作失败'); }
  };

  const getStatusTag = (s) => {
    const map = { draft: { color: 'default', text: '草稿' }, pending: { color: 'processing', text: '待审批' }, approved: { color: 'blue', text: '已批准' }, rejected: { color: 'red', text: '已拒绝' }, implemented: { color: 'green', text: '已执行' }, rollback: { color: 'orange', text: '已回滚' } };
    return <Tag color={map[s]?.color}>{map[s]?.text || s}</Tag>;
  };

  const getPriorityTag = (p) => {
    const map = { low: 'default', medium: 'blue', high: 'orange', critical: 'red' };
    return <Tag color={map[p]}>{p.toUpperCase()}</Tag>;
  };

  const columns = [
    { title: '标题', dataIndex: 'title' },
    { title: '类型', dataIndex: 'type', render: (t) => ({ config: '配置变更', firmware: '固件升级', network: '网络调整', security: '安全策略' }[t] || t) },
    { title: '优先级', dataIndex: 'priority', render: getPriorityTag },
    { title: '状态', dataIndex: 'status', render: getStatusTag },
    { title: '创建时间', dataIndex: 'createdAt', render: (t) => new Date(t).toLocaleDateString() },
    { title: '操作', render: (_, r) => (
      <Space size="small">
        {r.status === 'draft' && <Button type="link" size="small" icon={<SendOutlined />} onClick={() => handleAction(r.id, 'submit')}>提交</Button>}
        {r.status === 'pending' && <>
          <Button type="link" size="small" icon={<CheckOutlined />} onClick={() => handleAction(r.id, 'approve')}>批准</Button>
          <Popconfirm title="确定拒绝？" onConfirm={() => handleAction(r.id, 'reject')}><Button type="link" danger size="small" icon={<CloseOutlined />}>拒绝</Button></Popconfirm>
        </>}
        {r.status === 'approved' && <Button type="link" size="small" onClick={() => handleAction(r.id, 'implement')}>执行</Button>}
        {r.status === 'implemented' && <Button type="link" size="small" icon={<RollbackOutlined />} onClick={() => handleAction(r.id, 'rollback')}>回滚</Button>}
      </Space>
    )},
  ];

  return (
    <div style={{ padding: '24px 32px' }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <Col><Title level={3} style={{ margin: 0 }}><SwapOutlined style={{ marginRight: 12 }} />变更管理</Title></Col>
        <Col><Space><Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>新建变更</Button><Button icon={<ReloadOutlined />} onClick={fetchChanges}>刷新</Button></Space></Col>
      </Row>
      <Card><Table columns={columns} dataSource={changes} rowKey="id" loading={loading} /></Card>
      <Modal title="新建变更请求" open={modalOpen} onCancel={() => setModalOpen(false)} onOk={() => form.submit()} width={600}>
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item name="title" label="标题" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="type" label="类型" rules={[{ required: true }]}>
            <Select options={[{ value: 'config', label: '配置变更' }, { value: 'firmware', label: '固件升级' }, { value: 'network', label: '网络调整' }, { value: 'security', label: '安全策略' }]} />
          </Form.Item>
          <Form.Item name="priority" label="优先级" rules={[{ required: true }]}>
            <Select options={[{ value: 'low', label: '低' }, { value: 'medium', label: '中' }, { value: 'high', label: '高' }, { value: 'critical', label: '紧急' }]} />
          </Form.Item>
          <Form.Item name="description" label="描述" rules={[{ required: true }]}><Input.TextArea rows={3} /></Form.Item>
          <Form.Item name="rollbackPlan" label="回滚方案" rules={[{ required: true }]}><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ChangeManagement;
