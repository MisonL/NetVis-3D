import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Space, Tag, Typography, Row, Col, Modal, Form, Input, ColorPicker, message, Popconfirm } from 'antd';
import { TagsOutlined, ReloadOutlined, PlusOutlined, DeleteOutlined, EditOutlined } from '@ant-design/icons';

const { Title } = Typography;
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const TagManagement = () => {
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTag, setEditingTag] = useState(null);
  const [form] = Form.useForm();

  const getToken = () => localStorage.getItem('token');

  const fetchTags = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/tags`, { headers: { Authorization: `Bearer ${getToken()}` } });
      const data = await res.json();
      if (data.code === 0) setTags(data.data || []);
    } catch { /* ignore */ } finally { setLoading(false); }
  };

  useEffect(() => { 
    fetchTags(); 
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (values) => {
    try {
      const color = typeof values.color === 'string' ? values.color : values.color?.toHexString?.() || '#1677ff';
      const url = editingTag ? `${API_BASE}/api/tags/${editingTag.id}` : `${API_BASE}/api/tags`;
      const res = await fetch(url, {
        method: editingTag ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ ...values, color }),
      });
      const data = await res.json();
      if (data.code === 0) { message.success(editingTag ? '更新成功' : '创建成功'); setModalOpen(false); form.resetFields(); setEditingTag(null); fetchTags(); }
    } catch { message.error('操作失败'); }
  };

  const handleDelete = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/api/tags/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${getToken()}` } });
      const data = await res.json();
      if (data.code === 0) { message.success('删除成功'); fetchTags(); }
    } catch { message.error('删除失败'); }
  };

  const columns = [
    { title: '标签名称', dataIndex: 'name', render: (n, r) => <Tag color={r.color}>{n}</Tag> },
    { title: '描述', dataIndex: 'description' },
    { title: '设备数', dataIndex: 'deviceCount' },
    { title: '创建时间', dataIndex: 'createdAt', render: (t) => new Date(t).toLocaleDateString() },
    { title: '操作', render: (_, r) => (
      <Space>
        <Button type="link" size="small" icon={<EditOutlined />} onClick={() => { setEditingTag(r); form.setFieldsValue(r); setModalOpen(true); }}>编辑</Button>
        <Popconfirm title="确定删除？" onConfirm={() => handleDelete(r.id)}><Button type="link" danger size="small" icon={<DeleteOutlined />}>删除</Button></Popconfirm>
      </Space>
    )},
  ];

  return (
    <div style={{ padding: '24px 32px' }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <Col><Title level={3} style={{ margin: 0 }}><TagsOutlined style={{ marginRight: 12 }} />标签管理</Title></Col>
        <Col><Space><Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditingTag(null); form.resetFields(); setModalOpen(true); }}>新建标签</Button><Button icon={<ReloadOutlined />} onClick={fetchTags}>刷新</Button></Space></Col>
      </Row>
      <Card><Table columns={columns} dataSource={tags} rowKey="id" loading={loading} /></Card>
      <Modal title={editingTag ? '编辑标签' : '新建标签'} open={modalOpen} onCancel={() => setModalOpen(false)} onOk={() => form.submit()}>
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="name" label="标签名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="color" label="颜色"><ColorPicker format="hex" defaultValue="#1677ff" /></Form.Item>
          <Form.Item name="description" label="描述"><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default TagManagement;
