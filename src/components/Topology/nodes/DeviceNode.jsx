import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { Typography, Badge } from 'antd';

const { Text } = Typography;

const getIconPath = (type) => {
    switch (type) {
        case 'cloud': return '/icons/icon_cloud_v2.png';
        case 'firewall': return '/icons/icon_firewall_v2.png';
        case 'switch': 
        case 'core-switch':
        case 'agg-switch': return '/icons/icon_switch_v2.png';
        case 'server': return '/icons/icon_server_v2.png';
        case 'database': 
        case 'storage': return '/icons/icon_database_v2.png';
        case 'router': return '/icons/icon_switch_v2.png'; 
        default: return '/icons/icon_server_v2.png';
    }
};

const DeviceNode = ({ data, selected }) => {
    const isOnline = data.status === 'online';
    
    return (
        <div style={{ position: 'relative', textAlign: 'center' }}>
            <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
            
            {/* Glassmorphism Card Container */}
            <div style={{
                width: 120,
                padding: '12px 8px',
                borderRadius: '12px',
                background: 'rgba(255, 255, 255, 0.65)',
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
                border: `1px solid ${selected ? '#1677ff' : 'rgba(255, 255, 255, 0.5)'}`,
                boxShadow: selected 
                    ? '0 8px 32px rgba(22, 119, 255, 0.25)' 
                    : '0 4px 16px rgba(31, 38, 135, 0.08)',
                transition: 'all 0.3s ease',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 8,
                transform: selected ? 'translateY(-2px)' : 'none'
            }}>
                {/* Status Indicator Dot */}
                <div style={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    backgroundColor: isOnline ? '#52c41a' : '#ff4d4f',
                    boxShadow: isOnline ? '0 0 6px #52c41a' : '0 0 6px #ff4d4f'
                }} />

                {/* 3D Icon Image */}
                <div style={{ 
                    width: 64, 
                    height: 64, 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    marginBottom: 4
                }}>
                    <img 
                        src={getIconPath(data.type)} 
                        alt={data.type} 
                        style={{ 
                            width: '100%', 
                            height: '100%', 
                            objectFit: 'contain',
                            filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.1))'
                        }} 
                    />
                </div>

                {/* Labels */}
                <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                    <Text strong style={{ fontSize: 12, lineHeight: 1.2, marginBottom: 2 }} ellipsis>
                        {data.label}
                    </Text>
                    <Text type="secondary" style={{ fontSize: 10 }}>{data.ip}</Text>
                </div>
            </div>

            <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
        </div>
    );
};

export default memo(DeviceNode);
