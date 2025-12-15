import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Table,
  Button, 
  Space, 
  Tag, 
  Typography,
  Row,
  Col,
  Statistic,
  Modal,
  Form,
  Input,
  Switch,
  InputNumber,
  message,
  Tabs,
  List,
  Popconfirm
} from 'antd';
import { 
  SafetyOutlined, 
  ReloadOutlined,
  StopOutlined,
  UnlockOutlined,
  PlusOutlined,
  DeleteOutlined,
  UserOutlined,
  LaptopOutlined,
  ClockCircleOutlined,
  WarningOutlined
} from '@ant-design/icons';

const { Title, Text } = Typography;

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const SecurityCenter = () => {
  const [sessions, setSessions] = useState([]);
  const [overview, setOverview] = useState(null);
  const [policies, setPolicies] = useState(null);
  const [lockedUsers, setLockedUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [policyModal, setPolicyModal] = useState(false);
  const [form] = Form.useForm();

  const getToken = () => localStorage.getItem('token');

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [sessionsRes, overviewRes, policiesRes, lockedRes] = await Promise.all([
        fetch(`${API_BASE}/api/security/sessions`, { headers: { Authorization: `Bearer ${getToken()}` } }),
        fetch(`${API_BASE}/api/security/overview`, { headers: { Authorization: `Bearer ${getToken()}` } }),
        fetch(`${API_BASE}/api/security/policies`, { headers: { Authorization: `Bearer ${getToken()}` } }),
        fetch(`${API_BASE}/api/security/locked-users`, { headers: { Authorization: `Bearer ${getToken()}` } }),
      ]);

      const [sessionsData, overviewData, policiesData, lockedData] = await Promise.all([
        sessionsRes.json(), overviewRes.json(), policiesRes.json(), lockedRes.json(),
      ]);

      if (sessionsData.code === 0) setSessions(sessionsData.data || []);
      if (overviewData.code === 0) setOverview(overviewData.data);
      if (policiesData.code === 0) {
        setPolicies(policiesData.data);
        form.setFieldsValue(policiesData.data);
      }
      if (lockedData.code === 0) setLockedUsers(lockedData.data || []);
    } catch {
      message.error('获取数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleForceLogout = async (sessionId) => {
    try {
      const res = await fetch(`${API_BASE}/api/security/sessions/${sessionId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (data.code === 0) {
        message.success(data.message);
        fetchAll();
      }
    } catch {
      message.error('操作失败');
    }
  };

  const handleUnlock = async (userId) => {
    try {
      const res = await fetch(`${API_BASE}/api/security/unlock/${userId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (data.code === 0) {
        message.success(data.message);
        fetchAll();
      }
    } catch {
      message.error('解锁失败');
    }
  };

  const handleUpdatePolicies = async (values) => {
    try {
      const res = await fetch(`${API_BASE}/api/security/policies`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (data.code === 0) {
        message.success(data.message);
        setPolicyModal(false);
        fetchAll();
      }
    } catch {
      message.error('更新失败');
    }
  };

  const sessionColumns = [
    { title: '用户', dataIndex: 'username', render: (text) => <><UserOutlined /> {text}</> },
    { title: 'IP地址', dataIndex: 'ip' },
    { title: '浏览器', dataIndex: 'userAgent', ellipsis: true },
    { 
      title: '登录时间', 
      dataIndex: 'loginAt', 
      render: (t) => new Date(t).toLocaleString() 
    },
    { 
      title: '最后活动', 
      dataIndex: 'lastActiveAt', 
      render: (t) => new Date(t).toLocaleString() 
    },
    {
      title: '操作',
      render: (_, record) => (
        <Popconfirm title="确定强制下线？" onConfirm={() => handleForceLogout(record.sessionId)}>
          <Button type="link" danger size="small" icon={<StopOutlined />}>强制下线</Button>
        </Popconfirm>
      ),
    },
  ];

  const tabItems = [
    {
      key: 'sessions',
      label: <><LaptopOutlined /> 活跃会话</>,
      children: (
        <Card>
          <Table columns={sessionColumns} dataSource={sessions} rowKey="sessionId" loading={loading} />
        </Card>
      ),
    },
    {
      key: 'policies',
      label: <><SafetyOutlined /> 安全策略</>,
      children: (
        <Card extra={<Button type="primary" onClick={() => setPolicyModal(true)}>编辑策略</Button>}>
          {policies && (
            <Row gutter={[16, 16]}>
              <Col span={8}><Statistic title="最大登录尝试" value={policies.maxLoginAttempts} suffix="次" /></Col>
              <Col span={8}><Statistic title="锁定时长" value={policies.lockoutDuration} suffix="分钟" /></Col>
              <Col span={8}><Statistic title="会话超时" value={policies.sessionTimeout} suffix="小时" /></Col>
              <Col span={8}><Statistic title="密码最小长度" value={policies.passwordMinLength} suffix="位" /></Col>
              <Col span={8}><Text>双因素认证: {policies.twoFactorEnabled ? <Tag color="green">已启用</Tag> : <Tag>未启用</Tag>}</Text></Col>
            </Row>
          )}
        </Card>
      ),
    },
    {
      key: 'locked',
      label: <><WarningOutlined /> 锁定用户</>,
      children: (
        <Card>
          {lockedUsers.length > 0 ? (
            <List
              dataSource={lockedUsers}
              renderItem={(item) => (
                <List.Item actions={[
                  <Button key="unlock" type="link" icon={<UnlockOutlined />} onClick={() => handleUnlock(item.userId)}>
                    解锁
                  </Button>
                ]}>
                  <List.Item.Meta
                    title={`用户ID: ${item.userId}`}
                    description={`锁定时间: ${new Date(item.lockedAt).toLocaleString()} | 尝试次数: ${item.attempts}`}
                  />
                </List.Item>
              )}
            />
          ) : (
            <Text type="secondary">暂无锁定用户</Text>
          )}
        </Card>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px 32px' }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <Col>
          <Title level={3} style={{ margin: 0 }}>
            <SafetyOutlined style={{ marginRight: 12 }} />
            安全中心
          </Title>
        </Col>
        <Col>
          <Button icon={<ReloadOutlined />} onClick={fetchAll}>刷新</Button>
        </Col>
      </Row>

      {overview && (
        <Row gutter={24} style={{ marginBottom: 24 }}>
          <Col span={6}><Card><Statistic title="活跃会话" value={overview.activeSessions} prefix={<LaptopOutlined />} /></Card></Col>
          <Col span={6}><Card><Statistic title="锁定用户" value={overview.lockedUsers} prefix={<WarningOutlined />} /></Card></Col>
          <Col span={6}><Card><Statistic title="今日登录" value={overview.loginAttemptsToday} /></Card></Col>
          <Col span={6}><Card><Statistic title="今日失败" value={overview.failedLoginsToday} valueStyle={{ color: overview.failedLoginsToday > 0 ? '#cf1322' : 'inherit' }} /></Card></Col>
        </Row>
      )}

      <Tabs items={tabItems} />

      <Modal
        title="编辑安全策略"
        open={policyModal}
        onCancel={() => setPolicyModal(false)}
        onOk={() => form.submit()}
      >
        <Form form={form} layout="vertical" onFinish={handleUpdatePolicies}>
          <Form.Item name="maxLoginAttempts" label="最大登录尝试次数">
            <InputNumber min={1} max={10} />
          </Form.Item>
          <Form.Item name="lockoutDuration" label="锁定时长(分钟)">
            <InputNumber min={5} max={1440} />
          </Form.Item>
          <Form.Item name="sessionTimeout" label="会话超时(小时)">
            <InputNumber min={1} max={168} />
          </Form.Item>
          <Form.Item name="passwordMinLength" label="密码最小长度">
            <InputNumber min={6} max={32} />
          </Form.Item>
          <Form.Item name="twoFactorEnabled" label="双因素认证" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default SecurityCenter;
