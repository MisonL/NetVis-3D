import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Space, Tag, Typography, Row, Col, Modal, Form, Input, Select, message, Popconfirm } from 'antd';
import { FileTextOutlined, ReloadOutlined, PlusOutlined, CopyOutlined, DeleteOutlined } from '@ant-design/icons';

const { Title } = Typography;
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const DeviceTemplateManagement = () => {
  const [templates, setTemplates] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();

  const getToken = () => localStorage.getItem('token');

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [templatesRes, vendorsRes] = await Promise.all([
        fetch(`${API_BASE}/api/device-templates`, { headers: { Authorization: `Bearer ${getToken()}` } }),
        fetch(`${API_BASE}/api/device-templates/vendors/list`, { headers: { Authorization: `Bearer ${getToken()}` } }),
      ]);
      const [templatesData, vendorsData] = await Promise.all([templatesRes.json(), vendorsRes.json()]);
      if (templatesData.code === 0) setTemplates(templatesData.data || []);
      if (vendorsData.code === 0) setVendors(vendorsData.data || []);
    } catch { /* ignore */ } finally { setLoading(false); }
  };

  useEffect(() => { 
    fetchAll(); 
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreate = async (values) => {
    try {
      const res = await fetch(`${API_BASE}/api/device-templates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (data.code === 0) { message.success('模板已创建'); setModalOpen(false); form.resetFields(); fetchAll(); }
    } catch { message.error('创建失败'); }
  };

  const handleClone = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/api/device-templates/${id}/clone`, { method: 'POST', headers: { Authorization: `Bearer ${getToken()}` } });
      const data = await res.json();
      if (data.code === 0) { message.success('模板已克隆'); fetchAll(); }
    } catch { message.error('克隆失败'); }
  };

  const handleDelete = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/api/device-templates/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${getToken()}` } });
      const data = await res.json();
      if (data.code === 0) { message.success('模板已删除'); fetchAll(); }
    } catch { message.error('删除失败'); }
  };

  const columns = [
    { title: '模板名称', dataIndex: 'name' },
    { title: '厂商', dataIndex: 'vendor', render: (v) => <Tag color="blue">{v}</Tag> },
    { title: '型号', dataIndex: 'model' },
    { title: '类型', dataIndex: 'type' },
    { title: 'SNMP OID数', dataIndex: 'snmpOid', render: (o) => o?.length || 0 },
    { title: 'SSH命令数', dataIndex: 'sshCommands', render: (c) => c?.length || 0 },
    { title: '指标数', dataIndex: 'metrics', render: (m) => m?.length || 0 },
    { title: '操作', render: (_, r) => (
      <Space>
        <Button type="link" size="small" icon={<CopyOutlined />} onClick={() => handleClone(r.id)}>克隆</Button>
        <Popconfirm title="确定删除？" onConfirm={() => handleDelete(r.id)}><Button type="link" danger size="small" icon={<DeleteOutlined />}>删除</Button></Popconfirm>
      </Space>
    )},
  ];

  return (
    <div style={{ padding: '24px 32px' }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <Col><Title level={3} style={{ margin: 0 }}><FileTextOutlined style={{ marginRight: 12 }} />设备模板</Title></Col>
        <Col><Space><Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>新建模板</Button><Button icon={<ReloadOutlined />} onClick={fetchAll}>刷新</Button></Space></Col>
      </Row>

      <Card><Table columns={columns} dataSource={templates} rowKey="id" loading={loading} /></Card>

      <Modal title="新建设备模板" open={modalOpen} onCancel={() => setModalOpen(false)} onOk={() => form.submit()}>
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item name="name" label="模板名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="vendor" label="厂商" rules={[{ required: true }]}><Select options={vendors.map(v => ({ value: v, label: v }))} /></Form.Item>
          <Form.Item name="model" label="型号" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="type" label="设备类型" rules={[{ required: true }]}>
            <Select options={[{ value: 'switch', label: '交换机' }, { value: 'router', label: '路由器' }, { value: 'firewall', label: '防火墙' }]} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default DeviceTemplateManagement;
