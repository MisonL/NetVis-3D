import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Form, 
  Input, 
  Button, 
  Space, 
  Tag, 
  Typography,
  Row,
  Col,
  Switch,
  message,
  Alert,
  Divider,
  Tree,
  List,
  Avatar,
  Tabs
} from 'antd';
import { 
  WechatOutlined, 
  ReloadOutlined,
  SendOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  TeamOutlined,
  SettingOutlined,
  SafetyCertificateOutlined
} from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const WXWorkIntegration = () => {
  const [form] = Form.useForm();
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [departments, setDepartments] = useState([]);
  const [users, setUsers] = useState([]);
  const [sendForm] = Form.useForm();

  const getToken = () => localStorage.getItem('token');

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/wxwork/config`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (data.code === 0) {
        setConfig(data.data);
        form.setFieldsValue(data.data);
      }
    } catch {
      message.error('获取配置失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchDepartments = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/wxwork/departments`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (data.code === 0) {
        setDepartments(data.data || []);
      }
    } catch { /* ignore */ }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/wxwork/users`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (data.code === 0) {
        setUsers(data.data || []);
      }
    } catch { /* ignore */ }
  };

  useEffect(() => {
    fetchConfig();
    fetchDepartments();
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSaveConfig = async (values) => {
    try {
      const res = await fetch(`${API_BASE}/api/wxwork/config`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (data.code === 0) {
        message.success('配置保存成功');
        fetchConfig();
      } else {
        message.error(data.message);
      }
    } catch {
      message.error('保存失败');
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const res = await fetch(`${API_BASE}/api/wxwork/test`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (data.code === 0) {
        message.success(data.message);
      } else {
        message.error(data.message);
      }
    } catch {
      message.error('测试失败');
    } finally {
      setTesting(false);
    }
  };

  const handleSendMessage = async (values) => {
    try {
      const res = await fetch(`${API_BASE}/api/wxwork/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          type: 'text',
          content: values.content,
          toUser: ['@all'],
        }),
      });
      const data = await res.json();
      if (data.code === 0) {
        message.success('消息发送成功');
        sendForm.resetFields();
      } else {
        message.error(data.message);
      }
    } catch {
      message.error('发送失败');
    }
  };

  const buildDeptTree = (data, parentId = 0) => {
    return data
      .filter(d => d.parentId === parentId)
      .map(d => ({
        key: d.id,
        title: d.name,
        children: buildDeptTree(data, d.id),
      }));
  };

  const tabItems = [
    {
      key: 'config',
      label: <><SettingOutlined /> 配置管理</>,
      children: (
        <Card>
          <Alert
            message="企业微信集成配置"
            description="配置企业微信应用信息后，可实现告警推送、消息通知等功能"
            type="info"
            showIcon
            style={{ marginBottom: 24 }}
          />
          <Form form={form} layout="vertical" onFinish={handleSaveConfig}>
            <Row gutter={24}>
              <Col span={12}>
                <Form.Item name="corpId" label="企业ID (CorpID)">
                  <Input placeholder="请输入企业ID" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="agentId" label="应用ID (AgentId)">
                  <Input placeholder="请输入应用ID" />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item name="secret" label="应用Secret">
              <Input.Password placeholder="请输入应用Secret" />
            </Form.Item>
            <Form.Item name="webhookUrl" label="Webhook机器人地址">
              <Input placeholder="https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xxx" />
            </Form.Item>
            <Form.Item name="enabled" label="启用状态" valuePropName="checked">
              <Switch checkedChildren="启用" unCheckedChildren="禁用" />
            </Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">保存配置</Button>
              <Button onClick={handleTest} loading={testing}>测试连接</Button>
            </Space>
          </Form>
        </Card>
      ),
    },
    {
      key: 'send',
      label: <><SendOutlined /> 消息发送</>,
      children: (
        <Card>
          <Form form={sendForm} layout="vertical" onFinish={handleSendMessage}>
            <Form.Item name="content" label="消息内容" rules={[{ required: true }]}>
              <TextArea rows={4} placeholder="请输入要发送的消息内容" />
            </Form.Item>
            <Button type="primary" htmlType="submit" icon={<SendOutlined />}>
              发送消息
            </Button>
          </Form>
        </Card>
      ),
    },
    {
      key: 'contacts',
      label: <><TeamOutlined /> 通讯录</>,
      children: (
        <Row gutter={24}>
          <Col span={8}>
            <Card title="部门结构" size="small">
              <Tree
                treeData={buildDeptTree(departments)}
                defaultExpandAll
              />
            </Card>
          </Col>
          <Col span={16}>
            <Card title="成员列表" size="small">
              <List
                dataSource={users}
                renderItem={user => (
                  <List.Item>
                    <List.Item.Meta
                      avatar={<Avatar icon={<TeamOutlined />} />}
                      title={user.name}
                      description={user.mobile}
                    />
                  </List.Item>
                )}
              />
            </Card>
          </Col>
        </Row>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px 32px' }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <Col>
          <Title level={3} style={{ margin: 0 }}>
            <WechatOutlined style={{ marginRight: 12, color: '#07c160' }} />
            企业微信集成
          </Title>
        </Col>
        <Col>
          <Space>
            {config?.enabled ? (
              <Tag color="success" icon={<CheckCircleOutlined />}>已启用</Tag>
            ) : (
              <Tag color="default" icon={<CloseCircleOutlined />}>未启用</Tag>
            )}
            <Button icon={<ReloadOutlined />} onClick={fetchConfig}>刷新</Button>
          </Space>
        </Col>
      </Row>

      {/* 状态概览 */}
      <Row gutter={24} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <div style={{ textAlign: 'center' }}>
              <WechatOutlined style={{ fontSize: 32, color: '#07c160' }} />
              <div style={{ marginTop: 8 }}>
                <Text type="secondary">连接状态</Text>
              </div>
              <Tag color={config?.enabled ? 'success' : 'default'} style={{ marginTop: 4 }}>
                {config?.enabled ? '已连接' : '未连接'}
              </Tag>
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <div style={{ textAlign: 'center' }}>
              <SafetyCertificateOutlined style={{ fontSize: 32, color: '#1677ff' }} />
              <div style={{ marginTop: 8 }}>
                <Text type="secondary">应用配置</Text>
              </div>
              <Tag color={config?.hasSecret ? 'success' : 'warning'} style={{ marginTop: 4 }}>
                {config?.hasSecret ? '已配置' : '未配置'}
              </Tag>
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <div style={{ textAlign: 'center' }}>
              <SendOutlined style={{ fontSize: 32, color: '#faad14' }} />
              <div style={{ marginTop: 8 }}>
                <Text type="secondary">Webhook</Text>
              </div>
              <Tag color={config?.webhookUrl === '已配置' ? 'success' : 'default'} style={{ marginTop: 4 }}>
                {config?.webhookUrl || '未配置'}
              </Tag>
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <div style={{ textAlign: 'center' }}>
              <TeamOutlined style={{ fontSize: 32, color: '#52c41a' }} />
              <div style={{ marginTop: 8 }}>
                <Text type="secondary">通讯录</Text>
              </div>
              <Tag color="blue" style={{ marginTop: 4 }}>
                {departments.length} 部门 / {users.length} 人
              </Tag>
            </div>
          </Card>
        </Col>
      </Row>

      <Card>
        <Tabs items={tabItems} />
      </Card>
    </div>
  );
};

export default WXWorkIntegration;
