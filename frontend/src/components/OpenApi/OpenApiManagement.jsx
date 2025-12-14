import React, { useState, useEffect } from 'react';
import { 
  Card, Table, Typography, Tag, Space, Button, Modal, Form, 
  Input, Select, message, Tabs, Popconfirm, Switch, Tooltip
} from 'antd';
import { 
  ApiOutlined, KeyOutlined, LinkOutlined, PlusOutlined,
  CopyOutlined, DeleteOutlined, PlayCircleOutlined
} from '@ant-design/icons';
import { useAuth } from '../../context/AuthContext';

const { Title, Text, Paragraph } = Typography;

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const OpenApiManagement = () => {
  const { token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [apiKeys, setApiKeys] = useState([]);
  const [webhooks, setWebhooks] = useState([]);
  const [keyModalVisible, setKeyModalVisible] = useState(false);
  const [webhookModalVisible, setWebhookModalVisible] = useState(false);
  const [newKeySecret, setNewKeySecret] = useState(null);
  const [keyForm] = Form.useForm();
  const [webhookForm] = Form.useForm();

  useEffect(() => {
    fetchApiKeys();
    fetchWebhooks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchApiKeys = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/openapi/keys`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.code === 0) {
        setApiKeys(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch API keys:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchWebhooks = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/openapi/webhooks`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.code === 0) {
        setWebhooks(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch webhooks:', err);
    }
  };

  const handleCreateKey = async (values) => {
    try {
      const res = await fetch(`${API_BASE}/api/openapi/keys`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (data.code === 0) {
        message.success('API Key创建成功');
        setNewKeySecret(data.data);
        keyForm.resetFields();
        fetchApiKeys();
      } else {
        message.error(data.message);
      }
    } catch {
      message.error('创建失败');
    }
  };

  const handleCreateWebhook = async (values) => {
    try {
      const res = await fetch(`${API_BASE}/api/openapi/webhooks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (data.code === 0) {
        message.success('Webhook创建成功');
        setWebhookModalVisible(false);
        webhookForm.resetFields();
        fetchWebhooks();
      } else {
        message.error(data.message);
      }
    } catch {
      message.error('创建失败');
    }
  };

  const handleTestWebhook = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/api/openapi/webhooks/${id}/test`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.code === 0) {
        message.success(`测试成功，响应时间: ${data.data.responseTime}ms`);
      }
    } catch {
      message.error('测试失败');
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    message.success('已复制到剪贴板');
  };

  const keyColumns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'API Key',
      dataIndex: 'key',
      key: 'key',
      render: (val) => (
        <Space>
          <Text code>{val.substring(0, 20)}...</Text>
          <Tooltip title="复制">
            <Button type="text" size="small" icon={<CopyOutlined />} onClick={() => copyToClipboard(val)} />
          </Tooltip>
        </Space>
      ),
    },
    {
      title: '权限',
      dataIndex: 'permissions',
      key: 'permissions',
      render: (perms) => (
        <Space>
          {perms?.map(p => <Tag key={p} color={p === 'admin' ? 'red' : p === 'write' ? 'orange' : 'blue'}>{p}</Tag>)}
        </Space>
      ),
    },
    {
      title: '限流',
      dataIndex: 'rateLimit',
      key: 'rateLimit',
      render: (val) => `${val}/小时`,
    },
    {
      title: '状态',
      dataIndex: 'isActive',
      key: 'isActive',
      render: (val) => <Tag color={val ? 'success' : 'default'}>{val ? '启用' : '禁用'}</Tag>,
    },
    {
      title: '最后使用',
      dataIndex: 'lastUsedAt',
      key: 'lastUsedAt',
      render: (val) => val ? new Date(val).toLocaleString() : '-',
    },
    {
      title: '操作',
      key: 'action',
      render: () => (
        <Popconfirm title="确认删除?" okText="确认" cancelText="取消">
          <Button type="text" danger size="small" icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ];

  const webhookColumns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'URL',
      dataIndex: 'url',
      key: 'url',
      ellipsis: true,
      render: (val) => <Text code style={{ fontSize: 12 }}>{val}</Text>,
    },
    {
      title: '事件',
      dataIndex: 'events',
      key: 'events',
      render: (events) => (
        <Space wrap>
          {events?.map(e => <Tag key={e}>{e}</Tag>)}
        </Space>
      ),
    },
    {
      title: '状态',
      dataIndex: 'isActive',
      key: 'isActive',
      render: (val) => <Tag color={val ? 'success' : 'default'}>{val ? '启用' : '禁用'}</Tag>,
    },
    {
      title: '失败次数',
      dataIndex: 'failCount',
      key: 'failCount',
      render: (val) => <Tag color={val > 0 ? 'error' : 'default'}>{val}</Tag>,
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space>
          <Button type="text" size="small" icon={<PlayCircleOutlined />} onClick={() => handleTestWebhook(record.id)}>测试</Button>
          <Popconfirm title="确认删除?" okText="确认" cancelText="取消">
            <Button type="text" danger size="small" icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const tabItems = [
    {
      key: 'keys',
      label: (
        <span><KeyOutlined /> API Keys</span>
      ),
      children: (
        <>
          <div style={{ marginBottom: 16, textAlign: 'right' }}>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setKeyModalVisible(true)}>
              创建API Key
            </Button>
          </div>
          <Table
            columns={keyColumns}
            dataSource={apiKeys}
            rowKey="id"
            loading={loading}
            pagination={false}
          />
        </>
      ),
    },
    {
      key: 'webhooks',
      label: (
        <span><LinkOutlined /> Webhooks</span>
      ),
      children: (
        <>
          <div style={{ marginBottom: 16, textAlign: 'right' }}>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setWebhookModalVisible(true)}>
              创建Webhook
            </Button>
          </div>
          <Table
            columns={webhookColumns}
            dataSource={webhooks}
            rowKey="id"
            pagination={false}
          />
        </>
      ),
    },
  ];

  return (
    <div style={{ padding: '32px 48px' }}>
      <Title level={4} style={{ marginBottom: 24 }}>
        <ApiOutlined style={{ marginRight: 8 }} />
        开放API管理
      </Title>

      <Card style={{ background: 'var(--glass-card-bg)', border: '1px solid var(--glass-border)' }}>
        <Tabs items={tabItems} />
      </Card>

      {/* 创建API Key弹窗 */}
      <Modal
        title="创建API Key"
        open={keyModalVisible}
        onCancel={() => {
          setKeyModalVisible(false);
          setNewKeySecret(null);
        }}
        footer={null}
        width={500}
      >
        {newKeySecret ? (
          <div>
            <Paragraph type="warning">
              请保存以下密钥，它只会显示一次：
            </Paragraph>
            <Card size="small" style={{ marginBottom: 16 }}>
              <div style={{ marginBottom: 8 }}>
                <Text type="secondary">API Key:</Text>
                <div><Text code copyable>{newKeySecret.key}</Text></div>
              </div>
              <div>
                <Text type="secondary">Secret:</Text>
                <div><Text code copyable>{newKeySecret.secret}</Text></div>
              </div>
            </Card>
            <Button type="primary" block onClick={() => { setKeyModalVisible(false); setNewKeySecret(null); }}>
              我已保存
            </Button>
          </div>
        ) : (
          <Form form={keyForm} layout="vertical" onFinish={handleCreateKey}>
            <Form.Item name="name" label="名称" rules={[{ required: true }]}>
              <Input placeholder="如：监控系统集成" />
            </Form.Item>
            <Form.Item name="permissions" label="权限" initialValue={['read']}>
              <Select mode="multiple" options={[
                { label: '只读 (read)', value: 'read' },
                { label: '读写 (write)', value: 'write' },
                { label: '管理员 (admin)', value: 'admin' },
              ]} />
            </Form.Item>
            <Form.Item name="rateLimit" label="限流(次/小时)" initialValue={1000}>
              <Select options={[
                { label: '1000', value: 1000 },
                { label: '5000', value: 5000 },
                { label: '10000', value: 10000 },
                { label: '无限制', value: 100000 },
              ]} />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit" block>创建</Button>
            </Form.Item>
          </Form>
        )}
      </Modal>

      {/* 创建Webhook弹窗 */}
      <Modal
        title="创建Webhook"
        open={webhookModalVisible}
        onCancel={() => setWebhookModalVisible(false)}
        footer={null}
        width={500}
      >
        <Form form={webhookForm} layout="vertical" onFinish={handleCreateWebhook}>
          <Form.Item name="name" label="名称" rules={[{ required: true }]}>
            <Input placeholder="如：告警推送到钉钉" />
          </Form.Item>
          <Form.Item name="url" label="回调URL" rules={[{ required: true, type: 'url' }]}>
            <Input placeholder="https://your-server.com/webhook" />
          </Form.Item>
          <Form.Item name="events" label="订阅事件" rules={[{ required: true }]}>
            <Select mode="multiple" options={[
              { label: '设备上线 (device.online)', value: 'device.online' },
              { label: '设备离线 (device.offline)', value: 'device.offline' },
              { label: '告警产生 (alert.created)', value: 'alert.created' },
              { label: '告警解决 (alert.resolved)', value: 'alert.resolved' },
            ]} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block>创建</Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default OpenApiManagement;
