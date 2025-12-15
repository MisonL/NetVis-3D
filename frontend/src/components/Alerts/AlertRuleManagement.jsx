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
  Switch,
  message,
  Popconfirm,
  Typography,
  Row,
  Col,
  Tooltip,
  Empty 
} from 'antd';
import { 
  PlusOutlined, 
  EditOutlined, 
  DeleteOutlined,
  ThunderboltOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined
} from '@ant-design/icons';

const { Title, Text } = Typography;
const { TextArea } = Input;

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const AlertRuleManagement = () => {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [form] = Form.useForm();

  const getToken = () => localStorage.getItem('token');

  // 获取规则列表
  const fetchRules = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/alerts/rules`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (data.code === 0) {
        setRules(data.data || []);
      }
    } catch {
      message.error('获取规则列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRules();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 创建/更新规则
  const handleSubmit = async (values) => {
    try {
      const url = editingRule 
        ? `${API_BASE}/api/alerts/rules/${editingRule.id}`
        : `${API_BASE}/api/alerts/rules`;
      
      const res = await fetch(url, {
        method: editingRule ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          ...values,
          conditions: JSON.stringify(values.conditions || {}),
        }),
      });
      
      const data = await res.json();
      if (data.code === 0) {
        message.success(editingRule ? '规则更新成功' : '规则创建成功');
        setModalVisible(false);
        form.resetFields();
        setEditingRule(null);
        fetchRules();
      } else {
        message.error(data.message);
      }
    } catch {
      message.error('操作失败');
    }
  };

  // 删除规则
  const handleDelete = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/api/alerts/rules/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (data.code === 0) {
        message.success('规则删除成功');
        fetchRules();
      } else {
        message.error(data.message);
      }
    } catch {
      message.error('删除失败');
    }
  };

  // 切换规则状态
  const handleToggle = async (id, isEnabled) => {
    try {
      const res = await fetch(`${API_BASE}/api/alerts/rules/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ isEnabled }),
      });
      const data = await res.json();
      if (data.code === 0) {
        message.success(isEnabled ? '规则已启用' : '规则已禁用');
        fetchRules();
      }
    } catch {
      message.error('操作失败');
    }
  };

  const columns = [
    {
      title: '规则名称',
      dataIndex: 'name',
      render: (name, record) => (
        <Space>
          <ThunderboltOutlined style={{ color: record.isEnabled ? '#1890ff' : '#ccc' }} />
          <Text strong>{name}</Text>
        </Space>
      ),
    },
    {
      title: '类型',
      dataIndex: 'type',
      render: (type) => {
        const typeMap = {
          threshold: { text: '阈值规则', color: 'blue' },
          status: { text: '状态规则', color: 'green' },
          composite: { text: '复合规则', color: 'purple' },
        };
        const t = typeMap[type] || { text: type, color: 'default' };
        return <Tag color={t.color}>{t.text}</Tag>;
      },
    },
    {
      title: '严重程度',
      dataIndex: 'severity',
      render: (severity) => {
        const severityMap = {
          critical: { text: '严重', color: 'red' },
          warning: { text: '警告', color: 'orange' },
          info: { text: '信息', color: 'blue' },
        };
        const s = severityMap[severity] || { text: severity, color: 'default' };
        return <Tag color={s.color}>{s.text}</Tag>;
      },
    },
    {
      title: '状态',
      dataIndex: 'isEnabled',
      render: (isEnabled, record) => (
        <Switch
          checked={isEnabled}
          onChange={(checked) => handleToggle(record.id, checked)}
          checkedChildren={<CheckCircleOutlined />}
          unCheckedChildren={<CloseCircleOutlined />}
        />
      ),
    },
    {
      title: '描述',
      dataIndex: 'description',
      ellipsis: true,
      render: (desc) => desc || '-',
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
                setEditingRule(record);
                form.setFieldsValue({
                  ...record,
                  conditions: record.conditions ? JSON.parse(record.conditions) : {},
                });
                setModalVisible(true);
              }}
            />
          </Tooltip>
          <Popconfirm
            title="确定删除此规则？"
            onConfirm={() => handleDelete(record.id)}
          >
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
            <ThunderboltOutlined style={{ marginRight: 12 }} />
            告警规则管理
          </Title>
        </Col>
        <Col>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              setEditingRule(null);
              form.resetFields();
              setModalVisible(true);
            }}
          >
            新建规则
          </Button>
        </Col>
      </Row>

      <Card>
        <Table
          columns={columns}
          dataSource={rules}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
          locale={{ emptyText: <Empty description="暂无告警规则" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
        />
      </Card>

      <Modal
        title={editingRule ? '编辑规则' : '新建规则'}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          setEditingRule(null);
          form.resetFields();
        }}
        onOk={() => form.submit()}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{
            type: 'threshold',
            severity: 'warning',
            isEnabled: true,
          }}
        >
          <Form.Item
            name="name"
            label="规则名称"
            rules={[{ required: true, message: '请输入规则名称' }]}
          >
            <Input placeholder="如：CPU使用率超过80%" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="type"
                label="规则类型"
                rules={[{ required: true }]}
              >
                <Select>
                  <Select.Option value="threshold">阈值规则</Select.Option>
                  <Select.Option value="status">状态规则</Select.Option>
                  <Select.Option value="composite">复合规则</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="severity"
                label="严重程度"
                rules={[{ required: true }]}
              >
                <Select>
                  <Select.Option value="info">信息</Select.Option>
                  <Select.Option value="warning">警告</Select.Option>
                  <Select.Option value="critical">严重</Select.Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="description" label="描述">
            <TextArea rows={3} placeholder="规则说明" />
          </Form.Item>

          <Form.Item name="isEnabled" label="启用状态" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default AlertRuleManagement;
