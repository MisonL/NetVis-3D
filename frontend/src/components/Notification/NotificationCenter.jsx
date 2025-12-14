import React, { useState, useEffect } from 'react';
import { 
  Card, Table, Typography, Tag, Space, Button, Modal, Tabs,
  message, List, Badge, Switch, Row, Col, Statistic, Empty, Popconfirm
} from 'antd';
import { 
  BellOutlined, CheckCircleOutlined, DeleteOutlined,
  MailOutlined, DingdingOutlined, WechatOutlined, MessageOutlined,
  SettingOutlined, AlertOutlined, ClockCircleOutlined
} from '@ant-design/icons';
import { useAuth } from '../../context/AuthContext';

const { Title, Text, Paragraph } = Typography;

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const NotificationCenter = () => {
  const { token, hasPermission } = useAuth();
  const [loading, setLoading] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [settings, setSettings] = useState(null);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetchNotifications();
    fetchSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter === 'unread') params.append('isRead', 'false');
      if (filter !== 'all' && filter !== 'unread') params.append('type', filter);

      const res = await fetch(`${API_BASE}/api/notifications?${params}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.code === 0) {
        setNotifications(data.data.list);
        setUnreadCount(data.data.unreadCount);
      }
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/notifications/settings`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.code === 0) {
        setSettings(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch settings:', err);
    }
  };

  const handleMarkRead = async (id) => {
    try {
      await fetch(`${API_BASE}/api/notifications/${id}/read`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      fetchNotifications();
    } catch (err) {
      message.error('操作失败');
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await fetch(`${API_BASE}/api/notifications/read-all`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      message.success('已全部标为已读');
      fetchNotifications();
    } catch (err) {
      message.error('操作失败');
    }
  };

  const handleDelete = async (id) => {
    try {
      await fetch(`${API_BASE}/api/notifications/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      message.success('已删除');
      fetchNotifications();
    } catch (err) {
      message.error('删除失败');
    }
  };

  const handleTestChannel = async (channelId) => {
    try {
      const res = await fetch(`${API_BASE}/api/notifications/test/${channelId}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.code === 0) {
        message.success('测试消息已发送');
      }
    } catch (err) {
      message.error('测试失败');
    }
  };

  const getTypeIcon = (type) => {
    const icons = {
      alert: <AlertOutlined style={{ color: '#ff4d4f' }} />,
      system: <SettingOutlined style={{ color: '#1677ff' }} />,
      task: <ClockCircleOutlined style={{ color: '#52c41a' }} />,
      report: <BellOutlined style={{ color: '#faad14' }} />,
    };
    return icons[type] || <BellOutlined />;
  };

  const getPriorityColor = (priority) => {
    const colors = {
      high: 'red',
      medium: 'orange',
      low: 'default',
    };
    return colors[priority] || 'default';
  };

  const getChannelIcon = (id) => {
    const icons = {
      email: <MailOutlined />,
      dingtalk: <DingdingOutlined />,
      wechat: <WechatOutlined />,
      sms: <MessageOutlined />,
    };
    return icons[id] || <BellOutlined />;
  };

  const tabItems = [
    {
      key: 'notifications',
      label: (
        <span>
          <BellOutlined /> 通知列表
          {unreadCount > 0 && <Badge count={unreadCount} style={{ marginLeft: 8 }} />}
        </span>
      ),
      children: (
        <>
          <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
            <Space>
              {['all', 'unread', 'alert', 'system', 'task'].map(f => (
                <Button
                  key={f}
                  type={filter === f ? 'primary' : 'default'}
                  size="small"
                  onClick={() => setFilter(f)}
                >
                  {f === 'all' ? '全部' : f === 'unread' ? '未读' : f === 'alert' ? '告警' : f === 'system' ? '系统' : '任务'}
                </Button>
              ))}
            </Space>
            <Button onClick={handleMarkAllRead} disabled={unreadCount === 0}>
              全部已读
            </Button>
          </div>

          <List
            loading={loading}
            dataSource={notifications}
            locale={{ emptyText: <Empty description="暂无通知" /> }}
            renderItem={(item) => (
              <List.Item
                style={{
                  background: item.isRead ? 'transparent' : 'rgba(22, 119, 255, 0.05)',
                  padding: '12px 16px',
                  marginBottom: 8,
                  borderRadius: 8,
                  border: '1px solid var(--glass-border)',
                }}
                actions={[
                  !item.isRead && (
                    <Button 
                      type="text" 
                      size="small" 
                      icon={<CheckCircleOutlined />}
                      onClick={() => handleMarkRead(item.id)}
                    >
                      已读
                    </Button>
                  ),
                  <Popconfirm title="确认删除?" onConfirm={() => handleDelete(item.id)}>
                    <Button type="text" danger size="small" icon={<DeleteOutlined />} />
                  </Popconfirm>,
                ].filter(Boolean)}
              >
                <List.Item.Meta
                  avatar={getTypeIcon(item.type)}
                  title={
                    <Space>
                      {!item.isRead && <Badge status="processing" />}
                      <Text strong>{item.title}</Text>
                      <Tag color={getPriorityColor(item.priority)}>
                        {item.priority === 'high' ? '紧急' : item.priority === 'medium' ? '重要' : '普通'}
                      </Tag>
                    </Space>
                  }
                  description={
                    <div>
                      <div>{item.content}</div>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {new Date(item.createdAt).toLocaleString()}
                      </Text>
                    </div>
                  }
                />
              </List.Item>
            )}
          />
        </>
      ),
    },
    {
      key: 'channels',
      label: <span><SettingOutlined /> 通知渠道</span>,
      children: (
        <List
          dataSource={settings?.channels || []}
          renderItem={(channel) => (
            <List.Item
              actions={[
                <Switch 
                  key="switch"
                  checked={channel.enabled} 
                  onChange={() => message.info('功能开发中')}
                />,
                hasPermission('admin') && (
                  <Button 
                    key="test"
                    type="link" 
                    size="small"
                    onClick={() => handleTestChannel(channel.id)}
                  >
                    测试
                  </Button>
                ),
              ].filter(Boolean)}
            >
              <List.Item.Meta
                avatar={
                  <div style={{ fontSize: 24, width: 40 }}>
                    {getChannelIcon(channel.id)}
                  </div>
                }
                title={channel.name}
                description={channel.description}
              />
            </List.Item>
          )}
        />
      ),
    },
  ];

  return (
    <div style={{ padding: '32px 48px' }}>
      <Title level={4} style={{ marginBottom: 24 }}>
        <BellOutlined style={{ marginRight: 8 }} />
        通知中心
      </Title>

      {/* 统计卡片 */}
      <Row gutter={[24, 24]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={8}>
          <Card style={{ background: 'var(--glass-card-bg)', border: '1px solid var(--glass-border)' }}>
            <Statistic 
              title="未读通知" 
              value={unreadCount} 
              prefix={<BellOutlined />}
              valueStyle={{ color: unreadCount > 0 ? '#ff4d4f' : undefined }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card style={{ background: 'var(--glass-card-bg)', border: '1px solid var(--glass-border)' }}>
            <Statistic 
              title="通知总数" 
              value={notifications.length} 
              prefix={<MessageOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card style={{ background: 'var(--glass-card-bg)', border: '1px solid var(--glass-border)' }}>
            <Statistic 
              title="启用渠道" 
              value={settings?.channels?.filter(c => c.enabled).length || 0}
              suffix={`/ ${settings?.channels?.length || 0}`}
              prefix={<SettingOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Card style={{ background: 'var(--glass-card-bg)', border: '1px solid var(--glass-border)' }}>
        <Tabs items={tabItems} />
      </Card>
    </div>
  );
};

export default NotificationCenter;
