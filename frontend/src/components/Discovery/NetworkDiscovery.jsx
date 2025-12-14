import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Card, 
  Form, 
  Input, 
  Button, 
  Table, 
  Tag, 
  Progress, 
  Space, 
  Typography, 
  Alert, 
  Checkbox,
  message,
  Tooltip,
  Row,
  Col,
  Statistic,
  Divider
} from 'antd';
import { 
  SearchOutlined, 
  SyncOutlined, 
  StopOutlined,
  CloudUploadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  LoadingOutlined,
  RadarChartOutlined
} from '@ant-design/icons';

const { Title, Text } = Typography;

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const NetworkDiscovery = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [taskId, setTaskId] = useState(null);
  const [taskStatus, setTaskStatus] = useState(null);
  const [results, setResults] = useState([]);
  const [selectedDevices, setSelectedDevices] = useState([]);
  const [tasksHistory, setTasksHistory] = useState([]);
  const pollingRef = useRef(null);

  const getToken = () => localStorage.getItem('token');

  // 获取历史任务
  const fetchTasksHistory = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/discovery/tasks`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (data.code === 0) {
        setTasksHistory(data.data);
      }
    } catch (err) {
      console.error('Fetch tasks error:', err);
    }
  }, []);

  useEffect(() => {
    fetchTasksHistory();
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [fetchTasksHistory]);

  // 轮询任务状态
  const pollTaskStatus = (id) => {
    pollingRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE}/api/discovery/tasks/${id}`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        });
        const data = await res.json();
        if (data.code === 0) {
          setTaskStatus(data.data);
          if (data.data.status === 'completed' || data.data.status === 'failed') {
            clearInterval(pollingRef.current);
            setLoading(false);
            fetchResults(id);
            fetchTasksHistory();
          }
        }
      } catch (err) {
        console.error('Poll status error:', err);
      }
    }, 1000);
  };

  // 获取发现结果
  const fetchResults = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/api/discovery/tasks/${id}/results`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (data.code === 0) {
        setResults(data.data.devices || []);
      }
    } catch (err) {
      console.error('Fetch results error:', err);
    }
  };

  // 启动发现
  const handleStartDiscovery = async (values) => {
    setLoading(true);
    setResults([]);
    setSelectedDevices([]);
    try {
      const res = await fetch(`${API_BASE}/api/discovery/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          network: values.network,
          scanPorts: [22, 23, 80, 161, 443, 8080],
        }),
      });
      const data = await res.json();
      if (data.code === 0) {
        setTaskId(data.data.taskId);
        message.success('发现任务已启动');
        pollTaskStatus(data.data.taskId);
      } else {
        message.error(data.message || '启动失败');
        setLoading(false);
      }
    } catch {
      message.error('启动失败');
      setLoading(false);
    }
  };

  // 停止发现
  const handleStopDiscovery = async () => {
    if (!taskId) return;
    try {
      await fetch(`${API_BASE}/api/discovery/tasks/${taskId}/stop`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      clearInterval(pollingRef.current);
      setLoading(false);
      message.info('任务已停止');
      fetchTasksHistory();
    } catch {
      message.error('停止失败');
    }
  };

  // 导入选中设备
  const handleImport = async () => {
    if (selectedDevices.length === 0) {
      message.warning('请先选择要导入的设备');
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/discovery/import`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          taskId,
          deviceIps: selectedDevices,
        }),
      });
      const data = await res.json();
      if (data.code === 0) {
        message.success(data.message);
        setSelectedDevices([]);
      } else {
        message.error(data.message);
      }
    } catch {
      message.error('导入失败');
    }
  };

  // 设备表格列
  const columns = [
    {
      title: '选择',
      dataIndex: 'ip',
      width: 60,
      render: (ip) => (
        <Checkbox
          checked={selectedDevices.includes(ip)}
          onChange={(e) => {
            if (e.target.checked) {
              setSelectedDevices([...selectedDevices, ip]);
            } else {
              setSelectedDevices(selectedDevices.filter(d => d !== ip));
            }
          }}
        />
      ),
    },
    {
      title: 'IP地址',
      dataIndex: 'ip',
      render: (ip) => <Text code>{ip}</Text>,
    },
    {
      title: '主机名',
      dataIndex: 'hostname',
      render: (name) => name || '-',
    },
    {
      title: '类型',
      dataIndex: 'type',
      render: (type) => <Tag color="blue">{type}</Tag>,
    },
    {
      title: '厂商',
      dataIndex: 'vendor',
      render: (vendor) => <Tag>{vendor || 'Unknown'}</Tag>,
    },
    {
      title: '开放端口',
      dataIndex: 'ports',
      render: (ports) => (
        ports?.length > 0 ? (
          <Tooltip title={ports.join(', ')}>
            <Tag color="green">{ports.length}个端口</Tag>
          </Tooltip>
        ) : <Tag color="default">无</Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      render: (status) => (
        <Tag color={status === 'online' ? 'success' : 'error'}>
          {status === 'online' ? '在线' : '离线'}
        </Tag>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px 32px' }}>
      <Title level={3}>
        <RadarChartOutlined style={{ marginRight: 12 }} />
        拓扑自动发现
      </Title>
      
      <Row gutter={[24, 24]}>
        {/* 发现配置 */}
        <Col xs={24} lg={10}>
          <Card title="网络发现配置">
            <Form form={form} layout="vertical" onFinish={handleStartDiscovery}>
              <Form.Item
                name="network"
                label="网络地址 (CIDR)"
                rules={[
                  { required: true, message: '请输入网络地址' },
                  { pattern: /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\/\d{1,2}$/, message: 'CIDR格式不正确' },
                ]}
                initialValue="192.168.1.0/24"
              >
                <Input placeholder="例如: 192.168.1.0/24" disabled={loading} />
              </Form.Item>
              
              <Space>
                <Button
                  type="primary"
                  htmlType="submit"
                  icon={loading ? <LoadingOutlined /> : <SearchOutlined />}
                  loading={loading}
                >
                  {loading ? '扫描中...' : '开始扫描'}
                </Button>
                {loading && (
                  <Button icon={<StopOutlined />} danger onClick={handleStopDiscovery}>
                    停止
                  </Button>
                )}
              </Space>
            </Form>

            {/* 任务进度 */}
            {taskStatus && (
              <div style={{ marginTop: 24 }}>
                <Divider>扫描进度</Divider>
                <Progress
                  percent={taskStatus.progress}
                  status={
                    taskStatus.status === 'completed' ? 'success' :
                    taskStatus.status === 'failed' ? 'exception' : 'active'
                  }
                  strokeColor={{
                    '0%': '#108ee9',
                    '100%': '#87d068',
                  }}
                />
                <Row gutter={16} style={{ marginTop: 16 }}>
                  <Col span={12}>
                    <Statistic title="状态" value={taskStatus.status} />
                  </Col>
                  <Col span={12}>
                    <Statistic title="发现设备" value={taskStatus.foundDevices} suffix="台" />
                  </Col>
                </Row>
              </div>
            )}
          </Card>

          {/* 历史任务 */}
          <Card title="历史任务" style={{ marginTop: 24 }} size="small">
            {tasksHistory.length > 0 ? (
              <div style={{ maxHeight: 200, overflow: 'auto' }}>
                {tasksHistory.slice(0, 5).map(t => (
                  <div 
                    key={t.id} 
                    style={{ 
                      padding: '8px 12px', 
                      borderBottom: '1px solid #f0f0f0',
                      cursor: 'pointer',
                    }}
                    onClick={() => {
                      setTaskId(t.id);
                      setTaskStatus(t);
                      fetchResults(t.id);
                    }}
                  >
                    <Space>
                      {t.status === 'completed' && <CheckCircleOutlined style={{ color: '#52c41a' }} />}
                      {t.status === 'failed' && <CloseCircleOutlined style={{ color: '#ff4d4f' }} />}
                      {t.status === 'running' && <SyncOutlined spin style={{ color: '#1890ff' }} />}
                      <Text>{t.network}</Text>
                      <Tag>{t.foundDevices}台</Tag>
                    </Space>
                  </div>
                ))}
              </div>
            ) : (
              <Text type="secondary">暂无历史任务</Text>
            )}
          </Card>
        </Col>

        {/* 发现结果 */}
        <Col xs={24} lg={14}>
          <Card 
            title={`发现结果 (${results.length}台设备)`}
            extra={
              results.length > 0 && (
                <Space>
                  <Button
                    size="small"
                    onClick={() => setSelectedDevices(results.map(d => d.ip))}
                  >
                    全选
                  </Button>
                  <Button
                    type="primary"
                    icon={<CloudUploadOutlined />}
                    disabled={selectedDevices.length === 0}
                    onClick={handleImport}
                  >
                    导入选中 ({selectedDevices.length})
                  </Button>
                </Space>
              )
            }
          >
            {results.length > 0 ? (
              <Table
                dataSource={results}
                columns={columns}
                rowKey="ip"
                size="small"
                pagination={{ pageSize: 10 }}
              />
            ) : (
              <Alert
                message="暂无发现结果"
                description="请输入网络地址并点击开始扫描来发现网络中的设备"
                type="info"
                showIcon
              />
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default NetworkDiscovery;
