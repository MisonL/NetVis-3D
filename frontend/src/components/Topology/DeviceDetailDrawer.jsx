import React from 'react';
import { Drawer, Descriptions, Tag, Typography, Divider, Button, Space, Progress, Badge } from 'antd';
import { CloseOutlined, DashboardOutlined, SafetyCertificateOutlined, CloudServerOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

const DeviceDetailDrawer = ({ open, onClose, device }) => {
    return (
        <Drawer
            title={
                <Space>
                    <CloudServerOutlined style={{ color: '#1677ff' }} />
                    <span style={{ color: 'var(--text-primary)' }}>设备详情</span>
                </Space>
            }
            placement="right"
            onClose={onClose}
            open={open}

            styles={{ 
              wrapper: { width: 420 }, 
              mask: { background: 'transparent' }
            }}
            mask={false}
            extra={
              <Button type="text" icon={<CloseOutlined style={{ color: 'var(--text-secondary)' }} />} onClick={onClose} />
            }
            style={{ zIndex: 9999 }} // Ensure on top of canvas controls
            // drawerStyle replaced by styles.wrapper in v5
            // width replaced by styles.wrapper width
        >
             {device && (
                <div style={{ color: 'var(--text-secondary)' }}>
                    <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'space-between',
                        marginBottom: 24,
                        padding: 16,
                        background: 'rgba(255,255,255,0.03)',
                        borderRadius: 12,
                        border: '1px solid rgba(255,255,255,0.05)'
                    }}>
                        <div>
                            <Title level={4} style={{ margin: 0, color: 'var(--text-primary)' }}>{device.label}</Title>
                            <Text type="secondary" copyable>{device.id}</Text>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                             <Tag color={device.status === 'online' ? '#52c41a' : '#ff4d4f'} style={{ margin: 0, padding: '4px 12px', fontSize: 13, border: 'none' }}>
                                 {device.status.toUpperCase()}
                             </Tag>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
                        <div style={{ background: 'rgba(22, 119, 255, 0.05)', padding: 16, borderRadius: 12, border: '1px solid rgba(22, 119, 255, 0.1)' }}>
                            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 4 }}>CPU 使用率</div>
                            <div style={{ fontSize: 24, color: '#fff', fontWeight: 'bold' }}>
                                {device.metrics?.cpu || '0'}%
                            </div>
                            <Progress 
                                percent={parseInt(device.metrics?.cpu || 0)} 
                                showInfo={false} 
                                strokeColor={parseInt(device.metrics?.cpu) > 80 ? '#ff4d4f' : '#1677ff'} 
                                size="small"
                                trailColor="rgba(255,255,255,0.1)"
                            />
                        </div>
                        <div style={{ background: 'rgba(0, 240, 255, 0.05)', padding: 16, borderRadius: 12, border: '1px solid rgba(0, 240, 255, 0.1)' }}>
                            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 4 }}>内存使用率</div>
                            <div style={{ fontSize: 24, color: '#fff', fontWeight: 'bold' }}>
                                {device.metrics?.memory || '0'}%
                            </div>
                            <Progress 
                                percent={parseInt(device.metrics?.memory || 0)} 
                                showInfo={false} 
                                strokeColor="#00f0ff" 
                                size="small"
                                trailColor="rgba(255,255,255,0.1)"
                            />
                        </div>
                    </div>

                    <Descriptions column={1} size="small" style={{ marginBottom: 24 }}>
                        <Descriptions.Item label="IP 地址">{device.ip}</Descriptions.Item>
                        <Descriptions.Item label="设备类型">{device.type}</Descriptions.Item>
                        <Descriptions.Item label="物理位置">{device.location || 'Unknown'}</Descriptions.Item>
                        <Descriptions.Item label="运行时间">{device.uptime || '-'}</Descriptions.Item>
                        <Descriptions.Item label="实时流量">
                             <span style={{ color: 'var(--accent-cyan)', fontFamily: 'monospace', fontWeight: 'bold' }}>
                                 {device.metrics?.traffic || '-'}
                             </span>
                        </Descriptions.Item>
                    </Descriptions>
                    
                    {device.alerts && device.alerts.length > 0 && (
                         <div style={{ marginTop: 24, background: 'rgba(255, 77, 79, 0.1)', padding: 16, borderRadius: 8, border: '1px solid rgba(255, 77, 79, 0.2)' }}>
                            <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', color: '#ff4d4f' }}>
                                <SafetyCertificateOutlined style={{ marginRight: 8 }} />
                                <span style={{ fontWeight: 'bold' }}>安全告警 ({device.alerts.length})</span>
                            </div>
                            <ul style={{ color: 'var(--text-secondary)', paddingLeft: 20, margin: 0 }}>
                                {device.alerts.map((alert, idx) => (
                                    <li key={idx} style={{ marginBottom: 4 }}>{alert}</li>
                                ))}
                            </ul>
                         </div>
                    )}
                </div>
             )}
        </Drawer>
    );
};

export default DeviceDetailDrawer;
