import React, { useState, useEffect } from 'react';
import { 
  Table, Button, Space, Input, Tag, Modal, Form, 
  Select, message, Popconfirm, Card, Typography, Switch 
} from 'antd';
import { 
  PlusOutlined, EditOutlined, DeleteOutlined, 
  SearchOutlined, ReloadOutlined, UserOutlined 
} from '@ant-design/icons';
import { useAuth } from '../../context/AuthContext';

const { Title } = Typography;
const { Option } = Select;

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const UserManagement = () => {
  const { token, hasPermission } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [searchKeyword, setSearchKeyword] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [form] = Form.useForm();

  // 获取用户列表
  const fetchUsers = async (params = {}) => {
    if (!hasPermission('admin')) return;
    
    setLoading(true);
    try {
      const queryParams = new URLSearchParams({
        page: params.current || pagination.current,
        pageSize: params.pageSize || pagination.pageSize,
        ...(searchKeyword && { keyword: searchKeyword }),
      });

      const res = await fetch(`${API_BASE}/api/users?${queryParams}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      const data = await res.json();
      if (data.code === 0) {
        setUsers(data.data.list);
        setPagination(prev => ({
          ...prev,
          total: data.data.total,
          current: data.data.page,
        }));
      }
    } catch {
      message.error('获取用户列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 创建/更新用户
  const handleSubmit = async (values) => {
    try {
      const url = editingUser 
        ? `${API_BASE}/api/users/${editingUser.id}`
        : `${API_BASE}/api/users`;
      
      const res = await fetch(url, {
        method: editingUser ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(values),
      });

      const data = await res.json();
      if (data.code === 0) {
        message.success(editingUser ? '更新成功' : '创建成功');
        setModalVisible(false);
        form.resetFields();
        setEditingUser(null);
        fetchUsers();
      } else {
        message.error(data.message);
      }
    } catch {
      message.error('操作失败');
    }
  };

  // 删除用户
  const handleDelete = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/api/users/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      const data = await res.json();
      if (data.code === 0) {
        message.success('删除成功');
        fetchUsers();
      } else {
        message.error(data.message);
      }
    } catch {
      message.error('删除失败');
    }
  };

  // 打开编辑弹窗
  const openEditModal = (user) => {
    setEditingUser(user);
    form.setFieldsValue({
      username: user.username,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      isActive: user.isActive,
    });
    setModalVisible(true);
  };

  // 打开新增弹窗
  const openCreateModal = () => {
    setEditingUser(null);
    form.resetFields();
    setModalVisible(true);
  };

  const columns = [
    {
      title: '用户名',
      dataIndex: 'username',
      key: 'username',
      render: (text, record) => (
        <Space>
          <UserOutlined />
          <span style={{ fontWeight: 500 }}>{text}</span>
          {!record.isActive && <Tag color="red">已禁用</Tag>}
        </Space>
      ),
    },
    {
      title: '显示名',
      dataIndex: 'displayName',
      key: 'displayName',
    },
    {
      title: '邮箱',
      dataIndex: 'email',
      key: 'email',
    },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      render: (role) => {
        const colors = { admin: 'gold', user: 'blue', viewer: 'default' };
        const labels = { admin: '管理员', user: '用户', viewer: '访客' };
        return <Tag color={colors[role]}>{labels[role]}</Tag>;
      },
    },
    {
      title: '最后登录',
      dataIndex: 'lastLoginAt',
      key: 'lastLoginAt',
      render: (date) => date ? new Date(date).toLocaleString() : '-',
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date) => new Date(date).toLocaleDateString(),
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space>
          <Button 
            type="text" 
            icon={<EditOutlined />} 
            onClick={() => openEditModal(record)}
          />
          <Popconfirm
            title="确认删除此用户?"
            onConfirm={() => handleDelete(record.id)}
            okText="确认"
            cancelText="取消"
          >
            <Button type="text" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '32px 48px' }}>
      <Card
        style={{
          background: 'var(--glass-card-bg)',
          backdropFilter: 'blur(12px)',
          border: '1px solid var(--glass-border)',
          borderRadius: 16,
        }}
      >
        <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Title level={4} style={{ margin: 0 }}>用户管理</Title>
          <Space>
            <Input
              placeholder="搜索用户名或邮箱"
              prefix={<SearchOutlined />}
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              onPressEnter={() => fetchUsers()}
              style={{ width: 240 }}
            />
            <Button icon={<ReloadOutlined />} onClick={() => fetchUsers()}>刷新</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
              新增用户
            </Button>
          </Space>
        </div>

        <Table
          columns={columns}
          dataSource={users}
          rowKey="id"
          loading={loading}
          pagination={{
            ...pagination,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条`,
          }}
          onChange={(pag) => {
            setPagination(pag);
            fetchUsers({ current: pag.current, pageSize: pag.pageSize });
          }}
        />
      </Card>

      {/* 新增/编辑弹窗 */}
      <Modal
        title={editingUser ? '编辑用户' : '新增用户'}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          form.resetFields();
          setEditingUser(null);
        }}
        footer={null}
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{ role: 'user', isActive: true }}
        >
          <Form.Item
            name="username"
            label="用户名"
            rules={[
              { required: true, message: '请输入用户名' },
              { min: 3, message: '用户名至少3位' },
            ]}
          >
            <Input disabled={!!editingUser} placeholder="请输入用户名" />
          </Form.Item>

          <Form.Item
            name="email"
            label="邮箱"
            rules={[
              { required: true, message: '请输入邮箱' },
              { type: 'email', message: '邮箱格式不正确' },
            ]}
          >
            <Input placeholder="请输入邮箱" />
          </Form.Item>

          {!editingUser && (
            <Form.Item
              name="password"
              label="密码"
              rules={[
                { required: true, message: '请输入密码' },
                { min: 6, message: '密码至少6位' },
              ]}
            >
              <Input.Password placeholder="请输入密码" />
            </Form.Item>
          )}

          <Form.Item name="displayName" label="显示名称">
            <Input placeholder="请输入显示名称" />
          </Form.Item>

          <Form.Item name="role" label="角色" rules={[{ required: true }]}>
            <Select>
              <Option value="admin">管理员</Option>
              <Option value="user">用户</Option>
              <Option value="viewer">访客</Option>
            </Select>
          </Form.Item>

          <Form.Item name="isActive" label="状态" valuePropName="checked">
            <Switch checkedChildren="启用" unCheckedChildren="禁用" />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setModalVisible(false)}>取消</Button>
              <Button type="primary" htmlType="submit">
                {editingUser ? '更新' : '创建'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default UserManagement;
