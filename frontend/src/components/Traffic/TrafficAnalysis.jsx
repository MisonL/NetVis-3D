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
  Tooltip
} from 'antd';
import { 
  LineChartOutlined, 
  ReloadOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  ThunderboltOutlined,
  WifiOutlined
} from '@ant-design/icons';

const { Title, Text } = Typography;

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const TrafficAnalysis = () => {
  const [overview, setOverview] = useState(null);
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [interfaces, setInterfaces] = useState([]);
  const [loading, setLoading] = useState(false);

  const getToken = () => localStorage.getItem('token');

  const fetchOverview = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/traffic/overview`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (data.code === 0) {
        setOverview(data.data);
      }
    } catch {
      message.error('获取流量概览失败');
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

  const fetchInterfaces = async (deviceId) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/traffic/interfaces/${deviceId}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (data.code === 0) {
        setInterfaces(data.data.interfaces || []);
      }
    } catch {
      message.error('获取接口流量失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview();
    fetchDevices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const formatBytes = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + ' MB';
    return (bytes / 1024 / 1024 / 1024).toFixed(2) + ' GB';
  };

  const formatRate = (bytesPerSec) => {
    const bps = bytesPerSec * 8;
    if (bps < 1000) return bps.toFixed(0) + ' bps';
    if (bps < 1000000) return (bps / 1000).toFixed(1) + ' Kbps';
    if (bps < 1000000000) return (bps / 1000000).toFixed(1) + ' Mbps';
    return (bps / 1000000000).toFixed(2) + ' Gbps';
  };

  const columns = [
    {
      title: '接口名称',
      dataIndex: 'interfaceName',
      render: (name, record) => (
        <Space>
          <WifiOutlined style={{ color: record.status === 'up' ? '#52c41a' : '#999' }} />
          <Text strong>{name}</Text>
        </Space>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 80,
      render: (status) => (
        <Tag color={status === 'up' ? 'success' : 'default'}>
          {status === 'up' ? '在线' : '离线'}
        </Tag>
      ),
    },
    {
      title: '带宽',
      dataIndex: 'bandwidth',
      width: 100,
      render: (bw) => <Text>{bw} Mbps</Text>,
    },
    {
      title: '入流量',
      key: 'in',
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Text type="success"><ArrowDownOutlined /> {formatBytes(record.inBytes)}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{formatRate(record.inBytesRate)}</Text>
        </Space>
      ),
    },
    {
      title: '出流量',
      key: 'out',
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Text type="danger"><ArrowUpOutlined /> {formatBytes(record.outBytes)}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{formatRate(record.outBytesRate)}</Text>
        </Space>
      ),
    },
    {
      title: '利用率',
      dataIndex: 'utilization',
      width: 150,
      render: (util) => (
        <Progress
          percent={util}
          size="small"
          status={util > 80 ? 'exception' : util > 60 ? 'active' : 'success'}
          strokeColor={util > 80 ? '#ff4d4f' : util > 60 ? '#faad14' : '#52c41a'}
        />
      ),
    },
    {
      title: '错误',
      key: 'errors',
      width: 100,
      render: (_, record) => (
        <Tooltip title={`入错: ${record.inErrors}, 出错: ${record.outErrors}`}>
          <Tag color={record.inErrors + record.outErrors > 0 ? 'warning' : 'success'}>
            {record.inErrors + record.outErrors}
          </Tag>
        </Tooltip>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px 32px' }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <Col>
          <Title level={3} style={{ margin: 0 }}>
            <LineChartOutlined style={{ marginRight: 12 }} />
            流量分析
          </Title>
        </Col>
        <Col>
          <Space>
            <Select
              placeholder="选择设备"
              style={{ width: 240 }}
              onChange={(value) => { setSelectedDevice(value); fetchInterfaces(value); }}
              showSearch
              filterOption={(input, opt) => opt.children.toLowerCase().includes(input.toLowerCase())}
            >
              {devices.map(d => (
                <Select.Option key={d.id} value={d.id}>{d.name}</Select.Option>
              ))}
            </Select>
            <Button icon={<ReloadOutlined />} onClick={() => { fetchOverview(); if (selectedDevice) fetchInterfaces(selectedDevice); }}>
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
                title="总入流量"
                value={formatBytes(overview.summary.totalInBytes)}
                prefix={<ArrowDownOutlined style={{ color: '#52c41a' }} />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="总出流量"
                value={formatBytes(overview.summary.totalOutBytes)}
                prefix={<ArrowUpOutlined style={{ color: '#ff4d4f' }} />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="平均利用率"
                value={overview.summary.avgUtilization}
                suffix="%"
                prefix={<ThunderboltOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="高负载接口"
                value={overview.summary.highUtilizationCount}
                valueStyle={{ color: overview.summary.highUtilizationCount > 0 ? '#ff4d4f' : '#52c41a' }}
              />
            </Card>
          </Col>
        </Row>
      )}

      <Row gutter={24}>
        <Col span={16}>
          <Card title="接口流量详情" extra={selectedDevice ? <Tag>{devices.find(d => d.id === selectedDevice)?.name}</Tag> : null}>
            {selectedDevice ? (
              <Table
                columns={columns}
                dataSource={interfaces}
                rowKey="interfaceName"
                loading={loading}
                pagination={false}
                size="middle"
              />
            ) : (
              <div style={{ textAlign: 'center', padding: 48, color: '#999' }}>
                请选择设备查看接口流量
              </div>
            )}
          </Card>
        </Col>
        <Col span={8}>
          <Card title="TOP5 高负载接口" style={{ marginBottom: 24 }}>
            {overview?.topInterfaces?.map((item, idx) => (
              <div key={idx} style={{ marginBottom: 12 }}>
                <Row justify="space-between">
                  <Text>{item.deviceName} - {item.interface}</Text>
                  <Text strong style={{ color: item.utilization > 80 ? '#ff4d4f' : undefined }}>
                    {item.utilization}%
                  </Text>
                </Row>
                <Progress
                  percent={item.utilization}
                  size="small"
                  showInfo={false}
                  status={item.utilization > 80 ? 'exception' : 'active'}
                />
              </div>
            ))}
          </Card>
          <Card title="TOP5 流量设备">
            {overview?.topDevices?.map((item, idx) => (
              <div key={idx} style={{ marginBottom: 12, padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}>
                <Text strong>{item.deviceName}</Text>
                <Row justify="space-between" style={{ marginTop: 4 }}>
                  <Text type="success"><ArrowDownOutlined /> {formatBytes(item.inBytes)}</Text>
                  <Text type="danger"><ArrowUpOutlined /> {formatBytes(item.outBytes)}</Text>
                </Row>
              </div>
            ))}
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default TrafficAnalysis;
