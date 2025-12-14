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
  Tabs
} from 'antd';
import { 
  PlusOutlined, 
  EditOutlined, 
  DeleteOutlined,
  MailOutlined,
  SendOutlined,
  EyeOutlined,
  ReloadOutlined
} from '@ant-design/icons';

const { Title, Text } = Typography;
const { TextArea } = Input;

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const NotificationTemplates = () => {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewContent, setPreviewContent] = useState('');
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [activeTab, setActiveTab] = useState('all');
  const [form] = Form.useForm();

  const getToken = () => localStorage.getItem('token');

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const params = activeTab !== 'all' ? `?type=${activeTab}` : '';
      const res = await fetch(`${API_BASE}/api/templates/list${params}`, {
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
  }, [activeTab]);

  const handleSubmit = async (values) => {
    try {
      const url = editingTemplate 
        ? `${API_BASE}/api/templates/${editingTemplate.id}`
        : `${API_BASE}/api/templates`;
      
      const res = await fetch(url, {
        method: editingTemplate ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify(values),
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
      const res = await fetch(`${API_BASE}/api/templates/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (data.code === 0) {
        message.success('模板删除成功');
        fetchTemplates();
      } else {
        message.error(data.message);
      }
    } catch {
      message.error('删除失败');
    }
  };

  const handlePreview = async (template) => {
    const testVariables = {};
    template.variables?.forEach(v => {
      testVariables[v] = `[${v}]`;
    });

    try {
      const res = await fetch(`${API_BASE}/api/templates/preview`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          content: template.content,
          variables: testVariables,
        }),
      });
      const data = await res.json();
      if (data.code === 0) {
        setPreviewContent(data.data.preview);
        setPreviewVisible(true);
      }
    } catch {
      message.error('预览失败');
    }
  };

  const handleTest = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/api/templates/${id}/test`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (data.code === 0) {
        message.success('测试发送成功');
      }
    } catch {
      message.error('测试失败');
    }
  };

  const columns = [
    {
      title: '模板名称',
      dataIndex: 'name',
      render: (name, record) => (
        <Space>
          <MailOutlined style={{ color: record.isDefault ? '#1890ff' : '#999' }} />
          <Text strong>{name}</Text>
          {record.isDefault && <Tag color="blue">默认</Tag>}
        </Space>
      ),
    },
    {
      title: '类型',
      dataIndex: 'type',
      render: (type) => {
        const typeMap = {
          alert: { text: '告警', color: 'red' },
          report: { text: '报表', color: 'blue' },
          system: { text: '系统', color: 'purple' },
        };
        const t = typeMap[type] || { text: type, color: 'default' };
        return <Tag color={t.color}>{t.text}</Tag>;
      },
    },
    {
      title: '渠道',
      dataIndex: 'channel',
      render: (channel) => {
        const channelMap = {
          email: '邮件',
          webhook: 'Webhook',
          sms: '短信',
          dingtalk: '钉钉',
          wechat: '企业微信',
        };
        return <Tag>{channelMap[channel] || channel}</Tag>;
      },
    },
    {
      title: '变量数',
      dataIndex: 'variables',
      render: (vars) => <Tag>{vars?.length || 0} 个</Tag>,
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      render: (t) => t ? new Date(t).toLocaleDateString() : '-',
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button
            type="text"
            icon={<EyeOutlined />}
            onClick={() => handlePreview(record)}
          />
          <Button
            type="text"
            icon={<SendOutlined />}
            onClick={() => handleTest(record.id)}
          />
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => {
              setEditingTemplate(record);
              form.setFieldsValue(record);
              setModalVisible(true);
            }}
          />
          {!record.isDefault && (
            <Popconfirm title="确定删除此模板？" onConfirm={() => handleDelete(record.id)}>
              <Button type="text" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px 32px' }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <Col>
          <Title level={3} style={{ margin: 0 }}>
            <MailOutlined style={{ marginRight: 12 }} />
            通知模板管理
          </Title>
        </Col>
        <Col>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={fetchTemplates}>
              刷新
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => { setEditingTemplate(null); form.resetFields(); setModalVisible(true); }}
            >
              新建模板
            </Button>
          </Space>
        </Col>
      </Row>

      <Card>
        <Tabs activeKey={activeTab} onChange={setActiveTab}>
          <Tabs.TabPane tab="全部" key="all" />
          <Tabs.TabPane tab="告警模板" key="alert" />
          <Tabs.TabPane tab="报表模板" key="report" />
          <Tabs.TabPane tab="系统模板" key="system" />
        </Tabs>

        <Table
          columns={columns}
          dataSource={templates}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      <Modal
        title={editingTemplate ? '编辑模板' : '新建模板'}
        open={modalVisible}
        onCancel={() => { setModalVisible(false); setEditingTemplate(null); form.resetFields(); }}
        onOk={() => form.submit()}
        width={700}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}
          initialValues={{ type: 'alert', channel: 'email' }}>
          <Form.Item name="name" label="模板名称" rules={[{ required: true }]}>
            <Input placeholder="如: 设备离线告警" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="type" label="模板类型" rules={[{ required: true }]}>
                <Select>
                  <Select.Option value="alert">告警模板</Select.Option>
                  <Select.Option value="report">报表模板</Select.Option>
                  <Select.Option value="system">系统模板</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="channel" label="通知渠道" rules={[{ required: true }]}>
                <Select>
                  <Select.Option value="email">邮件</Select.Option>
                  <Select.Option value="webhook">Webhook</Select.Option>
                  <Select.Option value="sms">短信</Select.Option>
                  <Select.Option value="dingtalk">钉钉</Select.Option>
                  <Select.Option value="wechat">企业微信</Select.Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="subject" label="邮件主题">
            <Input placeholder="支持变量 {{variable}}" />
          </Form.Item>
          <Form.Item name="content" label="模板内容" rules={[{ required: true }]}>
            <TextArea rows={10} placeholder="使用 {{variable}} 表示变量" />
          </Form.Item>
          <Text type="secondary">
            常用变量: {'{{deviceName}} {{deviceIp}} {{alertTime}} {{severity}} {{alertTitle}}'}
          </Text>
        </Form>
      </Modal>

      <Modal
        title="模板预览"
        open={previewVisible}
        onCancel={() => setPreviewVisible(false)}
        footer={null}
        width={600}
      >
        <pre style={{ 
          background: '#f5f5f5', 
          padding: 16, 
          borderRadius: 8, 
          whiteSpace: 'pre-wrap',
          maxHeight: 400,
          overflow: 'auto',
        }}>
          {previewContent}
        </pre>
      </Modal>
    </div>
  );
};

export default NotificationTemplates;
