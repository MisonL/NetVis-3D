import React, { useState } from 'react';
import { Form, Input, Button, Card, Typography, message, Checkbox, Space } from 'antd';
import { UserOutlined, LockOutlined, LoginOutlined } from '@ant-design/icons';
import { useAuth } from '../../context/AuthContext';

const { Title, Text } = Typography;

const LoginPage = ({ onLoginSuccess }) => {
  const { login } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (values) => {
    setLoading(true);
    try {
      const result = await login(values.username, values.password);
      if (result.success) {
        message.success('登录成功');
        onLoginSuccess?.();
      } else {
        message.error(result.message || '登录失败');
      }
    } catch {
      message.error('登录失败，请检查网络连接');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #0a1628 0%, #1a2a4a 50%, #0d1b2a 100%)',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* 背景装饰 */}
      <div style={{
        position: 'absolute',
        width: '600px',
        height: '600px',
        background: 'radial-gradient(circle, rgba(22, 119, 255, 0.15) 0%, transparent 70%)',
        top: '-200px',
        right: '-200px',
        borderRadius: '50%',
      }} />
      <div style={{
        position: 'absolute',
        width: '400px',
        height: '400px',
        background: 'radial-gradient(circle, rgba(0, 240, 255, 0.1) 0%, transparent 70%)',
        bottom: '-100px',
        left: '-100px',
        borderRadius: '50%',
      }} />

      <Card
        className="login-card"
        style={{
          width: 420,
          background: 'rgba(15, 25, 45, 0.85)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: 16,
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
        }}
        styles={{ body: { padding: '48px 40px', background: 'transparent' } }}
      >
        {/* Logo 和标题 */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{
            fontSize: 28,
            fontWeight: 800,
            background: 'linear-gradient(45deg, #1677ff, #00f0ff)',
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            color: 'transparent',
            marginBottom: 12,
            letterSpacing: 2,
          }}>
            NETVIS PRO
          </div>
          <Text style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: 14 }}>
            企业级网络设备管理平台
          </Text>
        </div>

        <Form
          name="login"
          onFinish={handleSubmit}
          autoComplete="off"
          size="large"
          initialValues={{ remember: true }}
        >
          <Form.Item
            name="username"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input
              prefix={<UserOutlined style={{ color: 'rgba(255,255,255,0.3)' }} />}
              placeholder="用户名"
              className="login-input"
            />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password
              prefix={<LockOutlined style={{ color: 'rgba(255,255,255,0.3)' }} />}
              placeholder="密码"
              className="login-input"
            />
          </Form.Item>

          <Form.Item>
            <Space style={{ width: '100%', justifyContent: 'space-between' }}>
              <Form.Item name="remember" valuePropName="checked" noStyle>
                <Checkbox style={{ color: 'rgba(255,255,255,0.5)' }}>记住我</Checkbox>
              </Form.Item>
              <a href="#" style={{ color: '#1677ff', fontSize: 13 }}>忘记密码?</a>
            </Space>
          </Form.Item>

          <Form.Item style={{ marginBottom: 16 }}>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              block
              icon={<LoginOutlined />}
              style={{
                height: 48,
                borderRadius: 8,
                fontSize: 16,
                fontWeight: 600,
                background: 'linear-gradient(135deg, #1677ff 0%, #0958d9 100%)',
                border: 'none',
                boxShadow: '0 4px 20px rgba(22, 119, 255, 0.4)',
              }}
            >
              登 录
            </Button>
          </Form.Item>
        </Form>

        <div style={{ textAlign: 'center', marginTop: 24 }}>
          <Text style={{ color: 'rgba(255, 255, 255, 0.3)', fontSize: 12 }}>
            默认账号: admin / admin123
          </Text>
        </div>
      </Card>
    </div>
  );
};

export default LoginPage;
