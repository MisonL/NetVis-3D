import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Button, 
  Space, 
  Typography,
  Row,
  Col,
  message,
  List,
  Switch,
  Slider,
  Divider,
  Modal,
  Empty
} from 'antd';
import { 
  AppstoreOutlined, 
  ReloadOutlined,
  SaveOutlined,
  UndoOutlined,
  PlusOutlined,
  DeleteOutlined,
  DragOutlined
} from '@ant-design/icons';

const { Title, Text } = Typography;

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const DashboardCustomize = () => {
  const [config, setConfig] = useState(null);
  const [availableWidgets, setAvailableWidgets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const getToken = () => localStorage.getItem('token');

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const [configRes, widgetsRes] = await Promise.all([
        fetch(`${API_BASE}/api/dashboard/config`, { headers: { Authorization: `Bearer ${getToken()}` } }),
        fetch(`${API_BASE}/api/dashboard/widgets`, { headers: { Authorization: `Bearer ${getToken()}` } }),
      ]);

      const [configData, widgetsData] = await Promise.all([configRes.json(), widgetsRes.json()]);

      if (configData.code === 0) setConfig(configData.data);
      if (widgetsData.code === 0) setAvailableWidgets(widgetsData.data || []);
    } catch {
      message.error('获取配置失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSave = async () => {
    if (!config) return;
    try {
      const res = await fetch(`${API_BASE}/api/dashboard/config`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          layout: config.layout,
          theme: config.theme,
          refreshInterval: config.refreshInterval,
        }),
      });
      const data = await res.json();
      if (data.code === 0) {
        message.success(data.message);
        setHasChanges(false);
      }
    } catch {
      message.error('保存失败');
    }
  };

  const handleReset = async () => {
    Modal.confirm({
      title: '重置仪表盘',
      content: '确定要重置为默认配置吗？',
      onOk: async () => {
        try {
          const res = await fetch(`${API_BASE}/api/dashboard/config/reset`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${getToken()}` },
          });
          const data = await res.json();
          if (data.code === 0) {
            message.success(data.message);
            fetchConfig();
            setHasChanges(false);
          }
        } catch {
          message.error('重置失败');
        }
      },
    });
  };

  const handleAddWidget = (widget) => {
    if (!config) return;
    const existingIds = config.layout.map(l => l.id);
    if (existingIds.includes(widget.id)) {
      message.warning('该组件已添加');
      return;
    }

    const newLayout = {
      id: widget.id,
      type: widget.type,
      x: 0,
      y: config.layout.length * 4,
      w: widget.defaultW,
      h: widget.defaultH,
      config: {},
    };

    setConfig({
      ...config,
      layout: [...config.layout, newLayout],
    });
    setHasChanges(true);
    message.success(`已添加 ${widget.name}`);
  };

  const handleRemoveWidget = (widgetId) => {
    if (!config) return;
    setConfig({
      ...config,
      layout: config.layout.filter(l => l.id !== widgetId),
    });
    setHasChanges(true);
  };

  const handleRefreshIntervalChange = (value) => {
    if (!config) return;
    setConfig({ ...config, refreshInterval: value });
    setHasChanges(true);
  };

  return (
    <div style={{ padding: '24px 32px' }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <Col>
          <Title level={3} style={{ margin: 0 }}>
            <AppstoreOutlined style={{ marginRight: 12 }} />
            仪表盘自定义
          </Title>
        </Col>
        <Col>
          <Space>
            <Button 
              type="primary" 
              icon={<SaveOutlined />} 
              onClick={handleSave}
              disabled={!hasChanges}
            >
              保存配置
            </Button>
            <Button icon={<UndoOutlined />} onClick={handleReset}>重置默认</Button>
            <Button icon={<ReloadOutlined />} onClick={fetchConfig}>刷新</Button>
          </Space>
        </Col>
      </Row>

      <Row gutter={24}>
        {/* 左侧：可用组件 */}
        <Col span={8}>
          <Card title="可用组件" size="small" loading={loading}>
            <List
              size="small"
              dataSource={availableWidgets}
              renderItem={widget => (
                <List.Item
                  actions={[
                    <Button 
                      key="add" 
                      type="link" 
                      size="small" 
                      icon={<PlusOutlined />}
                      onClick={() => handleAddWidget(widget)}
                    >
                      添加
                    </Button>,
                  ]}
                >
                  <List.Item.Meta
                    title={widget.name}
                    description={`类型: ${widget.type} | 大小: ${widget.defaultW}x${widget.defaultH}`}
                  />
                </List.Item>
              )}
            />
          </Card>

          <Card title="刷新设置" size="small" style={{ marginTop: 16 }}>
            <Text>自动刷新间隔: {config?.refreshInterval || 30}秒</Text>
            <Slider
              min={10}
              max={120}
              step={10}
              value={config?.refreshInterval || 30}
              onChange={handleRefreshIntervalChange}
              marks={{ 10: '10s', 60: '60s', 120: '120s' }}
            />
          </Card>
        </Col>

        {/* 右侧：当前布局 */}
        <Col span={16}>
          <Card title="当前布局" loading={loading}>
            {config?.layout?.length > 0 ? (
              <List
                dataSource={config.layout}
                renderItem={(item) => {
                  const widget = availableWidgets.find(w => w.id === item.id);
                  return (
                    <List.Item
                      actions={[
                        <Button 
                          key="delete" 
                          type="link" 
                          danger 
                          size="small" 
                          icon={<DeleteOutlined />}
                          onClick={() => handleRemoveWidget(item.id)}
                        >
                          移除
                        </Button>,
                      ]}
                    >
                      <List.Item.Meta
                        avatar={<DragOutlined style={{ fontSize: 20, color: '#999' }} />}
                        title={widget?.name || item.id}
                        description={`位置: (${item.x}, ${item.y}) | 大小: ${item.w}x${item.h}`}
                      />
                    </List.Item>
                  );
                }}
              />
            ) : (
              <Empty description="暂无组件" />
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default DashboardCustomize;
