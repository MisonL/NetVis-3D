import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Table, 
  Button, 
  Space, 
  Tag, 
  Modal, 
  Form, 
  Select, 
  Input,
  InputNumber,
  message,
  Popconfirm,
  Typography,
  Row,
  Col,
  Statistic
} from 'antd';
import { 
  PlusOutlined, 
  EditOutlined, 
  DeleteOutlined,
  BranchesOutlined,
  ReloadOutlined,
  ThunderboltOutlined,
  SearchOutlined
} from '@ant-design/icons';

const { Title, Text } = Typography;

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const TopologyConnectionManagement = () => {
  const [connections, setConnections] = useState([]);
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingConn, setEditingConn] = useState(null);
  const [stats, setStats] = useState(null);
  const [form] = Form.useForm();

  const getToken = () => localStorage.getItem('token');

  const fetchConnections = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/topology-manage/connections`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (data.code === 0) {
        setConnections(data.data || []);
      }
    } catch {
      message.error('获取连接列表失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchDevices = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/devices`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (data.code === 0) {
        setDevices(data.data || []);
      }
    } catch {
      // ignore
    }
  };

  const fetchStats = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/topology-manage/stats`, {
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
    fetchConnections();
    fetchDevices();
    fetchStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (values) => {
    try {
      const url = editingConn 
        ? `${API_BASE}/api/topology-manage/connections/${editingConn.id}`
        : `${API_BASE}/api/topology-manage/connections`;
      
      const res = await fetch(url, {
        method: editingConn ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify(values),
      });
      
      const data = await res.json();
      if (data.code === 0) {
        message.success(editingConn ? '连接更新成功' : '连接创建成功');
        setModalVisible(false);
        form.resetFields();
        setEditingConn(null);
        fetchConnections();
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
      const res = await fetch(`${API_BASE}/api/topology-manage/connections/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (data.code === 0) {
        message.success('连接删除成功');
        fetchConnections();
        fetchStats();
      }
    } catch {
      message.error('删除失败');
    }
  };

  const handleDiscover = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/topology-manage/discover`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (data.code === 0) {
        message.success(data.message);
        fetchConnections();
        fetchStats();
      }
    } catch {
      message.error('发现失败');
    }
  };

  const columns = [
    {
      title: '源设备',
      dataIndex: 'source',
      render: (source) => (
        <Space>
          <BranchesOutlined />
          <Text strong>{source?.name || '-'}</Text>
        </Space>
      ),
    },
    {
      title: '目标设备',
      dataIndex: 'target',
      render: (target) => <Text>{target?.name || '-'}</Text>,
    },
    {
      title: '链路类型',
      dataIndex: 'linkType',
      render: (type) => {
        const typeMap = {
          ethernet: { text: '以太网', color: 'blue' },
          fiber: { text: '光纤', color: 'green' },
          wireless: { text: '无线', color: 'orange' },
          virtual: { text: '虚拟', color: 'purple' },
        };
        const t = typeMap[type] || { text: type, color: 'default' };
        return <Tag color={t.color}>{t.text}</Tag>;
      },
    },
    {
      title: '带宽',
      dataIndex: 'bandwidth',
      render: (bw) => bw ? `${bw >= 1000 ? bw/1000 + 'Gbps' : bw + 'Mbps'}` : '-',
    },
    {
      title: '状态',
      dataIndex: 'status',
      render: (status) => (
        <Tag color={status === 'up' ? 'success' : status === 'degraded' ? 'warning' : 'error'}>
          {status === 'up' ? '正常' : status === 'degraded' ? '降级' : '中断'}
        </Tag>
      ),
    },
    {
      title: '利用率',
      dataIndex: 'utilization',
      render: (u) => u ? `${u.toFixed(1)}%` : '-',
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => {
              setEditingConn(record);
              form.setFieldsValue(record);
              setModalVisible(true);
            }}
          />
          <Popconfirm title="确定删除此连接？" onConfirm={() => handleDelete(record.id)}>
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
            <BranchesOutlined style={{ marginRight: 12 }} />
            拓扑连接管理
          </Title>
        </Col>
        <Col>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={() => { fetchConnections(); fetchStats(); }}>
              刷新
            </Button>
            <Button icon={<SearchOutlined />} onClick={handleDiscover}>
              自动发现
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => { setEditingConn(null); form.resetFields(); setModalVisible(true); }}
            >
              新建连接
            </Button>
          </Space>
        </Col>
      </Row>

      {stats && (
        <Row gutter={24} style={{ marginBottom: 24 }}>
          <Col span={6}>
            <Card>
              <Statistic
                title="连接总数"
                value={stats.total}
                prefix={<BranchesOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="正常链路"
                value={stats.byStatus?.up || 0}
                valueStyle={{ color: '#3f8600' }}
                prefix={<ThunderboltOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="中断链路"
                value={stats.byStatus?.down || 0}
                valueStyle={{ color: '#cf1322' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="平均利用率"
                value={(stats.avgUtilization || 0).toFixed(1)}
                suffix="%"
              />
            </Card>
          </Col>
        </Row>
      )}

      <Card title="连接列表">
        <Table
          columns={columns}
          dataSource={connections}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      <Modal
        title={editingConn ? '编辑连接' : '新建连接'}
        open={modalVisible}
        onCancel={() => { setModalVisible(false); setEditingConn(null); form.resetFields(); }}
        onOk={() => form.submit()}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}
          initialValues={{ linkType: 'ethernet', bandwidth: 1000 }}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="sourceId" label="源设备" rules={[{ required: true }]}>
                <Select placeholder="选择源设备" showSearch
                  filterOption={(input, option) =>
                    option.children.toLowerCase().includes(input.toLowerCase())
                  }>
                  {devices.map(d => (
                    <Select.Option key={d.id} value={d.id}>{d.name} ({d.ipAddress})</Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="targetId" label="目标设备" rules={[{ required: true }]}>
                <Select placeholder="选择目标设备" showSearch
                  filterOption={(input, option) =>
                    option.children.toLowerCase().includes(input.toLowerCase())
                  }>
                  {devices.map(d => (
                    <Select.Option key={d.id} value={d.id}>{d.name} ({d.ipAddress})</Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="sourcePort" label="源端口">
                <Input placeholder="如: GigabitEthernet0/1" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="targetPort" label="目标端口">
                <Input placeholder="如: GigabitEthernet0/2" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="linkType" label="链路类型" rules={[{ required: true }]}>
                <Select>
                  <Select.Option value="ethernet">以太网</Select.Option>
                  <Select.Option value="fiber">光纤</Select.Option>
                  <Select.Option value="wireless">无线</Select.Option>
                  <Select.Option value="virtual">虚拟</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="bandwidth" label="带宽 (Mbps)">
                <InputNumber min={1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={2} placeholder="连接说明" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default TopologyConnectionManagement;
