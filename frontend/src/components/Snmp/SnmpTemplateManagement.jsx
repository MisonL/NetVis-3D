import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Table, 
  Button, 
  Space, 
  Tag, 
  Modal, 
  Form, 
  Input, 
  Select, 
  message,
  Popconfirm,
  Typography,
  Row,
  Col,
  Tooltip,
  Divider
} from 'antd';
import { 
  PlusOutlined, 
  EditOutlined, 
  DeleteOutlined,
  ApiOutlined,
  PlayCircleOutlined,
  CopyOutlined
} from '@ant-design/icons';

const { Title, Text } = Typography;

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const SnmpTemplateManagement = () => {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [testModalVisible, setTestModalVisible] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [form] = Form.useForm();
  const [testForm] = Form.useForm();

  const getToken = () => localStorage.getItem('token');

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/snmp/templates`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (data.code === 0) {
        setTemplates(data.data || []);
      }
    } catch {
      message.error('获取模板列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (values) => {
    try {
      const url = editingTemplate 
        ? `${API_BASE}/api/snmp/templates/${editingTemplate.id}`
        : `${API_BASE}/api/snmp/templates`;
      
      const res = await fetch(url, {
        method: editingTemplate ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          ...values,
          oids: values.oids || [],
        }),
      });
      
      const data = await res.json();
      if (data.code === 0) {
        message.success(editingTemplate ? '模板更新成功' : '模板创建成功');
        setModalVisible(false);
        form.resetFields();
        setEditingTemplate(null);
        fetchTemplates();
      } else {
        message.error(data.message);
      }
    } catch {
      message.error('操作失败');
    }
  };

  const handleDelete = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/api/snmp/templates/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (data.code === 0) {
        message.success('模板删除成功');
        fetchTemplates();
      }
    } catch {
      message.error('删除失败');
    }
  };

  const handleTest = async (values) => {
    setTestLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/snmp/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (data.code === 0) {
        message.success(`测试成功！响应时间: ${data.data.responseTime.toFixed(0)}ms`);
        Modal.info({
          title: 'SNMP测试结果',
          content: (
            <div>
              <p><strong>系统描述:</strong> {data.data.sysDescr}</p>
              <p><strong>运行时间:</strong> {Math.floor(data.data.sysUpTime / 86400)} 天</p>
            </div>
          ),
        });
      } else {
        message.error(data.message);
      }
    } catch {
      message.error('测试失败');
    } finally {
      setTestLoading(false);
    }
  };

  const columns = [
    {
      title: '模板名称',
      dataIndex: 'name',
      render: (name) => (
        <Space>
          <ApiOutlined style={{ color: '#1890ff' }} />
          <Text strong>{name}</Text>
        </Space>
      ),
    },
    {
      title: '厂商',
      dataIndex: 'vendor',
      render: (v) => <Tag>{v || '-'}</Tag>,
    },
    {
      title: 'SNMP版本',
      dataIndex: 'version',
      render: (v) => <Tag color="blue">{v.toUpperCase()}</Tag>,
    },
    {
      title: 'OID数量',
      dataIndex: 'oids',
      render: (oids) => <Tag>{oids?.length || 0} 个</Tag>,
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      render: (t) => t ? new Date(t).toLocaleDateString() : '-',
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Tooltip title="编辑">
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => {
                setEditingTemplate(record);
                form.setFieldsValue(record);
                setModalVisible(true);
              }}
            />
          </Tooltip>
          <Tooltip title="复制">
            <Button
              type="text"
              icon={<CopyOutlined />}
              onClick={() => {
                setEditingTemplate(null);
                form.setFieldsValue({ ...record, name: `${record.name} (副本)` });
                setModalVisible(true);
              }}
            />
          </Tooltip>
          <Popconfirm title="确定删除此模板？" onConfirm={() => handleDelete(record.id)}>
            <Button type="text" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px 32px' }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <Col>
          <Title level={3} style={{ margin: 0 }}>
            <ApiOutlined style={{ marginRight: 12 }} />
            SNMP模板管理
          </Title>
        </Col>
        <Col>
          <Space>
            <Button icon={<PlayCircleOutlined />} onClick={() => setTestModalVisible(true)}>
              测试连接
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                setEditingTemplate(null);
                form.resetFields();
                setModalVisible(true);
              }}
            >
              新建模板
            </Button>
          </Space>
        </Col>
      </Row>

      <Card>
        <Table
          columns={columns}
          dataSource={templates}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      {/* 模板编辑Modal */}
      <Modal
        title={editingTemplate ? '编辑模板' : '新建模板'}
        open={modalVisible}
        onCancel={() => { setModalVisible(false); setEditingTemplate(null); form.resetFields(); }}
        onOk={() => form.submit()}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}
          initialValues={{ version: 'v2c', community: 'public', oids: [] }}>
          <Form.Item name="name" label="模板名称" rules={[{ required: true }]}>
            <Input placeholder="如: Cisco 交换机模板" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="vendor" label="厂商">
                <Select placeholder="选择厂商">
                  <Select.Option value="Cisco">Cisco</Select.Option>
                  <Select.Option value="Huawei">Huawei</Select.Option>
                  <Select.Option value="H3C">H3C</Select.Option>
                  <Select.Option value="Ruijie">Ruijie</Select.Option>
                  <Select.Option value="Linux">Linux</Select.Option>
                  <Select.Option value="通用">通用</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="version" label="SNMP版本" rules={[{ required: true }]}>
                <Select>
                  <Select.Option value="v1">SNMPv1</Select.Option>
                  <Select.Option value="v2c">SNMPv2c</Select.Option>
                  <Select.Option value="v3">SNMPv3</Select.Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="community" label="Community">
            <Input placeholder="public" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 测试Modal */}
      <Modal
        title="SNMP连接测试"
        open={testModalVisible}
        onCancel={() => setTestModalVisible(false)}
        onOk={() => testForm.submit()}
        confirmLoading={testLoading}
      >
        <Form form={testForm} layout="vertical" onFinish={handleTest}
          initialValues={{ version: 'v2c', community: 'public' }}>
          <Form.Item name="ip" label="目标IP" rules={[{ required: true }]}>
            <Input placeholder="192.168.1.1" />
          </Form.Item>
          <Form.Item name="version" label="SNMP版本">
            <Select>
              <Select.Option value="v1">SNMPv1</Select.Option>
              <Select.Option value="v2c">SNMPv2c</Select.Option>
              <Select.Option value="v3">SNMPv3</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="community" label="Community">
            <Input placeholder="public" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default SnmpTemplateManagement;
