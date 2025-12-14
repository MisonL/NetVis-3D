import React, { useState } from 'react';
import { Table, Tag, Input, Space, Card, Typography, Button, Alert, Select, Upload, Modal, message, Popconfirm } from 'antd';
import { 
    SearchOutlined, 
    ReloadOutlined, 
    EditOutlined, 
    DeleteOutlined, 
    PlusOutlined, 
    UploadOutlined, 
    DownloadOutlined,
    AimOutlined,
    SettingOutlined,
    ExportOutlined,
    EyeOutlined
} from '@ant-design/icons';
import * as XLSX from 'xlsx';

const { Dragger } = Upload;
import { useSimulation } from '../../services/SimulationService';
import { useSettings } from '../../context/SettingsContext';
import DeviceDrawer from './DeviceDrawer';
import DeviceFormModal from './DeviceFormModal';

const DeviceList = ({ onLocate }) => {
    const [searchText, setSearchText] = useState('');
    const { settings } = useSettings();
    const { devices, updateDevices } = useSimulation(true, settings.refreshRate); 
    const [loading, setLoading] = useState(false);
    const [isImportModalVisible, setIsImportModalVisible] = useState(false);
    
    // 新增状态
    const [drawerVisible, setDrawerVisible] = useState(false);
    const [selectedDeviceId, setSelectedDeviceId] = useState(null);
    const [formVisible, setFormVisible] = useState(false);
    const [editingDevice, setEditingDevice] = useState(null);
    
    // 批量操作状态
    const [selectedRowKeys, setSelectedRowKeys] = useState([]);

    // Filter logic
    const filteredData = devices.filter(device => 
        device.label.toLowerCase().includes(searchText.toLowerCase()) || 
        device.ip.includes(searchText)
    );

    const handleRefresh = () => {
        setLoading(true);
        setTimeout(() => setLoading(false), 800);
    };

    const handleDownloadTemplate = () => {
        const templateData = [
            { label: 'Server-001', ip: '192.168.1.100', type: 'server', location: 'DC-A', status: 'online' },
            { label: 'Switch-Core', ip: '10.0.0.1', type: 'switch', location: 'Core Room', status: 'online' },
        ];
        const ws = XLSX.utils.json_to_sheet(templateData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Template");
        XLSX.writeFile(wb, "device_import_template.xlsx");
    };

    const handleFileUpload = (file) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                const jsonData = XLSX.utils.sheet_to_json(firstSheet);
                
                if (jsonData.length === 0) {
                    message.error('Excel 文件为空');
                    return;
                }

                // Basic validation and mapping
                const newDevices = jsonData.map((item, index) => ({
                    id: `imported-${Date.now()}-${index}`,
                    label: item.label || `Device-${index}`,
                    ip: item.ip || '0.0.0.0',
                    type: item.type?.toLowerCase() || 'server',
                    status: item.status?.toLowerCase() || 'offline',
                    location: item.location || 'Unknown',
                    metrics: { cpu: '0%', memory: '0%' }, // Init metrics
                    ...item
                }));

                updateDevices([...devices, ...newDevices]); 
                
                message.success(`成功导入 ${newDevices.length} 台设备`);
                setIsImportModalVisible(false);
            } catch (error) {
                console.error(error);
                message.error('解析 Excel 失败，请检查文件格式');
            }
        };
        reader.readAsArrayBuffer(file);
        return false; // Prevent auto upload
    };

    const columns = [
        {
            title: '设备名称',
            dataIndex: 'label',
            key: 'label',
            render: (text) => <b style={{ color: 'var(--text-primary)', cursor: 'pointer' }}>{text}</b>,
            sorter: (a, b) => a.label.localeCompare(b.label),
            width: 180,
        },
        {
            title: 'IP 地址',
            dataIndex: 'ip',
            key: 'ip',
            width: 140,
            render: (text) => <span style={{ fontFamily: 'monospace' }}>{text}</span>
        },
        {
            title: '类型',
            dataIndex: 'type',
            key: 'type',
            width: 120,
            render: (text) => (
                <Tag color="#1677ff" style={{ border: 'none', background: 'rgba(22, 119, 255, 0.15)' }}>
                    {text.toUpperCase()}
                </Tag>
            ),
            filters: [
                { text: 'Server', value: 'server' },
                { text: 'Switch', value: 'switch' },
                { text: 'Firewall', value: 'firewall' },
                { text: 'Database', value: 'database' },
            ],
            onFilter: (value, record) => record.type.includes(value),
        },
        {
            title: '状态',
            dataIndex: 'status',
            key: 'status',
            width: 120,
            render: (status) => {
                let color = (status === 'online' || status === 'success') ? '#52c41a' : '#ff4d4f';
                let label = '正常';
                if (status === 'warning') { color = '#faad14'; label = '警告'; }
                if (status === 'offline' || status === 'error') { color = '#ff4d4f'; label = '离线'; }
                
                return (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
                        <span style={{ color }}>{label}</span>
                    </div>
                );
            },
            filters: [
                { text: '正常 (Online)', value: 'online' },
                { text: '离线 (Offline)', value: 'offline' },
                { text: '警告 (Warning)', value: 'warning' },
            ],
            onFilter: (value, record) => record.status === value,
        },
        {
            title: '区域',
            dataIndex: 'location',
            key: 'location',
            ellipsis: true,
            width: 120,
            render: (loc) => loc || 'Data Center A',
        },
        {
            title: '性能 (CPU / MEM)',
            key: 'performance',
            width: 200,
            render: (_, record) => (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 10 }}>
                        <span style={{ width: 24, textAlign: 'right' }}>CPU</span>
                        <div style={{ flex: 1, height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 2 }}>
                            <div style={{ 
                                width: `${record.metrics?.cpu || Math.random()*80}%`, 
                                height: '100%', 
                                background: record.metrics?.cpu > 80 ? '#ff4d4f' : '#52c41a',
                                borderRadius: 2
                            }} />
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 10 }}>
                        <span style={{ width: 24, textAlign: 'right' }}>MEM</span>
                        <div style={{ flex: 1, height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 2 }}>
                            <div style={{ 
                                width: `${record.metrics?.memory || Math.random()*60}%`, 
                                height: '100%', 
                                background: '#1677ff',
                                borderRadius: 2
                            }} />
                        </div>
                    </div>
                </div>
            )
        },
        {
            title: '操作',
            key: 'action',
            fixed: 'right',
            width: 200,
            render: (_, record) => (
                <Space size="small">
                     <Button 
                        type="link" 
                        size="small" 
                        icon={<EyeOutlined />} 
                        onClick={() => {
                            setSelectedDeviceId(record.id);
                            setDrawerVisible(true);
                        }}
                    >
                        详情
                    </Button>
                     <Button 
                        type="link" 
                        size="small" 
                        icon={<SearchOutlined />} 
                        onClick={() => onLocate && onLocate(record.id)}
                    >
                        定位
                    </Button>
                    <Button 
                        type="text" 
                        size="small" 
                        icon={<EditOutlined style={{ color: 'var(--text-secondary)' }} />} 
                        onClick={() => {
                            setEditingDevice(record);
                            setFormVisible(true);
                        }}
                    />
                    <Popconfirm
                        title="确认删除此设备?"
                        onConfirm={() => {
                            const newDevices = devices.filter(d => d.id !== record.id);
                            updateDevices(newDevices);
                            message.success('设备已删除');
                        }}
                        okText="确认"
                        cancelText="取消"
                    >
                        <Button type="text" size="small" icon={<DeleteOutlined style={{ color: '#ff4d4f' }} />} />
                    </Popconfirm>
                </Space>
            ),
        },
    ];

    return (
        <div style={{ 
            height: '100%', 
            display: 'flex', 
            flexDirection: 'column',
            gap: 16,
            padding: '24px 0' // Match main layout padding visually if needed
        }}>
            {/* Toolbar */}
            <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                paddingBottom: 16,
                borderBottom: '1px solid var(--glass-panel-border)'
            }}>
                <Space size="middle">
                    <Input 
                        placeholder="搜索设备名称、IP 地址..." 
                        prefix={<SearchOutlined style={{ color: 'var(--text-secondary)' }} />} 
                        onChange={e => setSearchText(e.target.value)}
                        style={{ width: 280 }}
                        allowClear
                    />
                    <Select 
                        placeholder="所有类型" 
                        style={{ width: 120 }}
                        options={[
                            { label: '所有类型', value: 'all' },
                            { label: '交换机', value: 'switch' },
                            { label: '服务器', value: 'server' },
                            { label: '防火墙', value: 'firewall' },
                        ]} 
                    />
                </Space>

                <Space>
                    <Button 
                        type="primary" 
                        icon={<PlusOutlined />}
                        onClick={() => {
                            setEditingDevice(null);
                            setFormVisible(true);
                        }}
                    >
                        新增设备
                    </Button>
                    <Button icon={<ExportOutlined />}>导出</Button>
                    <Button icon={<ImportOutlined />} onClick={() => setIsImportModalVisible(true)}>导入</Button>
                    <Button icon={<ReloadOutlined />} onClick={handleRefresh} loading={loading}>刷新</Button>
                </Space>
            </div>

            {/* 批量操作工具栏 */}
            {selectedRowKeys.length > 0 && (
                <Alert
                    message={
                        <Space>
                            <span>已选择 {selectedRowKeys.length} 台设备</span>
                            <Button size="small" type="primary" danger onClick={() => message.info('批量删除功能')}>
                                批量删除
                            </Button>
                            <Button size="small" onClick={() => message.info('批量导出功能')}>
                                批量导出
                            </Button>
                            <Button size="small" onClick={() => setSelectedRowKeys([])}>
                                取消选择
                            </Button>
                        </Space>
                    }
                    type="info"
                    style={{ marginBottom: 16 }}
                />
            )}

            {/* Table */}
            <Table 
                columns={columns} 
                dataSource={filteredData} 
                rowKey="id"
                rowSelection={{
                    selectedRowKeys,
                    onChange: setSelectedRowKeys,
                }}
                pagination={{ 
                    pageSize: 10, 
                    showTotal: (total) => `共 ${total} 台设备`,
                    showSizeChanger: true 
                }}
                loading={loading}
                scroll={{ x: 1100, y: 'calc(100vh - 280px)' }} // Responsive scroll
                className="pro-table" // We will style this to be clean
                style={{ flex: 1 }}
            />
            <Modal
                title="导入设备清单 (Excel)"
                open={isImportModalVisible}
                onCancel={() => setIsImportModalVisible(false)}
                footer={null}
                width={600}
            >
                <div style={{ padding: '20px 0' }}>
                    <Alert 
                        message="导入说明" 
                        description={
                            <span>
                                请下载标准模板并按照格式填写。支持 .xlsx 格式。<a onClick={handleDownloadTemplate} style={{ color: '#1677ff' }}>下载模板</a>
                            </span>
                        }
                        type="info" 
                        showIcon 
                        style={{ marginBottom: 24 }}
                    />
                    
                    <Dragger 
                        accept=".xlsx, .xls"
                        beforeUpload={handleFileUpload}
                        showUploadList={false}
                        style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'var(--glass-border)' }}
                    >
                        <p className="ant-upload-drag-icon">
                            <InboxOutlined style={{ color: 'var(--primary-color)' }} />
                        </p>
                        <p className="ant-upload-text" style={{ color: 'var(--text-primary)' }}>点击或拖拽文件到此处上传</p>
                        <p className="ant-upload-hint" style={{ color: 'var(--text-secondary)' }}>
                            支持单个表格文件上传，严禁上传敏感数据
                        </p>
                    </Dragger>
                </div>
            </Modal>
            
            {/* 设备详情抽屉 */}
            <DeviceDrawer
                visible={drawerVisible}
                deviceId={selectedDeviceId}
                onClose={() => {
                    setDrawerVisible(false);
                    setSelectedDeviceId(null);
                }}
                onEdit={(device) => {
                    setDrawerVisible(false);
                    setEditingDevice(device);
                    setFormVisible(true);
                }}
                onDelete={(device) => {
                    const newDevices = devices.filter(d => d.id !== device.id);
                    updateDevices(newDevices);
                    setDrawerVisible(false);
                    message.success('设备已删除');
                }}
            />
            
            {/* 设备表单弹窗 */}
            <DeviceFormModal
                visible={formVisible}
                device={editingDevice}
                onClose={() => {
                    setFormVisible(false);
                    setEditingDevice(null);
                }}
                onSuccess={() => {
                    handleRefresh();
                }}
            />
        </div>
    );
};

export default DeviceList;
