import React, { useState, useEffect } from 'react';
import { 
  Card, Table, Typography, Tag, Space, Button, Modal, Tabs,
  message, Select, DatePicker, Row, Col, Statistic, List, Progress
} from 'antd';
import { 
  FileTextOutlined, DownloadOutlined, ClockCircleOutlined,
  DesktopOutlined, BellOutlined, LineChartOutlined, SettingOutlined,
  PlusOutlined, FilePdfOutlined, FileExcelOutlined
} from '@ant-design/icons';
import { useAuth } from '../../context/AuthContext';

const { Title, Text, Paragraph } = Typography;
const { RangePicker } = DatePicker;

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const ReportCenter = () => {
  const { token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [reportTypes, setReportTypes] = useState([]);
  const [history, setHistory] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [generateModalVisible, setGenerateModalVisible] = useState(false);
  const [selectedReportType, setSelectedReportType] = useState(null);
  const [reportData, setReportData] = useState(null);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    fetchReportTypes();
    fetchHistory();
    fetchSchedules();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchReportTypes = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/report/types`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.code === 0) {
        setReportTypes(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch report types:', err);
    }
  };

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/report/history`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.code === 0) {
        setHistory(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch history:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSchedules = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/report/schedules`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.code === 0) {
        setSchedules(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch schedules:', err);
    }
  };

  const handleGenerate = async (reportType) => {
    setGenerating(true);
    setReportData(null);
    
    try {
      const res = await fetch(`${API_BASE}/api/report/generate/${reportType.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ format: 'json' }),
      });
      const data = await res.json();
      if (data.code === 0) {
        setReportData(data.data);
        message.success('报表生成成功');
      } else {
        message.error(data.message);
      }
    } catch {
      message.error('报表生成失败');
    } finally {
      setGenerating(false);
    }
  };

  const getIconByType = (icon) => {
    const icons = {
      desktop: <DesktopOutlined />,
      bell: <BellOutlined />,
      'line-chart': <LineChartOutlined />,
      'file-text': <FileTextOutlined />,
      setting: <SettingOutlined />,
    };
    return icons[icon] || <FileTextOutlined />;
  };

  const formatBytes = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    return (bytes / 1024).toFixed(1) + ' KB';
  };

  const historyColumns = [
    {
      title: '报表类型',
      dataIndex: 'typeName',
      key: 'typeName',
    },
    {
      title: '格式',
      dataIndex: 'format',
      key: 'format',
      render: (val) => (
        <Tag color={val === 'pdf' ? 'red' : val === 'xlsx' ? 'green' : 'blue'}>
          {val.toUpperCase()}
        </Tag>
      ),
    },
    {
      title: '大小',
      dataIndex: 'size',
      key: 'size',
      render: formatBytes,
    },
    {
      title: '生成人',
      dataIndex: 'generatedBy',
      key: 'generatedBy',
    },
    {
      title: '生成时间',
      dataIndex: 'generatedAt',
      key: 'generatedAt',
      render: (val) => new Date(val).toLocaleString(),
    },
    {
      title: '操作',
      key: 'action',
      render: () => (
        <Button type="link" size="small" icon={<DownloadOutlined />}>下载</Button>
      ),
    },
  ];

  const scheduleColumns = [
    {
      title: '任务名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '报表类型',
      dataIndex: 'type',
      key: 'type',
    },
    {
      title: '执行周期',
      dataIndex: 'cronDescription',
      key: 'cronDescription',
      render: (val) => <Tag icon={<ClockCircleOutlined />}>{val}</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'isActive',
      key: 'isActive',
      render: (val) => <Tag color={val ? 'success' : 'default'}>{val ? '启用' : '禁用'}</Tag>,
    },
    {
      title: '上次执行',
      dataIndex: 'lastRun',
      key: 'lastRun',
      render: (val) => val ? new Date(val).toLocaleString() : '-',
    },
  ];

  const tabItems = [
    {
      key: 'types',
      label: <span><FileTextOutlined /> 报表类型</span>,
      children: (
        <List
          grid={{ gutter: 16, xs: 1, sm: 2, md: 3, lg: 3 }}
          dataSource={reportTypes}
          renderItem={(item) => (
            <List.Item>
              <Card
                hoverable
                style={{ background: 'var(--glass-card-bg)' }}
                actions={[
                  <Button 
                    key="generate" 
                    type="primary" 
                    size="small"
                    onClick={() => {
                      setSelectedReportType(item);
                      setGenerateModalVisible(true);
                    }}
                  >
                    生成报表
                  </Button>
                ]}
              >
                <Card.Meta
                  avatar={<div style={{ fontSize: 32, color: '#1677ff' }}>{getIconByType(item.icon)}</div>}
                  title={item.name}
                  description={
                    <div>
                      <Text type="secondary">{item.description}</Text>
                      <div style={{ marginTop: 8 }}>
                        {item.formats?.map(f => (
                          <Tag key={f} style={{ marginRight: 4 }}>
                            {f === 'pdf' ? <FilePdfOutlined /> : <FileExcelOutlined />} {f.toUpperCase()}
                          </Tag>
                        ))}
                      </div>
                    </div>
                  }
                />
              </Card>
            </List.Item>
          )}
        />
      ),
    },
    {
      key: 'history',
      label: <span><ClockCircleOutlined /> 生成历史</span>,
      children: (
        <Table
          columns={historyColumns}
          dataSource={history}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      ),
    },
    {
      key: 'schedules',
      label: <span><ClockCircleOutlined /> 定时任务</span>,
      children: (
        <>
          <div style={{ marginBottom: 16, textAlign: 'right' }}>
            <Button type="primary" icon={<PlusOutlined />}>新建定时任务</Button>
          </div>
          <Table
            columns={scheduleColumns}
            dataSource={schedules}
            rowKey="id"
            pagination={false}
          />
        </>
      ),
    },
  ];

  return (
    <div style={{ padding: '32px 48px' }}>
      <Title level={4} style={{ marginBottom: 24 }}>
        <FileTextOutlined style={{ marginRight: 8 }} />
        报表中心
      </Title>

      {/* 统计卡片 */}
      <Row gutter={[24, 24]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={8}>
          <Card style={{ background: 'var(--glass-card-bg)', border: '1px solid var(--glass-border)' }}>
            <Statistic title="报表类型" value={reportTypes.length} prefix={<FileTextOutlined />} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card style={{ background: 'var(--glass-card-bg)', border: '1px solid var(--glass-border)' }}>
            <Statistic title="已生成报表" value={history.length} prefix={<DownloadOutlined />} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card style={{ background: 'var(--glass-card-bg)', border: '1px solid var(--glass-border)' }}>
            <Statistic title="定时任务" value={schedules.length} prefix={<ClockCircleOutlined />} />
          </Card>
        </Col>
      </Row>

      <Card style={{ background: 'var(--glass-card-bg)', border: '1px solid var(--glass-border)' }}>
        <Tabs items={tabItems} />
      </Card>

      {/* 生成报表弹窗 */}
      <Modal
        title={`生成 ${selectedReportType?.name || ''}`}
        open={generateModalVisible}
        onCancel={() => {
          setGenerateModalVisible(false);
          setReportData(null);
        }}
        width={700}
        footer={null}
      >
        {!reportData ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Button 
              type="primary" 
              size="large" 
              loading={generating}
              onClick={() => handleGenerate(selectedReportType)}
            >
              {generating ? '生成中...' : '开始生成'}
            </Button>
          </div>
        ) : (
          <div>
            <div style={{ marginBottom: 16 }}>
              <Tag color="success">生成成功</Tag>
              <Text type="secondary">生成时间: {new Date(reportData.generatedAt).toLocaleString()}</Text>
            </div>
            
            {reportData.summary && (
              <Card size="small" title="报表摘要" style={{ marginBottom: 16 }}>
                <Row gutter={16}>
                  {Object.entries(reportData.summary).map(([key, value]) => {
                    if (typeof value === 'number') {
                      return (
                        <Col span={8} key={key}>
                          <Statistic title={key} value={value} />
                        </Col>
                      );
                    }
                    return null;
                  })}
                </Row>
              </Card>
            )}

            <Space style={{ marginTop: 16 }}>
              <Button icon={<FileExcelOutlined />}>下载 Excel</Button>
              <Button icon={<FilePdfOutlined />}>下载 PDF</Button>
            </Space>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default ReportCenter;
