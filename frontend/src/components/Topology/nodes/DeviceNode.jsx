import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { Typography } from 'antd';
import { CloudServerOutlined, SafetyCertificateOutlined, DatabaseOutlined, ApartmentOutlined } from '@ant-design/icons';

const { Text } = Typography;

const getIcon = (type) => {
    const style = { fontSize: 32, color: 'var(--text-primary)' };
    switch (type) {
        case 'cloud': return <CloudServerOutlined style={{ ...style, color: 'var(--accent-cyan)' }} />;
        case 'firewall': return <SafetyCertificateOutlined style={{ ...style, color: 'var(--accent-purple)' }} />;
        case 'switch': 
        case 'core-switch':
        case 'agg-switch': return <ApartmentOutlined style={{ ...style, color: 'var(--primary-color)' }} />;
        case 'server': return <CloudServerOutlined style={style} />;
        case 'database': 
        case 'storage': return <DatabaseOutlined style={{ ...style, color: '#faad14' }} />;
        default: return <CloudServerOutlined style={style} />;
    }
};

const DeviceNode = ({ data, selected }) => {
    const isOnline = data.status === 'online' || data.status === 'success';
    const isWarning = data.status === 'warning';
    
    let statusColor = 'var(--status-error)';
    if (isOnline) statusColor = 'var(--status-success)';
    if (isWarning) statusColor = 'var(--status-warning)';
    
    return (
        <div style={{ position: 'relative', textAlign: 'center' }}>
            <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
            
            {/* Glassmorphism Card Container */}
            <div style={{
                width: 140,
                padding: '16px 12px',
                borderRadius: '16px',
                background: 'var(--glass-panel-bg)',
                backdropFilter: 'var(--glass-blur)',
                WebkitBackdropFilter: 'var(--glass-blur)',
                border: `1px solid ${selected ? 'var(--primary-color)' : 'var(--glass-panel-border)'}`,
                boxShadow: selected 
                    ? '0 0 20px rgba(22, 119, 255, 0.4)' 
                    : 'var(--glass-panel-shadow)',
                transition: 'all 0.3s ease',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 12,
                transform: selected ? 'translateY(-4px) scale(1.05)' : 'none'
            }}>
                {/* Status Glow */}
                <div style={{
                    position: 'absolute',
                    top: 10,
                    right: 10,
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    backgroundColor: statusColor,
                    boxShadow: `0 0 10px ${statusColor}`
                }} />

                {/* React Icon instead of Image for sharpness */}
                <div style={{ 
                    width: 50, 
                    height: 50, 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    background: 'rgba(255,255,255,0.05)',
                    borderRadius: '50%'
                }}>
                    {getIcon(data.type)}
                </div>

                {/* Labels */}
                <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                    <Text strong style={{ fontSize: 13, color: 'var(--text-primary)', marginBottom: 2 }} ellipsis>
                        {data.label}
                    </Text>
                    <Text style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'monospace' }}>{data.ip}</Text>
                </div>
            </div>

            <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
        </div>
    );
};

export default memo(DeviceNode);
