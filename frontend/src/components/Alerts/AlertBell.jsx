import React, { useState, useEffect, useCallback } from 'react';
import { Badge, Dropdown, List, Typography, Button, Tag, Empty, Spin } from 'antd';
import { BellOutlined, ExclamationCircleOutlined, CloseCircleOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { useAuth } from '../../context/AuthContext';

const { Text } = Typography;

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const AlertBell = ({ onClick }) => {
  const { token, isAuthenticated } = useAuth();
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({ pending: 0, critical: 0 });

  const fetchRecentAlerts = useCallback(async () => {
    if (!isAuthenticated || !token) return;
    
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/alerts?page=1&pageSize=5&status=pending`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.code === 0) {
        setAlerts(data.data.list || []);
      }
    } catch {
      console.error('Failed to fetch alerts');
    } finally {
      setLoading(false);
    }
  }, [token, isAuthenticated]);

  const fetchStats = useCallback(async () => {
    if (!isAuthenticated || !token) return;
    
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
  }, [token, isAuthenticated]);

  useEffect(() => {
    fetchRecentAlerts();
    fetchStats();

    // 每30秒刷新一次
    const interval = setInterval(() => {
      fetchRecentAlerts();
      fetchStats();
    }, 30000);

    return () => clearInterval(interval);
  }, [fetchRecentAlerts, fetchStats]);

  const severityConfig = {
    critical: { color: '#ff4d4f', icon: <CloseCircleOutlined /> },
    warning: { color: '#faad14', icon: <ExclamationCircleOutlined /> },
    info: { color: '#1677ff', icon: <InfoCircleOutlined /> },
  };

  const dropdownContent = (
    <div style={{
      width: 360,
      background: 'var(--glass-dropdown-bg, rgba(255,255,255,0.95))',
      backdropFilter: 'blur(12px)',
      borderRadius: 12,
      boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
      overflow: 'hidden',
    }}>
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid var(--glass-border)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <Text strong>告警通知</Text>
        <Tag color={stats.critical > 0 ? 'error' : 'default'}>
          {stats.pending} 条待处理
        </Tag>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center' }}>
          <Spin />
        </div>
      ) : alerts.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="暂无告警"
          style={{ padding: '40px 0' }}
        />
      ) : (
        <List
          size="small"
          dataSource={alerts}
          renderItem={(item) => {
            const config = severityConfig[item.severity] || severityConfig.info;
            return (
              <List.Item 
                style={{ 
                  padding: '12px 16px',
                  cursor: 'pointer',
                  transition: 'background 0.2s',
                }}
                onClick={() => onClick?.()}
              >
                <List.Item.Meta
                  avatar={
                    <span style={{ color: config.color, fontSize: 16 }}>
                      {config.icon}
                    </span>
                  }
                  title={
                    <Text ellipsis style={{ maxWidth: 260 }}>
                      {item.message}
                    </Text>
                  }
                  description={
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {item.createdAt ? new Date(item.createdAt).toLocaleString() : '-'}
                    </Text>
                  }
                />
              </List.Item>
            );
          }}
        />
      )}

      <div style={{
        padding: '12px 16px',
        borderTop: '1px solid var(--glass-border)',
        textAlign: 'center',
      }}>
        <Button type="link" onClick={() => onClick?.()}>
          查看全部告警
        </Button>
      </div>
    </div>
  );

  return (
    <Dropdown
      dropdownRender={() => dropdownContent}
      trigger={['click']}
      placement="bottomRight"
    >
      <Badge 
        count={stats.pending} 
        size="small"
        offset={[-2, 2]}
        style={{ 
          backgroundColor: stats.critical > 0 ? '#ff4d4f' : '#faad14',
        }}
      >
        <Button
          type="text"
          icon={<BellOutlined style={{ fontSize: 18 }} />}
          style={{
            width: 40,
            height: 40,
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        />
      </Badge>
    </Dropdown>
  );
};

export default AlertBell;
