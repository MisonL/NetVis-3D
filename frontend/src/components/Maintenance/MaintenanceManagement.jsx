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
  DatePicker,
  message,
  Popconfirm,
  Typography,
  Row,
  Col,
  Statistic,
  List,
  Badge
} from 'antd';
import { 
  PlusOutlined, 
  EditOutlined, 
  DeleteOutlined,
  ToolOutlined,
  ReloadOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  PlayCircleOutlined,
  StopOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;
const { TextArea } = Input;

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const MaintenanceManagement = () => {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [stats, setStats] = useState(null);
  const [form] = Form.useForm();

  const getToken = () => localStorage.getItem('token');

  const fetchPlans = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/maintenance/list`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (data.code === 0) {
        setPlans(data.data || []);
      }
    } catch {
      message.error('获取维护计划失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/maintenance/stats/overview`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (data.code === 0) {
        setStats(data.data);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchPlans();
    fetchStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (values) => {
    try {
      const [startTime, endTime] = values.timeRange;
      const submitData = {
        ...values,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
      };
      delete submitData.timeRange;

      const url = editingPlan 
        ? `${API_BASE}/api/maintenance/${editingPlan.id}`
        : `${API_BASE}/api/maintenance`;
      
      const res = await fetch(url, {
        method: editingPlan ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify(submitData),
      });
      
      const data = await res.json();
      if (data.code === 0) {
        message.success(editingPlan ? '计划更新成功' : '计划创建成功');
        setModalVisible(false);
        form.resetFields();
        setEditingPlan(null);
        fetchPlans();
        fetchStats();
      } else {
        message.error(data.message);
      }
    } catch {
      message.error('操作失败');
    }
  };

  const handleDelete = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/api/maintenance/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (data.code === 0) {
        message.success('计划删除成功');
        fetchPlans();
        fetchStats();
      }
    } catch {
      message.error('删除失败');
    }
  };

  const handleStatusChange = async (id, status) => {
    try {
      const res = await fetch(`${API_BASE}/api/maintenance/${id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (data.code === 0) {
        message.success('状态更新成功');
        fetchPlans();
        fetchStats();
      }
    } catch {
      message.error('状态更新失败');
    }
  };

  const columns = [
    {
      title: '计划标题',
      dataIndex: 'title',
      render: (title) => (
        <Space>
          <ToolOutlined />
          <Text strong>{title}</Text>
        </Space>
      ),
    },
    {
      title: '类型',
      dataIndex: 'type',
      render: (type) => {
        const typeMap = {
          scheduled: { text: '计划维护', color: 'blue' },
          emergency: { text: '紧急维护', color: 'red' },
          upgrade: { text: '系统升级', color: 'green' },
          inspection: { text: '例行巡检', color: 'orange' },
        };
        const t = typeMap[type] || { text: type, color: 'default' };
        return <Tag color={t.color}>{t.text}</Tag>;
      },
    },
    {
      title: '时间',
      key: 'time',
      render: (_, record) => (
        <Text type="secondary">
          {dayjs(record.startTime).format('MM-DD HH:mm')} ~ {dayjs(record.endTime).format('HH:mm')}
        </Text>
      ),
    },
    {
      title: '负责人',
      dataIndex: 'assignee',
      render: (a) => a || '-',
    },
    {
      title: '状态',
      dataIndex: 'status',
      render: (status) => {
        const statusMap = {
          pending: { text: '待执行', color: 'warning', icon: <ClockCircleOutlined /> },
          in_progress: { text: '进行中', color: 'processing', icon: <PlayCircleOutlined /> },
          completed: { text: '已完成', color: 'success', icon: <CheckCircleOutlined /> },
          cancelled: { text: '已取消', color: 'default', icon: <StopOutlined /> },
        };
        const s = statusMap[status] || statusMap.pending;
        return <Tag color={s.color} icon={s.icon}>{s.text}</Tag>;
      },
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, record) => (
        <Space>
          {record.status === 'pending' && (
            <Button size="small" type="link" onClick={() => handleStatusChange(record.id, 'in_progress')}>
              开始
            </Button>
          )}
          {record.status === 'in_progress' && (
            <Button size="small" type="link" onClick={() => handleStatusChange(record.id, 'completed')}>
              完成
            </Button>
          )}
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => {
              setEditingPlan(record);
              form.setFieldsValue({
                ...record,
                timeRange: [dayjs(record.startTime), dayjs(record.endTime)],
              });
              setModalVisible(true);
            }}
          />
          <Popconfirm title="确定删除此计划？" onConfirm={() => handleDelete(record.id)}>
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
            <ToolOutlined style={{ marginRight: 12 }} />
            维护计划管理
          </Title>
        </Col>
        <Col>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={() => { fetchPlans(); fetchStats(); }}>
              刷新
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => { setEditingPlan(null); form.resetFields(); setModalVisible(true); }}
            >
              新建计划
            </Button>
          </Space>
        </Col>
      </Row>

      {stats && (
        <Row gutter={24} style={{ marginBottom: 24 }}>
          <Col span={6}>
            <Card>
              <Statistic
                title="计划总数"
                value={stats.total}
                prefix={<ToolOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="待执行"
                value={stats.byStatus?.pending || 0}
                valueStyle={{ color: '#faad14' }}
                prefix={<ClockCircleOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="进行中"
                value={stats.byStatus?.in_progress || 0}
                valueStyle={{ color: '#1890ff' }}
                prefix={<PlayCircleOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="已完成"
                value={stats.byStatus?.completed || 0}
                valueStyle={{ color: '#52c41a' }}
                prefix={<CheckCircleOutlined />}
              />
            </Card>
          </Col>
        </Row>
      )}

      <Row gutter={24}>
        <Col span={16}>
          <Card title="维护计划列表">
            <Table
              columns={columns}
              dataSource={plans}
              rowKey="id"
              loading={loading}
              pagination={{ pageSize: 10 }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card title="即将到来的维护">
            <List
              size="small"
              dataSource={stats?.upcoming || []}
              renderItem={(item) => (
                <List.Item>
                  <Badge status="warning" />
                  <div style={{ flex: 1, marginLeft: 8 }}>
                    <Text strong>{item.title}</Text>
                    <br />
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {dayjs(item.startTime).format('MM-DD HH:mm')}
                    </Text>
                  </div>
                </List.Item>
              )}
              locale={{ emptyText: '暂无计划' }}
            />
          </Card>
        </Col>
      </Row>

      <Modal
        title={editingPlan ? '编辑维护计划' : '新建维护计划'}
        open={modalVisible}
        onCancel={() => { setModalVisible(false); setEditingPlan(null); form.resetFields(); }}
        onOk={() => form.submit()}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}
          initialValues={{ type: 'scheduled' }}>
          <Form.Item name="title" label="计划标题" rules={[{ required: true }]}>
            <Input placeholder="如: 核心交换机固件升级" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="type" label="维护类型" rules={[{ required: true }]}>
                <Select>
                  <Select.Option value="scheduled">计划维护</Select.Option>
                  <Select.Option value="emergency">紧急维护</Select.Option>
                  <Select.Option value="upgrade">系统升级</Select.Option>
                  <Select.Option value="inspection">例行巡检</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="assignee" label="负责人">
                <Input placeholder="负责人姓名" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="timeRange" label="维护时间" rules={[{ required: true }]}>
            <RangePicker showTime format="YYYY-MM-DD HH:mm" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <TextArea rows={3} placeholder="维护计划详细描述" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default MaintenanceManagement;
