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
  Statistic
} from 'antd';
import { 
  PlusOutlined, 
  EditOutlined, 
  DeleteOutlined,
  PlayCircleOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  SyncOutlined,
  HistoryOutlined
} from '@ant-design/icons';

const { Title, Text } = Typography;

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const ScheduleManagement = () => {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingJob, setEditingJob] = useState(null);
  const [historyVisible, setHistoryVisible] = useState(false);
  const [historyData, setHistoryData] = useState([]);
  const [form] = Form.useForm();

  const getToken = () => localStorage.getItem('token');

  // 获取任务列表
  const fetchJobs = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/schedule/jobs`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (data.code === 0) {
        setJobs(data.data || []);
      }
    } catch {
      message.error('获取任务列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 创建/更新任务
  const handleSubmit = async (values) => {
    try {
      const url = editingJob 
        ? `${API_BASE}/api/schedule/jobs/${editingJob.id}`
        : `${API_BASE}/api/schedule/jobs`;
      
      const res = await fetch(url, {
        method: editingJob ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify(values),
      });
      
      const data = await res.json();
      if (data.code === 0) {
        message.success(editingJob ? '任务更新成功' : '任务创建成功');
        setModalVisible(false);
        form.resetFields();
        setEditingJob(null);
        fetchJobs();
      } else {
        message.error(data.message);
      }
    } catch {
      message.error('操作失败');
    }
  };

  // 删除任务
  const handleDelete = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/api/schedule/jobs/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (data.code === 0) {
        message.success('任务删除成功');
        fetchJobs();
      }
    } catch {
      message.error('删除失败');
    }
  };

  // 立即执行
  const handleRun = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/api/schedule/jobs/${id}/run`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (data.code === 0) {
        message.success('任务已开始执行');
        fetchJobs();
      }
    } catch {
      message.error('执行失败');
    }
  };

  // 切换状态
  const handleToggle = async (id, isEnabled) => {
    try {
      const res = await fetch(`${API_BASE}/api/schedule/jobs/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ isEnabled }),
      });
      const data = await res.json();
      if (data.code === 0) {
        message.success(isEnabled ? '任务已启用' : '任务已禁用');
        fetchJobs();
      }
    } catch {
      message.error('操作失败');
    }
  };

  // 查看历史
  const handleViewHistory = async (job) => {
    try {
      const res = await fetch(`${API_BASE}/api/schedule/jobs/${job.id}/history`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (data.code === 0) {
        setHistoryData(data.data || []);
        setHistoryVisible(true);
      }
    } catch {
      message.error('获取历史失败');
    }
  };

  const typeMap = {
    backup: { text: '配置备份', color: 'blue' },
    report: { text: '报表生成', color: 'green' },
    cleanup: { text: '日志清理', color: 'orange' },
    discovery: { text: '网络发现', color: 'purple' },
    health_check: { text: '健康检查', color: 'cyan' },
  };

  const columns = [
    {
      title: '任务名称',
      dataIndex: 'name',
      render: (name, record) => (
        <Space>
          <ClockCircleOutlined style={{ color: record.isEnabled ? '#1890ff' : '#ccc' }} />
          <Text strong>{name}</Text>
        </Space>
      ),
    },
    {
      title: '类型',
      dataIndex: 'type',
      render: (type) => {
        const t = typeMap[type] || { text: type, color: 'default' };
        return <Tag color={t.color}>{t.text}</Tag>;
      },
    },
    {
      title: 'Cron表达式',
      dataIndex: 'cron',
      render: (cron) => <Text code>{cron}</Text>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      render: (status) => {
        const statusMap = {
          idle: { text: '空闲', color: 'default', icon: <ClockCircleOutlined /> },
          running: { text: '运行中', color: 'processing', icon: <SyncOutlined spin /> },
          success: { text: '成功', color: 'success', icon: <CheckCircleOutlined /> },
          failed: { text: '失败', color: 'error', icon: <CloseCircleOutlined /> },
        };
        const s = statusMap[status] || statusMap.idle;
        return <Tag color={s.color} icon={s.icon}>{s.text}</Tag>;
      },
    },
    {
      title: '启用',
      dataIndex: 'isEnabled',
      render: (isEnabled, record) => (
        <Switch
          checked={isEnabled}
          onChange={(checked) => handleToggle(record.id, checked)}
          size="small"
        />
      ),
    },
    {
      title: '上次执行',
      dataIndex: 'lastRun',
      render: (lastRun) => lastRun ? new Date(lastRun).toLocaleString() : '-',
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Tooltip title="立即执行">
            <Button
              type="text"
              icon={<PlayCircleOutlined />}
              onClick={() => handleRun(record.id)}
              disabled={record.status === 'running'}
            />
          </Tooltip>
          <Tooltip title="执行历史">
            <Button
              type="text"
              icon={<HistoryOutlined />}
              onClick={() => handleViewHistory(record)}
            />
          </Tooltip>
          <Tooltip title="编辑">
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => {
                setEditingJob(record);
                form.setFieldsValue(record);
                setModalVisible(true);
              }}
            />
          </Tooltip>
          <Popconfirm
            title="确定删除此任务？"
            onConfirm={() => handleDelete(record.id)}
          >
            <Button type="text" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // 统计
  const totalJobs = jobs.length;
  const enabledJobs = jobs.filter(j => j.isEnabled).length;
  const runningJobs = jobs.filter(j => j.status === 'running').length;

  return (
    <div style={{ padding: '24px 32px' }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <Col>
          <Title level={3} style={{ margin: 0 }}>
            <ClockCircleOutlined style={{ marginRight: 12 }} />
            定时任务管理
          </Title>
        </Col>
        <Col>
          <Space size="large">
            <Statistic title="总任务" value={totalJobs} />
            <Statistic title="已启用" value={enabledJobs} valueStyle={{ color: '#3f8600' }} />
            <Statistic title="运行中" value={runningJobs} valueStyle={{ color: '#1890ff' }} />
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                setEditingJob(null);
                form.resetFields();
                setModalVisible(true);
              }}
            >
              新建任务
            </Button>
          </Space>
        </Col>
      </Row>

      <Card>
        <Table
          columns={columns}
          dataSource={jobs}
          rowKey="id"
          loading={loading}
          pagination={false}
        />
      </Card>

      {/* 创建/编辑Modal */}
      <Modal
        title={editingJob ? '编辑任务' : '新建任务'}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          setEditingJob(null);
          form.resetFields();
        }}
        onOk={() => form.submit()}
        width={500}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{
            type: 'health_check',
            cron: '0 6 * * *',
            isEnabled: true,
          }}
        >
          <Form.Item
            name="name"
            label="任务名称"
            rules={[{ required: true, message: '请输入任务名称' }]}
          >
            <Input placeholder="如：每日设备状态检查" />
          </Form.Item>

          <Form.Item
            name="type"
            label="任务类型"
            rules={[{ required: true }]}
          >
            <Select>
              <Select.Option value="health_check">健康检查</Select.Option>
              <Select.Option value="backup">配置备份</Select.Option>
              <Select.Option value="report">报表生成</Select.Option>
              <Select.Option value="cleanup">日志清理</Select.Option>
              <Select.Option value="discovery">网络发现</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="cron"
            label="Cron表达式"
            rules={[{ required: true, message: '请输入Cron表达式' }]}
            extra="格式: 分 时 日 月 周 (如: 0 6 * * * 表示每天6点执行)"
          >
            <Input placeholder="0 6 * * *" />
          </Form.Item>

          <Form.Item name="isEnabled" label="启用" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      {/* 执行历史Modal */}
      <Modal
        title="执行历史"
        open={historyVisible}
        onCancel={() => setHistoryVisible(false)}
        footer={null}
        width={600}
      >
        <Table
          dataSource={historyData}
          rowKey="id"
          pagination={false}
          columns={[
            {
              title: '执行时间',
              dataIndex: 'runAt',
              render: (t) => new Date(t).toLocaleString(),
            },
            {
              title: '耗时(秒)',
              dataIndex: 'duration',
            },
            {
              title: '状态',
              dataIndex: 'status',
              render: (s) => (
                <Tag color={s === 'success' ? 'success' : 'error'}>
                  {s === 'success' ? '成功' : '失败'}
                </Tag>
              ),
            },
            {
              title: '结果',
              dataIndex: 'result',
            },
          ]}
        />
      </Modal>
    </div>
  );
};

export default ScheduleManagement;
