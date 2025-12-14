import React, { useCallback, useState, useEffect } from 'react';
import ReactFlow, { 
    Background, 
    Controls, 
    useNodesState, 
    useEdgesState, 
    addEdge 
} from 'reactflow';
import 'reactflow/dist/style.css';
import { nodeTypes, edgeTypes, initialPositions } from './flowConfig';
import { useSimulation } from '../../services/SimulationService';
import { useSettings } from '../../context/SettingsContext';
import DeviceDetailDrawer from './DeviceDetailDrawer';
import TopologyControlPanel2D from './TopologyControlPanel2D';

const TopologyCanvas = ({ onSwitchTo3D }) => {
    const { settings } = useSettings();
    const { devices } = useSimulation(true, settings.refreshRate);
    
    // Convert simulation devices to ReactFlow nodes
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    
    // Store ID instead of object to avoid synchronization effects
    const [selectedDeviceId, setSelectedDeviceId] = useState(null);
    const [drawerVisible, setDrawerVisible] = useState(false);
    
    // ReactFlow Instance
    const [rfInstance, setRfInstance] = useState(null);

    // Derive selected device from current devices list
    const selectedDevice = devices.find(d => d.id === selectedDeviceId) || null;

    // Initial Load & Updates
    useEffect(() => {
        // 1. Map Nodes
        const flowNodes = devices.map(dev => ({
            id: dev.id,
            type: 'device',
            position: initialPositions[dev.id] || { x: 0, y: 0 },
            data: { ...dev } // Pass full device data including metrics/status
        }));
        setNodes(flowNodes);

        // 2. Map Edges (static topology for demo)
        const flowEdges = [
             { id: 'e-cloud-fw', source: 'cloud', target: 'fw-1', type: 'network', data: { traffic: 1 }, animated: true },
             { id: 'e-fw-core', source: 'fw-1', target: 'core-sw', type: 'network', data: { traffic: 1, label: 'Uplink' }, animated: true },
             { id: 'e-core-agg1', source: 'core-sw', target: 'agg-sw-1', type: 'network', data: { traffic: 1, label: '10G' }, animated: true },
             { id: 'e-core-agg2', source: 'core-sw', target: 'agg-sw-2', type: 'network', data: { traffic: 1, label: '10G' }, animated: true },
             { id: 'e-agg1-w1', source: 'agg-sw-1', target: 'web-1', type: 'network', data: { traffic: 0 } },
             { id: 'e-agg1-w2', source: 'agg-sw-1', target: 'web-2', type: 'network', data: { traffic: 1, label: 'Load' }, animated: true },
             { id: 'e-agg1-w3', source: 'agg-sw-1', target: 'web-3', type: 'network', data: { traffic: 0 } },
             { id: 'e-agg2-dbm', source: 'agg-sw-2', target: 'db-master', type: 'network', data: { traffic: 1 }, animated: true },
             { id: 'e-agg2-dbs', source: 'agg-sw-2', target: 'db-slave', type: 'network', data: { traffic: 0, label: 'Repl' } },
             { id: 'e-agg2-sto', source: 'agg-sw-2', target: 'storage-1', type: 'network', data: { traffic: 0 } },
        ];
        
        // Dynamic styles for edges based on theme
        const edgeStyles = {
            stroke: settings.theme === 'dark' ? '#555' : '#b1b1b7',
            strokeWidth: 2
        };

        const styledEdges = flowEdges.map(e => ({
            ...e,
            style: edgeStyles
        }));

        setEdges(styledEdges);

    }, [devices, setNodes, setEdges, settings.theme]);
    
    // REMOVED: Effect that caused the error (updating selectedDevice synchronously)

    const onConnect = useCallback((params) => setEdges((eds) => addEdge({ ...params, type: 'network' }, eds)), [setEdges]);

    const onNodeClick = useCallback((event, node) => {
        setSelectedDeviceId(node.id);
        setDrawerVisible(true);
    }, []);

    const darkThemeStyles = {
        '--glass-panel-bg': 'rgba(22, 33, 50, 0.75)',
        '--glass-panel-border': 'rgba(255, 255, 255, 0.1)',
        '--glass-panel-shadow': '0 8px 32px 0 rgba(0, 0, 0, 0.5)',
        '--text-primary': '#ffffff',
        '--text-secondary': 'rgba(255, 255, 255, 0.85)',
        '--text-tertiary': 'rgba(255, 255, 255, 0.45)',
        '--primary-color': '#1677ff'
    };



    const isDark = settings.canvasTheme2D === 'dark';

    return (
        <div style={{ 
            width: '100%', 
            height: '100%', 
            position: 'relative', 
            background: isDark 
                ? 'radial-gradient(circle at center, #1b263b 0%, #0d1117 100%)' // Deep blue-grad to dark
                : '#f5f5f5',
            ...isDark ? darkThemeStyles : {}
        }}>
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
                onInit={setRfInstance}
                style={{ color: isDark ? '#fff' : 'inherit' }}
            >
                <Background 
                    color={isDark ? '#4a5568' : '#ccc'} 
                    gap={24}  
                    size={1.5}
                    variant="dots"
                />
                <Controls 
                    position="bottom-right"
                    style={{ 
                        background: 'rgba(0,0,0,0.6)', 
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '8px',
                    }}
                    showZoom={true}
                    showFitView={true}
                    showInteractive={false}
                />
                {/* MiniMap removed for cleaner look */}
            </ReactFlow>

            <TopologyControlPanel2D 
                devices={devices}
                onSwitchTo3D={onSwitchTo3D}
                onSearchSelect={(id) => {
                    const node = nodes.find(n => n.id === id);
                    if (node) {
                        setSelectedDeviceId(node.id);
                        setDrawerVisible(true);
                        // Optional: Center view on node
                        if (rfInstance) {
                            rfInstance.setCenter(node.position.x, node.position.y, { zoom: 1.2, duration: 800 });
                        }
                    }
                }}
                onFitView={() => {
                    if (rfInstance) {
                        rfInstance.fitView({ padding: 0.2, duration: 800 });
                    }
                }}
            />

            <DeviceDetailDrawer 
                open={drawerVisible}
                onClose={() => {
                    setDrawerVisible(false);
                    setSelectedDeviceId(null);
                }}
                device={selectedDevice}
            />
        </div>
    );
};

export default TopologyCanvas;
