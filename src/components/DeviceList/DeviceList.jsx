import React, { useState } from 'react';
import { Table, Tag, Input, Space, Card, Typography, Button, Alert } from 'antd';
import { SearchOutlined, ReloadOutlined } from '@ant-design/icons';
import { useSimulation } from '../../services/SimulationService';
import { useSettings } from '../../context/SettingsContext';

const { Title } = Typography;

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

const DeviceList = ({ onLocate }) => {
    const [searchText, setSearchText] = useState('');
    const { settings } = useSettings();
    const { devices } = useSimulation(true, settings.refreshRate); 
    const loading = false; 

    // Filter logic
    const filteredData = devices.filter(device => 
        device.label.toLowerCase().includes(searchText.toLowerCase()) || 
        device.ip.includes(searchText)
    );

    const columns = [
        {
            title: '设备名称',
            dataIndex: 'label',
            key: 'label',
            render: (text) => <b style={{ color: 'var(--text-primary)' }}>{text}</b>,
            sorter: (a, b) => a.label.localeCompare(b.label),
        },
        {
            title: 'IP 地址',
            dataIndex: 'ip',
            key: 'ip',
        },
        {
            title: '类型',
            dataIndex: 'type',
            key: 'type',
            render: (text) => (
                <Tag color="#1677ff" style={{ border: 'none', background: 'rgba(22, 119, 255, 0.15)' }}>
                    {text.toUpperCase()}
                </Tag>
            ),
            filters: [
                { text: 'Server', value: 'server' },
                { text: 'Switch', value: 'switch' },
                { text: 'Firewall', value: 'firewall' },
                { text: 'Cloud', value: 'cloud' },
                { text: 'Database', value: 'database' },
            ],
            onFilter: (value, record) => record.type.includes(value),
        },
        {
            title: '状态',
            dataIndex: 'status',
            key: 'status',
            render: (status) => {
                let color = (status === 'online' || status === 'success') ? '#52c41a' : '#ff4d4f';
                if (status === 'warning') color = '#faad14';
                
                return (
                    <Tag color={color} style={{ border: 'none', background: 'transparent', boxShadow: `0 0 8px ${color}40`, fontWeight: 'bold' }}>
                        {status.toUpperCase()}
                    </Tag>
                );
            },
            filters: [
                { text: 'Online', value: 'online' },
                { text: 'Offline', value: 'offline' },
                { text: 'Warning', value: 'warning' },
            ],
            onFilter: (value, record) => record.status === value,
        },
        {
            title: '位置',
            dataIndex: 'location',
            key: 'location',
        },
        {
            title: '实时流量',
            dataIndex: 'traffic',
            key: 'traffic',
            render: (traffic, record) => (
                <span style={{ color: 'var(--accent-cyan)', fontFamily: 'monospace' }}>
                    {record.metrics?.traffic || traffic || '-'}
                </span>
            )
        },
        {
            title: '操作',
            key: 'action',
            render: (_, record) => (
                <Space size="middle">
                     <Button 
                        type="link"
                        size="small"
                        icon={<SearchOutlined />} 
                        onClick={() => onLocate && onLocate(record.id)}
                        style={{ color: 'var(--primary-color)' }}
                     >
                        定位
                     </Button>
                </Space>
            ),
        },
    ];

    return (
        <GlassCard 
            title="数据中心设备资产清单 (实时)" 
            extra={
                <Button icon={<ReloadOutlined />} onClick={() => {}} loading={loading} type="text" style={{ color: 'var(--text-primary)' }}>
                    刷新
                </Button>
            }
        >
            <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Input 
                    placeholder="搜索设备名称或 IP..." 
                    prefix={<SearchOutlined style={{ color: 'var(--text-secondary)' }} />} 
                    onChange={e => setSearchText(e.target.value)}
                    style={{ width: 320, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-primary)' }}
                    allowClear
                    className="glass-input"
                />
                <Tag color="#108ee9" style={{ border: 'none', fontSize: 13, padding: '4px 10px' }}>
                     共 {filteredData.length} 台设备
                </Tag>
            </div>
            <Table 
                columns={columns} 
                dataSource={filteredData} 
                rowKey="id"
                pagination={{ pageSize: 8, showSizeChanger: false }}
                loading={loading}
                className="glass-table"
            />
        </GlassCard>
    );
};

export default DeviceList;
