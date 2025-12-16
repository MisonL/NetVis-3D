
import React from 'react';
import { Card, Row, Col, Statistic, Progress, Typography, Button, Tag, Space, Badge } from 'antd';
import { 
    CloudServerOutlined, 
    AlertOutlined, 
    CheckCircleOutlined, 
    ThunderboltOutlined,
    SoundOutlined
} from '@ant-design/icons';
import { useDevices } from '../../hooks/useDevices';
import { useSettings } from '../../context/SettingsContext';

const { Title, Text } = Typography;

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

const Dashboard = () => {
    const { settings } = useSettings();
    const { devices } = useDevices(settings.refreshRate);

    // Compute Metrics
    const totalDevices = devices.length;
    const onlineDevices = devices.filter(d => d.status === 'online' || d.status === 'success').length;
    const warningDevices = devices.filter(d => d.status === 'warning').length;
    const errorDevices = devices.filter(d => d.status === 'error').length;
    
    // Calculate total simulated traffic
    const totalTraffic = devices.reduce((acc, curr) => {
         const t = curr.metrics?.traffic || '0';
         let val = 0;
         if (t.includes('Gbps')) val = parseFloat(t) * 1000;
         else if (t.includes('Mbps')) val = parseInt(t);
         return acc + val;
    }, 0);
    const trafficDisplay = totalTraffic > 1000 ? `${(totalTraffic / 1000).toFixed(1)} Gbps` : `${Math.floor(totalTraffic)} Mbps`;

    const onlineRate = Math.round((onlineDevices / totalDevices) * 100);

    // Alert List
    const alerts = devices
        .filter(d => d.status !== 'online' && d.status !== 'success')
        .map(d => ({
            id: d.id,
            label: d.label,
            status: d.status,
            msg: d.status === 'warning' ? 'CPU 负载过高 (High Load)' : '网络连接中断 (Down)',
            time: '刚刚 (Just Now)'
        }));

    return (
        <div style={{ padding: '32px 48px', width: '100%', boxSizing: 'border-box' }}>
            <div style={{ marginBottom: 32, marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                     <Title level={2} style={{ margin: 0, marginBottom: 8, fontWeight: 700, letterSpacing: 0.5, lineHeight: 1.2 }}>系统监控仪表盘</Title>
                     <Text style={{ color: 'var(--text-secondary)' }}>实时全网运行状态监测</Text>
                </div>
                <Tag color="#1677ff" style={{ padding: '6px 12px', fontSize: 14 }}>
                     <Badge status="processing" color="#00f0ff" /> 实时监控中
                </Tag>
            </div>
            
            {/* Top Stat Cards */}
            <Row gutter={[24, 24]}>
                <Col xs={24} sm={12} lg={6}>
                    <GlassCard>
                        <Statistic 
                            title={<span style={{ color: 'var(--text-tertiary)' }}>设备总数</span>}
                            value={totalDevices} 
                            prefix={<CloudServerOutlined style={{ color: 'var(--text-secondary)' }} />} 
                            styles={{ content: { color: 'var(--text-primary)', fontWeight: 700 } }}
                        />
                    </GlassCard>
                </Col>
                <Col xs={24} sm={12} lg={6}>
                    <GlassCard>
                        <Statistic 
                            title={<span style={{ color: 'var(--text-tertiary)' }}>系统在线率</span>}
                            value={onlineRate} 
                            suffix="%" 
                            prefix={<CheckCircleOutlined style={{ color: 'var(--status-success)' }} />} 
                        />
                    </GlassCard>
                </Col>
                <Col xs={24} sm={12} lg={6}>
                    <GlassCard>
                        <Statistic 
                            title={<span style={{ color: 'var(--text-tertiary)' }}>当前告警</span>}
                            value={warningDevices + errorDevices} 
                            prefix={<AlertOutlined style={{ color: errorDevices > 0 ? 'var(--status-error)' : (warningDevices > 0 ? 'var(--status-warning)' : 'var(--text-tertiary)') }} />} 
                            styles={{ content: { color: errorDevices > 0 ? 'var(--status-error)' : (warningDevices > 0 ? 'var(--status-warning)' : 'var(--text-primary)'), fontWeight: 700 } }}
                        />
                        {(warningDevices + errorDevices) > 0 && 
                            <div style={{ position: 'absolute', right: 24, top: 24 }}>
                                <div className="pulse-circle" style={{ width: 8, height: 8, background: '#ff4d4f', borderRadius: '50%' }}></div>
                            </div>
                        }
                    </GlassCard>
                </Col>
                <Col xs={24} sm={12} lg={6}>
                    <GlassCard>
                         <Statistic 
                            title={<span style={{ color: 'var(--text-tertiary)' }}>实时总吞吐</span>}
                            value={trafficDisplay} 
                            prefix={<ThunderboltOutlined style={{ color: 'var(--accent-cyan)' }} />} 
                        />
                    </GlassCard>
                </Col>
            </Row>

            <Row gutter={[24, 24]} style={{ marginTop: 24 }}>
                {/* Resource Usage */}
                <Col xs={24} lg={14}>
                    <GlassCard title="核心资源负载 (Top Load)" style={{ height: '100%' }}>
                         {devices.slice(0, 5).map(device => {
                             const cpu = parseInt(device.metrics?.cpu || 0);
                             let statusColor = { from: '#1677ff', to: '#00f0ff' };
                             if (cpu > 80) statusColor = { from: '#ff4d4f', to: '#ff7875' };
                             else if (cpu > 60) statusColor = { from: '#fadb14', to: '#ffec3d' };
                             
                             return (
                                 <div key={device.id} style={{ marginBottom: 20 }}>
                                     <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                                         <Space>
                                            <Tag color="rgba(255,255,255,0.1)" style={{ border: 'none', color: 'var(--text-secondary)' }}>{device.type.toUpperCase()}</Tag>
                                         <Text strong style={{ color: 'var(--text-primary)' }}>{device.label}</Text>
                                         </Space>
                                         <Text style={{ color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{cpu}% CPU</Text>
                                     </div>
                                     <Progress 
                                        percent={cpu} 
                                        size="small" 
                                        showInfo={false}
                                        strokeColor={statusColor}
                                        railColor="rgba(255,255,255,0.05)"
                                    />
                                 </div>
                             )
                         })}
                    </GlassCard>
                </Col>

                {/* Recent Alerts */}
                <Col xs={24} lg={10}>
                    <GlassCard 
                        title="最新告警动态" 
                        extra={<Button type="link" size="small">查看全部</Button>}
                        style={{ height: '100%' }}
                    >
                        <div style={{ height: 320, overflow: 'auto' }}>
                            {alerts.length === 0 ? (
                                <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-tertiary)' }}>
                                    <CheckCircleOutlined style={{ fontSize: 32, marginBottom: 8, color: 'var(--status-success)' }} />
                                    <br/>系统运行平稳
                                </div>
                            ) : (
                                alerts.map(item => (
                                    <div key={item.id} style={{ 
                                        borderBottom: '1px solid rgba(255,255,255,0.05)', 
                                        padding: '16px 8px', 
                                        display: 'flex', 
                                        alignItems: 'center',
                                        transition: 'background 0.3s',
                                        borderRadius: 8,
                                        cursor: 'default'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                    >
                                        <div style={{ 
                                            width: 36, height: 36, 
                                            borderRadius: 8, 
                                            background: item.status === 'warning' ? 'rgba(250, 219, 20, 0.1)' : 'rgba(255, 77, 79, 0.1)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            marginRight: 16,
                                            flexShrink: 0
                                        }}>
                                            <SoundOutlined style={{ fontSize: 18, color: item.status === 'warning' ? 'var(--status-warning)' : 'var(--status-error)' }} />
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <Text strong style={{ color: 'var(--text-primary)', display: 'block' }}>{item.label}</Text>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                                                <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{item.msg}</span>
                                                <span style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>{item.time}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </GlassCard>
                </Col>
            </Row>
        </div>
    );
};

export default Dashboard;
