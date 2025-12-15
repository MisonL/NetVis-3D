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
  Button,
  Space,
  Tabs,
  message,
  Progress,
  List
} from 'antd';
import { 
  ApiOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  ReloadOutlined,
  ThunderboltOutlined
} from '@ant-design/icons';

const { Title, Text } = Typography;

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const ApiUsageStats = () => {
  const [overview, setOverview] = useState(null);
  const [calls, setCalls] = useState([]);
  const [slowCalls, setSlowCalls] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);


  const getToken = () => localStorage.getItem('token');

  const fetchOverview = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/api-stats/overview`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (data.code === 0) {
        setOverview(data.data);
      }
    } catch {
      message.error('获取统计失败');
    }
  };

  const fetchCalls = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/api-stats/calls?page=${page}&pageSize=15`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (data.code === 0) {
        setCalls(data.data.list || []);
        setTotal(data.data.total || 0);
      }
    } catch {
      message.error('获取调用列表失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchSlowCalls = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/api-stats/slow?threshold=100&limit=10`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (data.code === 0) {
        setSlowCalls(data.data || []);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchOverview();
    fetchCalls();
    fetchSlowCalls();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const refresh = () => {
    fetchOverview();
    fetchCalls();
    fetchSlowCalls();
  };

  const columns = [
    {
      title: '时间',
      dataIndex: 'timestamp',
      width: 180,
      render: (t) => t ? new Date(t).toLocaleString() : '-',
    },
    {
      title: '方法',
      dataIndex: 'method',
      width: 80,
      render: (m) => {
        const colors = { GET: 'blue', POST: 'green', PUT: 'orange', DELETE: 'red' };
        return <Tag color={colors[m] || 'default'}>{m}</Tag>;
      },
    },
    {
      title: '端点',
      dataIndex: 'endpoint',
      ellipsis: true,
      render: (e) => <Text code>{e}</Text>,
    },
    {
      title: '状态',
      dataIndex: 'statusCode',
      width: 80,
      render: (code) => (
        <Tag color={code >= 200 && code < 300 ? 'success' : code >= 400 ? 'error' : 'warning'}>
          {code}
        </Tag>
      ),
    },
    {
      title: '响应时间',
      dataIndex: 'responseTime',
      width: 120,
      render: (t) => (
        <Text type={t > 100 ? 'warning' : 'secondary'}>
          {t?.toFixed(1)}ms
        </Text>
      ),
    },
    {
      title: 'IP',
      dataIndex: 'ipAddress',
      width: 140,
      ellipsis: true,
    },
  ];

  return (
    <div style={{ padding: '24px 32px' }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <Col>
          <Title level={3} style={{ margin: 0 }}>
            <ApiOutlined style={{ marginRight: 12 }} />
            API使用统计
          </Title>
        </Col>
        <Col>
          <Button icon={<ReloadOutlined />} onClick={refresh}>
            刷新
          </Button>
        </Col>
      </Row>

      {overview && (
        <Row gutter={24} style={{ marginBottom: 24 }}>
          <Col span={6}>
            <Card>
              <Statistic
                title="总调用次数"
                value={overview.totalCalls}
                prefix={<ApiOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="24小时调用"
                value={overview.dailyTotal}
                prefix={<ThunderboltOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="成功率"
                value={overview.successRate}
                suffix="%"
                valueStyle={{ color: parseFloat(overview.successRate) >= 95 ? '#3f8600' : '#cf1322' }}
                prefix={<CheckCircleOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="平均响应时间"
                value={overview.avgResponseTime}
                suffix="ms"
                prefix={<ClockCircleOutlined />}
              />
            </Card>
          </Col>
        </Row>
      )}

      <Row gutter={24}>
        <Col span={16}>
          <Card title="最近API调用">
            <Table
              columns={columns}
              dataSource={calls}
              rowKey="id"
              loading={loading}
              pagination={{
                current: page,
                pageSize: 15,
                total,
                onChange: (p) => setPage(p),
                showTotal: (t) => `共 ${t} 条`,
              }}
              size="small"
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card title="热门端点" style={{ marginBottom: 24 }}>
            <List
              size="small"
              dataSource={overview?.byEndpoint || []}
              renderItem={([endpoint, count]) => (
                <List.Item>
                  <Text code style={{ flex: 1 }}>{endpoint}</Text>
                  <Tag color="blue">{count}</Tag>
                </List.Item>
              )}
            />
          </Card>

          <Card title="慢请求 (>100ms)">
            <List
              size="small"
              dataSource={slowCalls.slice(0, 5)}
              renderItem={(item) => (
                <List.Item>
                  <Space>
                    <Tag color={item.method === 'GET' ? 'blue' : 'green'}>{item.method}</Tag>
                    <Text type="secondary" style={{ fontSize: 12 }}>{item.endpoint}</Text>
                  </Space>
                  <Text type="warning">{item.responseTime?.toFixed(0)}ms</Text>
                </List.Item>
              )}
              locale={{ emptyText: '无慢请求' }}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default ApiUsageStats;
