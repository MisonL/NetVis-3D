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
  Progress,
  Select,
  message,
  Tooltip,
  Alert,
  Badge
} from 'antd';
import { 
  DashboardOutlined, 
  ReloadOutlined,
  SyncOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons';

const { Title, Text } = Typography;

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const PerformanceBaseline = () => {
  const [overview, setOverview] = useState(null);
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [baselines, setBaselines] = useState([]);
  const [anomalies, setAnomalies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [calculating, setCalculating] = useState(false);

  const getToken = () => localStorage.getItem('token');

  const fetchOverview = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/baseline/overview`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (data.code === 0) {
        setOverview(data.data);
      }
    } catch {
      message.error('获取基线概览失败');
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
    } catch { /* ignore */ }
  };

  const fetchBaselines = async (deviceId) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/baseline/device/${deviceId}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (data.code === 0) {
        setBaselines(data.data.baselines || []);
      }
    } catch {
      message.error('获取设备基线失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchAnomalies = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/baseline/anomalies`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (data.code === 0) {
        setAnomalies(data.data.anomalies || []);
      }
    } catch { /* ignore */ }
  };

  const handleCalculate = async () => {
    setCalculating(true);
    try {
      const res = await fetch(`${API_BASE}/api/baseline/calculate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ period: '7d' }),
      });
      const data = await res.json();
      if (data.code === 0) {
        message.success(data.message);
        fetchOverview();
        fetchAnomalies();
      } else {
        message.error(data.message);
      }
    } catch {
      message.error('计算基线失败');
    } finally {
      setCalculating(false);
    }
  };

  useEffect(() => {
    fetchOverview();
    fetchDevices();
    fetchAnomalies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getMetricLabel = (metric) => {
    const labels = {
      cpu: 'CPU使用率',
      memory: '内存使用率',
      disk: '磁盘使用率',
      bandwidth: '带宽利用率',
      latency: '响应延迟',
    };
    return labels[metric] || metric;
  };

  const baselineColumns = [
    {
      title: '指标',
      dataIndex: 'metricType',
      render: (type) => <Text strong>{getMetricLabel(type)}</Text>,
    },
    {
      title: '平均值',
      dataIndex: 'avgValue',
      render: (v, record) => (
        <Space>
          <Text>{v.toFixed(1)}</Text>
          <Text type="secondary">{record.metricType === 'latency' ? 'ms' : '%'}</Text>
        </Space>
      ),
    },
    {
      title: '范围',
      key: 'range',
      render: (_, record) => (
        <Text type="secondary">{record.minValue.toFixed(1)} - {record.maxValue.toFixed(1)}</Text>
      ),
    },
    {
      title: '标准差',
      dataIndex: 'stdDev',
      render: (v) => <Text code>±{v.toFixed(2)}</Text>,
    },
    {
      title: '样本数',
      dataIndex: 'sampleCount',
      render: (v) => <Tag>{v}</Tag>,
    },
    {
      title: '周期',
      dataIndex: 'period',
      render: (p) => <Tag color="blue">{p}</Tag>,
    },
  ];

  const anomalyColumns = [
    {
      title: '设备',
      dataIndex: 'deviceName',
      render: (name) => <Text strong>{name}</Text>,
    },
    {
      title: '指标',
      dataIndex: 'metricType',
      render: (type) => getMetricLabel(type),
    },
    {
      title: '当前值',
      dataIndex: 'currentValue',
      render: (v, record) => (
        <Text type={record.severity === 'critical' ? 'danger' : 'warning'}>
          {v.toFixed(1)}
        </Text>
      ),
    },
    {
      title: '基线',
      dataIndex: 'baselineAvg',
      render: (v) => v.toFixed(1),
    },
    {
      title: '偏差',
      dataIndex: 'deviation',
      render: (v) => (
        <Tag color={Math.abs(v) > 2 ? 'red' : 'orange'}>
          {v > 0 ? '+' : ''}{v.toFixed(2)}σ
        </Tag>
      ),
    },
    {
      title: '严重度',
      dataIndex: 'severity',
      render: (s) => (
        <Tag color={s === 'critical' ? 'red' : 'orange'} icon={s === 'critical' ? <ExclamationCircleOutlined /> : <WarningOutlined />}>
          {s === 'critical' ? '严重' : '警告'}
        </Tag>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px 32px' }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <Col>
          <Title level={3} style={{ margin: 0 }}>
            <DashboardOutlined style={{ marginRight: 12 }} />
            性能基线
          </Title>
        </Col>
        <Col>
          <Space>
            <Button 
              type="primary" 
              icon={<SyncOutlined spin={calculating} />} 
              onClick={handleCalculate}
              loading={calculating}
            >
              重新计算基线
            </Button>
            <Button icon={<ReloadOutlined />} onClick={() => { fetchOverview(); fetchAnomalies(); }}>
              刷新
            </Button>
          </Space>
        </Col>
      </Row>

      {/* 概览统计 */}
      {overview && (
        <Row gutter={24} style={{ marginBottom: 24 }}>
          <Col span={6}>
            <Card>
              <Statistic
                title="已建立基线设备"
                value={overview.overview.devicesWithBaseline}
                suffix={`/ ${overview.overview.totalDevices}`}
                prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="监控指标"
                value={overview.overview.metricsTracked}
                prefix={<DashboardOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="超出基线"
                value={overview.overview.alerts.aboveBaseline}
                valueStyle={{ color: overview.overview.alerts.aboveBaseline > 0 ? '#ff4d4f' : '#52c41a' }}
                prefix={<WarningOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="低于基线"
                value={overview.overview.alerts.belowBaseline}
                valueStyle={{ color: overview.overview.alerts.belowBaseline > 0 ? '#faad14' : '#52c41a' }}
              />
            </Card>
          </Col>
        </Row>
      )}

      {anomalies.length > 0 && (
        <Alert
          message={`检测到 ${anomalies.length} 个性能异常`}
          type="warning"
          showIcon
          style={{ marginBottom: 24 }}
        />
      )}

      <Row gutter={24}>
        <Col span={14}>
          <Card 
            title="设备基线详情" 
            extra={
              <Select
                placeholder="选择设备"
                style={{ width: 200 }}
                onChange={(value) => { setSelectedDevice(value); fetchBaselines(value); }}
                showSearch
                filterOption={(input, opt) => opt.children.toLowerCase().includes(input.toLowerCase())}
              >
                {devices.map(d => (
                  <Select.Option key={d.id} value={d.id}>{d.name}</Select.Option>
                ))}
              </Select>
            }
          >
            {selectedDevice ? (
              <Table
                columns={baselineColumns}
                dataSource={baselines}
                rowKey="metricType"
                loading={loading}
                pagination={false}
                size="middle"
              />
            ) : (
              <div style={{ textAlign: 'center', padding: 48, color: '#999' }}>
                请选择设备查看基线详情
              </div>
            )}
          </Card>
        </Col>
        <Col span={10}>
          <Card title={<><WarningOutlined style={{ color: '#faad14' }} /> 性能异常</>}>
            <Table
              columns={anomalyColumns}
              dataSource={anomalies}
              rowKey={(r) => `${r.deviceId}-${r.metricType}`}
              pagination={{ pageSize: 5 }}
              size="small"
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default PerformanceBaseline;
