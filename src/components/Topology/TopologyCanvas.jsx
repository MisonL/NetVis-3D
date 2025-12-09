import React, { useCallback, useState } from 'react';
import ReactFlow, { 
    Background, 
    Controls, 
    MiniMap, 
    useNodesState, 
    useEdgesState, 
    addEdge 
} from 'reactflow';
import { Drawer, Descriptions, Tag, Typography, Button } from 'antd';
import { CloseOutlined } from '@ant-design/icons';
import 'reactflow/dist/style.css';
import DeviceNode from './nodes/DeviceNode';
import NetworkEdge from './edges/NetworkEdge';
import { mockDevices } from '../../utils/mockData';

const { Title, Text } = Typography;

const nodeTypes = {
  device: DeviceNode,
};

const edgeTypes = {
  network: NetworkEdge,
};

const initialNodes = mockDevices.map((device) => {
    let x = 0;
    let y = 0;

    // Hardcoded layout for the "Small Data Center" demo
    // Canvas Center roughly x=400
    switch (device.id) {
        case 'cloud': x = 400; y = 0; break;
        case 'fw-1': x = 400; y = 150; break;
        case 'core-sw': x = 400; y = 300; break;
        
        case 'agg-sw-1': x = 200; y = 450; break;
        case 'agg-sw-2': x = 600; y = 450; break;

        case 'web-1': x = 50; y = 600; break;
        case 'web-2': x = 200; y = 600; break;
        case 'web-3': x = 350; y = 600; break;

        case 'db-master': x = 500; y = 600; break;
        case 'db-slave': x = 620; y = 600; break;
        case 'storage-1': x = 750; y = 600; break;
        
        default: x = 0; y = 0;
    }

    return {
        id: device.id,
        type: 'device',
        position: { x, y },
        data: { ...device }
    };
});

const initialEdges = [
    // Internet -> FW
    { id: 'e-cloud-fw', source: 'cloud', target: 'fw-1', type: 'network', data: { traffic: 1 } },
    // FW -> Core
    { id: 'e-fw-core', source: 'fw-1', target: 'core-sw', type: 'network', data: { traffic: 1, label: 'Uplink' } },
    
    // Core -> Agg
    { id: 'e-core-agg1', source: 'core-sw', target: 'agg-sw-1', type: 'network', data: { traffic: 1, label: '10G' } },
    { id: 'e-core-agg2', source: 'core-sw', target: 'agg-sw-2', type: 'network', data: { traffic: 1, label: '10G' } },

    // Agg 1 -> Web
    { id: 'e-agg1-w1', source: 'agg-sw-1', target: 'web-1', type: 'network', data: { traffic: 0 } },
    { id: 'e-agg1-w2', source: 'agg-sw-1', target: 'web-2', type: 'network', data: { traffic: 1, label: 'Load' } }, // High traffic
    { id: 'e-agg1-w3', source: 'agg-sw-1', target: 'web-3', type: 'network', data: { traffic: 0 } },

    // Agg 2 -> Data
    { id: 'e-agg2-dbm', source: 'agg-sw-2', target: 'db-master', type: 'network', data: { traffic: 1 } },
    { id: 'e-agg2-dbs', source: 'agg-sw-2', target: 'db-slave', type: 'network', data: { traffic: 0, label: 'Repl' } },
    { id: 'e-agg2-sto', source: 'agg-sw-2', target: 'storage-1', type: 'network', data: { traffic: 0 } },
];

const TopologyCanvas = () => {
    const [nodes, , onNodesChange] = useNodesState(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
    const [selectedDevice, setSelectedDevice] = useState(null);
    const [drawerVisible, setDrawerVisible] = useState(false);

    const onConnect = useCallback((params) => setEdges((eds) => addEdge({ ...params, type: 'network' }, eds)), [setEdges]);

    const onNodeClick = useCallback((event, node) => {
        setSelectedDevice(node.data);
        setDrawerVisible(true);
    }, []);

    const closeDrawer = () => {
        setDrawerVisible(false);
        setSelectedDevice(null);
    };

    return (
        <div style={{ width: '100%', height: '100%', position: 'relative' }}>
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onNodeClick={onNodeClick}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                fitView
            >
                <Background color="#aaa" gap={16} />
                <Controls />
                <MiniMap style={{ height: 120 }} zoomable pannable />
            </ReactFlow>

            <Drawer
                title="设备详情"
                placement="right"
                onClose={closeDrawer}
                open={drawerVisible}
                width={400}
                mask={false}
                extra={
                  <Button type="text" icon={<CloseOutlined />} onClick={closeDrawer} />
                }
            >
                {selectedDevice && (
                    <>
                        <div style={{ marginBottom: 24, textAlign: 'center' }}>
                            <Title level={4}>{selectedDevice.label}</Title>
                            <Tag color={selectedDevice.status === 'online' ? 'success' : 'error'}>
                                {selectedDevice.status.toUpperCase()}
                            </Tag>
                        </div>
                        <Descriptions column={1} bordered size="small">
                            <Descriptions.Item label="IP 地址">{selectedDevice.ip}</Descriptions.Item>
                            <Descriptions.Item label="设备类型">{selectedDevice.type}</Descriptions.Item>
                            <Descriptions.Item label="位置">{selectedDevice.location || 'Unknown'}</Descriptions.Item>
                            <Descriptions.Item label="运行时间">{selectedDevice.uptime || '-'}</Descriptions.Item>
                            <Descriptions.Item label="当前流量">{selectedDevice.traffic || '-'}</Descriptions.Item>
                        </Descriptions>
                        
                        {selectedDevice.alerts && selectedDevice.alerts.length > 0 && (
                             <div style={{ marginTop: 24 }}>
                                <Text type="danger" strong>告警信息:</Text>
                                <ul style={{ color: '#ff4d4f', paddingLeft: 20 }}>
                                    {selectedDevice.alerts.map((alert, idx) => (
                                        <li key={idx}>{alert}</li>
                                    ))}
                                </ul>
                             </div>
                        )}
                    </>
                )}
            </Drawer>
        </div>
    );
};


export default TopologyCanvas;
