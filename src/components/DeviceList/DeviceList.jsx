import React, { useState } from 'react';
import { Table, Tag, Input, Space, Card, Typography, Button, Skeleton, Alert } from 'antd';
import { SearchOutlined, ReloadOutlined } from '@ant-design/icons';
import { useDevices } from '../../hooks/useDevices';

const { Title } = Typography;

const DeviceList = ({ onLocate }) => {
    const [searchText, setSearchText] = useState('');
    const { devices, loading, error, refresh } = useDevices();

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
            render: (text) => <b>{text}</b>,
            sorter: (a, b) => a.label.localeCompare(b.label),
        },
        // ... existing columns
        {
            title: 'IP 地址',
            dataIndex: 'ip',
            key: 'ip',
        },
        {
            title: '类型',
            dataIndex: 'type',
            key: 'type',
            render: (text) => <Tag color="blue">{text.toUpperCase()}</Tag>,
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
                let color = status === 'online' ? 'success' : 'error';
                if (status === 'warning') color = 'warning';
                return (
                    <Tag color={color}>
                        {status.toUpperCase()}
                    </Tag>
                );
            },
            filters: [
                { text: 'Online', value: 'online' },
                { text: 'Offline', value: 'offline' },
            ],
            onFilter: (value, record) => record.status === value,
        },
        {
            title: '位置',
            dataIndex: 'location',
            key: 'location',
        },
        {
            title: '操作',
            key: 'action',
            render: (_, record) => (
                <Space size="middle">
                     <Button 
                        type="link" 
                        icon={<SearchOutlined />} 
                        onClick={() => onLocate && onLocate(record.id)}
                     >
                        定位
                     </Button>
                </Space>
            ),
        },
    ];

    return (
        <Card title={<Title level={4} style={{ margin: 0 }}>设备清单</Title>} extra={
            <Button icon={<ReloadOutlined />} onClick={refresh} loading={loading}>刷新</Button>
        }>
            {error && (
                <Alert 
                    message="加载失败" 
                    description={error.message || '无法获取设备数据，请检查网络连接'} 
                    type="error" 
                    showIcon 
                    style={{ marginBottom: 16 }}
                />
            )}
            <div style={{ marginBottom: 16 }}>
                <Input 
                    placeholder="搜索设备名称或 IP..." 
                    prefix={<SearchOutlined />} 
                    onChange={e => setSearchText(e.target.value)}
                    style={{ width: 300 }}
                    allowClear
                />
                <span style={{ marginLeft: 8, color: '#888' }}>
                    共 {filteredData.length} 台设备
                </span>
            </div>
            <Table 
                columns={columns} 
                dataSource={filteredData} 
                rowKey="id"
                pagination={{ pageSize: 8 }}
                loading={loading}
            />
        </Card>
    );
};

export default DeviceList;
