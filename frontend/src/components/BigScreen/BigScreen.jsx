import React, { useState, useEffect, useRef } from 'react';
import { 
  Card, 
  Row, 
  Col, 
  Statistic,
  Progress,
  Tag,
  Typography,
  Button,
  Space,
  message
} from 'antd';
import { 
  FullscreenOutlined, 
  FullscreenExitOutlined,
  ReloadOutlined,
  DesktopOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined
} from '@ant-design/icons';

const { Title, Text } = Typography;

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const BigScreen = () => {
  const [data, setData] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const containerRef = useRef(null);

  const getToken = () => localStorage.getItem('token');

  const fetchData = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/bigscreen/data`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const result = await res.json();
      if (result.code === 0) {
        setData(result.data);
      }
    } catch {
      message.error('获取数据失败');
    }
  };

  useEffect(() => {
    fetchData();
    const dataInterval = setInterval(fetchData, 30000);
    const timeInterval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => {
      clearInterval(dataInterval);
      clearInterval(timeInterval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const cardStyle = {
    background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
    border: '1px solid #0f3460',
    borderRadius: 12,
  };

  const textColor = '#e0e0e0';
  const titleColor = '#00d4ff';

  return (
    <div
      ref={containerRef}
      style={{
        background: 'linear-gradient(135deg, #0a0a1a 0%, #1a1a3e 50%, #0d0d2b 100%)',
        minHeight: '100vh',
        padding: 24,
        color: textColor,
      }}
    >
      {/* 顶部标题栏 */}
      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <Col>
          <Title level={2} style={{ color: titleColor, margin: 0, textShadow: '0 0 10px rgba(0,212,255,0.5)' }}>
            🖥️ 网络监控大屏
          </Title>
        </Col>
        <Col>
          <Space size="large">
            <div style={{ textAlign: 'center' }}>
              <ClockCircleOutlined style={{ fontSize: 24, color: titleColor }} />
              <div style={{ fontSize: 28, fontWeight: 'bold', color: '#fff' }}>
                {currentTime.toLocaleTimeString()}
              </div>
              <div style={{ color: '#888' }}>{currentTime.toLocaleDateString()}</div>
            </div>
            <Button icon={<ReloadOutlined />} onClick={fetchData} ghost>刷新</Button>
            <Button 
              icon={isFullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />} 
              onClick={toggleFullscreen}
              type="primary"
            >
              {isFullscreen ? '退出全屏' : '全屏'}
            </Button>
          </Space>
        </Col>
      </Row>

      {data && (
        <>
          {/* 设备状态概览 */}
          <Row gutter={24} style={{ marginBottom: 24 }}>
            <Col span={4}>
              <Card style={cardStyle} bodyStyle={{ padding: 16 }}>
                <Statistic
                  title={<span style={{ color: '#888' }}>设备总数</span>}
                  value={data.deviceStats.total}
                  valueStyle={{ color: titleColor, fontSize: 36 }}
                  prefix={<DesktopOutlined />}
                />
              </Card>
            </Col>
            <Col span={4}>
              <Card style={cardStyle} bodyStyle={{ padding: 16 }}>
                <Statistic
                  title={<span style={{ color: '#888' }}>在线设备</span>}
                  value={data.deviceStats.online}
                  valueStyle={{ color: '#52c41a', fontSize: 36 }}
                  prefix={<CheckCircleOutlined />}
                />
              </Card>
            </Col>
            <Col span={4}>
              <Card style={cardStyle} bodyStyle={{ padding: 16 }}>
                <Statistic
                  title={<span style={{ color: '#888' }}>离线设备</span>}
                  value={data.deviceStats.offline}
                  valueStyle={{ color: '#ff4d4f', fontSize: 36 }}
                  prefix={<CloseCircleOutlined />}
                />
              </Card>
            </Col>
            <Col span={4}>
              <Card style={cardStyle} bodyStyle={{ padding: 16 }}>
                <Statistic
                  title={<span style={{ color: '#888' }}>告警总数</span>}
                  value={data.alertStats.total}
                  valueStyle={{ color: '#faad14', fontSize: 36 }}
                  prefix={<WarningOutlined />}
                />
              </Card>
            </Col>
            <Col span={4}>
              <Card style={cardStyle} bodyStyle={{ padding: 16 }}>
                <Statistic
                  title={<span style={{ color: '#888' }}>严重告警</span>}
                  value={data.alertStats.critical}
                  valueStyle={{ color: '#ff4d4f', fontSize: 36 }}
                />
              </Card>
            </Col>
            <Col span={4}>
              <Card style={cardStyle} bodyStyle={{ padding: 16 }}>
                <div style={{ textAlign: 'center' }}>
                  <Text style={{ color: '#888' }}>在线率</Text>
                  <Progress
                    type="circle"
                    percent={Math.round(data.deviceStats.online / data.deviceStats.total * 100)}
                    strokeColor={{ '0%': '#00d4ff', '100%': '#52c41a' }}
                    trailColor="#333"
                    size={80}
                  />
                </div>
              </Card>
            </Col>
          </Row>

          {/* 主要内容区域 */}
          <Row gutter={24}>
            {/* 流量趋势 */}
            <Col span={12}>
              <Card 
                title={<span style={{ color: titleColor }}>📊 流量趋势 (24h)</span>} 
                style={cardStyle}
                bodyStyle={{ height: 200 }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-end', height: '100%', gap: 4 }}>
                  {data.trafficData.slice(-12).map((item, idx) => (
                    <div key={idx} style={{ flex: 1, textAlign: 'center' }}>
                      <div 
                        style={{ 
                          height: item.inbound / 15, 
                          background: 'linear-gradient(180deg, #00d4ff 0%, #0066ff 100%)',
                          borderRadius: '4px 4px 0 0',
                          marginBottom: 4,
                        }} 
                      />
                      <Text style={{ fontSize: 10, color: '#666' }}>{item.time}</Text>
                    </div>
                  ))}
                </div>
              </Card>
            </Col>

            {/* TOP设备 */}
            <Col span={6}>
              <Card 
                title={<span style={{ color: titleColor }}>🔥 TOP设备负载</span>} 
                style={cardStyle}
                bodyStyle={{ height: 200 }}
              >
                {data.topDevices.map((device, idx) => (
                  <div key={idx} style={{ marginBottom: 12 }}>
                    <Row justify="space-between">
                      <Text style={{ color: textColor }}>{device.name}</Text>
                      <Text style={{ color: device.cpu > 70 ? '#ff4d4f' : '#52c41a' }}>{device.cpu}%</Text>
                    </Row>
                    <Progress 
                      percent={device.cpu} 
                      size="small" 
                      showInfo={false}
                      strokeColor={device.cpu > 70 ? '#ff4d4f' : '#52c41a'}
                      trailColor="#333"
                    />
                  </div>
                ))}
              </Card>
            </Col>

            {/* 最新告警 */}
            <Col span={6}>
              <Card 
                title={<span style={{ color: titleColor }}>🔔 最新告警</span>} 
                style={cardStyle}
                bodyStyle={{ height: 200, overflow: 'auto' }}
              >
                {data.recentAlerts.map((alert, idx) => (
                  <div key={idx} style={{ marginBottom: 8, padding: 8, background: 'rgba(255,255,255,0.05)', borderRadius: 4 }}>
                    <Tag color={alert.severity === 'critical' ? 'red' : alert.severity === 'warning' ? 'orange' : 'blue'}>
                      {alert.severity}
                    </Tag>
                    <Text style={{ color: textColor, fontSize: 12 }}>{alert.message || '告警信息'}</Text>
                  </div>
                ))}
              </Card>
            </Col>
          </Row>
        </>
      )}
    </div>
  );
};

export default BigScreen;
