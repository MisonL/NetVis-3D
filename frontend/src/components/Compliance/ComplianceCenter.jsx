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
  message,
  Modal,
  Tabs,
  List,
  Badge
} from 'antd';
import { 
  SafetyCertificateOutlined, 
  ReloadOutlined,
  ScanOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
  WarningOutlined
} from '@ant-design/icons';

const { Title, Text } = Typography;

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const ComplianceCenter = () => {
  const [overview, setOverview] = useState(null);
  const [rules, setRules] = useState([]);
  const [violations, setViolations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);

  const getToken = () => localStorage.getItem('token');

  const fetchOverview = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/compliance/overview`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (data.code === 0) {
        setOverview(data.data);
      }
    } catch {
      message.error('获取概览失败');
    }
  };

  const fetchRules = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/compliance/rules`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (data.code === 0) {
        setRules(data.data || []);
      }
    } catch {
      message.error('获取规则失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchViolations = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/compliance/violations`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (data.code === 0) {
        setViolations(data.data || []);
      }
    } catch { /* ignore */ }
  };

  const handleScan = async () => {
    setScanning(true);
    try {
      const res = await fetch(`${API_BASE}/api/compliance/scan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.code === 0) {
        message.success(data.message);
        setScanResult(data.data);
        fetchOverview();
        fetchViolations();
      } else {
        message.error(data.message);
      }
    } catch {
      message.error('扫描失败');
    } finally {
      setScanning(false);
    }
  };

  const handleToggleRule = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/api/compliance/rules/${id}/toggle`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (data.code === 0) {
        message.success(data.message);
        fetchRules();
      }
    } catch {
      message.error('操作失败');
    }
  };

  useEffect(() => {
    fetchOverview();
    fetchRules();
    fetchViolations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getSeverityColor = (severity) => {
    const colors = { critical: 'red', high: 'orange', medium: 'gold', low: 'blue' };
    return colors[severity] || 'default';
  };

  const getSeverityLabel = (severity) => {
    const labels = { critical: '严重', high: '高', medium: '中', low: '低' };
    return labels[severity] || severity;
  };

  const ruleColumns = [
    { title: '规则名称', dataIndex: 'name', render: (name) => <Text strong>{name}</Text> },
    { title: '类别', dataIndex: 'category', render: (c) => <Tag>{c}</Tag> },
    { title: '检查类型', dataIndex: 'checkType', render: (t) => <Tag color="blue">{t}</Tag> },
    { 
      title: '严重程度', 
      dataIndex: 'severity', 
      render: (s) => <Tag color={getSeverityColor(s)}>{getSeverityLabel(s)}</Tag> 
    },
    { 
      title: '状态', 
      dataIndex: 'enabled', 
      render: (enabled) => (
        <Badge status={enabled ? 'success' : 'default'} text={enabled ? '启用' : '禁用'} />
      )
    },
    {
      title: '操作',
      render: (_, record) => (
        <Button size="small" onClick={() => handleToggleRule(record.id)}>
          {record.enabled ? '禁用' : '启用'}
        </Button>
      ),
    },
  ];

  const violationColumns = [
    { title: '设备', dataIndex: 'deviceName', render: (name) => <Text strong>{name}</Text> },
    { title: 'IP地址', dataIndex: 'deviceIp' },
    { title: '规则', dataIndex: 'ruleName' },
    { title: '类别', dataIndex: 'category', render: (c) => <Tag>{c}</Tag> },
    { 
      title: '严重程度', 
      dataIndex: 'severity', 
      render: (s) => <Tag color={getSeverityColor(s)}>{getSeverityLabel(s)}</Tag> 
    },
    { 
      title: '状态', 
      dataIndex: 'status', 
      render: (s) => (
        <Tag color={s === 'open' ? 'error' : 'warning'}>
          {s === 'open' ? '待处理' : '已确认'}
        </Tag>
      )
    },
  ];

  const tabItems = [
    {
      key: 'rules',
      label: '合规规则',
      children: (
        <Table
          columns={ruleColumns}
          dataSource={rules}
          rowKey="id"
          loading={loading}
          pagination={false}
        />
      ),
    },
    {
      key: 'violations',
      label: (
        <span>
          违规项 
          {violations.length > 0 && <Badge count={violations.length} style={{ marginLeft: 8 }} />}
        </span>
      ),
      children: (
        <Table
          columns={violationColumns}
          dataSource={violations}
          rowKey="id"
          pagination={{ pageSize: 10 }}
        />
      ),
    },
  ];

  return (
    <div style={{ padding: '24px 32px' }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <Col>
          <Title level={3} style={{ margin: 0 }}>
            <SafetyCertificateOutlined style={{ marginRight: 12 }} />
            合规审计
          </Title>
        </Col>
        <Col>
          <Space>
            <Button 
              type="primary" 
              icon={<ScanOutlined />} 
              onClick={handleScan}
              loading={scanning}
            >
              执行扫描
            </Button>
            <Button icon={<ReloadOutlined />} onClick={() => { fetchOverview(); fetchRules(); fetchViolations(); }}>
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
                title="合规评分"
                value={overview.overallScore}
                suffix="/ 100"
                valueStyle={{ color: overview.overallScore >= 80 ? '#52c41a' : overview.overallScore >= 60 ? '#faad14' : '#ff4d4f' }}
                prefix={<SafetyCertificateOutlined />}
              />
              <Progress 
                percent={overview.overallScore} 
                showInfo={false}
                strokeColor={overview.overallScore >= 80 ? '#52c41a' : overview.overallScore >= 60 ? '#faad14' : '#ff4d4f'}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="合规设备"
                value={overview.compliantDevices}
                suffix={`/ ${overview.totalDevices}`}
                prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="启用规则"
                value={overview.enabledRules}
                suffix={`/ ${overview.totalRules}`}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="待处理违规"
                value={violations.filter(v => v.status === 'open').length}
                valueStyle={{ color: violations.filter(v => v.status === 'open').length > 0 ? '#ff4d4f' : '#52c41a' }}
                prefix={<WarningOutlined />}
              />
            </Card>
          </Col>
        </Row>
      )}

      {/* 分类统计 */}
      {overview && (
        <Row gutter={24} style={{ marginBottom: 24 }}>
          <Col span={12}>
            <Card title="按类别统计" size="small">
              {overview.byCategory?.map((item, idx) => (
                <div key={idx} style={{ marginBottom: 12 }}>
                  <Row justify="space-between">
                    <Text>{item.category}</Text>
                    <Space>
                      <Tag color="success">{item.passed} 通过</Tag>
                      <Tag color="error">{item.failed} 不合规</Tag>
                    </Space>
                  </Row>
                  <Progress 
                    percent={Math.round(item.passed / item.total * 100)} 
                    size="small"
                    showInfo={false}
                  />
                </div>
              ))}
            </Card>
          </Col>
          <Col span={12}>
            <Card title="按严重程度统计" size="small">
              {overview.bySeverity?.map((item, idx) => (
                <div key={idx} style={{ marginBottom: 12 }}>
                  <Row justify="space-between">
                    <Tag color={getSeverityColor(item.severity)}>{getSeverityLabel(item.severity)}</Tag>
                    <Space>
                      <Tag color="success">{item.passed} 通过</Tag>
                      <Tag color="error">{item.failed} 不合规</Tag>
                    </Space>
                  </Row>
                </div>
              ))}
            </Card>
          </Col>
        </Row>
      )}

      <Card>
        <Tabs items={tabItems} />
      </Card>

      {/* 扫描结果弹窗 */}
      <Modal
        title="扫描结果"
        open={!!scanResult}
        onCancel={() => setScanResult(null)}
        footer={null}
        width={600}
      >
        {scanResult && (
          <div>
            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col span={6}>
                <Statistic title="总检查项" value={scanResult.summary.totalChecks} />
              </Col>
              <Col span={6}>
                <Statistic title="通过" value={scanResult.summary.passed} valueStyle={{ color: '#52c41a' }} />
              </Col>
              <Col span={6}>
                <Statistic title="不合规" value={scanResult.summary.failed} valueStyle={{ color: '#ff4d4f' }} />
              </Col>
              <Col span={6}>
                <Statistic title="通过率" value={scanResult.summary.passRate} suffix="%" />
              </Col>
            </Row>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default ComplianceCenter;
