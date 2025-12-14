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
  Tree,
  ColorPicker
} from 'antd';
import { 
  PlusOutlined, 
  EditOutlined, 
  DeleteOutlined,
  FolderOutlined,
  ClusterOutlined,
  ReloadOutlined
} from '@ant-design/icons';

const { Title, Text } = Typography;

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const DeviceGroupManagement = () => {
  const [groups, setGroups] = useState([]);
  const [treeData, setTreeData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);
  const [stats, setStats] = useState(null);
  const [form] = Form.useForm();

  const getToken = () => localStorage.getItem('token');

  const fetchGroups = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/groups/list`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (data.code === 0) {
        setGroups(data.data.list || []);
        setTreeData(data.data.tree || []);
      }
    } catch {
      message.error('获取分组列表失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/groups/stats/overview`, {
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
    fetchGroups();
    fetchStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (values) => {
    try {
      const url = editingGroup 
        ? `${API_BASE}/api/groups/${editingGroup.id}`
        : `${API_BASE}/api/groups`;
      
      const color = typeof values.color === 'string' ? values.color : values.color?.toHexString?.() || '#1890ff';
      
      const res = await fetch(url, {
        method: editingGroup ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ ...values, color }),
      });
      
      const data = await res.json();
      if (data.code === 0) {
        message.success(editingGroup ? '分组更新成功' : '分组创建成功');
        setModalVisible(false);
        form.resetFields();
        setEditingGroup(null);
        fetchGroups();
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
      const res = await fetch(`${API_BASE}/api/groups/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (data.code === 0) {
        message.success('分组删除成功');
        fetchGroups();
        fetchStats();
      } else {
        message.error(data.message);
      }
    } catch {
      message.error('删除失败');
    }
  };

  const columns = [
    {
      title: '分组名称',
      dataIndex: 'name',
      render: (name, record) => (
        <Space>
          <div style={{ 
            width: 12, 
            height: 12, 
            borderRadius: 2, 
            backgroundColor: record.color || '#1890ff' 
          }} />
          <FolderOutlined />
          <Text strong>{name}</Text>
        </Space>
      ),
    },
    {
      title: '描述',
      dataIndex: 'description',
      ellipsis: true,
      render: (d) => d || '-',
    },
    {
      title: '设备数量',
      dataIndex: 'deviceCount',
      render: (count) => <Tag color="blue">{count} 台</Tag>,
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      render: (t) => t ? new Date(t).toLocaleDateString() : '-',
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
              setEditingGroup(record);
              form.setFieldsValue({
                ...record,
                color: record.color,
              });
              setModalVisible(true);
            }}
          />
          <Popconfirm
            title="确定删除此分组？"
            description="分组内设备将变为未分组"
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
            <ClusterOutlined style={{ marginRight: 12 }} />
            设备分组管理
          </Title>
        </Col>
        <Col>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={() => { fetchGroups(); fetchStats(); }}>
              刷新
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => { setEditingGroup(null); form.resetFields(); setModalVisible(true); }}
            >
              新建分组
            </Button>
          </Space>
        </Col>
      </Row>

      {stats && (
        <Row gutter={24} style={{ marginBottom: 24 }}>
          <Col span={8}>
            <Card>
              <Statistic
                title="分组总数"
                value={stats.totalGroups}
                prefix={<FolderOutlined />}
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card>
              <Statistic
                title="已分组设备"
                value={stats.totalDevices}
                suffix="台"
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card>
              <Statistic
                title="平均每组"
                value={stats.totalGroups ? Math.round(stats.totalDevices / stats.totalGroups) : 0}
                suffix="台"
              />
            </Card>
          </Col>
        </Row>
      )}

      <Row gutter={24}>
        <Col span={16}>
          <Card title="分组列表">
            <Table
              columns={columns}
              dataSource={groups}
              rowKey="id"
              loading={loading}
              pagination={{ pageSize: 10 }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card title="分组树形视图">
            {treeData.length > 0 ? (
              <Tree
                showIcon
                defaultExpandAll
                treeData={treeData.map(g => ({
                  key: g.id,
                  title: (
                    <Space>
                      <div style={{ 
                        width: 10, 
                        height: 10, 
                        borderRadius: 2, 
                        backgroundColor: g.color 
                      }} />
                      {g.name}
                      <Tag size="small">{g.deviceCount}</Tag>
                    </Space>
                  ),
                  children: g.children?.map(c => ({
                    key: c.id,
                    title: `${c.name} (${c.deviceCount})`,
                  })),
                }))}
              />
            ) : (
              <Text type="secondary">暂无分组</Text>
            )}
          </Card>
        </Col>
      </Row>

      <Modal
        title={editingGroup ? '编辑分组' : '新建分组'}
        open={modalVisible}
        onCancel={() => { setModalVisible(false); setEditingGroup(null); form.resetFields(); }}
        onOk={() => form.submit()}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}
          initialValues={{ color: '#1890ff' }}>
          <Form.Item name="name" label="分组名称" rules={[{ required: true }]}>
            <Input placeholder="如: 核心层" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={2} placeholder="分组说明" />
          </Form.Item>
          <Form.Item name="parentId" label="上级分组">
            <Select allowClear placeholder="选择上级分组（可选）">
              {groups.filter(g => g.id !== editingGroup?.id).map(g => (
                <Select.Option key={g.id} value={g.id}>{g.name}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="color" label="标识颜色">
            <ColorPicker />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default DeviceGroupManagement;
