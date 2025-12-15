import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Space, Tag, Typography, Row, Col, Statistic, Modal, Form, Input, Select, Progress, message } from 'antd';
import { ThunderboltOutlined, ReloadOutlined, PlusOutlined, UploadOutlined, CloudUploadOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const FirmwareManagement = () => {
  const [library, setLibrary] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [upgradeModal, setUpgradeModal] = useState(false);
  const [form] = Form.useForm();

  const getToken = () => localStorage.getItem('token');

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [libraryRes, tasksRes, statsRes] = await Promise.all([
        fetch(`${API_BASE}/api/firmware/library`, { headers: { Authorization: `Bearer ${getToken()}` } }),
        fetch(`${API_BASE}/api/firmware/tasks`, { headers: { Authorization: `Bearer ${getToken()}` } }),
        fetch(`${API_BASE}/api/firmware/stats`, { headers: { Authorization: `Bearer ${getToken()}` } }),
      ]);
      const [libraryData, tasksData, statsData] = await Promise.all([libraryRes.json(), tasksRes.json(), statsRes.json()]);
      if (libraryData.code === 0) setLibrary(libraryData.data || []);
      if (tasksData.code === 0) setTasks(tasksData.data || []);
      if (statsData.code === 0) setStats(statsData.data);
    } catch { /* ignore */ } finally { setLoading(false); }
  };

  useEffect(() => { 
    fetchAll(); 
    const i = setInterval(fetchAll, 5000);
    return () => clearInterval(i);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleUpgrade = async (values) => {
    try {
      const res = await fetch(`${API_BASE}/api/firmware/upgrade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ ...values, deviceIds: ['dev-1', 'dev-2', 'dev-3'] }),
      });
      const data = await res.json();
      if (data.code === 0) { message.success('升级任务已创建'); setUpgradeModal(false); form.resetFields(); fetchAll(); }
    } catch { message.error('创建失败'); }
  };

  const libraryColumns = [
    { title: '厂商', dataIndex: 'vendor' },
    { title: '型号', dataIndex: 'model' },
    { title: '版本', dataIndex: 'version', render: (v) => <Tag color="blue">{v}</Tag> },
    { title: '文件名', dataIndex: 'fileName', ellipsis: true },
    { title: '大小', dataIndex: 'fileSize', render: (s) => `${(s / 1024 / 1024).toFixed(1)} MB` },
    { title: '发布日期', dataIndex: 'releaseDate', render: (d) => new Date(d).toLocaleDateString() },
  ];

  const taskColumns = [
    { title: '固件ID', dataIndex: 'firmwareId', ellipsis: true },
    { title: '状态', dataIndex: 'status', render: (s) => {
      const map = { pending: { color: 'default', text: '等待中' }, running: { color: 'processing', text: '升级中' }, completed: { color: 'success', text: '已完成' }, failed: { color: 'error', text: '失败' } };
      return <Tag color={map[s]?.color}>{map[s]?.text || s}</Tag>;
    }},
    { title: '进度', dataIndex: 'progress', render: (p) => <Progress percent={Math.round(p.completed / p.total * 100)} size="small" status={p.failed > 0 ? 'exception' : undefined} /> },
    { title: '设备数', dataIndex: 'deviceIds', render: (ids) => ids?.length || 0 },
    { title: '创建时间', dataIndex: 'createdAt', render: (t) => new Date(t).toLocaleString() },
  ];

  return (
    <div style={{ padding: '24px 32px' }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <Col><Title level={3} style={{ margin: 0 }}><ThunderboltOutlined style={{ marginRight: 12 }} />固件升级管理</Title></Col>
        <Col><Space><Button type="primary" icon={<CloudUploadOutlined />} onClick={() => setUpgradeModal(true)}>创建升级任务</Button><Button icon={<ReloadOutlined />} onClick={fetchAll}>刷新</Button></Space></Col>
      </Row>

      {stats && (
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={6}><Card size="small"><Statistic title="固件数量" value={stats.totalFirmware} /></Card></Col>
          <Col span={6}><Card size="small"><Statistic title="升级任务" value={stats.totalTasks} /></Card></Col>
          <Col span={6}><Card size="small"><Statistic title="进行中" value={stats.runningTasks} valueStyle={{ color: '#1677ff' }} /></Card></Col>
          <Col span={6}><Card size="small"><Statistic title="已完成" value={stats.completedTasks} valueStyle={{ color: '#52c41a' }} /></Card></Col>
        </Row>
      )}

      <Card title="固件库" style={{ marginBottom: 24 }}><Table columns={libraryColumns} dataSource={library} rowKey="id" loading={loading} size="small" /></Card>
      <Card title="升级任务"><Table columns={taskColumns} dataSource={tasks} rowKey="id" loading={loading} /></Card>

      <Modal title="创建升级任务" open={upgradeModal} onCancel={() => setUpgradeModal(false)} onOk={() => form.submit()}>
        <Form form={form} layout="vertical" onFinish={handleUpgrade}>
          <Form.Item name="firmwareId" label="选择固件" rules={[{ required: true }]}>
            <Select options={library.map(f => ({ value: f.id, label: `${f.vendor} ${f.model} - ${f.version}` }))} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default FirmwareManagement;
