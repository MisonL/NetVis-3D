import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Button, 
  Space, 
  Tag, 
  Typography,
  Row,
  Col,
  Modal,
  Select,
  message,
  List,
  Progress,
  Badge
} from 'antd';
import { 
  DownloadOutlined, 
  ReloadOutlined,
  FileExcelOutlined,
  FileTextOutlined,
  CloudDownloadOutlined,
  CheckCircleOutlined,
  LoadingOutlined,
  ClockCircleOutlined
} from '@ant-design/icons';

const { Title, Text } = Typography;

import { API_BASE_URL } from '../../config';
const API_BASE = API_BASE_URL;

const DataExport = () => {
  const [exportTypes, setExportTypes] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedType, setSelectedType] = useState(null);
  const [selectedFormat, setSelectedFormat] = useState(null);

  const getToken = () => localStorage.getItem('token');

  const fetchTypes = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/export/types`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (data.code === 0) {
        setExportTypes(data.data || []);
      }
    } catch { /* ignore */ }
  };

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/export/tasks`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (data.code === 0) {
        setTasks(data.data || []);
      }
    } catch {
      message.error('获取任务列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTypes();
    fetchTasks();
    const interval = setInterval(fetchTasks, 5000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleExport = async () => {
    if (!selectedType || !selectedFormat) {
      message.warning('请选择导出类型和格式');
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/export/${selectedType}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ format: selectedFormat }),
      });
      const data = await res.json();
      if (data.code === 0) {
        message.success(data.message);
        setModalVisible(false);
        setSelectedType(null);
        setSelectedFormat(null);
        fetchTasks();
      } else {
        message.error(data.message);
      }
    } catch {
      message.error('导出失败');
    }
  };

  const handleDownload = (task) => {
    if (task.status === 'completed' && task.fileUrl) {
      window.open(`${API_BASE}${task.fileUrl}`, '_blank');
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'processing': return <LoadingOutlined spin style={{ color: '#1677ff' }} />;
      case 'completed': return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
      case 'failed': return <Badge status="error" />;
      default: return <ClockCircleOutlined />;
    }
  };

  const getStatusLabel = (status) => {
    const labels = { pending: '等待中', processing: '处理中', completed: '已完成', failed: '失败' };
    return labels[status] || status;
  };

  const getTypeLabel = (type) => {
    const labels = { devices: '设备列表', alerts: '告警数据', audit: '审计日志', topology: '拓扑数据', metrics: '性能指标', config: '配置备份' };
    return labels[type] || type;
  };

  const getFormatIcon = (format) => {
    if (format === 'excel' || format === 'xlsx') return <FileExcelOutlined style={{ color: '#52c41a' }} />;
    return <FileTextOutlined />;
  };

  return (
    <div style={{ padding: '24px 32px' }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <Col>
          <Title level={3} style={{ margin: 0 }}>
            <CloudDownloadOutlined style={{ marginRight: 12 }} />
            数据导出
          </Title>
        </Col>
        <Col>
          <Space>
            <Button type="primary" icon={<DownloadOutlined />} onClick={() => setModalVisible(true)}>
              新建导出
            </Button>
            <Button icon={<ReloadOutlined />} onClick={fetchTasks}>刷新</Button>
          </Space>
        </Col>
      </Row>

      {/* 导出类型 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {exportTypes.map((type, idx) => (
          <Col span={4} key={idx}>
            <Card 
              size="small" 
              hoverable 
              onClick={() => { setSelectedType(type.type); setModalVisible(true); }}
              style={{ textAlign: 'center' }}
            >
              <div style={{ fontSize: 24, marginBottom: 8 }}>
                {type.icon === 'desktop' ? '💻' : 
                 type.icon === 'warning' ? '⚠️' :
                 type.icon === 'file-text' ? '📄' :
                 type.icon === 'apartment' ? '🔗' :
                 type.icon === 'line-chart' ? '📊' : '📦'}
              </div>
              <Text strong>{type.name}</Text>
              <div style={{ marginTop: 4 }}>
                {type.formats.map(f => (
                  <Tag key={f} size="small">{f.toUpperCase()}</Tag>
                ))}
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      {/* 导出任务列表 */}
      <Card title="导出记录" loading={loading}>
        {tasks.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 32, color: '#999' }}>
            暂无导出记录
          </div>
        ) : (
          <List
            dataSource={tasks}
            renderItem={task => (
              <List.Item
                actions={[
                  task.status === 'completed' && (
                    <Button 
                      type="link" 
                      icon={<DownloadOutlined />}
                      onClick={() => handleDownload(task)}
                    >
                      下载
                    </Button>
                  )
                ].filter(Boolean)}
              >
                <List.Item.Meta
                  avatar={getFormatIcon(task.format)}
                  title={
                    <Space>
                      <Text strong>{getTypeLabel(task.type)}</Text>
                      <Tag>{task.format.toUpperCase()}</Tag>
                    </Space>
                  }
                  description={
                    <Space>
                      {getStatusIcon(task.status)}
                      <span>{getStatusLabel(task.status)}</span>
                      {task.status === 'processing' && (
                        <Progress percent={task.progress} size="small" style={{ width: 100 }} />
                      )}
                      <Text type="secondary">
                        {new Date(task.createdAt).toLocaleString()}
                      </Text>
                    </Space>
                  }
                />
              </List.Item>
            )}
          />
        )}
      </Card>

      {/* 导出弹窗 */}
      <Modal
        title="新建导出"
        open={modalVisible}
        onCancel={() => { setModalVisible(false); setSelectedType(null); setSelectedFormat(null); }}
        onOk={handleExport}
        okText="开始导出"
      >
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <div>
            <Text strong>选择导出类型</Text>
            <Select
              value={selectedType}
              onChange={setSelectedType}
              style={{ width: '100%', marginTop: 8 }}
              placeholder="请选择导出类型"
            >
              {exportTypes.map(type => (
                <Select.Option key={type.type} value={type.type}>{type.name}</Select.Option>
              ))}
            </Select>
          </div>
          <div>
            <Text strong>选择导出格式</Text>
            <Select
              value={selectedFormat}
              onChange={setSelectedFormat}
              style={{ width: '100%', marginTop: 8 }}
              placeholder="请选择导出格式"
              disabled={!selectedType}
            >
              {selectedType && exportTypes.find(t => t.type === selectedType)?.formats.map(f => (
                <Select.Option key={f} value={f}>{f.toUpperCase()}</Select.Option>
              ))}
            </Select>
          </div>
        </Space>
      </Modal>
    </div>
  );
};

export default DataExport;
