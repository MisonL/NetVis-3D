import React, { useState, useEffect } from 'react';
import { 
  Card, Table, Typography, Tag, Space, Select, DatePicker, 
  Button, Row, Col, Statistic, Spin
} from 'antd';
import { 
  FileTextOutlined, DownloadOutlined, UserOutlined,
  ClockCircleOutlined, FilterOutlined
} from '@ant-design/icons';
import { useAuth } from '../../context/AuthContext';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const AuditLogs = () => {
  const { token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0 });
  const [stats, setStats] = useState(null);
  const [filters, setFilters] = useState({ action: null, resource: null });

  useEffect(() => {
    fetchLogs();
    fetchStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.page, filters]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        pageSize: pagination.pageSize.toString(),
      });
      if (filters.action) params.append('action', filters.action);
      if (filters.resource) params.append('resource', filters.resource);

      const res = await fetch(`${API_BASE}/api/audit?${params}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.code === 0) {
        setLogs(data.data.list);
        setPagination(prev => ({ ...prev, total: data.data.pagination.total }));
      }
    } catch (err) {
      console.error('Failed to fetch logs:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/audit/stats`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.code === 0) {
        setStats(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  };

  const handleExport = () => {
    window.open(`${API_BASE}/api/audit/export?token=${token}`, '_blank');
  };

  const getActionTag = (action) => {
    const colors = {
      login: 'blue',
      logout: 'default',
      create: 'green',
      update: 'orange',
      delete: 'red',
      import: 'purple',
    };
    const labels = {
      login: '登录',
      logout: '登出',
      create: '创建',
      update: '更新',
      delete: '删除',
      import: '导入',
    };
    return <Tag color={colors[action] || 'default'}>{labels[action] || action}</Tag>;
  };

  const getResourceTag = (resource) => {
    const labels = {
      user: '用户',
      device: '设备',
      alert: '告警',
      license: '授权',
      config: '配置',
    };
    return <Tag>{labels[resource] || resource}</Tag>;
  };

  const columns = [
    {
      title: '时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (val) => new Date(val).toLocaleString(),
    },
    {
      title: '用户',
      dataIndex: 'displayName',
      key: 'user',
      width: 120,
      render: (val, record) => val || record.username || '-',
    },
    {
      title: '操作',
      dataIndex: 'action',
      key: 'action',
      width: 100,
      render: getActionTag,
    },
    {
      title: '资源类型',
      dataIndex: 'resource',
      key: 'resource',
      width: 100,
      render: getResourceTag,
    },
    {
      title: '资源ID',
      dataIndex: 'resourceId',
      key: 'resourceId',
      width: 150,
      ellipsis: true,
      render: (val) => val || '-',
    },
    {
      title: 'IP地址',
      dataIndex: 'ipAddress',
      key: 'ipAddress',
      width: 130,
      render: (val) => val || '-',
    },
    {
      title: '详情',
      dataIndex: 'details',
      key: 'details',
      ellipsis: true,
      render: (val) => val ? JSON.stringify(val) : '-',
    },
  ];

  return (
    <div style={{ padding: '32px 48px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={4} style={{ margin: 0 }}>
          <FileTextOutlined style={{ marginRight: 8 }} />
          审计日志
        </Title>
        <Button icon={<DownloadOutlined />} onClick={handleExport}>
          导出CSV
        </Button>
      </div>

      {/* 统计卡片 */}
      <Row gutter={[24, 24]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={8}>
          <Card style={{ background: 'var(--glass-card-bg)', border: '1px solid var(--glass-border)' }}>
            <Statistic 
              title="今日操作" 
              value={stats?.dailyTrend?.[stats.dailyTrend.length - 1]?.count || 0}
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card style={{ background: 'var(--glass-card-bg)', border: '1px solid var(--glass-border)' }}>
            <Statistic 
              title="登录次数" 
              value={stats?.byAction?.find(a => a.action === 'login')?.count || 0}
              prefix={<UserOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card style={{ background: 'var(--glass-card-bg)', border: '1px solid var(--glass-border)' }}>
            <Statistic 
              title="总记录数" 
              value={pagination.total}
              prefix={<FileTextOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* 筛选器 */}
      <Card 
        size="small" 
        style={{ marginBottom: 16, background: 'var(--glass-card-bg)', border: '1px solid var(--glass-border)' }}
      >
        <Space wrap>
          <FilterOutlined />
          <Select
            placeholder="操作类型"
            allowClear
            style={{ width: 120 }}
            onChange={(val) => setFilters(f => ({ ...f, action: val }))}
            options={[
              { label: '登录', value: 'login' },
              { label: '创建', value: 'create' },
              { label: '更新', value: 'update' },
              { label: '删除', value: 'delete' },
              { label: '导入', value: 'import' },
            ]}
          />
          <Select
            placeholder="资源类型"
            allowClear
            style={{ width: 120 }}
            onChange={(val) => setFilters(f => ({ ...f, resource: val }))}
            options={[
              { label: '用户', value: 'user' },
              { label: '设备', value: 'device' },
              { label: '告警', value: 'alert' },
              { label: '授权', value: 'license' },
            ]}
          />
        </Space>
      </Card>

      {/* 日志表格 */}
      <Table
        columns={columns}
        dataSource={logs}
        rowKey="id"
        loading={loading}
        pagination={{
          current: pagination.page,
          pageSize: pagination.pageSize,
          total: pagination.total,
          showTotal: (total) => `共 ${total} 条记录`,
          onChange: (page) => setPagination(p => ({ ...p, page })),
        }}
        scroll={{ x: 1000 }}
      />
    </div>
  );
};

export default AuditLogs;
