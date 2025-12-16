import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Table, 
  Tag, 
  Typography,
  Row,
  Col,
  Statistic,
  Select,
  Input,
  DatePicker,
  Button,
  Space,
  Tabs,
  message
} from 'antd';
import { 
  FileTextOutlined,
  InfoCircleOutlined,
  WarningOutlined,
  CloseCircleOutlined,
  ReloadOutlined,
  DeleteOutlined,
  SearchOutlined
} from '@ant-design/icons';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

import { API_BASE_URL } from '../../config';
const API_BASE = API_BASE_URL;

const SystemLogs = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [stats, setStats] = useState(null);
  const [filters, setFilters] = useState({
    level: 'all',
    source: '',
    keyword: '',
  });
  const [activeTab, setActiveTab] = useState('system');

  const getToken = () => localStorage.getItem('token');

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      if (filters.level !== 'all') params.set('level', filters.level);
      if (filters.source) params.set('source', filters.source);
      if (filters.keyword) params.set('keyword', filters.keyword);

      const endpoint = activeTab === 'system' ? 'system' : 'audit';
      const res = await fetch(`${API_BASE}/api/logs/${endpoint}?${params}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (data.code === 0) {
        setLogs(data.data.list || []);
        setTotal(data.data.total || 0);
      }
    } catch {
      message.error('获取日志失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/logs/stats`, {
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
    fetchLogs();
    fetchStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, activeTab]);

  const handleSearch = () => {
    setPage(1);
    fetchLogs();
  };

  const handleCleanup = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/logs/cleanup?days=30`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (data.code === 0) {
        message.success(data.message);
        fetchLogs();
        fetchStats();
      }
    } catch {
      message.error('清理失败');
    }
  };

  const systemColumns = [
    {
      title: '时间',
      dataIndex: 'timestamp',
      width: 180,
      render: (t) => t ? new Date(t).toLocaleString() : '-',
    },
    {
      title: '级别',
      dataIndex: 'level',
      width: 100,
      render: (level) => {
        const config = {
          info: { color: 'blue', icon: <InfoCircleOutlined /> },
          warn: { color: 'orange', icon: <WarningOutlined /> },
          error: { color: 'red', icon: <CloseCircleOutlined /> },
        };
        const c = config[level] || config.info;
        return <Tag color={c.color} icon={c.icon}>{level.toUpperCase()}</Tag>;
      },
    },
    {
      title: '来源',
      dataIndex: 'source',
      width: 120,
      render: (s) => <Tag>{s}</Tag>,
    },
    {
      title: '消息',
      dataIndex: 'message',
      ellipsis: true,
    },
    {
      title: '详情',
      dataIndex: 'details',
      width: 200,
      ellipsis: true,
      render: (d) => d ? <Text type="secondary" code>{d}</Text> : '-',
    },
  ];

  const auditColumns = [
    {
      title: '时间',
      dataIndex: 'createdAt',
      width: 180,
      render: (t) => t ? new Date(t).toLocaleString() : '-',
    },
    {
      title: '操作',
      dataIndex: 'action',
      width: 100,
      render: (a) => {
        const colors = {
          create: 'green',
          update: 'blue',
          delete: 'red',
          login: 'purple',
          logout: 'default',
        };
        return <Tag color={colors[a] || 'default'}>{a}</Tag>;
      },
    },
    {
      title: '资源类型',
      dataIndex: 'resource',
      width: 120,
    },
    {
      title: '资源ID',
      dataIndex: 'resourceId',
      width: 200,
      ellipsis: true,
      render: (id) => id ? <Text code>{id}</Text> : '-',
    },
    {
      title: '详情',
      dataIndex: 'details',
      ellipsis: true,
      render: (d) => d || '-',
    },
  ];

  return (
    <div style={{ padding: '24px 32px' }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <Col>
          <Title level={3} style={{ margin: 0 }}>
            <FileTextOutlined style={{ marginRight: 12 }} />
            系统日志
          </Title>
        </Col>
        <Col>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={() => { fetchLogs(); fetchStats(); }}>
              刷新
            </Button>
            <Button icon={<DeleteOutlined />} onClick={handleCleanup} danger>
              清理30天前日志
            </Button>
          </Space>
        </Col>
      </Row>

      {stats && (
        <Row gutter={24} style={{ marginBottom: 24 }}>
          <Col span={6}>
            <Card>
              <Statistic
                title="日志总数"
                value={stats.total}
                prefix={<FileTextOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="信息"
                value={stats.byLevel?.info || 0}
                valueStyle={{ color: '#1890ff' }}
                prefix={<InfoCircleOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="警告"
                value={stats.byLevel?.warn || 0}
                valueStyle={{ color: '#faad14' }}
                prefix={<WarningOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="错误"
                value={stats.byLevel?.error || 0}
                valueStyle={{ color: '#cf1322' }}
                prefix={<CloseCircleOutlined />}
              />
            </Card>
          </Col>
        </Row>
      )}

      <Card>
        <Tabs activeKey={activeTab} onChange={setActiveTab}>
          <Tabs.TabPane tab="系统日志" key="system" />
          <Tabs.TabPane tab="审计日志" key="audit" />
        </Tabs>

        {activeTab === 'system' && (
          <Space style={{ marginBottom: 16 }} wrap>
            <Select
              value={filters.level}
              onChange={(v) => setFilters({ ...filters, level: v })}
              style={{ width: 120 }}
            >
              <Select.Option value="all">全部级别</Select.Option>
              <Select.Option value="info">INFO</Select.Option>
              <Select.Option value="warn">WARN</Select.Option>
              <Select.Option value="error">ERROR</Select.Option>
            </Select>
            <Select
              value={filters.source}
              onChange={(v) => setFilters({ ...filters, source: v })}
              style={{ width: 120 }}
              allowClear
              placeholder="来源"
            >
              <Select.Option value="server">server</Select.Option>
              <Select.Option value="database">database</Select.Option>
              <Select.Option value="auth">auth</Select.Option>
              <Select.Option value="api">api</Select.Option>
              <Select.Option value="collector">collector</Select.Option>
            </Select>
            <Input
              placeholder="搜索关键词"
              value={filters.keyword}
              onChange={(e) => setFilters({ ...filters, keyword: e.target.value })}
              style={{ width: 200 }}
              prefix={<SearchOutlined />}
              allowClear
            />
            <Button type="primary" onClick={handleSearch}>
              搜索
            </Button>
          </Space>
        )}

        <Table
          columns={activeTab === 'system' ? systemColumns : auditColumns}
          dataSource={logs}
          rowKey="id"
          loading={loading}
          pagination={{
            current: page,
            pageSize,
            total,
            onChange: (p, ps) => { setPage(p); setPageSize(ps); },
            showSizeChanger: true,
            showTotal: (t) => `共 ${t} 条`,
          }}
        />
      </Card>
    </div>
  );
};

export default SystemLogs;
