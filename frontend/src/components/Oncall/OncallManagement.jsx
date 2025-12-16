import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Table,
  Button, 
  Space, 
  Tag, 
  Typography,
  Row,
  Col,
  Statistic,
  Modal,
  Form,
  Input,
  Select,
  DatePicker,
  message,
  List,
  Switch,
  Timeline,
  Avatar
} from 'antd';
import { 
  TeamOutlined, 
  ReloadOutlined,
  PlusOutlined,
  PhoneOutlined,
  UserOutlined,
  ClockCircleOutlined,
  AlertOutlined,
  SwapOutlined
} from '@ant-design/icons';

const { Title, Text } = Typography;

import { API_BASE_URL } from '../../config';
const API_BASE = API_BASE_URL;

const OncallManagement = () => {
  const [currentOncall, setCurrentOncall] = useState(null);
  const [weeklySchedule, setWeeklySchedule] = useState([]);
  const [escalationRules, setEscalationRules] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [handoverModal, setHandoverModal] = useState(false);
  const [form] = Form.useForm();

  const getToken = () => localStorage.getItem('token');

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [currentRes, weeklyRes, rulesRes, statsRes] = await Promise.all([
        fetch(`${API_BASE}/api/oncall/current`, { headers: { Authorization: `Bearer ${getToken()}` } }),
        fetch(`${API_BASE}/api/oncall/weekly`, { headers: { Authorization: `Bearer ${getToken()}` } }),
        fetch(`${API_BASE}/api/oncall/escalation`, { headers: { Authorization: `Bearer ${getToken()}` } }),
        fetch(`${API_BASE}/api/oncall/stats`, { headers: { Authorization: `Bearer ${getToken()}` } }),
      ]);

      const [currentData, weeklyData, rulesData, statsData] = await Promise.all([
        currentRes.json(), weeklyRes.json(), rulesRes.json(), statsRes.json(),
      ]);

      if (currentData.code === 0) setCurrentOncall(currentData.data);
      if (weeklyData.code === 0) setWeeklySchedule(weeklyData.data || []);
      if (rulesData.code === 0) setEscalationRules(rulesData.data || []);
      if (statsData.code === 0) setStats(statsData.data);
    } catch {
      message.error('获取数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleToggleRule = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/api/oncall/escalation/${id}/toggle`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (data.code === 0) {
        message.success(data.message);
        fetchAll();
      }
    } catch {
      message.error('操作失败');
    }
  };

  const handleHandover = async (values) => {
    try {
      const res = await fetch(`${API_BASE}/api/oncall/handover`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (data.code === 0) {
        message.success(data.message);
        setHandoverModal(false);
        form.resetFields();
      }
    } catch {
      message.error('交接失败');
    }
  };

  const ruleColumns = [
    { title: '规则名称', dataIndex: 'name', render: (name) => <Text strong>{name}</Text> },
    { 
      title: '触发条件', 
      dataIndex: 'conditions', 
      render: (conditions) => (
        <Space wrap>
          {conditions?.map((c, i) => (
            <Tag key={i} color={c.severity === 'critical' ? 'red' : 'orange'}>
              {c.severity} &gt; {c.timeout}分钟
            </Tag>
          ))}
        </Space>
      )
    },
    { 
      title: '状态', 
      dataIndex: 'enabled', 
      render: (enabled, record) => (
        <Switch checked={enabled} onChange={() => handleToggleRule(record.id)} />
      )
    },
  ];

  return (
    <div style={{ padding: '24px 32px' }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <Col>
          <Title level={3} style={{ margin: 0 }}>
            <TeamOutlined style={{ marginRight: 12 }} />
            值班管理
          </Title>
        </Col>
        <Col>
          <Space>
            <Button icon={<SwapOutlined />} onClick={() => setHandoverModal(true)}>
              值班交接
            </Button>
            <Button icon={<ReloadOutlined />} onClick={fetchAll}>刷新</Button>
          </Space>
        </Col>
      </Row>

      {/* 当前值班 */}
      <Row gutter={24} style={{ marginBottom: 24 }}>
        <Col span={8}>
          <Card title="当前值班人员" loading={loading}>
            {currentOncall && (
              <div style={{ textAlign: 'center' }}>
                <Avatar size={64} icon={<UserOutlined />} style={{ backgroundColor: '#1677ff' }} />
                <div style={{ marginTop: 16 }}>
                  <Title level={4} style={{ margin: 0 }}>{currentOncall.userName}</Title>
                  <Text type="secondary">{currentOncall.email}</Text>
                </div>
                <div style={{ marginTop: 16 }}>
                  <ClockCircleOutlined /> 值班时间
                  <div>
                    <Text>{new Date(currentOncall.startTime).toLocaleTimeString()}</Text>
                    <Text> - </Text>
                    <Text>{new Date(currentOncall.endTime).toLocaleTimeString()}</Text>
                  </div>
                </div>
                {currentOncall.nextOncall && (
                  <div style={{ marginTop: 16, padding: 8, background: '#f5f5f5', borderRadius: 4 }}>
                    <Text type="secondary">下一班: {currentOncall.nextOncall.userName}</Text>
                  </div>
                )}
              </div>
            )}
          </Card>
        </Col>
        <Col span={16}>
          <Card title="本周值班表" loading={loading}>
            <Row gutter={8}>
              {weeklySchedule.map((day, idx) => (
                <Col span={3} key={idx}>
                  <div 
                    style={{ 
                      textAlign: 'center', 
                      padding: 12, 
                      background: day.isToday ? '#e6f7ff' : '#fafafa',
                      borderRadius: 8,
                      border: day.isToday ? '2px solid #1677ff' : '1px solid #f0f0f0',
                    }}
                  >
                    <div style={{ fontWeight: day.isToday ? 'bold' : 'normal' }}>{day.dayName}</div>
                    <div style={{ fontSize: 12, color: '#999' }}>{day.date.slice(5)}</div>
                    <Avatar size="small" icon={<UserOutlined />} style={{ marginTop: 8 }} />
                    <div style={{ fontSize: 12, marginTop: 4 }}>{day.userName}</div>
                  </div>
                </Col>
              ))}
            </Row>
          </Card>
        </Col>
      </Row>

      {/* 统计 */}
      {stats && (
        <Row gutter={24} style={{ marginBottom: 24 }}>
          <Col span={6}>
            <Card><Statistic title="值班计划" value={stats.totalSchedules} /></Card>
          </Col>
          <Col span={6}>
            <Card><Statistic title="升级规则" value={`${stats.activeRules}/${stats.totalRules}`} suffix="启用" /></Card>
          </Col>
          <Col span={6}>
            <Card><Statistic title="本周告警" value={stats.thisWeekAlerts} suffix="条" /></Card>
          </Col>
          <Col span={6}>
            <Card><Statistic title="平均响应" value={stats.avgResponseTime} /></Card>
          </Col>
        </Row>
      )}

      {/* 告警升级规则 */}
      <Card title={<><AlertOutlined /> 告警升级规则</>} loading={loading}>
        <Table columns={ruleColumns} dataSource={escalationRules} rowKey="id" pagination={false} />
      </Card>

      {/* 值班交接弹窗 */}
      <Modal
        title="值班交接"
        open={handoverModal}
        onCancel={() => { setHandoverModal(false); form.resetFields(); }}
        onOk={() => form.submit()}
      >
        <Form form={form} layout="vertical" onFinish={handleHandover}>
          <Form.Item name="notes" label="交接备注">
            <Input.TextArea rows={4} placeholder="请填写值班交接备注信息" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default OncallManagement;
