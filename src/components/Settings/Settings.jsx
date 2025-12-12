import React, { useState } from 'react';
import { Card, Form, Switch, Select, Slider, Button, message, Divider, Typography, Space } from 'antd';
import { SaveOutlined, RestOutlined, BgColorsOutlined, SettingOutlined } from '@ant-design/icons';
import { useSettings } from '../../context/SettingsContext';

const { Title, Text } = Typography;
const { Option } = Select;

const GlassCard = ({ children, title, extra, ...props }) => (
    <Card 
        variant="borderless" 
        title={title ? <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{title}</span> : null}
        extra={extra}
        style={{ 
            height: '100%', 
            borderRadius: 16,
            background: 'var(--glass-panel-bg)',
            backdropFilter: 'var(--glass-blur)',
            border: '1px solid var(--glass-panel-border)',
            boxShadow: 'var(--glass-panel-shadow)',
            ...props.style
        }}
        {...props}
    >
        {children}
    </Card>
);

const Settings = () => {
    const { settings, updateSetting } = useSettings();
    const [loading, setLoading] = useState(false);

    const handleSave = () => {
        setLoading(true);
        // Simulate API call or just confirm saving
        setTimeout(() => {
            setLoading(false);
            message.success('系统设置已保存');
        }, 500);
    };

    return (
        <GlassCard 
            title={
                <Space>
                    <SettingOutlined style={{ color: 'var(--primary-color)' }} />
                    系统偏好设置
                </Space>
            } 
            style={{ maxWidth: 800, margin: '0 auto' }}
        >
            <Form
                layout="vertical"
                initialValues={settings}
                onFinish={handleSave}
            >
                <Divider titlePlacement="left" style={{ borderColor: 'rgba(255,255,255,0.1)', color: 'var(--text-tertiary)' }}>视觉效果 (Effects)</Divider>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                    <Form.Item label={<span style={{ color: 'var(--text-secondary)' }}>界面主题</span>} name="theme">
                        <Select 
                            value={settings.theme} 
                            onChange={val => updateSetting('theme', val)}
                            popupClassName="glass-dropdown"
                        >
                            <Option value="dark">🌙 暗夜黑 (Dark)</Option>
                            <Option value="light">☀️ 极简白 (Light)</Option>
                        </Select>
                    </Form.Item>

                    <Form.Item label={<span style={{ color: 'var(--text-secondary)' }}>贴图质量</span>} name="textureQuality">
                        <Select value={settings.textureQuality} onChange={val => updateSetting('textureQuality', val)} popupClassName="glass-dropdown">
                            <Option value="low">⚡️ 低 (性能优先)</Option>
                            <Option value="medium">⚖️ 中 (均衡)</Option>
                            <Option value="high">💎 高 (画质优先)</Option>
                        </Select>
                    </Form.Item>
                </div>

                <div style={{ display: 'flex', gap: 48, background: 'rgba(255,255,255,0.02)', padding: 16, borderRadius: 8 }}>
                     <Form.Item label={<span style={{ color: 'var(--text-secondary)' }}>粒子特效</span>} name="particleEffects" style={{ marginBottom: 0 }}>
                        <Switch checked={settings.particleEffects} onChange={val => updateSetting('particleEffects', val)} />
                    </Form.Item>
                    
                    <Form.Item label={<span style={{ color: 'var(--text-secondary)' }}>3D 自动旋转</span>} name="autoRotate" style={{ marginBottom: 0 }}>
                         <Switch checked={settings.autoRotate} onChange={val => updateSetting('autoRotate', val)} />
                    </Form.Item>

                    <Form.Item label={<span style={{ color: 'var(--text-secondary)' }}>辉光特效 (Bloom)</span>} name="bloomEnabled" style={{ marginBottom: 0 }}>
                         <Switch checked={settings.bloomEnabled} onChange={val => updateSetting('bloomEnabled', val)} />
                    </Form.Item>
                </div>

                <Divider titlePlacement="left" style={{ borderColor: 'rgba(255,255,255,0.1)', color: 'var(--text-tertiary)' }}>监控参数 (Metrics)</Divider>

                <Form.Item label={<span style={{ color: 'var(--text-secondary)' }}>数据刷新频率 ({settings.refreshRate}秒)</span>} name="refreshRate">
                    <Slider 
                        min={1} max={10} 
                        marks={{ 1: '实时 (1s)', 5: '标准 (5s)', 10: '节能 (10s)' }} 
                        value={settings.refreshRate}
                        onChange={val => updateSetting('refreshRate', val)}
                        tooltip={{ formatter: val => `${val} 秒` }}
                    />
                </Form.Item>


                <Divider style={{ borderColor: 'rgba(255,255,255,0.1)' }} />

                <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
                    <Space size="large">
                        <Button danger icon={<RestOutlined />} onClick={() => message.info('缓存已清除')} type="text">
                            清除缓存
                        </Button>
                         <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={loading} size="large" style={{ padding: '0 32px' }}>
                            保存配置
                        </Button>
                    </Space>
                </Form.Item>
            </Form>
        </GlassCard>
    );
};

export default Settings;
