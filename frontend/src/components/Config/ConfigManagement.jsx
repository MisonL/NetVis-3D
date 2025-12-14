import React, { useState, useEffect } from 'react';
import { 
  Card, Table, Typography, Tag, Space, Button, Modal, Tabs,
  message, Select, Input, Popconfirm, Tooltip, Row, Col, Statistic
} from 'antd';
import { 
  FileTextOutlined, CloudUploadOutlined, CloudDownloadOutlined,
  HistoryOutlined, CopyOutlined, DiffOutlined, PlusOutlined,
  CheckCircleOutlined, CloseCircleOutlined
} from '@ant-design/icons';
import { useAuth } from '../../context/AuthContext';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const ConfigManagement = () => {
  const { token, hasPermission } = useAuth();
  const [loading, setLoading] = useState(false);
  const [backups, setBackups] = useState([]);
  const [deployHistory, setDeployHistory] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [_backupModalVisible, setBackupModalVisible] = useState(false);
  const [deployModalVisible, setDeployModalVisible] = useState(false);
  const [viewModalVisible, setViewModalVisible] = useState(false);
  const [selectedConfig, setSelectedConfig] = useState(null);
  const [deployConfig, setDeployConfig] = useState('');

  useEffect(() => {
    fetchBackups();
    fetchDeployHistory();
    fetchTemplates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchBackups = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/config/backups`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.code === 0) {
        setBackups(data.data.list);
      }
    } catch (err) {
      console.error('Failed to fetch backups:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchDeployHistory = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/config/deploy-history`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.code === 0) {
        setDeployHistory(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch deploy history:', err);
    }
  };

  const fetchTemplates = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/config/templates`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.code === 0) {
        setTemplates(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch templates:', err);
    }
  };

  const handleViewConfig = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/api/config/backups/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.code === 0) {
        setSelectedConfig(data.data);
        setViewModalVisible(true);
      }
    } catch {
      message.error('获取配置内容失败');
    }
  };

  const handleDeploy = async () => {
    if (!deployConfig.trim()) {
      message.warning('请输入配置内容');
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/config/deploy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          deviceId: 'device-001',
          configContent: deployConfig,
          description: '手动下发',
        }),
      });
      const data = await res.json();
      if (data.code === 0) {
        message.success('配置下发成功');
        setDeployModalVisible(false);
        setDeployConfig('');
        fetchDeployHistory();
      } else {
        message.error(data.message);
      }
    } catch {
      message.error('配置下发失败');
    }
  };

  const formatBytes = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    return (bytes / 1024).toFixed(1) + ' KB';
  };

  const backupColumns = [
    {
      title: '设备名称',
      dataIndex: 'deviceName',
      key: 'deviceName',
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      render: (val) => (
        <Tag color={val === 'running' ? 'blue' : val === 'startup' ? 'green' : 'purple'}>
          {val === 'running' ? '运行配置' : val === 'startup' ? '启动配置' : '完整备份'}
        </Tag>
      ),
    },
    {
      title: '版本',
      dataIndex: 'version',
      key: 'version',
      render: (val) => <Tag>{val}</Tag>,
    },
    {
      title: '大小',
      dataIndex: 'size',
      key: 'size',
      render: formatBytes,
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: '备份时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (val) => new Date(val).toLocaleString(),
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space>
          <Button type="link" size="small" onClick={() => handleViewConfig(record.id)}>查看</Button>
          <Button type="link" size="small" icon={<DiffOutlined />}>对比</Button>
        </Space>
      ),
    },
  ];

  const historyColumns = [
    {
      title: '设备名称',
      dataIndex: 'deviceName',
      key: 'deviceName',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (val) => (
        <Tag color={val === 'success' ? 'success' : 'error'} icon={val === 'success' ? <CheckCircleOutlined /> : <CloseCircleOutlined />}>
          {val === 'success' ? '成功' : '失败'}
        </Tag>
      ),
    },
    {
      title: '配置行数',
      dataIndex: 'linesApplied',
      key: 'linesApplied',
    },
    {
      title: '耗时',
      dataIndex: 'duration',
      key: 'duration',
      render: (val) => `${(val / 1000).toFixed(2)}s`,
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: '下发时间',
      dataIndex: 'deployedAt',
      key: 'deployedAt',
      render: (val) => new Date(val).toLocaleString(),
    },
  ];

  const templateColumns = [
    {
      title: '模板名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '厂商',
      dataIndex: 'vendor',
      key: 'vendor',
      render: (val) => <Tag>{val.toUpperCase()}</Tag>,
    },
    {
      title: '设备类型',
      dataIndex: 'type',
      key: 'type',
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
    },
    {
      title: '变量',
      dataIndex: 'variables',
      key: 'variables',
      render: (vars) => vars?.map(v => <Tag key={v}>{v}</Tag>),
    },
    {
      title: '操作',
      key: 'action',
      render: () => (
        <Button type="link" size="small">使用模板</Button>
      ),
    },
  ];

  const tabItems = [
    {
      key: 'backups',
      label: <span><CloudDownloadOutlined /> 配置备份</span>,
      children: (
        <>
          <div style={{ marginBottom: 16, textAlign: 'right' }}>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setBackupModalVisible(true)}>
              新建备份
            </Button>
          </div>
          <Table
            columns={backupColumns}
            dataSource={backups}
            rowKey="id"
            loading={loading}
            pagination={{ pageSize: 10 }}
          />
        </>
      ),
    },
    {
      key: 'deploy',
      label: <span><CloudUploadOutlined /> 配置下发</span>,
      children: (
        <>
          <div style={{ marginBottom: 16, textAlign: 'right' }}>
            {hasPermission('admin') && (
              <Button type="primary" icon={<CloudUploadOutlined />} onClick={() => setDeployModalVisible(true)}>
                下发配置
              </Button>
            )}
          </div>
          <Table
            columns={historyColumns}
            dataSource={deployHistory}
            rowKey="id"
            pagination={{ pageSize: 10 }}
          />
        </>
      ),
    },
    {
      key: 'templates',
      label: <span><FileTextOutlined /> 配置模板</span>,
      children: (
        <Table
          columns={templateColumns}
          dataSource={templates}
          rowKey="id"
          pagination={false}
        />
      ),
    },
  ];

  return (
    <div style={{ padding: '32px 48px' }}>
      <Title level={4} style={{ marginBottom: 24 }}>
        <FileTextOutlined style={{ marginRight: 8 }} />
        配置管理
      </Title>

      {/* 统计卡片 */}
      <Row gutter={[24, 24]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={8}>
          <Card style={{ background: 'var(--glass-card-bg)', border: '1px solid var(--glass-border)' }}>
            <Statistic title="备份总数" value={backups.length} prefix={<CloudDownloadOutlined />} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card style={{ background: 'var(--glass-card-bg)', border: '1px solid var(--glass-border)' }}>
            <Statistic 
              title="下发成功率" 
              value={deployHistory.filter(d => d.status === 'success').length}
              suffix={`/ ${deployHistory.length}`}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card style={{ background: 'var(--glass-card-bg)', border: '1px solid var(--glass-border)' }}>
            <Statistic title="配置模板" value={templates.length} prefix={<FileTextOutlined />} />
          </Card>
        </Col>
      </Row>

      <Card style={{ background: 'var(--glass-card-bg)', border: '1px solid var(--glass-border)' }}>
        <Tabs items={tabItems} />
      </Card>

      {/* 查看配置弹窗 */}
      <Modal
        title="配置内容"
        open={viewModalVisible}
        onCancel={() => setViewModalVisible(false)}
        footer={null}
        width={700}
      >
        {selectedConfig && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <Space>
                <Tag>版本: {selectedConfig.version}</Tag>
                <Tag>类型: {selectedConfig.type}</Tag>
              </Space>
            </div>
            <TextArea
              value={selectedConfig.content}
              rows={20}
              readOnly
              style={{ fontFamily: 'monospace', fontSize: 12 }}
            />
          </div>
        )}
      </Modal>

      {/* 下发配置弹窗 */}
      <Modal
        title="下发配置"
        open={deployModalVisible}
        onCancel={() => setDeployModalVisible(false)}
        onOk={handleDeploy}
        okText="下发"
        width={700}
      >
        <div style={{ marginBottom: 16 }}>
          <Text type="secondary">请输入要下发的配置命令：</Text>
        </div>
        <TextArea
          value={deployConfig}
          onChange={(e) => setDeployConfig(e.target.value)}
          rows={15}
          placeholder={`interface GigabitEthernet0/0
 description WAN
 ip address 192.168.1.1 255.255.255.0
 no shutdown`}
          style={{ fontFamily: 'monospace', fontSize: 12 }}
        />
      </Modal>
    </div>
  );
};

export default ConfigManagement;
