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
  message,
  Popconfirm,
  Typography,
  Row,
  Col,
  Statistic,
  Progress
} from 'antd';
import { 
  PlusOutlined, 
  DownloadOutlined, 
  DeleteOutlined,
  CloudUploadOutlined,
  ReloadOutlined,
  DatabaseOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  SyncOutlined
} from '@ant-design/icons';

const { Title, Text } = Typography;

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const BackupManagement = () => {
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [storageInfo, setStorageInfo] = useState(null);
  const [form] = Form.useForm();

  const getToken = () => localStorage.getItem('token');

  const fetchBackups = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/backup/list`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (data.code === 0) {
        setBackups(data.data || []);
      }
    } catch {
      message.error('获取备份列表失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchStorageInfo = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/backup/storage`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (data.code === 0) {
        setStorageInfo(data.data);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchBackups();
    fetchStorageInfo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreate = async (values) => {
    try {
      const res = await fetch(`${API_BASE}/api/backup/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (data.code === 0) {
        message.success('备份任务已创建');
        setModalVisible(false);
        form.resetFields();
        fetchBackups();
      } else {
        message.error(data.message);
      }
    } catch {
      message.error('创建备份失败');
    }
  };

  const handleDownload = async (id) => {
    window.open(`${API_BASE}/api/backup/download/${id}?token=${getToken()}`, '_blank');
  };

  const handleRestore = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/api/backup/restore/${id}`, {
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
      message.error('恢复失败');
    }
  };

  const handleDelete = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/api/backup/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (data.code === 0) {
        message.success('备份删除成功');
        fetchBackups();
      }
    } catch {
      message.error('删除失败');
    }
  };

  const formatSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const columns = [
    {
      title: '备份名称',
      dataIndex: 'name',
      render: (name) => (
        <Space>
          <DatabaseOutlined style={{ color: '#1890ff' }} />
          <Text strong>{name}</Text>
        </Space>
      ),
    },
    {
      title: '类型',
      dataIndex: 'type',
      render: (type) => {
        const typeMap = {
          full: { text: '完整备份', color: 'blue' },
          config: { text: '配置备份', color: 'green' },
          data: { text: '数据备份', color: 'orange' },
        };
        const t = typeMap[type] || { text: type, color: 'default' };
        return <Tag color={t.color}>{t.text}</Tag>;
      },
    },
    {
      title: '大小',
      dataIndex: 'size',
      render: (size) => formatSize(size),
    },
    {
      title: '状态',
      dataIndex: 'status',
      render: (status) => {
        const statusMap = {
          pending: { text: '等待中', color: 'default', icon: <SyncOutlined /> },
          running: { text: '备份中', color: 'processing', icon: <SyncOutlined spin /> },
          completed: { text: '已完成', color: 'success', icon: <CheckCircleOutlined /> },
          failed: { text: '失败', color: 'error', icon: <CloseCircleOutlined /> },
        };
        const s = statusMap[status] || statusMap.pending;
        return <Tag color={s.color} icon={s.icon}>{s.text}</Tag>;
      },
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      render: (t) => t ? new Date(t).toLocaleString() : '-',
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button
            type="text"
            icon={<DownloadOutlined />}
            onClick={() => handleDownload(record.id)}
            disabled={record.status !== 'completed'}
          >
            下载
          </Button>
          <Popconfirm
            title="确定恢复此备份？"
            description="恢复操作将覆盖现有数据"
            onConfirm={() => handleRestore(record.id)}
          >
            <Button type="text" disabled={record.status !== 'completed'}>
              恢复
            </Button>
          </Popconfirm>
          <Popconfirm title="确定删除此备份？" onConfirm={() => handleDelete(record.id)}>
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
            <CloudUploadOutlined style={{ marginRight: 12 }} />
            系统备份恢复
          </Title>
        </Col>
        <Col>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={() => { fetchBackups(); fetchStorageInfo(); }}>
              刷新
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => { form.resetFields(); setModalVisible(true); }}
            >
              创建备份
            </Button>
          </Space>
        </Col>
      </Row>

      <Row gutter={24} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="备份总数"
              value={backups.length}
              prefix={<DatabaseOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="成功备份"
              value={backups.filter(b => b.status === 'completed').length}
              valueStyle={{ color: '#3f8600' }}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="存储使用"
              value={formatSize(storageInfo?.totalSize || 0)}
              prefix={<CloudUploadOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="文件数量"
              value={storageInfo?.fileCount || 0}
              suffix="个"
            />
          </Card>
        </Col>
      </Row>

      <Card title="备份列表">
        <Table
          columns={columns}
          dataSource={backups}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
          locale={{ emptyText: '暂无备份记录' }}
        />
      </Card>

      <Modal
        title="创建备份"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={() => form.submit()}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}
          initialValues={{ type: 'full' }}>
          <Form.Item name="name" label="备份名称" rules={[{ required: true }]}>
            <Input placeholder="如: 2024年12月完整备份" />
          </Form.Item>
          <Form.Item name="type" label="备份类型" rules={[{ required: true }]}>
            <Select>
              <Select.Option value="full">完整备份 (所有数据)</Select.Option>
              <Select.Option value="config">配置备份 (仅配置)</Select.Option>
              <Select.Option value="data">数据备份 (仅业务数据)</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="description" label="备注">
            <Input.TextArea rows={2} placeholder="可选备注信息" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default BackupManagement;
