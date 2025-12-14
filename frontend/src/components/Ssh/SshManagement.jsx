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
  InputNumber,
  message,
  Popconfirm,
  Typography,
  Row,
  Col,
  Statistic,
  Tabs,
  List
} from 'antd';
import { 
  PlusOutlined, 
  DeleteOutlined,
  CodeOutlined,
  KeyOutlined,
  ReloadOutlined,
  PlayCircleOutlined,
  HistoryOutlined,
  SendOutlined
} from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const SshManagement = () => {
  const [credentials, setCredentials] = useState([]);
  const [devices, setDevices] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [credModalVisible, setCredModalVisible] = useState(false);
  const [execModalVisible, setExecModalVisible] = useState(false);
  const [execResult, setExecResult] = useState(null);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [form] = Form.useForm();
  const [execForm] = Form.useForm();

  const getToken = () => localStorage.getItem('token');

  const fetchCredentials = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/ssh/credentials`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (data.code === 0) setCredentials(data.data || []);
    } catch { /* ignore */ }
  };

  const fetchDevices = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/devices`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (data.code === 0) setDevices(data.data || []);
    } catch { /* ignore */ }
  };

  const fetchTemplates = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/ssh/templates`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (data.code === 0) setTemplates(data.data || []);
    } catch { /* ignore */ }
  };

  const fetchSessions = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/ssh/sessions?pageSize=10`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (data.code === 0) setSessions(data.data?.list || []);
    } catch { /* ignore */ }
  };

  useEffect(() => {
    fetchCredentials();
    fetchDevices();
    fetchTemplates();
    fetchSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreateCredential = async (values) => {
    try {
      const res = await fetch(`${API_BASE}/api/ssh/credentials`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (data.code === 0) {
        message.success('凭据创建成功');
        setCredModalVisible(false);
        form.resetFields();
        fetchCredentials();
      } else {
        message.error(data.message);
      }
    } catch {
      message.error('创建失败');
    }
  };

  const handleDeleteCredential = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/api/ssh/credentials/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (data.code === 0) {
        message.success('删除成功');
        fetchCredentials();
      }
    } catch {
      message.error('删除失败');
    }
  };

  const handleExecute = async (values) => {
    setLoading(true);
    try {
      const commands = values.commands.split('\n').filter(c => c.trim());
      const res = await fetch(`${API_BASE}/api/ssh/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ deviceId: values.deviceId, commands }),
      });
      const data = await res.json();
      if (data.code === 0) {
        message.success('命令执行成功');
        setExecResult(data.data);
        fetchSessions();
      } else {
        message.error(data.message);
      }
    } catch {
      message.error('执行失败');
    } finally {
      setLoading(false);
    }
  };

  const credColumns = [
    { title: '凭据名称', dataIndex: 'name', render: (n) => <Text strong>{n}</Text> },
    { title: '用户名', dataIndex: 'username' },
    { title: '端口', dataIndex: 'port', width: 80 },
    { title: '关联设备', dataIndex: 'deviceIds', render: (ids) => (ids?.length || 0) + ' 台' },
    {
      title: '操作', key: 'actions', width: 100,
      render: (_, record) => (
        <Popconfirm title="确定删除？" onConfirm={() => handleDeleteCredential(record.id)}>
          <Button type="text" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ];

  const tabItems = [
    {
      key: 'execute',
      label: <><CodeOutlined /> 命令执行</>,
      children: (
        <Row gutter={24}>
          <Col span={12}>
            <Card title="执行命令" size="small">
              <Form form={execForm} layout="vertical" onFinish={handleExecute}>
                <Form.Item name="deviceId" label="选择设备" rules={[{ required: true }]}>
                  <Select placeholder="选择设备" showSearch
                    filterOption={(input, opt) => opt.children.toLowerCase().includes(input.toLowerCase())}>
                    {devices.map(d => (
                      <Select.Option key={d.id} value={d.id}>{d.name} ({d.ipAddress})</Select.Option>
                    ))}
                  </Select>
                </Form.Item>
                <Form.Item name="commands" label="命令 (每行一条)" rules={[{ required: true }]}>
                  <TextArea rows={5} placeholder="show version&#10;show ip interface brief" />
                </Form.Item>
                <Form.Item>
                  <Button type="primary" htmlType="submit" icon={<SendOutlined />} loading={loading}>
                    执行命令
                  </Button>
                </Form.Item>
              </Form>
            </Card>
          </Col>
          <Col span={12}>
            <Card title="执行结果" size="small">
              {execResult ? (
                <div style={{ maxHeight: 300, overflow: 'auto' }}>
                  {execResult.results?.map((r, i) => (
                    <div key={i} style={{ marginBottom: 16 }}>
                      <Tag color="blue">{r.command}</Tag>
                      <pre style={{ 
                        background: '#1e1e1e', color: '#d4d4d4', padding: 12, 
                        borderRadius: 4, fontSize: 12, marginTop: 8, overflow: 'auto' 
                      }}>
                        {r.output}
                      </pre>
                    </div>
                  ))}
                </div>
              ) : (
                <Text type="secondary">执行命令后在此显示结果</Text>
              )}
            </Card>
          </Col>
        </Row>
      ),
    },
    {
      key: 'credentials',
      label: <><KeyOutlined /> 凭据管理</>,
      children: (
        <Card 
          title="SSH凭据" 
          extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => setCredModalVisible(true)}>新建凭据</Button>}
        >
          <Table columns={credColumns} dataSource={credentials} rowKey="id" pagination={false} />
        </Card>
      ),
    },
    {
      key: 'templates',
      label: <><CodeOutlined /> 命令模板</>,
      children: (
        <Card title="预置命令模板">
          <List
            dataSource={templates}
            renderItem={(item) => (
              <List.Item actions={[
                <Button size="small" onClick={() => execForm.setFieldsValue({ commands: item.commands.join('\n') })}>
                  使用模板
                </Button>
              ]}>
                <List.Item.Meta
                  title={<><Tag color={item.vendor === 'cisco' ? 'blue' : 'orange'}>{item.vendor}</Tag> {item.name}</>}
                  description={item.description}
                />
              </List.Item>
            )}
          />
        </Card>
      ),
    },
    {
      key: 'history',
      label: <><HistoryOutlined /> 执行历史</>,
      children: (
        <Card title="SSH会话历史">
          <List
            dataSource={sessions}
            renderItem={(item) => (
              <List.Item>
                <List.Item.Meta
                  title={<Text code>设备ID: {item.deviceId?.slice(0, 8)}...</Text>}
                  description={`${item.commands?.length || 0} 条命令 · ${new Date(item.startTime).toLocaleString()}`}
                />
                <Tag color={item.status === 'active' ? 'processing' : 'default'}>{item.status}</Tag>
              </List.Item>
            )}
          />
        </Card>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px 32px' }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <Col>
          <Title level={3} style={{ margin: 0 }}>
            <CodeOutlined style={{ marginRight: 12 }} />
            SSH设备管理
          </Title>
        </Col>
        <Col>
          <Button icon={<ReloadOutlined />} onClick={() => { fetchCredentials(); fetchSessions(); }}>
            刷新
          </Button>
        </Col>
      </Row>

      <Row gutter={24} style={{ marginBottom: 24 }}>
        <Col span={6}><Card><Statistic title="SSH凭据" value={credentials.length} prefix={<KeyOutlined />} /></Card></Col>
        <Col span={6}><Card><Statistic title="可管理设备" value={devices.filter(d => d.status === 'online').length} /></Card></Col>
        <Col span={6}><Card><Statistic title="命令模板" value={templates.length} /></Card></Col>
        <Col span={6}><Card><Statistic title="今日会话" value={sessions.length} prefix={<HistoryOutlined />} /></Card></Col>
      </Row>

      <Card>
        <Tabs items={tabItems} />
      </Card>

      <Modal
        title="新建SSH凭据"
        open={credModalVisible}
        onCancel={() => { setCredModalVisible(false); form.resetFields(); }}
        onOk={() => form.submit()}
      >
        <Form form={form} layout="vertical" onFinish={handleCreateCredential} initialValues={{ port: 22 }}>
          <Form.Item name="name" label="凭据名称" rules={[{ required: true }]}>
            <Input placeholder="如: 核心交换机凭据" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={16}>
              <Form.Item name="username" label="用户名" rules={[{ required: true }]}>
                <Input placeholder="SSH用户名" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="port" label="端口">
                <InputNumber min={1} max={65535} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="password" label="密码">
            <Input.Password placeholder="SSH密码" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default SshManagement;
