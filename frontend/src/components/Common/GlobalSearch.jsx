import React, { useState, useEffect, useRef } from 'react';
import { Input, Modal, List, Tag, Typography, Space, Spin, Empty } from 'antd';
import { 
  SearchOutlined, DesktopOutlined, BellOutlined, 
  UserOutlined, FileTextOutlined, SettingOutlined 
} from '@ant-design/icons';

const { Text } = Typography;

const GlobalSearch = ({ visible, onClose, onNavigate }) => {
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const inputRef = useRef(null);

  useEffect(() => {
    if (visible) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [visible]);

  const performSearch = (query) => {
    setLoading(true);
    
    // 模拟搜索结果 - 实际应调用API
    const mockResults = [
      { type: 'device', title: 'Core-Router-01', subtitle: '192.168.1.1', key: '0' },
      { type: 'device', title: 'Firewall-Main', subtitle: '192.168.1.2', key: '1' },
      { type: 'device', title: 'Switch-DC-A', subtitle: '192.168.1.3', key: '2' },
      { type: 'alert', title: 'CPU 使用率过高', subtitle: 'Core-Router-01', key: '3' },
      { type: 'alert', title: '内存告警', subtitle: 'Server-DB-01', key: '4' },
      { type: 'user', title: '管理员', subtitle: 'admin@netvis.local', key: '5' },
      { type: 'page', title: '系统设置', subtitle: '配置系统参数', key: '6' },
      { type: 'page', title: '数据分析', subtitle: '查看统计报表', key: '7' },
    ];

    const filtered = mockResults.filter(item => 
      item.title.toLowerCase().includes(query.toLowerCase()) ||
      item.subtitle.toLowerCase().includes(query.toLowerCase())
    );

    setTimeout(() => {
      setResults(filtered);
      setLoading(false);
    }, 200);
  };

  useEffect(() => {
    if (!keyword.trim()) {
      setResults([]);
      return;
    }

    const timer = setTimeout(() => {
      performSearch(keyword);
    }, 300);

    return () => clearTimeout(timer);
  }, [keyword]);

  const getIcon = (type) => {
    const icons = {
      device: <DesktopOutlined style={{ color: '#1677ff' }} />,
      alert: <BellOutlined style={{ color: '#faad14' }} />,
      user: <UserOutlined style={{ color: '#52c41a' }} />,
      page: <FileTextOutlined style={{ color: '#722ed1' }} />,
    };
    return icons[type] || <SearchOutlined />;
  };

  const getTagColor = (type) => {
    const colors = {
      device: 'blue',
      alert: 'orange',
      user: 'green',
      page: 'purple',
    };
    return colors[type] || 'default';
  };

  const getTypeLabel = (type) => {
    const labels = {
      device: '设备',
      alert: '告警',
      user: '用户',
      page: '页面',
    };
    return labels[type] || type;
  };

  const handleSelect = (item) => {
    onClose();
    setKeyword('');
    onNavigate?.(item);
  };

  return (
    <Modal
      open={visible}
      onCancel={() => {
        onClose();
        setKeyword('');
      }}
      footer={null}
      closable={false}
      width={560}
      style={{ top: 100 }}
      styles={{
        body: { padding: 0 },
      }}
    >
      <div style={{ padding: '16px 16px 0' }}>
        <Input
          ref={inputRef}
          size="large"
          placeholder="搜索设备、告警、用户..."
          prefix={<SearchOutlined style={{ color: 'var(--text-secondary)' }} />}
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          allowClear
          style={{ borderRadius: 8 }}
        />
      </div>

      <div style={{ 
        maxHeight: 400, 
        overflow: 'auto',
        padding: '8px 0',
      }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center' }}>
            <Spin />
          </div>
        ) : keyword && results.length === 0 ? (
          <Empty 
            image={Empty.PRESENTED_IMAGE_SIMPLE} 
            description="未找到相关结果"
            style={{ padding: '40px 0' }}
          />
        ) : results.length > 0 ? (
          <List
            dataSource={results}
            renderItem={(item) => (
              <List.Item
                onClick={() => handleSelect(item)}
                style={{ 
                  padding: '12px 16px',
                  cursor: 'pointer',
                  transition: 'background 0.2s',
                }}
                className="search-result-item"
              >
                <Space>
                  {getIcon(item.type)}
                  <div>
                    <Text strong>{item.title}</Text>
                    <br />
                    <Text type="secondary" style={{ fontSize: 12 }}>{item.subtitle}</Text>
                  </div>
                </Space>
                <Tag color={getTagColor(item.type)}>{getTypeLabel(item.type)}</Tag>
              </List.Item>
            )}
          />
        ) : !keyword ? (
          <div style={{ padding: '24px 16px', color: 'var(--text-secondary)' }}>
            <Text type="secondary">输入关键词开始搜索</Text>
            <div style={{ marginTop: 16 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                快捷键: <Tag>⌘ + K</Tag> 或 <Tag>Ctrl + K</Tag>
              </Text>
            </div>
          </div>
        ) : null}
      </div>
    </Modal>
  );
};

export default GlobalSearch;
