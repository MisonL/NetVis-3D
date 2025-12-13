import React, { useState } from 'react';
import { Form, Switch, Select, Slider, Button, message, Divider, Typography, Space, Tabs, Input, InputNumber, Radio } from 'antd';
import { 
    SaveOutlined, 
    GlobalOutlined, 
    WifiOutlined, 
    DashboardOutlined, 
    DatabaseOutlined, 
    InfoCircleOutlined,
    DesktopOutlined
} from '@ant-design/icons';
import { useSettings } from '../../context/SettingsContext';

const { Title, Text } = Typography;
const { Option } = Select;

const BasicSettings = () => {
    const { settings, updateSetting } = useSettings();
    return (
        <Form layout="vertical" initialValues={settings}>
            <Title level={4} style={{ color: 'var(--text-primary)', marginBottom: 24 }}>基础设置 (Basic)</Title>
            
            <Form.Item label="系统名称 (System Name)">
                <Input defaultValue="NetVis Data Center Pro" style={{ width: 400 }} />
            </Form.Item>
            
            <Form.Item label="默认语言 (Language)">
                <Select defaultValue="zh_CN" style={{ width: 200 }}>
                    <Option value="zh_CN">简体中文</Option>
                    <Option value="en_US">English</Option>
                </Select>
            </Form.Item>

            <Form.Item label="数据刷新频率 (Refresh Rate)">
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <Slider 
                        min={1} max={10} 
                        style={{ width: 200 }}
                        value={settings.refreshRate}
                        onChange={val => updateSetting('refreshRate', val)}
                    />
                    <Text style={{ color: 'var(--text-secondary)' }}>{settings.refreshRate} 秒/次</Text>
                </div>
            </Form.Item>
        </Form>
    );
};

const DisplaySettings = () => {
    const { settings, updateSetting } = useSettings();
    return (
        <Form layout="vertical">
            <Title level={4} style={{ color: 'var(--text-primary)', marginBottom: 24 }}>显示设置 (Display)</Title>
            
            <Form.Item label="界面主题 (Theme Mode)">
                <Radio.Group 
                    value={settings.theme} 
                    onChange={e => updateSetting('theme', e.target.value)}
                    buttonStyle="solid"
                >
                    <Radio.Button value="light">☀️ 极简白 (Light)</Radio.Button>
                    <Radio.Button value="dark">🌙 暗夜黑 (Dark)</Radio.Button>
                </Radio.Group>
            </Form.Item>

            <Form.Item label="3D 渲染质量 (Render Quality)">
                <Select 
                    value={settings.textureQuality} 
                    onChange={val => updateSetting('textureQuality', val)}
                    style={{ width: 200 }}
                >
                    <Option value="low">⚡️ 性能优先</Option>
                    <Option value="medium">⚖️ 均衡模式</Option>
                    <Option value="high">💎 画质优先</Option>
                </Select>
            </Form.Item>
            
            <Divider style={{ borderColor: 'var(--glass-border)' }} />
            
            <div style={{ display: 'flex', gap: 40 }}>
                <Form.Item label="粒子特效" style={{ marginBottom: 0 }}>
                    <Switch checked={settings.particleEffects} onChange={val => updateSetting('particleEffects', val)} />
                </Form.Item>
                <Form.Item label="自动旋转" style={{ marginBottom: 0 }}>
                    <Switch checked={settings.autoRotate} onChange={val => updateSetting('autoRotate', val)} />
                </Form.Item>
                <Form.Item label="辉光效果 (Bloom)" style={{ marginBottom: 0 }}>
                    <Switch checked={settings.bloomEnabled} onChange={val => updateSetting('bloomEnabled', val)} />
                </Form.Item>
            </div>
        </Form>
    );
};

const NetworkSettings = () => (
    <Form layout="vertical">
        <Title level={4} style={{ color: 'var(--text-primary)', marginBottom: 24 }}>网络配置 (Network)</Title>
            <Form.Item label="SNMP 团体名 (Community)">
            <Input.Password defaultValue="public_readonly" style={{ width: 300 }} />
        </Form.Item>
        <Form.Item label="自动发现网段 (Discovery Range)">
            <Input.TextArea defaultValue="192.168.1.0/24\n10.0.90.0/24" rows={3} style={{ width: 400 }} />
        </Form.Item>
        <Form.Item label="连接超时 (Timeout)">
            <InputNumber defaultValue={3000} addonAfter="ms" />
        </Form.Item>
    </Form>
);

const Settings = () => {
    
    const [loading, setLoading] = useState(false);

    const handleSave = () => {
        setLoading(true);
        setTimeout(() => {
            setLoading(false);
            message.success('系统配置已保存并生效');
        }, 800);
    };

    const items = [
        { key: 'basic', label: '基础设置', icon: <DesktopOutlined />, children: <BasicSettings /> },
        { key: 'display', label: '显示偏好', icon: <GlobalOutlined />, children: <DisplaySettings /> },
        { key: 'network', label: '网络配置', icon: <WifiOutlined />, children: <NetworkSettings /> },
        { key: 'monitor', label: '监控策略', icon: <DashboardOutlined />, children: <div style={{ color: 'var(--text-secondary)' }}>监控阈值配置模块 (Mock)</div> },
        { key: 'data', label: '数据管理', icon: <DatabaseOutlined />, children: <div style={{ color: 'var(--text-secondary)' }}>数据备份与保留策略 (Mock)</div> },
        { key: 'about', label: '关于系统', icon: <InfoCircleOutlined />, children: <div style={{ color: 'var(--text-secondary)' }}>NetVis Pro v2.5.0 (Build 20241212)</div> },
    ];

    return (
        <div style={{ 
            height: '100%', 
            padding: '24px 0',
            display: 'flex', 
            flexDirection: 'column' 
        }}>
            <div style={{ flex: 1, background: 'var(--glass-panel-bg)', borderRadius: 8, padding: 24, border: '1px solid var(--glass-panel-border)' }}>
                <Tabs 
                    tabPosition="left"
                    items={items.map(item => ({
                        key: item.key,
                        label: (
                            <span>
                                {item.icon}
                                {item.label}
                            </span>
                        ),
                        children: (
                            <div style={{ maxWidth: 800, paddingLeft: 24 }}>
                                {item.children}
                                <Divider style={{ borderColor: 'var(--glass-border)', margin: '40px 0 24px' }} />
                                <Button type="primary" icon={<SaveOutlined />} onClick={handleSave} loading={loading}>
                                    保存更改
                                </Button>
                            </div>
                        )
                    }))}
                />
            </div>
        </div>
    );
};

export default Settings;
