import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Space, Tag, Typography, Row, Col, Statistic, Modal, Form, Input, message, Popconfirm, Progress, Tabs, InputNumber } from 'antd';
import { CloudServerOutlined, ReloadOutlined, PlusOutlined, DeleteOutlined, HomeOutlined, AppstoreOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const DataCenterManagement = () => {
  const [dataCenters, setDataCenters] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [rackModal, setRackModal] = useState(null);
  const [racks, setRacks] = useState([]);
  const [form] = Form.useForm();

  const getToken = () => localStorage.getItem('token');

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [dcRes, statsRes] = await Promise.all([
        fetch(`${API_BASE}/api/datacenters`, { headers: { Authorization: `Bearer ${getToken()}` } }),
        fetch(`${API_BASE}/api/datacenters/stats/overview`, { headers: { Authorization: `Bearer ${getToken()}` } }),
      ]);
      const [dcData, statsData] = await Promise.all([dcRes.json(), statsRes.json()]);
      if (dcData.code === 0) setDataCenters(dcData.data || []);
      if (statsData.code === 0) setStats(statsData.data);
    } catch { /* ignore */ } finally { setLoading(false); }
  };

  const fetchRacks = async (dcId) => {
    try {
      const res = await fetch(`${API_BASE}/api/datacenters/${dcId}/racks`, { headers: { Authorization: `Bearer ${getToken()}` } });
      const data = await res.json();
      if (data.code === 0) setRacks(data.data || []);
    } catch { /* ignore */ }
  };

  useEffect(() => { 
    fetchAll(); 
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreate = async (values) => {
    try {
      const res = await fetch(`${API_BASE}/api/datacenters`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (data.code === 0) { message.success('数据中心已创建'); setModalOpen(false); form.resetFields(); fetchAll(); }
    } catch { message.error('创建失败'); }
  };

  const handleDelete = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/api/datacenters/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${getToken()}` } });
      const data = await res.json();
      if (data.code === 0) { message.success('已删除'); fetchAll(); }
    } catch { message.error('删除失败'); }
  };

  const columns = [
    { title: '名称', dataIndex: 'name' },
    { title: '编码', dataIndex: 'code', render: (c) => <Tag color="blue">{c}</Tag> },
    { title: '位置', dataIndex: 'location' },
    { title: '联系人', dataIndex: 'contact' },
    { title: '机柜数', dataIndex: 'rackCount' },
    { title: '设备数', dataIndex: 'deviceCount' },
    { title: '状态', dataIndex: 'status', render: (s) => <Tag color={s === 'active' ? 'green' : s === 'maintenance' ? 'orange' : 'default'}>{s === 'active' ? '运行中' : s === 'maintenance' ? '维护中' : '停用'}</Tag> },
    { title: '操作', render: (_, r) => (
      <Space>
        <Button type="link" size="small" icon={<AppstoreOutlined />} onClick={() => { setRackModal(r.id); fetchRacks(r.id); }}>机柜</Button>
        <Popconfirm title="确定删除？" onConfirm={() => handleDelete(r.id)}><Button type="link" danger size="small" icon={<DeleteOutlined />}>删除</Button></Popconfirm>
      </Space>
    )},
  ];

  const rackColumns = [
    { title: '机柜名', dataIndex: 'name' },
    { title: '行', dataIndex: 'row' },
    { title: '列', dataIndex: 'column' },
    { title: 'U位使用', render: (_, r) => <Progress percent={Math.round(r.usedU / r.uCount * 100)} size="small" format={() => `${r.usedU}/${r.uCount}U`} /> },
    { title: '功率', render: (_, r) => <Progress percent={Math.round(r.power / r.maxPower * 100)} size="small" strokeColor={r.power / r.maxPower > 0.8 ? '#f5222d' : '#52c41a'} format={() => `${r.power}W`} /> },
  ];

  return (
    <div style={{ padding: '24px 32px' }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <Col><Title level={3} style={{ margin: 0 }}><HomeOutlined style={{ marginRight: 12 }} />数据中心管理</Title></Col>
        <Col><Space><Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>新建数据中心</Button><Button icon={<ReloadOutlined />} onClick={fetchAll}>刷新</Button></Space></Col>
      </Row>

      {stats && (
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={4}><Card size="small"><Statistic title="数据中心" value={stats.totalDataCenters} /></Card></Col>
          <Col span={4}><Card size="small"><Statistic title="机柜总数" value={stats.totalRacks} /></Card></Col>
          <Col span={4}><Card size="small"><Statistic title="设备总数" value={stats.totalDevices} /></Card></Col>
          <Col span={4}><Card size="small"><Statistic title="总U位" value={stats.totalU} /></Card></Col>
          <Col span={4}><Card size="small"><Statistic title="已用U位" value={stats.usedU} /></Card></Col>
          <Col span={4}><Card size="small"><Statistic title="利用率" value={stats.avgUtilization} /></Card></Col>
        </Row>
      )}

      <Card><Table columns={columns} dataSource={dataCenters} rowKey="id" loading={loading} /></Card>

      <Modal title="新建数据中心" open={modalOpen} onCancel={() => setModalOpen(false)} onOk={() => form.submit()}>
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item name="name" label="名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="code" label="编码" rules={[{ required: true }]}><Input placeholder="DC-01" /></Form.Item>
          <Form.Item name="location" label="位置" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="address" label="地址"><Input /></Form.Item>
          <Form.Item name="contact" label="联系人"><Input /></Form.Item>
          <Form.Item name="phone" label="电话"><Input /></Form.Item>
        </Form>
      </Modal>

      <Modal title="机柜列表" open={!!rackModal} onCancel={() => { setRackModal(null); setRacks([]); }} footer={null} width={800}>
        <Table columns={rackColumns} dataSource={racks} rowKey="id" size="small" />
      </Modal>
    </div>
  );
};

export default DataCenterManagement;
