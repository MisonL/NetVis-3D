import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Table,
  Button, 
  Space, 
  Tag, 
  Typography,
  Row,
  Col,
  Statistic,
  Modal,
  Form,
  Input,
  message,
  Progress,
  List
} from 'antd';
import { 
  WifiOutlined, 
  ReloadOutlined,
  ThunderboltOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  CloseCircleOutlined,
  PlayCircleOutlined
} from '@ant-design/icons';

const { Title, Text } = Typography;

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const NetworkQuality = () => {
  const [overview, setOverview] = useState(null);
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pingModal, setPingModal] = useState(false);
  const [pingResult, setPingResult] = useState(null);
  const [pingLoading, setPingLoading] = useState(false);
  const [form] = Form.useForm();

  const getToken = () => localStorage.getItem('token');

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [overviewRes, linksRes] = await Promise.all([
        fetch(`${API_BASE}/api/network-quality/overview`, { headers: { Authorization: `Bearer ${getToken()}` } }),
        fetch(`${API_BASE}/api/network-quality/links`, { headers: { Authorization: `Bearer ${getToken()}` } }),
      ]);

      const [overviewData, linksData] = await Promise.all([overviewRes.json(), linksRes.json()]);

      if (overviewData.code === 0) setOverview(overviewData.data);
      if (linksData.code === 0) setLinks(linksData.data || []);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 30000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePing = async (values) => {
    setPingLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/network-quality/ping`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ target: values.target, count: 4 }),
      });
      const data = await res.json();
      if (data.code === 0) {
        setPingResult(data.data);
      }
    } catch {
      message.error('Ping测试失败');
    } finally {
      setPingLoading(false);
    }
  };

  const getStatusIcon = (status) => {
    if (status === 'healthy') return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
    if (status === 'degraded') return <ExclamationCircleOutlined style={{ color: '#faad14' }} />;
    return <CloseCircleOutlined style={{ color: '#f5222d' }} />;
  };

  const linkColumns = [
    { title: '源设备', dataIndex: 'sourceDevice' },
    { title: '源IP', dataIndex: 'sourceIp' },
    { title: '目标设备', dataIndex: 'targetDevice' },
    { title: '目标IP', dataIndex: 'targetIp' },
    { 
      title: '延迟', 
      dataIndex: 'latency', 
      render: (v) => <Tag color={v < 30 ? 'green' : v < 60 ? 'orange' : 'red'}>{v}ms</Tag>
    },
    { 
      title: '丢包率', 
      dataIndex: 'packetLoss', 
      render: (v) => `${v}%`
    },
    { 
      title: '状态', 
      dataIndex: 'status', 
      render: (s) => <>{getStatusIcon(s)} {s === 'healthy' ? '健康' : '降级'}</>
    },
  ];

  return (
    <div style={{ padding: '24px 32px' }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <Col>
          <Title level={3} style={{ margin: 0 }}>
            <WifiOutlined style={{ marginRight: 12 }} />
            网络质量监测
          </Title>
        </Col>
        <Col>
          <Space>
            <Button icon={<PlayCircleOutlined />} onClick={() => setPingModal(true)}>Ping测试</Button>
            <Button icon={<ReloadOutlined />} onClick={fetchAll} loading={loading}>刷新</Button>
          </Space>
        </Col>
      </Row>

      {/* 概览统计 */}
      {overview && (
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={4}>
            <Card size="small">
              <Statistic title="平均延迟" value={overview.avgLatency} suffix="ms" valueStyle={{ color: overview.avgLatency < 30 ? '#52c41a' : '#faad14' }} />
            </Card>
          </Col>
          <Col span={4}>
            <Card size="small">
              <Statistic title="抖动" value={overview.avgJitter} suffix="ms" />
            </Card>
          </Col>
          <Col span={4}>
            <Card size="small">
              <Statistic title="丢包率" value={overview.packetLoss} suffix="%" />
            </Card>
          </Col>
          <Col span={4}>
            <Card size="small">
              <Statistic title="可用性" value={overview.availability} suffix="%" valueStyle={{ color: '#52c41a' }} />
            </Card>
          </Col>
          <Col span={4}>
            <Card size="small">
              <Statistic title="健康链路" value={overview.healthyLinks} prefix={<CheckCircleOutlined />} />
            </Card>
          </Col>
          <Col span={4}>
            <Card size="small">
              <Statistic title="降级/故障" value={`${overview.degradedLinks}/${overview.downLinks}`} prefix={<ExclamationCircleOutlined />} valueStyle={{ color: overview.degradedLinks + overview.downLinks > 0 ? '#faad14' : 'inherit' }} />
            </Card>
          </Col>
        </Row>
      )}

      {/* 链路健康列表 */}
      <Card title="链路健康状态">
        <Table columns={linkColumns} dataSource={links} rowKey="id" loading={loading} />
      </Card>

      {/* Ping测试弹窗 */}
      <Modal
        title="Ping测试"
        open={pingModal}
        onCancel={() => { setPingModal(false); setPingResult(null); }}
        footer={null}
        width={600}
      >
        <Form form={form} layout="inline" onFinish={handlePing} style={{ marginBottom: 16 }}>
          <Form.Item name="target" rules={[{ required: true, message: '请输入目标地址' }]}>
            <Input placeholder="输入IP地址或域名" style={{ width: 300 }} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={pingLoading}>
              开始测试
            </Button>
          </Form.Item>
        </Form>

        {pingResult && (
          <div>
            <Text strong>目标: {pingResult.target}</Text>
            <List
              size="small"
              dataSource={pingResult.results}
              renderItem={(item) => (
                <List.Item>
                  <Text>序号 {item.seq}: TTL={item.ttl}, 时间={item.time}ms</Text>
                </List.Item>
              )}
            />
            <div style={{ marginTop: 16, padding: 12, background: '#f5f5f5', borderRadius: 4 }}>
              <Text>统计: {pingResult.stats.transmitted}包发送, {pingResult.stats.received}包接收, {pingResult.stats.loss}%丢失</Text>
              <br />
              <Text>RTT: 最小={pingResult.stats.min}ms, 最大={pingResult.stats.max}ms, 平均={pingResult.stats.avg}ms</Text>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default NetworkQuality;
