import React, { useState, useEffect } from 'react';
import { 
  Card, 
  List,
  Button, 
  Space, 
  Tag, 
  Typography,
  Row,
  Col,
  Input,
  Modal,
  Form,
  Select,
  message,
  Tabs,
  Empty
} from 'antd';
import { 
  BookOutlined, 
  ReloadOutlined,
  PlusOutlined,
  SearchOutlined,
  EyeOutlined,
  EditOutlined,
  DeleteOutlined,
  TagOutlined,
  FireOutlined
} from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const KnowledgeBase = () => {
  const [articles, setArticles] = useState([]);
  const [categories, setCategories] = useState([]);
  const [tags, setTags] = useState([]);
  const [popular, setPopular] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [detailModal, setDetailModal] = useState(null);
  const [form] = Form.useForm();

  const getToken = () => localStorage.getItem('token');

  const fetchArticles = async () => {
    setLoading(true);
    try {
      let url = `${API_BASE}/api/knowledge/articles`;
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (selectedCategory) params.append('category', selectedCategory);
      if (params.toString()) url += `?${params.toString()}`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (data.code === 0) {
        setArticles(data.data || []);
      }
    } catch {
      message.error('获取文章失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/knowledge/categories`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (data.code === 0) {
        setCategories(data.data || []);
      }
    } catch { /* ignore */ }
  };

  const fetchTags = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/knowledge/tags`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (data.code === 0) {
        setTags(data.data || []);
      }
    } catch { /* ignore */ }
  };

  const fetchPopular = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/knowledge/popular`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (data.code === 0) {
        setPopular(data.data || []);
      }
    } catch { /* ignore */ }
  };

  useEffect(() => {
    fetchArticles();
    fetchCategories();
    fetchTags();
    fetchPopular();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchArticles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, selectedCategory]);

  const handleCreate = async (values) => {
    try {
      const res = await fetch(`${API_BASE}/api/knowledge/articles`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (data.code === 0) {
        message.success('文章创建成功');
        setModalVisible(false);
        form.resetFields();
        fetchArticles();
        fetchCategories();
      } else {
        message.error(data.message);
      }
    } catch {
      message.error('创建失败');
    }
  };

  const handleViewDetail = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/api/knowledge/articles/${id}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (data.code === 0) {
        setDetailModal(data.data);
      }
    } catch {
      message.error('获取详情失败');
    }
  };

  return (
    <div style={{ padding: '24px 32px' }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <Col>
          <Title level={3} style={{ margin: 0 }}>
            <BookOutlined style={{ marginRight: 12 }} />
            知识库
          </Title>
        </Col>
        <Col>
          <Space>
            <Input
              placeholder="搜索文章..."
              prefix={<SearchOutlined />}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: 200 }}
              allowClear
            />
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalVisible(true)}>
              新建文章
            </Button>
            <Button icon={<ReloadOutlined />} onClick={fetchArticles}>刷新</Button>
          </Space>
        </Col>
      </Row>

      <Row gutter={24}>
        {/* 左侧：分类和标签 */}
        <Col span={6}>
          <Card title="分类" size="small" style={{ marginBottom: 16 }}>
            <div style={{ marginBottom: 8 }}>
              <Tag 
                color={!selectedCategory ? 'blue' : 'default'} 
                style={{ cursor: 'pointer', marginBottom: 4 }}
                onClick={() => setSelectedCategory('')}
              >
                全部
              </Tag>
            </div>
            {categories.map((cat, idx) => (
              <Tag
                key={idx}
                color={selectedCategory === cat.name ? 'blue' : 'default'}
                style={{ cursor: 'pointer', marginBottom: 4 }}
                onClick={() => setSelectedCategory(cat.name)}
              >
                {cat.name} ({cat.count})
              </Tag>
            ))}
          </Card>

          <Card title={<><TagOutlined /> 热门标签</>} size="small" style={{ marginBottom: 16 }}>
            {tags.map((tag, idx) => (
              <Tag key={idx} style={{ marginBottom: 4, cursor: 'pointer' }} onClick={() => setSearch(tag.name)}>
                {tag.name} ({tag.count})
              </Tag>
            ))}
          </Card>

          <Card title={<><FireOutlined /> 热门文章</>} size="small">
            <List
              size="small"
              dataSource={popular}
              renderItem={item => (
                <List.Item style={{ padding: '4px 0', cursor: 'pointer' }} onClick={() => handleViewDetail(item.id)}>
                  <Text ellipsis style={{ flex: 1 }}>{item.title}</Text>
                  <Text type="secondary">{item.views}</Text>
                </List.Item>
              )}
            />
          </Card>
        </Col>

        {/* 右侧：文章列表 */}
        <Col span={18}>
          <Card loading={loading}>
            {articles.length === 0 ? (
              <Empty description="暂无文章" />
            ) : (
              <List
                dataSource={articles}
                renderItem={article => (
                  <List.Item
                    actions={[
                      <Button key="view" type="link" icon={<EyeOutlined />} onClick={() => handleViewDetail(article.id)}>
                        查看
                      </Button>,
                    ]}
                  >
                    <List.Item.Meta
                      title={<a onClick={() => handleViewDetail(article.id)}>{article.title}</a>}
                      description={
                        <Space>
                          <Tag color="blue">{article.category}</Tag>
                          {article.tags.map((t, i) => <Tag key={i}>{t}</Tag>)}
                          <Text type="secondary">浏览: {article.views}</Text>
                        </Space>
                      }
                    />
                  </List.Item>
                )}
              />
            )}
          </Card>
        </Col>
      </Row>

      {/* 新建文章弹窗 */}
      <Modal
        title="新建文章"
        open={modalVisible}
        onCancel={() => { setModalVisible(false); form.resetFields(); }}
        onOk={() => form.submit()}
        width={700}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item name="title" label="标题" rules={[{ required: true }]}>
            <Input placeholder="请输入文章标题" />
          </Form.Item>
          <Form.Item name="category" label="分类" rules={[{ required: true }]}>
            <Select placeholder="请选择分类">
              <Select.Option value="配置指南">配置指南</Select.Option>
              <Select.Option value="故障处理">故障处理</Select.Option>
              <Select.Option value="最佳实践">最佳实践</Select.Option>
              <Select.Option value="安全规范">安全规范</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="tags" label="标签">
            <Select mode="tags" placeholder="输入标签后回车" />
          </Form.Item>
          <Form.Item name="content" label="内容" rules={[{ required: true }]}>
            <TextArea rows={10} placeholder="支持Markdown格式" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 文章详情弹窗 */}
      <Modal
        title={detailModal?.title}
        open={!!detailModal}
        onCancel={() => setDetailModal(null)}
        footer={null}
        width={800}
      >
        {detailModal && (
          <div>
            <Space style={{ marginBottom: 16 }}>
              <Tag color="blue">{detailModal.category}</Tag>
              {detailModal.tags.map((t, i) => <Tag key={i}>{t}</Tag>)}
              <Text type="secondary">浏览: {detailModal.views}</Text>
            </Space>
            <div style={{ 
              background: '#f5f5f5', 
              padding: 16, 
              borderRadius: 8,
              whiteSpace: 'pre-wrap',
              fontFamily: 'monospace'
            }}>
              {detailModal.content}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default KnowledgeBase;
