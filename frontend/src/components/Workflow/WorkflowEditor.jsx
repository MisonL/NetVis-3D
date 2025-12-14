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
  Modal,
  Form,
  Input,
  message,
  Tabs,
  Timeline,
  Badge,
  Popconfirm,
  Empty
} from 'antd';
import { 
  ApartmentOutlined, 
  ReloadOutlined,
  PlusOutlined,
  PlayCircleOutlined,
  StopOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  LoadingOutlined
} from '@ant-design/icons';

const { Title, Text } = Typography;

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const WorkflowEditor = () => {
  const [workflows, setWorkflows] = useState([]);
  const [executions, setExecutions] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [form] = Form.useForm();

  const getToken = () => localStorage.getItem('token');

  const fetchWorkflows = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/workflow`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (data.code === 0) {
        setWorkflows(data.data || []);
      }
    } catch {
      message.error('获取工作流失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchExecutions = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/workflow/executions/list`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (data.code === 0) {
        setExecutions(data.data || []);
      }
    } catch { /* ignore */ }
  };

  const fetchTemplates = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/workflow/templates/steps`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (data.code === 0) {
        setTemplates(data.data || []);
      }
    } catch { /* ignore */ }
  };

  useEffect(() => {
    fetchWorkflows();
    fetchExecutions();
    fetchTemplates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreate = async (values) => {
    try {
      const res = await fetch(`${API_BASE}/api/workflow`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (data.code === 0) {
        message.success('工作流创建成功');
        setModalVisible(false);
        form.resetFields();
        fetchWorkflows();
      } else {
        message.error(data.message);
      }
    } catch {
      message.error('创建失败');
    }
  };

  const handleExecute = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/api/workflow/${id}/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.code === 0) {
        message.success(data.message);
        fetchExecutions();
      } else {
        message.error(data.message);
      }
    } catch {
      message.error('执行失败');
    }
  };

  const handleToggleStatus = async (id, currentStatus) => {
    const newStatus = currentStatus === 'active' ? 'archived' : 'active';
    try {
      const res = await fetch(`${API_BASE}/api/workflow/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (data.code === 0) {
        message.success(`工作流已${newStatus === 'active' ? '激活' : '归档'}`);
        fetchWorkflows();
      }
    } catch {
      message.error('操作失败');
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'running': return <LoadingOutlined spin style={{ color: '#1677ff' }} />;
      case 'completed': return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
      case 'failed': return <CloseCircleOutlined style={{ color: '#ff4d4f' }} />;
      case 'cancelled': return <StopOutlined style={{ color: '#faad14' }} />;
      default: return <ClockCircleOutlined />;
    }
  };

  const getStatusLabel = (status) => {
    const labels = { running: '运行中', completed: '已完成', failed: '失败', cancelled: '已取消' };
    return labels[status] || status;
  };

  const workflowColumns = [
    { title: '名称', dataIndex: 'name', render: (name) => <Text strong>{name}</Text> },
    { title: '描述', dataIndex: 'description', ellipsis: true },
    { title: '步骤数', dataIndex: 'stepCount', render: (count) => <Tag>{count} 步</Tag> },
    { 
      title: '状态', 
      dataIndex: 'status', 
      render: (status) => (
        <Tag color={status === 'active' ? 'success' : status === 'draft' ? 'default' : 'warning'}>
          {status === 'active' ? '已激活' : status === 'draft' ? '草稿' : '已归档'}
        </Tag>
      )
    },
    {
      title: '操作',
      render: (_, record) => (
        <Space>
          <Button 
            type="primary" 
            size="small" 
            icon={<PlayCircleOutlined />}
            onClick={() => handleExecute(record.id)}
            disabled={record.status !== 'active'}
          >
            执行
          </Button>
          <Button size="small" onClick={() => handleToggleStatus(record.id, record.status)}>
            {record.status === 'active' ? '归档' : '激活'}
          </Button>
        </Space>
      ),
    },
  ];

  const executionColumns = [
    { title: '工作流', dataIndex: 'workflowName', render: (name) => <Text strong>{name}</Text> },
    { 
      title: '状态', 
      dataIndex: 'status', 
      render: (status) => (
        <Space>
          {getStatusIcon(status)}
          <span>{getStatusLabel(status)}</span>
        </Space>
      )
    },
    { 
      title: '开始时间', 
      dataIndex: 'startedAt', 
      render: (t) => new Date(t).toLocaleString() 
    },
    { 
      title: '完成时间', 
      dataIndex: 'completedAt', 
      render: (t) => t ? new Date(t).toLocaleString() : '-'
    },
  ];

  const tabItems = [
    {
      key: 'workflows',
      label: '工作流列表',
      children: (
        <Table
          columns={workflowColumns}
          dataSource={workflows}
          rowKey="id"
          loading={loading}
          pagination={false}
        />
      ),
    },
    {
      key: 'executions',
      label: (
        <span>
          执行记录
          {executions.filter(e => e.status === 'running').length > 0 && (
            <Badge count={executions.filter(e => e.status === 'running').length} style={{ marginLeft: 8 }} />
          )}
        </span>
      ),
      children: (
        <Table
          columns={executionColumns}
          dataSource={executions}
          rowKey="id"
          pagination={{ pageSize: 10 }}
        />
      ),
    },
    {
      key: 'templates',
      label: '步骤模板',
      children: (
        <Row gutter={[16, 16]}>
          {templates.map((tpl, idx) => (
            <Col span={6} key={idx}>
              <Card size="small" hoverable>
                <Text strong>{tpl.name}</Text>
                <div><Text type="secondary">{tpl.description}</Text></div>
                <Tag color="blue" style={{ marginTop: 8 }}>{tpl.type}</Tag>
              </Card>
            </Col>
          ))}
        </Row>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px 32px' }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <Col>
          <Title level={3} style={{ margin: 0 }}>
            <ApartmentOutlined style={{ marginRight: 12 }} />
            脚本编排
          </Title>
        </Col>
        <Col>
          <Space>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalVisible(true)}>
              新建工作流
            </Button>
            <Button icon={<ReloadOutlined />} onClick={() => { fetchWorkflows(); fetchExecutions(); }}>
              刷新
            </Button>
          </Space>
        </Col>
      </Row>

      {/* 概览统计 */}
      <Row gutter={24} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <div style={{ textAlign: 'center' }}>
              <Text type="secondary">工作流总数</Text>
              <div style={{ fontSize: 28, fontWeight: 'bold', marginTop: 8 }}>{workflows.length}</div>
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <div style={{ textAlign: 'center' }}>
              <Text type="secondary">已激活</Text>
              <div style={{ fontSize: 28, fontWeight: 'bold', marginTop: 8, color: '#52c41a' }}>
                {workflows.filter(w => w.status === 'active').length}
              </div>
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <div style={{ textAlign: 'center' }}>
              <Text type="secondary">运行中</Text>
              <div style={{ fontSize: 28, fontWeight: 'bold', marginTop: 8, color: '#1677ff' }}>
                {executions.filter(e => e.status === 'running').length}
              </div>
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <div style={{ textAlign: 'center' }}>
              <Text type="secondary">今日执行</Text>
              <div style={{ fontSize: 28, fontWeight: 'bold', marginTop: 8 }}>
                {executions.filter(e => 
                  new Date(e.startedAt).toDateString() === new Date().toDateString()
                ).length}
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      <Card>
        <Tabs items={tabItems} />
      </Card>

      <Modal
        title="新建工作流"
        open={modalVisible}
        onCancel={() => { setModalVisible(false); form.resetFields(); }}
        onOk={() => form.submit()}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item name="name" label="名称" rules={[{ required: true }]}>
            <Input placeholder="请输入工作流名称" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={3} placeholder="请输入工作流描述" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default WorkflowEditor;
