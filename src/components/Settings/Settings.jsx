import React, { useState } from 'react';
import { Card, Form, Switch, Select, Slider, Button, message, Divider, Typography, Space } from 'antd';
import { SaveOutlined, RestOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;
const { Option } = Select;

const Settings = () => {
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);

    const handleSave = () => {
        setLoading(true);
        setTimeout(() => {
            setLoading(false);
            message.success('系统设置已保存');
        }, 800);
    };

    const initialValues = {
        theme: 'dark',
        particleEffects: true,
        textureQuality: 'high',
        refreshRate: 5,
        autoRotate: false
    };

    return (
        <Card title={<Title level={4} style={{ margin: 0 }}>系统设置</Title>} style={{ maxWidth: 800 }}>
            <Form
                form={form}
                layout="vertical"
                initialValues={initialValues}
                onFinish={handleSave}
            >
                <Divider orientation="left">显示设置 (Appearance)</Divider>
                
                <Form.Item label="界面主题" name="theme">
                    <Select>
                        <Option value="dark">暗夜黑 (Dark)</Option>
                        <Option value="light">极简白 (Light)</Option>
                    </Select>
                </Form.Item>

                <div style={{ display: 'flex', gap: 24 }}>
                     <Form.Item label="启用粒子特效" name="particleEffects" valuePropName="checked">
                        <Switch />
                    </Form.Item>
                    
                    <Form.Item label="3D 自动旋转" name="autoRotate" valuePropName="checked">
                        <Switch />
                    </Form.Item>
                </div>

                <Divider orientation="left">监控配置 (Monitor)</Divider>

                <Form.Item label="数据刷新频率 (秒)" name="refreshRate">
                    <Slider min={1} max={60} marks={{ 1: '1s', 5: '5s', 30: '30s', 60: '60s' }} />
                </Form.Item>

                <Form.Item label="贴图质量" name="textureQuality">
                     <Select>
                        <Option value="low">低 (性能优先)</Option>
                        <Option value="medium">中</Option>
                        <Option value="high">高 (画质优先)</Option>
                    </Select>
                </Form.Item>

                <Divider orientation="left">系统维护 (System)</Divider>

                <div style={{ marginBottom: 24 }}>
                    <Text type="secondary">虽然目前是演示数据，但您可以模拟清除本地缓存的操作。</Text>
                </div>

                <Form.Item>
                    <Space size="large">
                        <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={loading}>
                            保存配置
                        </Button>
                        <Button danger icon={<RestOutlined />} onClick={() => message.info('缓存已清除')}>
                            清除缓存
                        </Button>
                    </Space>
                </Form.Item>
            </Form>
        </Card>
    );
};

export default Settings;
