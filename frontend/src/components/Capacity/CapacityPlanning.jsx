import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Progress, Typography, Table, Tag, Button, Space, List } from 'antd';
import { FundOutlined, ReloadOutlined, RiseOutlined, FallOutlined, WarningOutlined, CloudServerOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const CapacityPlanning = () => {
  const [overview, setOverview] = useState(null);
  const [bottlenecks, setBottlenecks] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(false);

  const getToken = () => localStorage.getItem('token');

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [overviewRes, bottlenecksRes, recsRes] = await Promise.all([
        fetch(`${API_BASE}/api/capacity/overview`, { headers: { Authorization: `Bearer ${getToken()}` } }),
        fetch(`${API_BASE}/api/capacity/bottlenecks`, { headers: { Authorization: `Bearer ${getToken()}` } }),
        fetch(`${API_BASE}/api/capacity/recommendations`, { headers: { Authorization: `Bearer ${getToken()}` } }),
      ]);
      const [overviewData, bottlenecksData, recsData] = await Promise.all([overviewRes.json(), bottlenecksRes.json(), recsRes.json()]);
      if (overviewData.code === 0) setOverview(overviewData.data);
      if (bottlenecksData.code === 0) setBottlenecks(bottlenecksData.data || []);
      if (recsData.code === 0) setRecommendations(recsData.data || []);
    } catch { /* ignore */ } finally { setLoading(false); }
  };

  useEffect(() => { fetchAll(); }, []);

  const getTrendIcon = (trend) => trend === 'increasing' ? <RiseOutlined style={{ color: '#faad14' }} /> : <FallOutlined style={{ color: '#52c41a' }} />;

  const MetricCard = ({ title, data }) => (
    <Card size="small" title={title}>
      <Progress type="dashboard" percent={data.current} strokeColor={data.current > 80 ? '#f5222d' : data.current > 60 ? '#faad14' : '#52c41a'} />
      <div style={{ textAlign: 'center', marginTop: 8 }}>
        <Text type="secondary">30天预测: {data.forecast30d}% | 90天预测: {data.forecast90d}%</Text>
        <div>{getTrendIcon(data.trend)} {data.trend === 'increasing' ? '上升趋势' : '稳定'}</div>
      </div>
    </Card>
  );

  const bottleneckColumns = [
    { title: '设备', dataIndex: 'deviceName' },
    { title: 'IP', dataIndex: 'ip' },
    { title: '瓶颈', dataIndex: 'bottleneck', render: (b) => ({ cpu: 'CPU', memory: '内存', bandwidth: '带宽', disk: '磁盘' }[b] || b) },
    { title: '使用率', dataIndex: 'currentUsage', render: (v) => <Progress percent={v} size="small" strokeColor={v > 90 ? '#f5222d' : '#faad14'} /> },
    { title: '严重程度', dataIndex: 'severity', render: (s) => <Tag color={s === 'critical' ? 'red' : 'orange'}>{s === 'critical' ? '严重' : '警告'}</Tag> },
  ];

  return (
    <div style={{ padding: '24px 32px' }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <Col><Title level={3} style={{ margin: 0 }}><FundOutlined style={{ marginRight: 12 }} />容量规划</Title></Col>
        <Col><Button icon={<ReloadOutlined />} onClick={fetchAll} loading={loading}>刷新</Button></Col>
      </Row>

      {overview && (
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={6}><MetricCard title="CPU容量" data={overview.cpuCapacity} /></Col>
          <Col span={6}><MetricCard title="内存容量" data={overview.memoryCapacity} /></Col>
          <Col span={6}><MetricCard title="带宽容量" data={overview.bandwidthCapacity} /></Col>
          <Col span={6}><MetricCard title="存储容量" data={overview.storageCapacity} /></Col>
        </Row>
      )}

      <Row gutter={16}>
        <Col span={16}>
          <Card title={<><WarningOutlined /> 资源瓶颈</>} loading={loading}>
            <Table columns={bottleneckColumns} dataSource={bottlenecks} rowKey="deviceId" size="small" pagination={false} />
          </Card>
        </Col>
        <Col span={8}>
          <Card title={<><CloudServerOutlined /> 扩容建议</>} loading={loading}>
            <List
              size="small"
              dataSource={recommendations}
              renderItem={(item) => (
                <List.Item>
                  <List.Item.Meta
                    title={<><Tag color={item.priority === 'high' ? 'red' : 'orange'}>{item.priority.toUpperCase()}</Tag> {item.title}</>}
                    description={<><Text type="secondary">{item.description}</Text><br/><Text strong>预估成本: {item.estimatedCost}</Text></>}
                  />
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default CapacityPlanning;
