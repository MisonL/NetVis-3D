import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Space, Tag, Typography, Row, Col, Statistic, Modal, Form, Input, Select, message, Popconfirm } from 'antd';
import { BugOutlined, ReloadOutlined, PlusOutlined, UserAddOutlined, CheckOutlined, CloseCircleOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;
const { TextArea } = Input;
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const IncidentManagement = () => {
  const [incidents, setIncidents] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [resolveModal, setResolveModal] = useState(null);
  const [form] = Form.useForm();
  const [resolveForm] = Form.useForm();

  const getToken = () => localStorage.getItem('token');

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [incidentsRes, statsRes] = await Promise.all([
        fetch(`${API_BASE}/api/incidents`, { headers: { Authorization: `Bearer ${getToken()}` } }),
        fetch(`${API_BASE}/api/incidents/stats`, { headers: { Authorization: `Bearer ${getToken()}` } }),
      ]);
      const [incidentsData, statsData] = await Promise.all([incidentsRes.json(), statsRes.json()]);
      if (incidentsData.code === 0) setIncidents(incidentsData.data || []);
      if (statsData.code === 0) setStats(statsData.data);
    } catch { /* ignore */ } finally { setLoading(false); }
  };

  useEffect(() => { 
    fetchAll(); 
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreate = async (values) => {
    try {
      const res = await fetch(`${API_BASE}/api/incidents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ ...values, affectedDevices: [] }),
      });
      const data = await res.json();
      if (data.code === 0) { message.success('工单已创建'); setModalOpen(false); form.resetFields(); fetchAll(); }
    } catch { message.error('创建失败'); }
  };

  const handleResolve = async (values) => {
    try {
      const res = await fetch(`${API_BASE}/api/incidents/${resolveModal}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (data.code === 0) { message.success('已解决'); setResolveModal(null); resolveForm.resetFields(); fetchAll(); }
    } catch { message.error('操作失败'); }
  };

  const handleAction = async (id, action) => {
    try {
      const body = action === 'assign' ? JSON.stringify({ assignee: 'admin' }) : undefined;
      const res = await fetch(`${API_BASE}/api/incidents/${id}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body,
      });
      const data = await res.json();
      if (data.code === 0) { message.success(data.message); fetchAll(); }
    } catch { message.error('操作失败'); }
  };

  const getSeverityTag = (s) => {
    const map = { low: 'default', medium: 'blue', high: 'orange', critical: 'red' };
    return <Tag color={map[s]}>{s.toUpperCase()}</Tag>;
  };

  const getStatusTag = (s) => {
    const map = { open: { color: 'red', text: '待处理' }, in_progress: { color: 'processing', text: '处理中' }, resolved: { color: 'green', text: '已解决' }, closed: { color: 'default', text: '已关闭' } };
    return <Tag color={map[s]?.color}>{map[s]?.text || s}</Tag>;
  };

  const columns = [
    { title: '标题', dataIndex: 'title', ellipsis: true },
    { title: '严重程度', dataIndex: 'severity', render: getSeverityTag },
    { title: '状态', dataIndex: 'status', render: getStatusTag },
    { title: '处理人', dataIndex: 'assignee', render: (a) => a || '-' },
    { title: '创建时间', dataIndex: 'createdAt', render: (t) => new Date(t).toLocaleString() },
    { title: '操作', render: (_, r) => (
      <Space size="small">
        {r.status === 'open' && <Button type="link" size="small" icon={<UserAddOutlined />} onClick={() => handleAction(r.id, 'assign')}>分配</Button>}
        {r.status === 'in_progress' && <Button type="link" size="small" icon={<CheckOutlined />} onClick={() => setResolveModal(r.id)}>解决</Button>}
        {r.status === 'resolved' && <Button type="link" size="small" onClick={() => handleAction(r.id, 'close')}>关闭</Button>}
      </Space>
    )},
  ];

  return (
    <div style={{ padding: '24px 32px' }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <Col><Title level={3} style={{ margin: 0 }}><BugOutlined style={{ marginRight: 12 }} />故障管理</Title></Col>
        <Col><Space><Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>新建工单</Button><Button icon={<ReloadOutlined />} onClick={fetchAll}>刷新</Button></Space></Col>
      </Row>

      {stats && (
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={5}><Card size="small"><Statistic title="总工单" value={stats.total} /></Card></Col>
          <Col span={5}><Card size="small"><Statistic title="待处理" value={stats.open} valueStyle={{ color: '#f5222d' }} /></Card></Col>
          <Col span={5}><Card size="small"><Statistic title="处理中" value={stats.inProgress} valueStyle={{ color: '#1677ff' }} /></Card></Col>
          <Col span={5}><Card size="small"><Statistic title="已解决" value={stats.resolved} valueStyle={{ color: '#52c41a' }} /></Card></Col>
          <Col span={4}><Card size="small"><Statistic title="MTTR" value={stats.mttr} /></Card></Col>
        </Row>
      )}

      <Card><Table columns={columns} dataSource={incidents} rowKey="id" loading={loading} /></Card>

      <Modal title="新建故障工单" open={modalOpen} onCancel={() => setModalOpen(false)} onOk={() => form.submit()}>
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item name="title" label="标题" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="severity" label="严重程度" rules={[{ required: true }]}>
            <Select options={[{ value: 'low', label: '低' }, { value: 'medium', label: '中' }, { value: 'high', label: '高' }, { value: 'critical', label: '紧急' }]} />
          </Form.Item>
          <Form.Item name="description" label="描述"><TextArea rows={3} /></Form.Item>
        </Form>
      </Modal>

      <Modal title="解决工单" open={!!resolveModal} onCancel={() => setResolveModal(null)} onOk={() => resolveForm.submit()}>
        <Form form={resolveForm} layout="vertical" onFinish={handleResolve}>
          <Form.Item name="rootCause" label="根因分析" rules={[{ required: true }]}><TextArea rows={2} /></Form.Item>
          <Form.Item name="resolution" label="解决方案" rules={[{ required: true }]}><TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default IncidentManagement;
