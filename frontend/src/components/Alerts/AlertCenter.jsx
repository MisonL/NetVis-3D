import React, { useState, useEffect, useCallback } from 'react';
import { 
  Table, Button, Space, Tag, Badge, Card, Typography, Tabs, 
  Select, message, Modal, Descriptions, Timeline, Tooltip, Empty 
} from 'antd';
import { 
  BellOutlined, CheckCircleOutlined, ExclamationCircleOutlined,
  CloseCircleOutlined, ReloadOutlined, EyeOutlined,
  InfoCircleOutlined
} from '@ant-design/icons';
import { useAuth } from '../../context/AuthContext';

const { Title, Text } = Typography;

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const AlertCenter = () => {
  const { token } = useAuth();
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [activeTab, setActiveTab] = useState('pending');
  const [detailVisible, setDetailVisible] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [stats, setStats] = useState({ pending: 0, critical: 0, totalToday: 0 });
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);

  // 获取告警列表
  const fetchAlerts = useCallback(async (params = {}) => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams({
        page: String(params.current || pagination.current),
        pageSize: String(params.pageSize || pagination.pageSize),
        status: activeTab === 'all' ? '' : activeTab,
      });

      const res = await fetch(`${API_BASE}/api/alerts?${queryParams}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      const data = await res.json();
      if (data.code === 0) {
        setAlerts(data.data.list);
        setPagination(prev => ({
          ...prev,
          total: data.data.total,
          current: data.data.page,
        }));
      }
    } catch {
      message.error('获取告警列表失败');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, activeTab]);

  // 获取统计
  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/alerts/stats`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.code === 0) {
        setStats(data.data);
      }
    } catch {
      console.error('Failed to fetch stats');
    }
  }, [token]);

  useEffect(() => {
    fetchAlerts();
    fetchStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // 确认告警
  const handleAcknowledge = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/api/alerts/${id}/ack`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.code === 0) {
        message.success('告警已确认');
        fetchAlerts();
        fetchStats();
      } else {
        message.error(data.message);
      }
    } catch {
      message.error('操作失败');
    }
  };

  // 解决告警
  const handleResolve = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/api/alerts/${id}/resolve`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.code === 0) {
        message.success('告警已解决');
        fetchAlerts();
        fetchStats();
      } else {
        message.error(data.message);
      }
    } catch {
      message.error('操作失败');
    }
  };

  // 批量确认告警
  const handleBatchAcknowledge = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先选择要确认的告警');
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/alerts/batch/ack`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ ids: selectedRowKeys }),
      });
      const data = await res.json();
      if (data.code === 0) {
        message.success(`已确认 ${selectedRowKeys.length} 条告警`);
        setSelectedRowKeys([]);
        fetchAlerts();
        fetchStats();
      } else {
        message.error(data.message);
      }
    } catch {
      message.error('批量确认失败');
    }
  };

  // 批量解决告警
  const handleBatchResolve = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先选择要解决的告警');
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/alerts/batch/resolve`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ ids: selectedRowKeys }),
      });
      const data = await res.json();
      if (data.code === 0) {
        message.success(`已解决 ${selectedRowKeys.length} 条告警`);
        setSelectedRowKeys([]);
        fetchAlerts();
        fetchStats();
      } else {
        message.error(data.message);
      }
    } catch {
      message.error('批量解决失败');
    }
  };

  const severityConfig = {
    critical: { color: '#ff4d4f', icon: <CloseCircleOutlined />, label: '严重' },
    warning: { color: '#faad14', icon: <ExclamationCircleOutlined />, label: '警告' },
    info: { color: '#1677ff', icon: <InfoCircleOutlined />, label: '提示' },
  };

  const statusConfig = {
    pending: { color: 'error', label: '待处理' },
    acknowledged: { color: 'warning', label: '处理中' },
    resolved: { color: 'success', label: '已解决' },
  };

  const columns = [
    {
      title: '级别',
      dataIndex: 'severity',
      key: 'severity',
      width: 80,
      render: (severity) => {
        const config = severityConfig[severity] || severityConfig.info;
        return (
          <Tooltip title={config.label}>
            <span style={{ color: config.color, fontSize: 18 }}>
              {config.icon}
            </span>
          </Tooltip>
        );
      },
    },
    {
      title: '告警内容',
      dataIndex: 'message',
      key: 'message',
      ellipsis: true,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => {
        const config = statusConfig[status] || statusConfig.pending;
        return <Tag color={config.color}>{config.label}</Tag>;
      },
    },
    {
      title: '设备',
      dataIndex: 'deviceId',
      key: 'deviceId',
      width: 150,
      render: (id) => id ? <Text code>{id.substring(0, 8)}...</Text> : '-',
    },
    {
      title: '触发时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (date) => date ? new Date(date).toLocaleString() : '-',
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_, record) => (
        <Space>
          <Tooltip title="查看详情">
            <Button 
              type="text" 
              icon={<EyeOutlined />} 
              onClick={() => {
                setSelectedAlert(record);
                setDetailVisible(true);
              }}
            />
          </Tooltip>
          {record.status === 'pending' && (
            <Tooltip title="确认">
              <Button 
                type="text" 
                icon={<CheckCircleOutlined style={{ color: '#faad14' }} />} 
                onClick={() => handleAcknowledge(record.id)}
              />
            </Tooltip>
          )}
          {record.status !== 'resolved' && (
            <Tooltip title="解决">
              <Button 
                type="text" 
                icon={<CheckCircleOutlined style={{ color: '#52c41a' }} />} 
                onClick={() => handleResolve(record.id)}
              />
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  const tabItems = [
    { 
      key: 'pending', 
      label: (
        <Badge count={stats.pending} offset={[10, 0]}>
          <span>待处理</span>
        </Badge>
      ),
    },
    { key: 'acknowledged', label: '处理中' },
    { key: 'resolved', label: '已解决' },
    { key: 'all', label: '全部' },
  ];

  return (
    <div style={{ padding: '32px 48px' }}>
      {/* 统计卡片 */}
      <Space size={24} style={{ marginBottom: 24, width: '100%' }}>
        <Card 
          size="small" 
          style={{ 
            background: 'linear-gradient(135deg, #ff4d4f22 0%, #ff4d4f11 100%)',
            border: '1px solid #ff4d4f33',
            borderRadius: 12,
            minWidth: 160,
          }}
        >
          <div style={{ textAlign: 'center' }}>
            <CloseCircleOutlined style={{ fontSize: 24, color: '#ff4d4f' }} />
            <div style={{ fontSize: 28, fontWeight: 700, color: '#ff4d4f', marginTop: 8 }}>
              {stats.critical}
            </div>
            <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>严重告警</div>
          </div>
        </Card>
        <Card 
          size="small" 
          style={{ 
            background: 'linear-gradient(135deg, #faad1422 0%, #faad1411 100%)',
            border: '1px solid #faad1433',
            borderRadius: 12,
            minWidth: 160,
          }}
        >
          <div style={{ textAlign: 'center' }}>
            <BellOutlined style={{ fontSize: 24, color: '#faad14' }} />
            <div style={{ fontSize: 28, fontWeight: 700, color: '#faad14', marginTop: 8 }}>
              {stats.pending}
            </div>
            <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>待处理</div>
          </div>
        </Card>
      </Space>

      {/* 告警列表 */}
      <Card
        style={{
          background: 'var(--glass-card-bg)',
          backdropFilter: 'blur(12px)',
          border: '1px solid var(--glass-border)',
          borderRadius: 16,
        }}
      >
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Title level={4} style={{ margin: 0 }}>
            <BellOutlined style={{ marginRight: 8 }} />
            告警中心
          </Title>
          <Space>
            {selectedRowKeys.length > 0 && (
              <>
                <Button 
                  type="primary" 
                  ghost
                  icon={<CheckCircleOutlined />}
                  onClick={handleBatchAcknowledge}
                >
                  批量确认 ({selectedRowKeys.length})
                </Button>
                <Button 
                  type="primary" 
                  icon={<CheckCircleOutlined />}
                  onClick={handleBatchResolve}
                >
                  批量解决 ({selectedRowKeys.length})
                </Button>
              </>
            )}
            <Button icon={<ReloadOutlined />} onClick={() => { fetchAlerts(); fetchStats(); setSelectedRowKeys([]); }}>
              刷新
            </Button>
          </Space>
        </div>

        <Tabs 
          activeKey={activeTab} 
          onChange={(key) => { setActiveTab(key); setSelectedRowKeys([]); }}
          items={tabItems}
        />

        <Table
          columns={columns}
          dataSource={alerts}
          rowKey="id"
          loading={loading}
          rowSelection={{
            selectedRowKeys,
            onChange: (keys) => setSelectedRowKeys(keys),
            getCheckboxProps: (record) => ({
              disabled: record.status === 'resolved', // 已解决的不可选
            }),
          }}
          locale={{ emptyText: <Empty description="暂无告警记录" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
          pagination={{
            ...pagination,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条`,
          }}
          onChange={(pag) => {
            setPagination(pag);
            fetchAlerts({ current: pag.current, pageSize: pag.pageSize });
          }}
        />
      </Card>

      {/* 详情弹窗 */}
      <Modal
        title="告警详情"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailVisible(false)}>关闭</Button>,
          selectedAlert?.status === 'pending' && (
            <Button key="ack" type="primary" ghost onClick={() => {
              handleAcknowledge(selectedAlert.id);
              setDetailVisible(false);
            }}>
              确认告警
            </Button>
          ),
          selectedAlert?.status !== 'resolved' && (
            <Button key="resolve" type="primary" onClick={() => {
              handleResolve(selectedAlert.id);
              setDetailVisible(false);
            }}>
              解决告警
            </Button>
          ),
        ].filter(Boolean)}
        width={600}
      >
        {selectedAlert && (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="告警ID">
              <Text code>{selectedAlert.id}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="级别">
              <Tag color={severityConfig[selectedAlert.severity]?.color}>
                {severityConfig[selectedAlert.severity]?.label}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="状态">
              <Tag color={statusConfig[selectedAlert.status]?.color}>
                {statusConfig[selectedAlert.status]?.label}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="告警内容">
              {selectedAlert.message}
            </Descriptions.Item>
            <Descriptions.Item label="设备ID">
              {selectedAlert.deviceId || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="触发时间">
              {new Date(selectedAlert.createdAt).toLocaleString()}
            </Descriptions.Item>
            {selectedAlert.acknowledgedAt && (
              <Descriptions.Item label="确认时间">
                {new Date(selectedAlert.acknowledgedAt).toLocaleString()}
              </Descriptions.Item>
            )}
            {selectedAlert.resolvedAt && (
              <Descriptions.Item label="解决时间">
                {new Date(selectedAlert.resolvedAt).toLocaleString()}
              </Descriptions.Item>
            )}
          </Descriptions>
        )}
      </Modal>
    </div>
  );
};

export default AlertCenter;
