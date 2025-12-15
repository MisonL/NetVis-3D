import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Button, 
  Space, 
  Typography,
  Row,
  Col,
  Form,
  Input,
  Switch,
  Select,
  InputNumber,
  ColorPicker,
  message,
  Tabs,
  Divider
} from 'antd';
import { 
  SettingOutlined, 
  SaveOutlined,
  UndoOutlined,
  MailOutlined,
  LockOutlined,
  DatabaseOutlined,
  GlobalOutlined
} from '@ant-design/icons';

const { Title, Text } = Typography;

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const SystemConfig = () => {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [form] = Form.useForm();

  const getToken = () => localStorage.getItem('token');

  const fetchConfigs = async () => {
    setLoading(true);
    try {
      const [configsRes, groupsRes] = await Promise.all([
        fetch(`${API_BASE}/api/sys-config`, { headers: { Authorization: `Bearer ${getToken()}` } }),
        fetch(`${API_BASE}/api/sys-config/groups`, { headers: { Authorization: `Bearer ${getToken()}` } }),
      ]);

      const [configsData, groupsData] = await Promise.all([configsRes.json(), groupsRes.json()]);

      if (configsData.code === 0) {
        form.setFieldsValue(configsData.data);
      }
      if (groupsData.code === 0) {
        setGroups(groupsData.data || []);
      }
    } catch {
      message.error('获取配置失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfigs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSave = async () => {
    try {
      const values = form.getFieldsValue();
      const res = await fetch(`${API_BASE}/api/sys-config`, {
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
        setHasChanges(false);
      } else {
        message.error(data.message);
      }
    } catch {
      message.error('保存失败');
    }
  };

  const handleReset = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/sys-config/reset`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (data.code === 0) {
        message.success(data.message);
        fetchConfigs();
        setHasChanges(false);
      }
    } catch {
      message.error('重置失败');
    }
  };

  const handleTestEmail = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/sys-config/test-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ to: 'test@example.com' }),
      });
      const data = await res.json();
      message.info(data.message);
    } catch {
      message.error('测试失败');
    }
  };

  const renderField = (config) => {
    switch (config.type) {
      case 'input':
        return <Input />;
      case 'number':
        return <InputNumber style={{ width: '100%' }} />;
      case 'switch':
        return <Switch />;
      case 'select':
        return (
          <Select>
            {config.options?.map(opt => (
              <Select.Option key={opt} value={opt}>{opt}</Select.Option>
            ))}
          </Select>
        );
      case 'color':
        return <ColorPicker format="hex" showText />;
      default:
        return <Input />;
    }
  };

  const getIcon = (key) => {
    switch (key) {
      case 'general': return <GlobalOutlined />;
      case 'security': return <LockOutlined />;
      case 'email': return <MailOutlined />;
      case 'data': return <DatabaseOutlined />;
      default: return <SettingOutlined />;
    }
  };

  const tabItems = groups.map(group => ({
    key: group.key,
    label: <><span style={{ marginRight: 8 }}>{getIcon(group.key)}</span>{group.name}</>,
    children: (
      <Card loading={loading}>
        {group.configs.map(config => (
          <Form.Item
            key={config.key}
            name={config.key}
            label={config.label}
            valuePropName={config.type === 'switch' ? 'checked' : 'value'}
          >
            {renderField(config)}
          </Form.Item>
        ))}
        {group.key === 'email' && (
          <Form.Item>
            <Button onClick={handleTestEmail}>发送测试邮件</Button>
          </Form.Item>
        )}
      </Card>
    ),
  }));

  return (
    <div style={{ padding: '24px 32px' }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <Col>
          <Title level={3} style={{ margin: 0 }}>
            <SettingOutlined style={{ marginRight: 12 }} />
            系统配置
          </Title>
        </Col>
        <Col>
          <Space>
            <Button type="primary" icon={<SaveOutlined />} onClick={handleSave} disabled={!hasChanges}>
              保存配置
            </Button>
            <Button icon={<UndoOutlined />} onClick={handleReset}>重置默认</Button>
          </Space>
        </Col>
      </Row>

      <Form 
        form={form} 
        layout="vertical" 
        onValuesChange={() => setHasChanges(true)}
      >
        <Tabs items={tabItems} />
      </Form>
    </div>
  );
};

export default SystemConfig;
