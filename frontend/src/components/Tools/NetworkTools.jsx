import React, { useState } from 'react';
import { Card, Button, Space, Tag, Typography, Row, Col, Form, Input, InputNumber, Tabs, List, Divider, message, Table } from 'antd';
import { ToolOutlined, WifiOutlined, GlobalOutlined, ScanOutlined, CalculatorOutlined, RocketOutlined } from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const NetworkTools = () => {
  const [loading, setLoading] = useState(false);
  const [pingResult, setPingResult] = useState(null);
  const [tracerouteResult, setTracerouteResult] = useState(null);
  const [dnsResult, setDnsResult] = useState(null);
  const [calcResult, setCalcResult] = useState(null);

  const getToken = () => localStorage.getItem('token');

  const runTool = async (tool, data, setResult) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/network-tools/${tool}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (result.code === 0) setResult(result.data);
      else message.error(result.message);
    } catch { message.error('执行失败'); } finally { setLoading(false); }
  };

  const tabItems = [
    {
      key: 'ping',
      label: <><WifiOutlined /> Ping</>,
      children: (
        <div>
          <Form layout="inline" onFinish={(v) => runTool('ping', v, setPingResult)}>
            <Form.Item name="target" label="目标" rules={[{ required: true }]}><Input placeholder="IP或域名" style={{ width: 200 }} /></Form.Item>
            <Form.Item name="count" label="次数"><InputNumber min={1} max={20} defaultValue={4} /></Form.Item>
            <Form.Item><Button type="primary" htmlType="submit" loading={loading}>执行</Button></Form.Item>
          </Form>
          {pingResult && (
            <Card size="small" style={{ marginTop: 16 }}>
              <Text strong>Ping {pingResult.target}</Text>
              <Divider />
              <List size="small" dataSource={pingResult.results} renderItem={(r) => (
                <List.Item><Tag color={r.success ? 'green' : 'red'}>{r.success ? `${r.time.toFixed(2)}ms` : 'timeout'}</Tag> seq={r.seq} ttl={r.ttl}</List.Item>
              )} />
              <Divider />
              <Text>发送: {pingResult.stats.sent} | 接收: {pingResult.stats.received} | 丢包: {pingResult.stats.loss}</Text><br/>
              <Text>延迟 min/avg/max: {pingResult.stats.min}/{pingResult.stats.avg}/{pingResult.stats.max} ms</Text>
            </Card>
          )}
        </div>
      ),
    },
    {
      key: 'traceroute',
      label: <><GlobalOutlined /> Traceroute</>,
      children: (
        <div>
          <Form layout="inline" onFinish={(v) => runTool('traceroute', v, setTracerouteResult)}>
            <Form.Item name="target" label="目标" rules={[{ required: true }]}><Input placeholder="IP或域名" style={{ width: 200 }} /></Form.Item>
            <Form.Item><Button type="primary" htmlType="submit" loading={loading}>执行</Button></Form.Item>
          </Form>
          {tracerouteResult && (
            <Card size="small" style={{ marginTop: 16 }}>
              <Table size="small" dataSource={tracerouteResult.hops} rowKey="hop" columns={[
                { title: '跳数', dataIndex: 'hop', width: 60 },
                { title: 'IP', dataIndex: 'ip', width: 150 },
                { title: '主机名', dataIndex: 'hostname' },
                { title: 'RTT', dataIndex: 'rtt', render: (r) => r.map(t => t.toFixed(1) + 'ms').join(' / ') },
              ]} pagination={false} />
            </Card>
          )}
        </div>
      ),
    },
    {
      key: 'dns',
      label: <><ScanOutlined /> DNS</>,
      children: (
        <div>
          <Form layout="inline" onFinish={(v) => runTool('dns', v, setDnsResult)}>
            <Form.Item name="hostname" label="域名" rules={[{ required: true }]}><Input placeholder="example.com" style={{ width: 200 }} /></Form.Item>
            <Form.Item><Button type="primary" htmlType="submit" loading={loading}>查询</Button></Form.Item>
          </Form>
          {dnsResult && (
            <Card size="small" style={{ marginTop: 16 }}>
              <Text strong>DNS查询结果: {dnsResult.hostname}</Text>
              <List size="small" dataSource={dnsResult.records} renderItem={(r) => (
                <List.Item><Tag color="blue">{r.type}</Tag> {r.value} TTL={r.ttl}</List.Item>
              )} />
            </Card>
          )}
        </div>
      ),
    },
    {
      key: 'calculator',
      label: <><CalculatorOutlined /> 子网计算器</>,
      children: (
        <div>
          <Form layout="inline" onFinish={(v) => runTool('calculator', v, setCalcResult)}>
            <Form.Item name="ip" label="IP地址" rules={[{ required: true }]}><Input placeholder="192.168.1.0" style={{ width: 150 }} /></Form.Item>
            <Form.Item name="cidr" label="CIDR" rules={[{ required: true }]}><InputNumber min={8} max={30} style={{ width: 80 }} /></Form.Item>
            <Form.Item><Button type="primary" htmlType="submit" loading={loading}>计算</Button></Form.Item>
          </Form>
          {calcResult && (
            <Card size="small" style={{ marginTop: 16 }}>
              <Row gutter={16}>
                <Col span={8}><Text type="secondary">网络地址:</Text> <Text strong>{calcResult.network}</Text></Col>
                <Col span={8}><Text type="secondary">广播地址:</Text> <Text strong>{calcResult.broadcast}</Text></Col>
                <Col span={8}><Text type="secondary">子网掩码:</Text> <Text strong>{calcResult.subnetMask}</Text></Col>
              </Row>
              <Row gutter={16} style={{ marginTop: 8 }}>
                <Col span={8}><Text type="secondary">首个主机:</Text> <Text strong>{calcResult.firstHost}</Text></Col>
                <Col span={8}><Text type="secondary">最后主机:</Text> <Text strong>{calcResult.lastHost}</Text></Col>
                <Col span={8}><Text type="secondary">可用主机数:</Text> <Text strong>{calcResult.totalHosts}</Text></Col>
              </Row>
            </Card>
          )}
        </div>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px 32px' }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <Col><Title level={3} style={{ margin: 0 }}><ToolOutlined style={{ marginRight: 12 }} />网络工具</Title></Col>
      </Row>
      <Card><Tabs items={tabItems} /></Card>
    </div>
  );
};

export default NetworkTools;
