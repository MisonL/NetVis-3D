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
  Progress,
  Modal,
  Form,
  Input,
  message,
  List, 
  Badge
} from 'antd';
import { 
  AuditOutlined, 
  ReloadOutlined,
  PlusOutlined,
  ScanOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  DesktopOutlined
} from '@ant-design/icons';

const { Title, Text } = Typography;

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const AssetInventory = () => {
  const [overview, setOverview] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [form] = Form.useForm();

  const getToken = () => localStorage.getItem('token');

  const fetchOverview = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/inventory/overview`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (data.code === 0) {
        setOverview(data.data);
      }
    } catch {
      message.error('获取概览失败');
    }
  };

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/inventory/tasks`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (data.code === 0) {
        setTasks(data.data || []);
      }
    } catch {
      message.error('获取任务失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview();
    fetchTasks();
    const interval = setInterval(() => {
      fetchTasks();
    }, 3000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreate = async (values) => {
    try {
      const res = await fetch(`${API_BASE}/api/inventory/tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (data.code === 0) {
        message.success(data.message);
        setModalVisible(false);
        form.resetFields();
        fetchTasks();
      } else {
        message.error(data.message);
      }
    } catch {
      message.error('创建失败');
    }
  };

  const getStatusTag = (status) => {
    const config = {
      pending: { color: 'default', text: '等待中' },
      running: { color: 'processing', text: '进行中' },
      completed: { color: 'success', text: '已完成' },
      cancelled: { color: 'warning', text: '已取消' },
    };
    const { color, text } = config[status] || { color: 'default', text: status };
    return <Tag color={color}>{text}</Tag>;
  };

  const taskColumns = [
    { title: '任务名称', dataIndex: 'name', render: (name) => <Text strong>{name}</Text> },
    { title: '状态', dataIndex: 'status', render: getStatusTag },
    { 
      title: '进度', 
      dataIndex: 'progress', 
      render: (p, record) => (
        <Progress 
          percent={p} 
          size="small" 
          status={record.status === 'running' ? 'active' : undefined}
        />
      )
    },
    { title: '总设备', dataIndex: 'totalDevices' },
    { title: '已扫描', dataIndex: 'scannedDevices' },
    { title: '匹配', dataIndex: 'matchedDevices', render: (v) => <Text type="success">{v}</Text> },
    { title: '不匹配', dataIndex: 'unmatchedDevices', render: (v) => <Text type="warning">{v}</Text> },
    { title: '新发现', dataIndex: 'newDevices', render: (v) => <Text type="secondary">{v}</Text> },
  ];

  return (
    <div style={{ padding: '24px 32px' }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <Col>
          <Title level={3} style={{ margin: 0 }}>
            <AuditOutlined style={{ marginRight: 12 }} />
            资产盘点
          </Title>
        </Col>
        <Col>
          <Space>
            <Button type="primary" icon={<ScanOutlined />} onClick={() => setModalVisible(true)}>
              新建盘点
            </Button>
            <Button icon={<ReloadOutlined />} onClick={() => { fetchOverview(); fetchTasks(); }}>
              刷新
            </Button>
          </Space>
        </Col>
      </Row>

      {/* 资产概览 */}
      {overview && (
        <Row gutter={24} style={{ marginBottom: 24 }}>
          <Col span={6}>
            <Card>
              <Statistic
                title="资产总数"
                value={overview.totalAssets}
                prefix={<DesktopOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="在线资产"
                value={overview.onlineAssets}
                valueStyle={{ color: '#52c41a' }}
                prefix={<CheckCircleOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="离线资产"
                value={overview.offlineAssets}
                valueStyle={{ color: '#ff4d4f' }}
                prefix={<ExclamationCircleOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="资产类型"
                value={Object.keys(overview.byType || {}).length}
                suffix="种"
              />
            </Card>
          </Col>
        </Row>
      )}

      {/* 盘点任务 */}
      <Card title="盘点任务" style={{ marginBottom: 24 }} loading={loading}>
        <Table
          columns={taskColumns}
          dataSource={tasks}
          rowKey="id"
          pagination={false}
        />
      </Card>

      {/* 资产分布 */}
      {overview && (
        <Row gutter={24}>
          <Col span={12}>
            <Card title="按类型分布" size="small">
              {Object.entries(overview.byType || {}).map(([type, count], idx) => (
                <div key={idx} style={{ marginBottom: 8 }}>
                  <Row justify="space-between">
                    <Text>{type}</Text>
                    <Badge count={count} style={{ backgroundColor: '#1677ff' }} />
                  </Row>
                </div>
              ))}
            </Card>
          </Col>
          <Col span={12}>
            <Card title="按位置分布" size="small">
              {Object.entries(overview.byLocation || {}).map(([loc, count], idx) => (
                <div key={idx} style={{ marginBottom: 8 }}>
                  <Row justify="space-between">
                    <Text>{loc}</Text>
                    <Badge count={count} style={{ backgroundColor: '#52c41a' }} />
                  </Row>
                </div>
              ))}
            </Card>
          </Col>
        </Row>
      )}

      {/* 新建盘点弹窗 */}
      <Modal
        title="新建盘点任务"
        open={modalVisible}
        onCancel={() => { setModalVisible(false); form.resetFields(); }}
        onOk={() => form.submit()}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item name="name" label="任务名称" rules={[{ required: true }]}>
            <Input placeholder="请输入盘点任务名称" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default AssetInventory;
