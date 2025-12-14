import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Table, 
  Tag, 
  Typography,
  Row,
  Col,
  Statistic,
  Progress,
  Space,
  Button,
  message,
  Tooltip,
  List
} from 'antd';
import { 
  HeartOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  CloseCircleOutlined,
  ReloadOutlined,
  RiseOutlined
} from '@ant-design/icons';

const { Title, Text } = Typography;

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const DeviceHealthScore = () => {
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(false);

  const getToken = () => localStorage.getItem('token');

  const fetchOverview = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/device-health/overview`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (data.code === 0) {
        setOverview(data.data);
      }
    } catch {
      message.error('获取健康评分失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getGradeColor = (grade) => {
    const colors = { A: '#52c41a', B: '#1890ff', C: '#faad14', D: '#fa8c16', F: '#ff4d4f' };
    return colors[grade] || '#999';
  };

  const getScoreStatus = (score) => {
    if (score >= 90) return 'success';
    if (score >= 70) return 'normal';
    if (score >= 60) return 'exception';
    return 'exception';
  };

  const columns = [
    {
      title: '设备名称',
      dataIndex: 'deviceName',
      render: (name, record) => (
        <Space>
          <HeartOutlined style={{ color: getGradeColor(record.grade) }} />
          <Text strong>{name}</Text>
        </Space>
      ),
    },
    {
      title: '类型',
      dataIndex: 'type',
      render: (t) => <Tag>{t}</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      render: (status) => (
        <Tag color={status === 'online' ? 'success' : status === 'warning' ? 'warning' : 'error'}>
          {status === 'online' ? '在线' : status === 'warning' ? '警告' : '离线'}
        </Tag>
      ),
    },
    {
      title: '健康评分',
      dataIndex: 'score',
      sorter: (a, b) => a.score - b.score,
      render: (score) => (
        <Progress 
          percent={score} 
          size="small" 
          status={getScoreStatus(score)}
          format={(p) => `${p}`}
          style={{ width: 100 }}
        />
      ),
    },
    {
      title: '等级',
      dataIndex: 'grade',
      render: (grade) => (
        <Tag 
          color={getGradeColor(grade)} 
          style={{ fontSize: 16, fontWeight: 'bold', padding: '2px 12px' }}
        >
          {grade}
        </Tag>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px 32px' }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <Col>
          <Title level={3} style={{ margin: 0 }}>
            <HeartOutlined style={{ marginRight: 12, color: '#eb2f96' }} />
            设备健康评分
          </Title>
        </Col>
        <Col>
          <Button icon={<ReloadOutlined />} onClick={fetchOverview} loading={loading}>
            刷新
          </Button>
        </Col>
      </Row>

      {overview && (
        <>
          <Row gutter={24} style={{ marginBottom: 24 }}>
            <Col span={6}>
              <Card>
                <Statistic
                  title="设备总数"
                  value={overview.totalDevices}
                  prefix={<HeartOutlined />}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="平均健康分"
                  value={overview.avgScore}
                  suffix="分"
                  valueStyle={{ color: overview.avgScore >= 80 ? '#3f8600' : '#cf1322' }}
                  prefix={<RiseOutlined />}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="优秀设备 (A级)"
                  value={overview.gradeDistribution?.A || 0}
                  valueStyle={{ color: '#52c41a' }}
                  prefix={<CheckCircleOutlined />}
                  suffix="台"
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="需关注设备"
                  value={(overview.gradeDistribution?.D || 0) + (overview.gradeDistribution?.F || 0)}
                  valueStyle={{ color: '#cf1322' }}
                  prefix={<WarningOutlined />}
                  suffix="台"
                />
              </Card>
            </Col>
          </Row>

          <Row gutter={24}>
            <Col span={16}>
              <Card title="设备健康排名">
                <Table
                  columns={columns}
                  dataSource={overview.scores}
                  rowKey="deviceId"
                  loading={loading}
                  pagination={{ pageSize: 10 }}
                />
              </Card>
            </Col>
            <Col span={8}>
              <Card title="等级分布" style={{ marginBottom: 24 }}>
                <Row gutter={[16, 16]}>
                  {['A', 'B', 'C', 'D', 'F'].map(grade => (
                    <Col span={12} key={grade}>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ 
                          fontSize: 24, 
                          fontWeight: 'bold', 
                          color: getGradeColor(grade) 
                        }}>
                          {overview.gradeDistribution?.[grade] || 0}
                        </div>
                        <Tag color={getGradeColor(grade)}>{grade}级</Tag>
                      </div>
                    </Col>
                  ))}
                </Row>
              </Card>

              <Card title="需关注设备">
                <List
                  size="small"
                  dataSource={overview.lowScoreDevices || []}
                  renderItem={(item) => (
                    <List.Item>
                      <Space>
                        <CloseCircleOutlined style={{ color: '#ff4d4f' }} />
                        <Text>{item.deviceName}</Text>
                        <Tag color="error">{item.score}分</Tag>
                      </Space>
                    </List.Item>
                  )}
                  locale={{ emptyText: '暂无低分设备' }}
                />
              </Card>
            </Col>
          </Row>
        </>
      )}
    </div>
  );
};

export default DeviceHealthScore;
