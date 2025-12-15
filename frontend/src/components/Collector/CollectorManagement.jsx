import React, { useState, useEffect, useCallback } from 'react';
import { 
  Card, 
  Table, 
  Tag, 
  Typography,
  Row,
  Col,
  Statistic,
  Progress,
  Space,
  Button,
  message,
  Tooltip
} from 'antd';
import { 
  CloudServerOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ReloadOutlined,
  SyncOutlined
} from '@ant-design/icons';

const { Title, Text } = Typography;

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const CollectorManagement = () => {
  const [collectors, setCollectors] = useState([]);
  const [loading, setLoading] = useState(false);

  const getToken = () => localStorage.getItem('token');

  const fetchCollectors = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/collector/list`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (data.code === 0) {
        setCollectors(data.data || []);
      }
    } catch {
      message.error('获取采集器列表失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCollectors();
    const interval = setInterval(fetchCollectors, 30000);
    return () => clearInterval(interval);
  }, [fetchCollectors]);

  const columns = [
    {
      title: '采集器ID',
      dataIndex: 'id',
      render: (id) => <Text code>{id}</Text>,
    },
    {
      title: '名称',
      dataIndex: 'name',
      render: (name, record) => (
        <Space>
          <CloudServerOutlined style={{ color: record.status === 'online' ? '#52c41a' : '#ff4d4f' }} />
          <Text strong>{name}</Text>
        </Space>
      ),
    },
    {
      title: '版本',
      dataIndex: 'version',
      render: (v) => <Tag>{v || 'N/A'}</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      render: (status) => (
        <Tag 
          color={status === 'online' ? 'success' : 'error'} 
          icon={status === 'online' ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
        >
          {status === 'online' ? '在线' : '离线'}
        </Tag>
      ),
    },
    {
      title: '最后心跳',
      dataIndex: 'lastHeartbeat',
      render: (time) => time ? new Date(time).toLocaleString() : '-',
    },
    {
      title: '启动时间',
      dataIndex: 'startedAt',
      render: (time) => time ? new Date(time).toLocaleString() : '-',
    },
    {
      title: '已采集指标',
      dataIndex: 'metricsCount',
      render: (count) => (
        <Text type={count > 0 ? 'success' : 'secondary'}>
          {count?.toLocaleString() || 0} 条
        </Text>
      ),
    },
  ];

  const onlineCount = collectors.filter(c => c.status === 'online').length;
  const offlineCount = collectors.filter(c => c.status === 'offline').length;
  const totalMetrics = collectors.reduce((sum, c) => sum + (c.metricsCount || 0), 0);

  return (
    <div style={{ padding: '24px 32px' }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <Col>
          <Title level={3} style={{ margin: 0 }}>
            <CloudServerOutlined style={{ marginRight: 12 }} />
            采集器管理
          </Title>
        </Col>
        <Col>
          <Button icon={<ReloadOutlined />} onClick={fetchCollectors} loading={loading}>
            刷新
          </Button>
        </Col>
      </Row>

      <Row gutter={24} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="采集器总数"
              value={collectors.length}
              prefix={<CloudServerOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="在线采集器"
              value={onlineCount}
              valueStyle={{ color: '#3f8600' }}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="离线采集器"
              value={offlineCount}
              valueStyle={{ color: offlineCount > 0 ? '#cf1322' : '#999' }}
              prefix={<CloseCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="已采集指标"
              value={totalMetrics}
              prefix={<SyncOutlined />}
              suffix="条"
            />
          </Card>
        </Col>
      </Row>

      <Card title="采集器列表">
        <Table
          columns={columns}
          dataSource={collectors}
          rowKey="id"
          loading={loading}
          pagination={false}
          locale={{ emptyText: '暂无采集器注册' }}
        />
      </Card>

      <Card title="采集器部署说明" style={{ marginTop: 24 }}>
        <Typography.Paragraph>
          <Text strong>1. 下载采集器</Text>
          <br />
          <Text code>git clone && cd collector && go build -o collector ./cmd/main.go</Text>
        </Typography.Paragraph>
        <Typography.Paragraph>
          <Text strong>2. 配置采集器</Text>
          <br />
          编辑 <Text code>config.yaml</Text>，设置API地址和Token
        </Typography.Paragraph>
        <Typography.Paragraph>
          <Text strong>3. 启动采集器</Text>
          <br />
          <Text code>./collector -config config.yaml</Text>
        </Typography.Paragraph>
        <Typography.Paragraph>
          <Text strong>4. Docker部署</Text>
          <br />
          <Text code>docker build -t netvis-collector . && docker run -d netvis-collector</Text>
        </Typography.Paragraph>
      </Card>
    </div>
  );
};

export default CollectorManagement;
