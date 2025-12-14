import React, { useState, useEffect } from 'react';
import { 
  Card, Row, Col, Typography, Progress, Tag, Button, Input, 
  Modal, message, Spin, List, Space, Divider, Statistic, Alert
} from 'antd';
import { 
  SafetyCertificateOutlined, CloudServerOutlined, UserOutlined,
  CheckCircleOutlined, CloseCircleOutlined, ClockCircleOutlined,
  KeyOutlined, CopyOutlined
} from '@ant-design/icons';
import { useAuth } from '../../context/AuthContext';

const { Title, Text, Paragraph } = Typography;

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const LicenseManagement = () => {
  const { token, hasPermission } = useAuth();
  const [loading, setLoading] = useState(false);
  const [licenseInfo, setLicenseInfo] = useState(null);
  const [usage, setUsage] = useState(null);
  const [modules, setModules] = useState([]);
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [licenseKey, setLicenseKey] = useState('');
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    fetchLicenseInfo();
    fetchUsage();
    fetchModules();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchLicenseInfo = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/license/info`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.code === 0) {
        setLicenseInfo(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch license info:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsage = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/license/usage`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.code === 0) {
        setUsage(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch usage:', err);
    }
  };

  const fetchModules = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/license/modules`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.code === 0) {
        setModules(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch modules:', err);
    }
  };

  const handleImport = async () => {
    if (!licenseKey.trim()) {
      message.warning('请输入License Key');
      return;
    }

    setImporting(true);
    try {
      const res = await fetch(`${API_BASE}/api/license/import`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ licenseKey }),
      });
      const data = await res.json();
      if (data.code === 0) {
        message.success('License激活成功！');
        setImportModalVisible(false);
        setLicenseKey('');
        fetchLicenseInfo();
        fetchUsage();
        fetchModules();
      } else {
        message.error(data.message);
      }
    } catch (err) {
      message.error('激活失败，请检查网络');
    } finally {
      setImporting(false);
    }
  };

  const handleGenerateTrial = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/license/generate-trial`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.code === 0) {
        setLicenseKey(data.data.licenseKey);
        message.success(`已生成30天试用License`);
      }
    } catch (err) {
      message.error('生成失败');
    }
  };

  const getStatusTag = (status) => {
    const config = {
      active: { color: 'success', icon: <CheckCircleOutlined />, text: '已激活' },
      expired: { color: 'error', icon: <CloseCircleOutlined />, text: '已过期' },
      unlicensed: { color: 'default', icon: <ClockCircleOutlined />, text: '未授权' },
    };
    const c = config[status] || config.unlicensed;
    return <Tag color={c.color} icon={c.icon}>{c.text}</Tag>;
  };

  const getEditionName = (edition) => {
    const names = {
      community: '社区版',
      basic: '基础版',
      professional: '专业版',
      enterprise: '企业版',
    };
    return names[edition] || edition;
  };

  if (loading && !licenseInfo) {
    return (
      <div style={{ padding: 48, textAlign: 'center' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div style={{ padding: '32px 48px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={4} style={{ margin: 0 }}>
          <SafetyCertificateOutlined style={{ marginRight: 8 }} />
          License 授权管理
        </Title>
        {hasPermission('admin') && (
          <Button type="primary" icon={<KeyOutlined />} onClick={() => setImportModalVisible(true)}>
            导入License
          </Button>
        )}
      </div>

      {/* License信息卡片 */}
      <Card 
        style={{ marginBottom: 24, background: 'var(--glass-card-bg)', border: '1px solid var(--glass-border)' }}
      >
        <Row gutter={[24, 24]} align="middle">
          <Col xs={24} md={8}>
            <Space direction="vertical">
              <Text type="secondary">授权状态</Text>
              <Space>
                {getStatusTag(licenseInfo?.status)}
                <Text strong style={{ fontSize: 18 }}>{getEditionName(licenseInfo?.edition)}</Text>
              </Space>
            </Space>
          </Col>
          <Col xs={24} md={8}>
            <Space direction="vertical">
              <Text type="secondary">客户名称</Text>
              <Text strong>{licenseInfo?.customer || '未知'}</Text>
            </Space>
          </Col>
          <Col xs={24} md={8}>
            <Space direction="vertical">
              <Text type="secondary">到期时间</Text>
              <Text strong>
                {licenseInfo?.expiresAt 
                  ? new Date(licenseInfo.expiresAt).toLocaleDateString() 
                  : '永久有效'}
              </Text>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* 使用量统计 */}
      <Row gutter={[24, 24]} style={{ marginBottom: 24 }}>
        <Col xs={24} md={12}>
          <Card 
            title={<><CloudServerOutlined /> 设备配额</>}
            style={{ background: 'var(--glass-card-bg)', border: '1px solid var(--glass-border)' }}
          >
            <Statistic 
              value={usage?.devices?.used || 0} 
              suffix={`/ ${usage?.devices?.max || 10}`} 
              valueStyle={{ color: '#1677ff' }}
            />
            <Progress 
              percent={usage?.devices?.percentage || 0} 
              status={usage?.devices?.percentage > 80 ? 'exception' : 'active'}
              strokeColor="#1677ff"
            />
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card 
            title={<><UserOutlined /> 用户配额</>}
            style={{ background: 'var(--glass-card-bg)', border: '1px solid var(--glass-border)' }}
          >
            <Statistic 
              value={usage?.users?.used || 0} 
              suffix={`/ ${usage?.users?.max || 3}`}
              valueStyle={{ color: '#52c41a' }}
            />
            <Progress 
              percent={usage?.users?.percentage || 0} 
              status={usage?.users?.percentage > 80 ? 'exception' : 'active'}
              strokeColor="#52c41a"
            />
          </Card>
        </Col>
      </Row>

      {/* 模块列表 */}
      <Card 
        title="功能模块"
        style={{ background: 'var(--glass-card-bg)', border: '1px solid var(--glass-border)' }}
      >
        <List
          grid={{ gutter: 16, xs: 1, sm: 2, md: 3, lg: 5 }}
          dataSource={modules}
          renderItem={(item) => (
            <List.Item>
              <Card 
                size="small"
                style={{ 
                  textAlign: 'center',
                  opacity: item.enabled ? 1 : 0.5,
                  background: item.enabled ? 'rgba(22, 119, 255, 0.05)' : 'transparent',
                }}
              >
                {item.enabled ? (
                  <CheckCircleOutlined style={{ fontSize: 24, color: '#52c41a' }} />
                ) : (
                  <CloseCircleOutlined style={{ fontSize: 24, color: '#999' }} />
                )}
                <div style={{ marginTop: 8, fontWeight: 500 }}>{item.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{item.description}</div>
              </Card>
            </List.Item>
          )}
        />
      </Card>

      {/* 导入License弹窗 */}
      <Modal
        title="导入 License"
        open={importModalVisible}
        onCancel={() => setImportModalVisible(false)}
        footer={null}
        width={500}
      >
        <Alert 
          message="请输入有效的 License Key 以激活产品功能"
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
        
        <Input.TextArea
          rows={4}
          placeholder="NV-edition-modules-devices-users-days-checksum"
          value={licenseKey}
          onChange={(e) => setLicenseKey(e.target.value)}
          style={{ marginBottom: 16 }}
        />

        {hasPermission('admin') && (
          <div style={{ marginBottom: 16 }}>
            <Button type="link" onClick={handleGenerateTrial}>
              生成30天试用License（开发用）
            </Button>
          </div>
        )}

        <div style={{ textAlign: 'right' }}>
          <Space>
            <Button onClick={() => setImportModalVisible(false)}>取消</Button>
            <Button type="primary" onClick={handleImport} loading={importing}>
              激活
            </Button>
          </Space>
        </div>
      </Modal>
    </div>
  );
};

export default LicenseManagement;
