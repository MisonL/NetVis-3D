import React, { useState, useEffect } from 'react';
import { Card, Button, Space, Tag, Typography, Row, Col, Statistic, Table, Modal, Select, message } from 'antd';
import { ExportOutlined, FileImageOutlined, FileTextOutlined, ReloadOutlined, DownloadOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const TopologyExport = () => {
  const [history, setHistory] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [previewModal, setPreviewModal] = useState(null);
  const [svgContent, setSvgContent] = useState('');

  const getToken = () => localStorage.getItem('token');

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [historyRes, statsRes] = await Promise.all([
        fetch(`${API_BASE}/api/topology-export/history`, { headers: { Authorization: `Bearer ${getToken()}` } }),
        fetch(`${API_BASE}/api/topology-export/stats`, { headers: { Authorization: `Bearer ${getToken()}` } }),
      ]);
      const [historyData, statsData] = await Promise.all([historyRes.json(), statsRes.json()]);
      if (historyData.code === 0) setHistory(historyData.data || []);
      if (statsData.code === 0) setStats(statsData.data);
    } catch { /* ignore */ } finally { setLoading(false); }
  };

  useEffect(() => { 
    fetchAll(); 
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleExport = async (format) => {
    try {
      const res = await fetch(`${API_BASE}/api/topology-export/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ format }),
      });
      const data = await res.json();
      if (data.code === 0) { message.success(`${format.toUpperCase()}导出成功`); fetchAll(); }
    } catch { message.error('导出失败'); }
  };

  const handlePreviewSvg = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/topology-export/svg`, { headers: { Authorization: `Bearer ${getToken()}` } });
      const svg = await res.text();
      setSvgContent(svg);
      setPreviewModal('svg');
    } catch { message.error('预览失败'); }
  };

  const columns = [
    { title: '文件名', dataIndex: 'fileName', ellipsis: true },
    { title: '格式', dataIndex: 'format', render: (f) => <Tag color={f === 'svg' ? 'blue' : f === 'png' ? 'green' : f === 'json' ? 'purple' : 'orange'}>{f.toUpperCase()}</Tag> },
    { title: '大小', dataIndex: 'fileSize', render: (s) => `${(s / 1024).toFixed(1)} KB` },
    { title: '时间', dataIndex: 'createdAt', render: (t) => new Date(t).toLocaleString() },
  ];

  return (
    <div style={{ padding: '24px 32px' }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <Col><Title level={3} style={{ margin: 0 }}><ExportOutlined style={{ marginRight: 12 }} />拓扑导出</Title></Col>
        <Col><Button icon={<ReloadOutlined />} onClick={fetchAll}>刷新</Button></Col>
      </Row>

      {stats && (
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={6}><Card size="small"><Statistic title="导出总数" value={stats.total} /></Card></Col>
          <Col span={6}><Card size="small"><Statistic title="SVG" value={stats.byFormat?.svg || 0} /></Card></Col>
          <Col span={6}><Card size="small"><Statistic title="PNG" value={stats.byFormat?.png || 0} /></Card></Col>
          <Col span={6}><Card size="small"><Statistic title="JSON" value={stats.byFormat?.json || 0} /></Card></Col>
        </Row>
      )}

      <Card title="导出操作" style={{ marginBottom: 24 }}>
        <Space size="large">
          <Button type="primary" icon={<FileImageOutlined />} onClick={() => handleExport('svg')}>导出SVG</Button>
          <Button icon={<FileImageOutlined />} onClick={() => handleExport('png')}>导出PNG</Button>
          <Button icon={<FileTextOutlined />} onClick={() => handleExport('json')}>导出JSON</Button>
          <Button icon={<DownloadOutlined />} onClick={() => handleExport('visio')}>导出Visio</Button>
          <Button type="dashed" onClick={handlePreviewSvg}>预览SVG</Button>
        </Space>
      </Card>

      <Card title="导出历史"><Table columns={columns} dataSource={history} rowKey="id" loading={loading} size="small" /></Card>

      <Modal title="SVG预览" open={previewModal === 'svg'} onCancel={() => setPreviewModal(null)} footer={null} width={900}>
        <div dangerouslySetInnerHTML={{ __html: svgContent }} style={{ minHeight: 400, display: 'flex', justifyContent: 'center', alignItems: 'center' }} />
      </Modal>
    </div>
  );
};

export default TopologyExport;
