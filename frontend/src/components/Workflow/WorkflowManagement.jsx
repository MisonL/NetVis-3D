import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Space, Tag, Typography, Row, Col, Statistic, Modal, Form, Input, Select, message, Popconfirm, Switch, Steps, Badge } from 'antd';
import { NodeIndexOutlined, ReloadOutlined, PlusOutlined, DeleteOutlined, PlayCircleOutlined, ClockCircleOutlined, ThunderboltOutlined, FlagOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const WorkflowManagement = () => {
  const [workflows, setWorkflows] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [historyModal, setHistoryModal] = useState(null);
  const [history, setHistory] = useState([]);

  const getToken = () => localStorage.getItem('token');

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [workflowsRes, statsRes] = await Promise.all([
        fetch(`${API_BASE}/api/workflows`, { headers: { Authorization: `Bearer ${getToken()}` } }),
        fetch(`${API_BASE}/api/workflows/stats/overview`, { headers: { Authorization: `Bearer ${getToken()}` } }),
      ]);
      const [workflowsData, statsData] = await Promise.all([workflowsRes.json(), statsRes.json()]);
      if (workflowsData.code === 0) setWorkflows(workflowsData.data || []);
      if (statsData.code === 0) setStats(statsData.data);
    } catch { /* ignore */ } finally { setLoading(false); }
  };

  const fetchHistory = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/api/workflows/${id}/history`, { headers: { Authorization: `Bearer ${getToken()}` } });
      const data = await res.json();
      if (data.code === 0) setHistory(data.data || []);
    } catch { /* ignore */ }
  };

  useEffect(() => { 
    fetchAll(); 
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleToggle = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/api/workflows/${id}/toggle`, { method: 'POST', headers: { Authorization: `Bearer ${getToken()}` } });
      const data = await res.json();
      if (data.code === 0) { message.success(data.message); fetchAll(); }
    } catch { message.error('操作失败'); }
  };

  const handleRun = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/api/workflows/${id}/run`, { method: 'POST', headers: { Authorization: `Bearer ${getToken()}` } });
      const data = await res.json();
      if (data.code === 0) { message.success('工作流已执行'); fetchAll(); }
    } catch { message.error('执行失败'); }
  };

  const handleDelete = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/api/workflows/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${getToken()}` } });
      const data = await res.json();
      if (data.code === 0) { message.success('已删除'); fetchAll(); }
    } catch { message.error('删除失败'); }
  };

  const getTriggerIcon = (type) => {
    if (type === 'scheduled') return <ClockCircleOutlined />;
    if (type === 'event') return <ThunderboltOutlined />;
    return <FlagOutlined />;
  };

  const columns = [
    { title: '名称', dataIndex: 'name' },
    { title: '描述', dataIndex: 'description', ellipsis: true },
    { title: '触发器', dataIndex: 'trigger', render: (t) => <Tag icon={getTriggerIcon(t?.type)}>{t?.type === 'scheduled' ? '定时' : t?.type === 'event' ? '事件' : '手动'}</Tag> },
    { title: '步骤数', dataIndex: 'steps', render: (s) => s?.length || 0 },
    { title: '执行次数', dataIndex: 'runCount' },
    { title: '最后执行', dataIndex: 'lastRun', render: (t) => t ? new Date(t).toLocaleString() : '-' },
    { title: '状态', dataIndex: 'enabled', render: (e, r) => <Switch checked={e} onChange={() => handleToggle(r.id)} /> },
    { title: '操作', render: (_, r) => (
      <Space>
        <Button type="link" size="small" icon={<PlayCircleOutlined />} onClick={() => handleRun(r.id)}>执行</Button>
        <Button type="link" size="small" onClick={() => { setHistoryModal(r.id); fetchHistory(r.id); }}>历史</Button>
        <Popconfirm title="确定删除？" onConfirm={() => handleDelete(r.id)}><Button type="link" danger size="small" icon={<DeleteOutlined />}>删除</Button></Popconfirm>
      </Space>
    )},
  ];

  return (
    <div style={{ padding: '24px 32px' }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <Col><Title level={3} style={{ margin: 0 }}><NodeIndexOutlined style={{ marginRight: 12 }} />工作流编排</Title></Col>
        <Col><Space><Button icon={<ReloadOutlined />} onClick={fetchAll}>刷新</Button></Space></Col>
      </Row>

      {stats && (
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={6}><Card size="small"><Statistic title="工作流总数" value={stats.total} /></Card></Col>
          <Col span={6}><Card size="small"><Statistic title="已启用" value={stats.enabled} valueStyle={{ color: '#52c41a' }} /></Card></Col>
          <Col span={6}><Card size="small"><Statistic title="总执行次数" value={stats.totalRuns} /></Card></Col>
          <Col span={6}><Card size="small"><Statistic title="定时/事件/手动" value={`${stats.byTrigger?.scheduled || 0}/${stats.byTrigger?.event || 0}/${stats.byTrigger?.manual || 0}`} /></Card></Col>
        </Row>
      )}

      <Card><Table columns={columns} dataSource={workflows} rowKey="id" loading={loading} /></Card>

      <Modal title="执行历史" open={!!historyModal} onCancel={() => { setHistoryModal(null); setHistory([]); }} footer={null} width={700}>
        <Table size="small" dataSource={history} rowKey="id" columns={[
          { title: 'ID', dataIndex: 'id', ellipsis: true, width: 200 },
          { title: '状态', dataIndex: 'status', render: (s) => <Badge status={s === 'completed' ? 'success' : s === 'failed' ? 'error' : 'processing'} text={s} /> },
          { title: '开始时间', dataIndex: 'startTime', render: (t) => new Date(t).toLocaleString() },
          { title: '结束时间', dataIndex: 'endTime', render: (t) => t ? new Date(t).toLocaleString() : '-' },
        ]} />
      </Modal>
    </div>
  );
};

export default WorkflowManagement;
