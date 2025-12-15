import React, { useState, useEffect, useCallback } from 'react';
import { 
  Drawer, Descriptions, Tag, Button, Space, Tabs, Timeline, 
  Statistic, Row, Col, Progress, Card, Typography, Spin, message 
} from 'antd';
import { 
  CloudServerOutlined, WifiOutlined, DesktopOutlined, 
  SafetyCertificateOutlined, GlobalOutlined, ClockCircleOutlined,
  EditOutlined, DeleteOutlined, ReloadOutlined
} from '@ant-design/icons';
import { useAuth } from '../../context/AuthContext';

const { Text, Title } = Typography;

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const DeviceDrawer = ({ visible, deviceId, onClose, onEdit, onDelete }) => {
  const { token } = useAuth();
  const [device, setDevice] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('info');

  const fetchDevice = useCallback(async () => {
    if (!deviceId) return;
    
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/devices/${deviceId}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.code === 0) {
        setDevice(data.data);
      } else {
        message.error('获取设备信息失败');
      }
    } catch {
      message.error('获取设备信息失败');
    } finally {
      setLoading(false);
    }
  }, [deviceId, token]);

  useEffect(() => {
    if (visible && deviceId) {
      fetchDevice();
    }
  }, [visible, deviceId, fetchDevice]);

  const getDeviceIcon = (type) => {
    const icons = {
      router: <GlobalOutlined style={{ fontSize: 32, color: '#1677ff' }} />,
      switch: <WifiOutlined style={{ fontSize: 32, color: '#52c41a' }} />,
      firewall: <SafetyCertificateOutlined style={{ fontSize: 32, color: '#fa541c' }} />,
      server: <CloudServerOutlined style={{ fontSize: 32, color: '#722ed1' }} />,
      ap: <WifiOutlined style={{ fontSize: 32, color: '#13c2c2' }} />,
      other: <DesktopOutlined style={{ fontSize: 32, color: '#8c8c8c' }} />,
    };
    return icons[type] || icons.other;
  };

  const getStatusTag = (status) => {
    const config = {
      online: { color: 'success', text: '在线' },
      offline: { color: 'default', text: '离线' },
      warning: { color: 'warning', text: '告警' },
      error: { color: 'error', text: '故障' },
      unknown: { color: 'default', text: '未知' },
    };
    const c = config[status] || config.unknown;
    return <Tag color={c.color}>{c.text}</Tag>;
  };

  const tabItems = [
    {
      key: 'info',
      label: '基本信息',
      children: device && (
        <Descriptions column={1} bordered size="small">
          <Descriptions.Item label="设备名称">{device.name}</Descriptions.Item>
          <Descriptions.Item label="设备标签">{device.label || '-'}</Descriptions.Item>
          <Descriptions.Item label="设备类型">
            <Tag>{device.type}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="状态">
            {getStatusTag(device.status)}
          </Descriptions.Item>
          <Descriptions.Item label="厂商">{device.vendor || '-'}</Descriptions.Item>
          <Descriptions.Item label="型号">{device.model || '-'}</Descriptions.Item>
          <Descriptions.Item label="IP 地址">
            <Text code>{device.ipAddress || '-'}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="MAC 地址">
            <Text code>{device.macAddress || '-'}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="位置">{device.location || '-'}</Descriptions.Item>
          <Descriptions.Item label="最后在线">
            {device.lastSeen ? new Date(device.lastSeen).toLocaleString() : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="创建时间">
            {new Date(device.createdAt).toLocaleString()}
          </Descriptions.Item>
        </Descriptions>
      ),
    },
    {
      key: 'metrics',
      label: '性能指标',
      children: (
        <Row gutter={[16, 16]}>
          <Col span={12}>
            <Card size="small">
              <Statistic 
                title="CPU 使用率" 
                value={Math.round(Math.random() * 100)} 
                suffix="%" 
                valueStyle={{ color: '#1677ff' }}
              />
              <Progress percent={Math.round(Math.random() * 100)} showInfo={false} strokeColor="#1677ff" size="small" />
            </Card>
          </Col>
          <Col span={12}>
            <Card size="small">
              <Statistic 
                title="内存使用率" 
                value={Math.round(Math.random() * 100)} 
                suffix="%" 
                valueStyle={{ color: '#52c41a' }}
              />
              <Progress percent={Math.round(Math.random() * 100)} showInfo={false} strokeColor="#52c41a" size="small" />
            </Card>
          </Col>
          <Col span={12}>
            <Card size="small">
              <Statistic 
                title="入站流量" 
                value={Math.round(Math.random() * 1000)} 
                suffix="Mbps" 
              />
            </Card>
          </Col>
          <Col span={12}>
            <Card size="small">
              <Statistic 
                title="出站流量" 
                value={Math.round(Math.random() * 1000)} 
                suffix="Mbps" 
              />
            </Card>
          </Col>
        </Row>
      ),
    },
    {
      key: 'history',
      label: '变更历史',
      children: (
        <Timeline
          items={[
            {
              color: 'green',
              children: (
                <>
                  <Text>设备创建</Text>
                  <br />
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {device?.createdAt ? new Date(device.createdAt).toLocaleString() : '-'}
                  </Text>
                </>
              ),
            },
            {
              color: 'blue',
              children: (
                <>
                  <Text>状态更新为在线</Text>
                  <br />
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {new Date().toLocaleString()}
                  </Text>
                </>
              ),
            },
          ]}
        />
      ),
    },
  ];

  return (
    <Drawer
      title={null}
      placement="right"
      width={520}
      open={visible}
      onClose={onClose}
      styles={{
        mask: { backdropFilter: 'blur(4px)' },
        body: { padding: 0 },
      }}
    >
      {loading ? (
        <div style={{ padding: 40, textAlign: 'center' }}>
          <Spin size="large" />
        </div>
      ) : device ? (
        <>
          {/* Header */}
          <div style={{
            padding: '24px',
            background: 'linear-gradient(135deg, rgba(22, 119, 255, 0.1) 0%, rgba(0, 240, 255, 0.05) 100%)',
            borderBottom: '1px solid var(--glass-border)',
          }}>
            <Space align="start">
              <div style={{
                width: 64,
                height: 64,
                borderRadius: 12,
                background: 'rgba(255,255,255,0.8)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                {getDeviceIcon(device.type)}
              </div>
              <div>
                <Title level={4} style={{ margin: 0 }}>{device.name}</Title>
                <Space style={{ marginTop: 8 }}>
                  {getStatusTag(device.status)}
                  <Text type="secondary">{device.ipAddress}</Text>
                </Space>
              </div>
            </Space>
            
            <Space style={{ marginTop: 16 }}>
              <Button icon={<ReloadOutlined />} onClick={fetchDevice}>刷新</Button>
              <Button icon={<EditOutlined />} onClick={() => onEdit?.(device)}>编辑</Button>
              <Button danger icon={<DeleteOutlined />} onClick={() => onDelete?.(device)}>删除</Button>
            </Space>
          </div>

          {/* Tabs */}
          <div style={{ padding: '0 24px 24px' }}>
            <Tabs
              activeKey={activeTab}
              onChange={setActiveTab}
              items={tabItems}
            />
          </div>
        </>
      ) : (
        <div style={{ padding: 40, textAlign: 'center' }}>
          <Text type="secondary">未找到设备信息</Text>
        </div>
      )}
    </Drawer>
  );
};

export default DeviceDrawer;
