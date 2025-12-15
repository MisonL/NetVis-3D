import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Space, Tag, Typography, Row, Col, Statistic, Modal, Form, Input, InputNumber, Progress, message, Popconfirm } from 'antd';
import { GlobalOutlined, ReloadOutlined, PlusOutlined, ScanOutlined, DeleteOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const IpamManagement = () => {
  const [subnets, setSubnets] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [scanModal, setScanModal] = useState(null);
  const [scanResults, setScanResults] = useState(null);
  const [form] = Form.useForm();

  const getToken = () => localStorage.getItem('token');

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [subnetsRes, statsRes] = await Promise.all([
        fetch(`${API_BASE}/api/ipam/subnets`, { headers: { Authorization: `Bearer ${getToken()}` } }),
        fetch(`${API_BASE}/api/ipam/stats`, { headers: { Authorization: `Bearer ${getToken()}` } }),
      ]);
      const [subnetsData, statsData] = await Promise.all([subnetsRes.json(), statsRes.json()]);
      if (subnetsData.code === 0) setSubnets(subnetsData.data || []);
      if (statsData.code === 0) setStats(statsData.data);
    } catch { /* ignore */ } finally { setLoading(false); }
  };

  useEffect(() => { 
    fetchAll(); 
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreate = async (values) => {
    try {
      const res = await fetch(`${API_BASE}/api/ipam/subnets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (data.code === 0) { message.success('子网已创建'); setModalOpen(false); form.resetFields(); fetchAll(); }
    } catch { message.error('创建失败'); }
  };

  const handleScan = async (subnetId) => {
    try {
      const res = await fetch(`${API_BASE}/api/ipam/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ subnetId }),
      });
      const data = await res.json();
      if (data.code === 0) { setScanResults(data.data); }
    } catch { message.error('扫描失败'); }
  };

  const handleDelete = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/api/ipam/subnets/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${getToken()}` } });
      const data = await res.json();
      if (data.code === 0) { message.success('子网已删除'); fetchAll(); }
    } catch { message.error('删除失败'); }
  };

  const columns = [
    { title: '子网', dataIndex: 'network', render: (n, r) => `${n}/${r.cidr}` },
    { title: '名称', dataIndex: 'name' },
    { title: '网关', dataIndex: 'gateway' },
    { title: 'VLAN', dataIndex: 'vlan' },
    { title: '使用率', render: (_, r) => <Progress percent={Math.round(r.usedIps / r.totalIps * 100)} size="small" /> },
    { title: 'IP使用', render: (_, r) => `${r.usedIps} / ${r.totalIps}` },
    { title: '操作', render: (_, r) => (
      <Space>
        <Button type="link" size="small" icon={<ScanOutlined />} onClick={() => { setScanModal(r.id); handleScan(r.id); }}>扫描</Button>
        <Popconfirm title="确定删除？" onConfirm={() => handleDelete(r.id)}><Button type="link" danger size="small" icon={<DeleteOutlined />}>删除</Button></Popconfirm>
      </Space>
    )},
  ];

  return (
    <div style={{ padding: '24px 32px' }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <Col><Title level={3} style={{ margin: 0 }}><GlobalOutlined style={{ marginRight: 12 }} />IP地址管理</Title></Col>
        <Col><Space><Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>新建子网</Button><Button icon={<ReloadOutlined />} onClick={fetchAll}>刷新</Button></Space></Col>
      </Row>

      {stats && (
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={6}><Card size="small"><Statistic title="子网数量" value={stats.totalSubnets} /></Card></Col>
          <Col span={6}><Card size="small"><Statistic title="总IP数" value={stats.totalIps} /></Card></Col>
          <Col span={6}><Card size="small"><Statistic title="已分配" value={stats.usedIps} /></Card></Col>
          <Col span={6}><Card size="small"><Statistic title="使用率" value={stats.utilizationRate} /></Card></Col>
        </Row>
      )}

      <Card><Table columns={columns} dataSource={subnets} rowKey="id" loading={loading} /></Card>

      <Modal title="新建子网" open={modalOpen} onCancel={() => setModalOpen(false)} onOk={() => form.submit()}>
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item name="network" label="网络地址" rules={[{ required: true }]}><Input placeholder="192.168.1.0" /></Form.Item>
          <Form.Item name="cidr" label="CIDR" rules={[{ required: true }]}><InputNumber min={8} max={30} style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="gateway" label="网关" rules={[{ required: true }]}><Input placeholder="192.168.1.1" /></Form.Item>
          <Form.Item name="vlan" label="VLAN"><InputNumber min={1} max={4094} style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="name" label="名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="description" label="描述"><Input /></Form.Item>
        </Form>
      </Modal>

      <Modal title="IP扫描结果" open={!!scanModal} onCancel={() => { setScanModal(null); setScanResults(null); }} footer={null} width={700}>
        {scanResults && (
          <Table size="small" dataSource={scanResults.discovered} rowKey="ip" columns={[
            { title: 'IP', dataIndex: 'ip' },
            { title: 'MAC', dataIndex: 'mac' },
            { title: '主机名', dataIndex: 'hostname' },
            { title: '厂商', dataIndex: 'vendor' },
            { title: '状态', dataIndex: 'status', render: (s) => <Tag color={s === 'online' ? 'green' : 'default'}>{s}</Tag> },
          ]} />
        )}
      </Modal>
    </div>
  );
};

export default IpamManagement;
