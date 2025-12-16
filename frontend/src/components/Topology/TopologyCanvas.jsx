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
import { useTopologyData } from '../../hooks/useTopologyData';
import { useSettings } from '../../context/SettingsContext';
import DeviceDetailDrawer from './DeviceDetailDrawer';
import TopologyControlPanel2D from './TopologyControlPanel2D';

const TopologyCanvas = ({ onSwitchTo3D }) => {
    const { settings } = useSettings();
    // Use Real Data
    const { nodes: backendNodes, edges: backendEdges, loading } = useTopologyData(settings.refreshRate);
    const devices = backendNodes; // Alias for compatibility with other components if needed

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
        if (loading) return;

        // 1. Map Nodes
        const flowNodes = backendNodes.map(dev => ({
            id: dev.id,
            type: 'device',
            // If we have saved positions in backend, use them. Otherwise default or initialPositions.
            position: initialPositions[dev.id] || { x: Math.random() * 500, y: Math.random() * 500 }, // Fallback to random if new
            data: { ...dev } 
        }));
        setNodes(flowNodes);

        // 2. Map Edges
        const flowEdges = backendEdges.map(conn => ({
            id: conn.id,
            source: conn.source,
            target: conn.target,
            type: 'network',
            data: { 
                traffic: conn.utilization > 50 ? 1 : 0, 
                label: conn.bandwidth ? `${conn.bandwidth}Mbps` : '',
                status: conn.status 
            },
            animated: conn.status === 'up' && conn.utilization > 0,
            style: {
                stroke: conn.status === 'down' ? '#ff4d4f' : (settings.theme === 'dark' ? '#555' : '#b1b1b7'),
                strokeWidth: 2,
                strokeDasharray: conn.status === 'down' ? '5 5' : '0'
            }
        }));

        setEdges(flowEdges);

    }, [backendNodes, backendEdges, loading, setNodes, setEdges, settings.theme]);
    
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
