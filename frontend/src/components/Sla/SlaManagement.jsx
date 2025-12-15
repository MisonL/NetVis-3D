import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Space, Tag, Typography, Row, Col, Statistic, Modal, Form, Input, InputNumber, Progress, message } from 'antd';
import { SafetyCertificateOutlined, ReloadOutlined, PlusOutlined, CheckCircleOutlined, CloseCircleOutlined, TrophyOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const SlaManagement = () => {
  const [policies, setPolicies] = useState([]);
  const [reports, setReports] = useState([]);
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();

  const getToken = () => localStorage.getItem('token');

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [policiesRes, reportsRes, dashboardRes] = await Promise.all([
        fetch(`${API_BASE}/api/sla/policies`, { headers: { Authorization: `Bearer ${getToken()}` } }),
        fetch(`${API_BASE}/api/sla/reports`, { headers: { Authorization: `Bearer ${getToken()}` } }),
        fetch(`${API_BASE}/api/sla/dashboard`, { headers: { Authorization: `Bearer ${getToken()}` } }),
      ]);
      const [policiesData, reportsData, dashboardData] = await Promise.all([policiesRes.json(), reportsRes.json(), dashboardRes.json()]);
      if (policiesData.code === 0) setPolicies(policiesData.data || []);
      if (reportsData.code === 0) setReports(reportsData.data || []);
      if (dashboardData.code === 0) setDashboard(dashboardData.data);
    } catch { /* ignore */ } finally { setLoading(false); }
  };

  useEffect(() => { 
    fetchAll(); 
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreate = async (values) => {
    try {
      const res = await fetch(`${API_BASE}/api/sla/policies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (data.code === 0) { message.success('SLA策略已创建'); setModalOpen(false); form.resetFields(); fetchAll(); }
    } catch { message.error('创建失败'); }
  };

  const policyColumns = [
    { title: '策略名称', dataIndex: 'name', render: (n, r) => <><TrophyOutlined style={{ marginRight: 8 }} />{n}{r.isDefault && <Tag color="blue" style={{ marginLeft: 8 }}>默认</Tag>}</> },
    { title: '可用性目标', dataIndex: 'availabilityTarget', render: (v) => `${v}%` },
    { title: '延迟目标', dataIndex: 'latencyTarget', render: (v) => `≤${v}ms` },
    { title: 'MTTR目标', dataIndex: 'mttrTarget', render: (v) => `≤${v}min` },
    { title: '描述', dataIndex: 'description' },
  ];

  const reportColumns = [
    { title: '策略', dataIndex: 'policyName' },
    { title: '周期', dataIndex: 'period' },
    { title: '可用性', dataIndex: 'availability', render: (v) => <Progress percent={v} size="small" strokeColor={v >= 99.9 ? '#52c41a' : '#faad14'} format={(p) => `${p?.toFixed(2)}%`} /> },
    { title: '平均延迟', dataIndex: 'avgLatency', render: (v) => `${v}ms` },
    { title: 'MTTR', dataIndex: 'mttr' },
    { title: '状态', dataIndex: 'status', render: (s) => s === 'met' ? <Tag color="green"><CheckCircleOutlined /> 达标</Tag> : <Tag color="red"><CloseCircleOutlined /> 未达标</Tag> },
  ];

  return (
    <div style={{ padding: '24px 32px' }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <Col><Title level={3} style={{ margin: 0 }}><SafetyCertificateOutlined style={{ marginRight: 12 }} />SLA服务等级</Title></Col>
        <Col><Space><Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>新建策略</Button><Button icon={<ReloadOutlined />} onClick={fetchAll}>刷新</Button></Space></Col>
      </Row>

      {dashboard && (
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={6}><Card size="small"><Statistic title="策略数量" value={dashboard.totalPolicies} /></Card></Col>
          <Col span={6}><Card size="small"><Statistic title="达标服务" value={dashboard.metCount} valueStyle={{ color: '#52c41a' }} prefix={<CheckCircleOutlined />} /></Card></Col>
          <Col span={6}><Card size="small"><Statistic title="平均可用性" value={dashboard.avgAvailability} suffix="%" valueStyle={{ color: '#52c41a' }} /></Card></Col>
          <Col span={6}><Card size="small"><Statistic title="当前MTTR" value={dashboard.currentMTTR} /></Card></Col>
        </Row>
      )}

      <Card title="SLA策略" style={{ marginBottom: 24 }}><Table columns={policyColumns} dataSource={policies} rowKey="id" loading={loading} pagination={false} /></Card>
      <Card title="SLA报告"><Table columns={reportColumns} dataSource={reports} rowKey="id" loading={loading} /></Card>

      <Modal title="新建SLA策略" open={modalOpen} onCancel={() => setModalOpen(false)} onOk={() => form.submit()}>
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item name="name" label="策略名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="availabilityTarget" label="可用性目标(%)" rules={[{ required: true }]}><InputNumber min={90} max={100} step={0.01} style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="latencyTarget" label="延迟目标(ms)" rules={[{ required: true }]}><InputNumber min={1} style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="mttrTarget" label="MTTR目标(分钟)" rules={[{ required: true }]}><InputNumber min={1} style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="description" label="描述"><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default SlaManagement;
