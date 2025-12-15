import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Space, Tag, Typography, Row, Col, Statistic, Select, Input } from 'antd';
import { FileSearchOutlined, ReloadOutlined, SearchOutlined, InfoCircleOutlined, WarningOutlined, CloseCircleOutlined, ExclamationCircleOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;
const { Search } = Input;
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const LogAnalysis = () => {
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState(null);
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({ level: null, device: null });

  const getToken = () => localStorage.getItem('token');

  const fetchAll = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.level) params.append('level', filters.level);
      if (filters.device) params.append('device', filters.device);
      
      const [logsRes, statsRes, devicesRes] = await Promise.all([
        fetch(`${API_BASE}/api/log-analysis?${params}`, { headers: { Authorization: `Bearer ${getToken()}` } }),
        fetch(`${API_BASE}/api/log-analysis/stats`, { headers: { Authorization: `Bearer ${getToken()}` } }),
        fetch(`${API_BASE}/api/log-analysis/devices`, { headers: { Authorization: `Bearer ${getToken()}` } }),
      ]);
      const [logsData, statsData, devicesData] = await Promise.all([logsRes.json(), statsRes.json(), devicesRes.json()]);
      if (logsData.code === 0) setLogs(logsData.data || []);
      if (statsData.code === 0) setStats(statsData.data);
      if (devicesData.code === 0) setDevices(devicesData.data || []);
    } catch { /* ignore */ } finally { setLoading(false); }
  };

  useEffect(() => { 
    fetchAll(); 
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const handleSearch = async (query) => {
    if (!query) { fetchAll(); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/log-analysis/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ query }),
      });
      const data = await res.json();
      if (data.code === 0) setLogs(data.data.logs || []);
    } catch { /* ignore */ } finally { setLoading(false); }
  };

  const getLevelIcon = (level) => {
    const map = { info: <InfoCircleOutlined style={{ color: '#1677ff' }} />, warning: <WarningOutlined style={{ color: '#faad14' }} />, error: <CloseCircleOutlined style={{ color: '#f5222d' }} />, critical: <ExclamationCircleOutlined style={{ color: '#cf1322' }} /> };
    return map[level] || null;
  };

  const columns = [
    { title: '时间', dataIndex: 'timestamp', render: (t) => new Date(t).toLocaleString(), width: 180 },
    { title: '级别', dataIndex: 'level', render: (l) => <>{getLevelIcon(l)} <Tag color={l === 'critical' ? 'red' : l === 'error' ? 'orange' : l === 'warning' ? 'gold' : 'blue'}>{l.toUpperCase()}</Tag></>, width: 120 },
    { title: '设备', dataIndex: 'device', width: 120 },
    { title: '类别', dataIndex: 'facility', width: 80 },
    { title: '消息', dataIndex: 'message', ellipsis: true },
  ];

  return (
    <div style={{ padding: '24px 32px' }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <Col><Title level={3} style={{ margin: 0 }}><FileSearchOutlined style={{ marginRight: 12 }} />日志分析</Title></Col>
        <Col><Button icon={<ReloadOutlined />} onClick={fetchAll}>刷新</Button></Col>
      </Row>

      {stats && (
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={4}><Card size="small"><Statistic title="总日志" value={stats.total} /></Card></Col>
          <Col span={5}><Card size="small"><Statistic title="信息" value={stats.byLevel.info} prefix={<InfoCircleOutlined />} /></Card></Col>
          <Col span={5}><Card size="small"><Statistic title="警告" value={stats.byLevel.warning} valueStyle={{ color: '#faad14' }} prefix={<WarningOutlined />} /></Card></Col>
          <Col span={5}><Card size="small"><Statistic title="错误" value={stats.byLevel.error} valueStyle={{ color: '#f5222d' }} prefix={<CloseCircleOutlined />} /></Card></Col>
          <Col span={5}><Card size="small"><Statistic title="严重" value={stats.byLevel.critical} valueStyle={{ color: '#cf1322' }} prefix={<ExclamationCircleOutlined />} /></Card></Col>
        </Row>
      )}

      <Card>
        <Space style={{ marginBottom: 16 }}>
          <Search placeholder="搜索日志..." onSearch={handleSearch} style={{ width: 300 }} allowClear />
          <Select placeholder="日志级别" allowClear style={{ width: 120 }} onChange={(v) => setFilters({ ...filters, level: v })} options={[{ value: 'info', label: 'INFO' }, { value: 'warning', label: 'WARNING' }, { value: 'error', label: 'ERROR' }, { value: 'critical', label: 'CRITICAL' }]} />
          <Select placeholder="设备" allowClear style={{ width: 150 }} onChange={(v) => setFilters({ ...filters, device: v })} options={devices.map(d => ({ value: d, label: d }))} />
        </Space>
        <Table columns={columns} dataSource={logs} rowKey="id" loading={loading} size="small" pagination={{ pageSize: 20 }} />
      </Card>
    </div>
  );
};

export default LogAnalysis;
