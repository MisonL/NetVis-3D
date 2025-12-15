import React, { useState, useEffect } from 'react';
import { Card, Button, Space, Tag, Typography, Row, Col, Statistic, Form, Input, Select, Tabs, List, Divider, Progress, message, Table, Alert } from 'antd';
import { MedicineBoxOutlined, ReloadOutlined, WifiOutlined, DashboardOutlined, SafetyOutlined, SettingOutlined, CheckCircleOutlined, CloseCircleOutlined, WarningOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const NetworkDiagnostics = () => {
  const [loading, setLoading] = useState(false);
  const [connectivityResult, setConnectivityResult] = useState(null);
  const [performanceResult, setPerformanceResult] = useState(null);
  const [securityResult, setSecurityResult] = useState(null);
  const [stats, setStats] = useState(null);

  const getToken = () => localStorage.getItem('token');

  const fetchData = async () => {
    try {
      const statsRes = await fetch(`${API_BASE}/api/diagnostics/stats`, { headers: { Authorization: `Bearer ${getToken()}` } });
      const statsData = await statsRes.json();
      if (statsData.code === 0) setStats(statsData.data);
    } catch { /* ignore */ }
  };

  useEffect(() => { 
    fetchData(); 
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runDiagnostic = async (type, data, setResult) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/diagnostics/${type}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (result.code === 0) { setResult(result.data); fetchData(); }
      else message.error(result.message);
    } catch { message.error('诊断失败'); } finally { setLoading(false); }
  };

  const tabItems = [
    {
      key: 'connectivity',
      label: <><WifiOutlined /> 连通性诊断</>,
      children: (
        <div>
          <Form layout="inline" onFinish={(v) => runDiagnostic('connectivity', v, setConnectivityResult)}>
            <Form.Item name="source" label="源" rules={[{ required: true }]}><Input placeholder="设备IP" style={{ width: 150 }} /></Form.Item>
            <Form.Item name="target" label="目标" rules={[{ required: true }]}><Input placeholder="目标IP" style={{ width: 150 }} /></Form.Item>
            <Form.Item name="protocol" label="协议"><Select defaultValue="icmp" style={{ width: 100 }} options={[{ value: 'icmp', label: 'ICMP' }, { value: 'tcp', label: 'TCP' }, { value: 'udp', label: 'UDP' }]} /></Form.Item>
            <Form.Item><Button type="primary" htmlType="submit" loading={loading}>诊断</Button></Form.Item>
          </Form>
          {connectivityResult && (
            <Card size="small" style={{ marginTop: 16 }}>
              <Alert type={connectivityResult.reachable ? 'success' : 'error'} message={connectivityResult.reachable ? '可达' : '不可达'} style={{ marginBottom: 16 }} />
              <Row gutter={16}>
                <Col span={8}><Statistic title="延迟" value={connectivityResult.latency?.toFixed(2)} suffix="ms" /></Col>
                <Col span={8}><Statistic title="跳数" value={connectivityResult.hops} /></Col>
                <Col span={8}><Statistic title="丢包率" value={connectivityResult.packetLoss?.toFixed(2)} suffix="%" /></Col>
              </Row>
            </Card>
          )}
        </div>
      ),
    },
    {
      key: 'performance',
      label: <><DashboardOutlined /> 性能诊断</>,
      children: (
        <div>
          <Form layout="inline" onFinish={(v) => runDiagnostic('performance', v, setPerformanceResult)}>
            <Form.Item name="deviceId" label="设备ID" rules={[{ required: true }]}><Input placeholder="device-001" style={{ width: 200 }} /></Form.Item>
            <Form.Item><Button type="primary" htmlType="submit" loading={loading}>诊断</Button></Form.Item>
          </Form>
          {performanceResult && (
            <Card size="small" style={{ marginTop: 16 }}>
              <Row gutter={16}>
                <Col span={12}><Text strong>CPU</Text><Progress percent={performanceResult.cpu?.current} strokeColor={performanceResult.cpu?.current > 80 ? '#f5222d' : '#52c41a'} /></Col>
                <Col span={12}><Text strong>内存</Text><Progress percent={performanceResult.memory?.current} strokeColor={performanceResult.memory?.current > 80 ? '#f5222d' : '#52c41a'} /></Col>
              </Row>
              {performanceResult.issues?.length > 0 && <Alert type="warning" style={{ marginTop: 16 }} message={performanceResult.issues.map(i => i.message).join('; ')} />}
            </Card>
          )}
        </div>
      ),
    },
    {
      key: 'security',
      label: <><SafetyOutlined /> 安全诊断</>,
      children: (
        <div>
          <Form layout="inline" onFinish={(v) => runDiagnostic('security', v, setSecurityResult)}>
            <Form.Item name="deviceId" label="设备ID" rules={[{ required: true }]}><Input placeholder="device-001" style={{ width: 200 }} /></Form.Item>
            <Form.Item><Button type="primary" htmlType="submit" loading={loading}>诊断</Button></Form.Item>
          </Form>
          {securityResult && (
            <Card size="small" style={{ marginTop: 16 }}>
              <Row gutter={16} style={{ marginBottom: 16 }}>
                <Col span={6}><Statistic title="安全评分" value={securityResult.score} suffix="/100" valueStyle={{ color: securityResult.score > 80 ? '#52c41a' : '#faad14' }} /></Col>
                <Col span={6}><Statistic title="漏洞数" value={securityResult.vulnerabilities} valueStyle={{ color: securityResult.vulnerabilities > 0 ? '#f5222d' : '#52c41a' }} /></Col>
                <Col span={6}><Statistic title="开放端口" value={securityResult.openPorts?.length} /></Col>
                <Col span={6}><Statistic title="弱密码" valueRender={() => securityResult.weakPasswords ? <Tag color="red">是</Tag> : <Tag color="green">否</Tag>} /></Col>
              </Row>
              {securityResult.recommendations?.length > 0 && (
                <List size="small" header={<Text strong>安全建议</Text>} dataSource={securityResult.recommendations} renderItem={(item) => <List.Item><WarningOutlined style={{ color: '#faad14', marginRight: 8 }} />{item}</List.Item>} />
              )}
            </Card>
          )}
        </div>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px 32px' }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <Col><Title level={3} style={{ margin: 0 }}><MedicineBoxOutlined style={{ marginRight: 12 }} />网络诊断</Title></Col>
        <Col><Button icon={<ReloadOutlined />} onClick={fetchData}>刷新</Button></Col>
      </Row>

      {stats && (
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={6}><Card size="small"><Statistic title="诊断总数" value={stats.total} /></Card></Col>
          <Col span={6}><Card size="small"><Statistic title="连通性" value={stats.byType?.connectivity || 0} /></Card></Col>
          <Col span={6}><Card size="small"><Statistic title="性能" value={stats.byType?.performance || 0} /></Card></Col>
          <Col span={6}><Card size="small"><Statistic title="成功率" value={stats.successRate} valueStyle={{ color: '#52c41a' }} /></Card></Col>
        </Row>
      )}

      <Card><Tabs items={tabItems} /></Card>
    </div>
  );
};

export default NetworkDiagnostics;
