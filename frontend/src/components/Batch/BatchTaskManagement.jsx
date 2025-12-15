import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Space, Tag, Typography, Row, Col, Modal, Form, Input, Select, Progress, message, Steps } from 'antd';
import { ThunderboltOutlined, ReloadOutlined, PlusOutlined, StopOutlined, RedoOutlined, CheckCircleOutlined, CloseCircleOutlined, LoadingOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const BatchTaskManagement = () => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [detailModal, setDetailModal] = useState(null);
  const [form] = Form.useForm();

  const getToken = () => localStorage.getItem('token');

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/batch-tasks`, { headers: { Authorization: `Bearer ${getToken()}` } });
      const data = await res.json();
      if (data.code === 0) setTasks(data.data || []);
    } catch { /* ignore */ } finally { setLoading(false); }
  };

  useEffect(() => { fetchTasks(); const i = setInterval(fetchTasks, 5000); return () => clearInterval(i); }, []);

  const handleCreate = async (values) => {
    try {
      const res = await fetch(`${API_BASE}/api/batch-tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ ...values, deviceIds: ['dev-1', 'dev-2', 'dev-3', 'dev-4', 'dev-5'] }),
      });
      const data = await res.json();
      if (data.code === 0) { message.success('任务已创建'); setModalOpen(false); form.resetFields(); fetchTasks(); }
    } catch { message.error('创建失败'); }
  };

  const handleCancel = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/api/batch-tasks/${id}/cancel`, { method: 'POST', headers: { Authorization: `Bearer ${getToken()}` } });
      const data = await res.json();
      if (data.code === 0) { message.success('任务已取消'); fetchTasks(); }
    } catch { message.error('取消失败'); }
  };

  const getStatusTag = (s) => {
    const map = { pending: { color: 'default', text: '等待中' }, running: { color: 'processing', text: '执行中' }, completed: { color: 'success', text: '已完成' }, failed: { color: 'error', text: '失败' } };
    return <Tag color={map[s]?.color}>{map[s]?.text || s}</Tag>;
  };

  const columns = [
    { title: '任务名称', dataIndex: 'name' },
    { title: '类型', dataIndex: 'type', render: (t) => ({ command: '命令执行', config: '配置下发', firmware: '固件升级', restart: '设备重启' }[t] || t) },
    { title: '状态', dataIndex: 'status', render: getStatusTag },
    { title: '进度', dataIndex: 'progress', render: (p) => <Progress percent={Math.round(p.completed / p.total * 100)} size="small" status={p.failed > 0 ? 'exception' : undefined} /> },
    { title: '创建时间', dataIndex: 'createdAt', render: (t) => new Date(t).toLocaleString() },
    { title: '操作', render: (_, r) => (
      <Space>
        <Button type="link" size="small" onClick={() => setDetailModal(r)}>详情</Button>
        {(r.status === 'pending' || r.status === 'running') && <Button type="link" danger size="small" icon={<StopOutlined />} onClick={() => handleCancel(r.id)}>取消</Button>}
      </Space>
    )},
  ];

  return (
    <div style={{ padding: '24px 32px' }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <Col><Title level={3} style={{ margin: 0 }}><ThunderboltOutlined style={{ marginRight: 12 }} />批量任务</Title></Col>
        <Col><Space><Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>新建任务</Button><Button icon={<ReloadOutlined />} onClick={fetchTasks}>刷新</Button></Space></Col>
      </Row>
      <Card><Table columns={columns} dataSource={tasks} rowKey="id" loading={loading} /></Card>
      <Modal title="新建批量任务" open={modalOpen} onCancel={() => setModalOpen(false)} onOk={() => form.submit()}>
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item name="name" label="任务名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="type" label="任务类型" rules={[{ required: true }]}>
            <Select options={[{ value: 'command', label: '命令执行' }, { value: 'config', label: '配置下发' }, { value: 'firmware', label: '固件升级' }, { value: 'restart', label: '设备重启' }]} />
          </Form.Item>
          <Form.Item name="command" label="命令/配置"><Input.TextArea rows={3} placeholder="输入要执行的命令或配置" /></Form.Item>
        </Form>
      </Modal>
      <Modal title="任务详情" open={!!detailModal} onCancel={() => setDetailModal(null)} footer={null} width={700}>
        {detailModal && (
          <div>
            <Text strong>任务: {detailModal.name}</Text> {getStatusTag(detailModal.status)}
            <Progress percent={Math.round(detailModal.progress.completed / detailModal.progress.total * 100)} style={{ margin: '16px 0' }} />
            <Text>成功: {detailModal.progress.completed - detailModal.progress.failed} | 失败: {detailModal.progress.failed} | 总计: {detailModal.progress.total}</Text>
            <Table size="small" style={{ marginTop: 16 }} dataSource={detailModal.results} rowKey="deviceId" columns={[
              { title: '设备ID', dataIndex: 'deviceId' },
              { title: '状态', dataIndex: 'status', render: (s) => s === 'success' ? <Tag color="green"><CheckCircleOutlined /> 成功</Tag> : <Tag color="red"><CloseCircleOutlined /> 失败</Tag> },
              { title: '消息', dataIndex: 'message' },
              { title: '时间', dataIndex: 'timestamp', render: (t) => new Date(t).toLocaleTimeString() },
            ]} />
          </div>
        )}
      </Modal>
    </div>
  );
};

export default BatchTaskManagement;
