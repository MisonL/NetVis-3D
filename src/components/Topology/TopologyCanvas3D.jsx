import React, { useState, useRef, useEffect, useCallback } from 'react';
import ForceGraph3D from 'react-force-graph-3d';
import { Drawer, Descriptions, Tag, Typography, Button, FloatButton, Segmented, Space, Tooltip, Slider, Select } from 'antd';
import { 
  CloseOutlined, 
  ReloadOutlined, 
  EyeOutlined, 
  EyeInvisibleOutlined,
  BgColorsOutlined,
  DeploymentUnitOutlined,
  AppstoreOutlined,
  CodeOutlined,
  GatewayOutlined,
  StopOutlined,
  SunOutlined,
  SwapOutlined
} from '@ant-design/icons';
import * as THREE from 'three';
import { mockDevices } from '../../utils/mockData';

const { Title, Text } = Typography;

// Icon Mapping Configuration
const ICON_SETS = {
    premium: {
        cloud: '/icons/icon_cloud_v2.png',
        firewall: '/icons/icon_firewall_v2.png',
        switch: '/icons/icon_switch_v2.png',
        server: '/icons/icon_server_v2.png',
        database: '/icons/icon_database_v2.png'
    },
    classic: {
        cloud: '/icons/icon_cloud_1765196203289.png',
        firewall: '/icons/icon_firewall_1765196219715.png',
        switch: '/icons/icon_switch_1765196237482.png',
        server: '/icons/icon_server_1765196257054.png',
        database: '/icons/icon_database_1765196274421.png'
    }
};

const getIconPath = (type, theme) => {
    let key = 'server';
    if (type === 'cloud') key = 'cloud';
    else if (type === 'firewall') key = 'firewall';
    else if (type.includes('switch') || type === 'router') key = 'switch';
    else if (type === 'database' || type === 'storage') key = 'database';
    
    return ICON_SETS[theme]?.[key] || ICON_SETS.premium[key];
};

const getGeometricColor = (type) => {
    switch(type) {
        case 'cloud': return 0x1890ff;
        case 'firewall': return 0xff4d4f;
        case 'core-switch': return 0x722ed1;
        case 'agg-switch': return 0x13c2c2;
        case 'web': 
        case 'server': return 0x52c41a;
        case 'database': return 0xfaad14;
        default: return 0x8c8c8c;
    }
};

// Compute initial data once
const initialGraphData = (() => {
    const nodes = mockDevices.map((device) => {
       // Fixed Hierarchical Layout - calculate exact positions
       let fx = 0, fy = 0, fz = 0;
       
       // Tier 1: Cloud (top)
       if (device.type === 'cloud') {
           fx = 0; fy = 300; fz = 0;
       }
       // Tier 2: Firewall
       else if (device.type === 'firewall') {
           fx = 0; fy = 150; fz = 0;
       }
       // Tier 3: Core Switch
       else if (device.type === 'core-switch') {
           fx = 0; fy = 0; fz = 0;
       }
       // Tier 4: Aggregation Switches (spread horizontally)
       else if (device.type.includes('agg')) {
           const aggIndex = device.id.includes('1') ? -1 : 1;
           fx = aggIndex * 150; fy = -150; fz = 0;
       }
       // Tier 5: Servers/DB (spread in grid)
       else {
           // Group: Web servers left, DB/Storage right
           if (device.id.includes('web')) {
               const webIndex = parseInt(device.id.replace(/\D/g, '')) || 1;
               fx = -150 + (webIndex - 2) * 80;
               fy = -300;
               fz = (webIndex - 2) * 50;
           } else {
               // DB and Storage on the right side
               const dbIndex = device.id.includes('master') ? 0 : (device.id.includes('slave') ? 1 : 2);
               fx = 150 + (dbIndex - 1) * 80;
               fy = -300;
               fz = (dbIndex - 1) * 50;
           }
       }

       return {
           id: device.id,
           ...device,
           fx, fy, fz  // Fixed positions
       };
   });

   const links = [
       { source: 'cloud', target: 'fw-1', traffic: 1 },
       { source: 'fw-1', target: 'core-sw', traffic: 1 },
       { source: 'core-sw', target: 'agg-sw-1', traffic: 1 },
       { source: 'core-sw', target: 'agg-sw-2', traffic: 1 },
       { source: 'agg-sw-1', target: 'web-1', traffic: 0 },
       { source: 'agg-sw-1', target: 'web-2', traffic: 1 },
       { source: 'agg-sw-1', target: 'web-3', traffic: 0 },
       { source: 'agg-sw-2', target: 'db-master', traffic: 1 },
       { source: 'agg-sw-2', target: 'db-slave', traffic: 0 },
       { source: 'agg-sw-2', target: 'storage-1', traffic: 0 },
   ];
   return { nodes, links };
})();

const TopologyCanvas3D = ({ focusNodeId, onFocusComplete, onSwitchTo2D }) => {
    const fgRef = useRef();
    
    // 1. Load Persisted Settings
    const [bgMode, setBgMode] = useState(() => localStorage.getItem('topology_bgMode') || 'starfield');
    const [iconTheme, setIconTheme] = useState(() => localStorage.getItem('topology_iconTheme') || 'premium');
    const [showLabels, setShowLabels] = useState(() => localStorage.getItem('topology_showLabels') !== 'false');
    const [interactionMode, setInteractionMode] = useState('pan');
    
    // Save settings
    useEffect(() => localStorage.setItem('topology_bgMode', bgMode), [bgMode]);
    useEffect(() => localStorage.setItem('topology_iconTheme', iconTheme), [iconTheme]);
    useEffect(() => localStorage.setItem('topology_showLabels', showLabels), [showLabels]);

    // Graph Data State
    const [graphData] = useState(initialGraphData);
    const [selectedDevice, setSelectedDevice] = useState(null);
    const [drawerVisible, setDrawerVisible] = useState(false);

    // Handle "Locate" from external component
    useEffect(() => {
        if (focusNodeId && fgRef.current) {
            const node = initialGraphData.nodes.find(n => n.id === focusNodeId);
            if (node) {
                setTimeout(() => {
                    setSelectedDevice(node);
                    setDrawerVisible(true);
                }, 0);

                const distOffset = 220;
                const camPos = { x: node.x, y: node.y + 20, z: node.z + distOffset };
                fgRef.current.cameraPosition(camPos, node, 2000);
                if (onFocusComplete) onFocusComplete();
            }
        }
    }, [focusNodeId, onFocusComplete]);

    // Interaction Mode Effect - Mouse Controls & Cursor
    useEffect(() => {
        if (!fgRef.current) return;
        const controls = fgRef.current.controls();
        const renderer = fgRef.current.renderer();
        const domElement = renderer?.domElement;
        
        if (controls) {
            const timer = setTimeout(() => {
                if (interactionMode === 'pan') {
                    controls.mouseButtons.LEFT = THREE.MOUSE.PAN;
                    controls.mouseButtons.RIGHT = THREE.MOUSE.ROTATE;
                } else {
                    controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
                    controls.mouseButtons.RIGHT = THREE.MOUSE.PAN;
                }
                
                // Fine-tuned for "responsiveness" (Stable but agile)
                controls.enableDamping = false; 
                controls.panSpeed = 0.8;
                controls.rotateSpeed = 0.8;
            }, 100);
            return () => clearTimeout(timer);
        }
        
        if (domElement) {
            const onMouseDown = () => domElement.style.cursor = 'grabbing';
            const onMouseUp = () => domElement.style.cursor = 'grab';
            domElement.style.cursor = 'grab';
            domElement.addEventListener('mousedown', onMouseDown);
            domElement.addEventListener('mouseup', onMouseUp);
            domElement.addEventListener('mouseleave', onMouseUp);
            return () => {
                domElement.removeEventListener('mousedown', onMouseDown);
                domElement.removeEventListener('mouseup', onMouseUp);
                domElement.removeEventListener('mouseleave', onMouseUp);
            };
        }
    }, [interactionMode]);

    // Background Effect
    useEffect(() => {
        if (!fgRef.current) return;
        const scene = fgRef.current.scene();
        
        // Cleanup function references
        const cleanupObjects = [];
        scene.children.forEach(child => {
            if (child.userData && child.userData.isBackgroundElement) cleanupObjects.push(child);
        });
        cleanupObjects.forEach(obj => scene.remove(obj));

        if (bgMode === 'starfield') {
            const count1 = 5000;
            const positions1 = new Float32Array(count1 * 3);
            for(let i = 0; i < count1 * 3; i++) positions1[i] = (Math.random() - 0.5) * 6000;
            const geo1 = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(positions1, 3));
            const mat1 = new THREE.PointsMaterial({ color: 0x8888aa, size: 1.5, transparent: true, opacity: 0.6 });
            const s1 = new THREE.Points(geo1, mat1); s1.userData = { isBackgroundElement: true };
            scene.add(s1);

            const count2 = 500;
            const positions2 = new Float32Array(count2 * 3);
            for(let i = 0; i < count2 * 3; i++) positions2[i] = (Math.random() - 0.5) * 5000;
            const geo2 = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(positions2, 3));
            const mat2 = new THREE.PointsMaterial({ color: 0xccffff, size: 3, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending });
            const s2 = new THREE.Points(geo2, mat2); s2.userData = { isBackgroundElement: true };
            scene.add(s2);

        } else if (bgMode === 'grid') {
             const gridHelper = new THREE.GridHelper(3000, 60, 0x0044aa, 0x002244);
             gridHelper.position.y = -400; gridHelper.material.transparent = true; gridHelper.material.opacity = 0.3;
             gridHelper.userData = { isBackgroundElement: true }; scene.add(gridHelper);
             
             const subGrid = new THREE.GridHelper(3000, 120, 0x001133, 0x000811);
             subGrid.position.y = -401; subGrid.material.transparent = true; subGrid.material.opacity = 0.1;
             subGrid.userData = { isBackgroundElement: true }; scene.add(subGrid);

             scene.fog = new THREE.FogExp2(0x000205, 0.001);
        } else if (bgMode === 'light') {
             // Light theme: clean white background with subtle grid
             const gridHelper = new THREE.GridHelper(3000, 60, 0xcccccc, 0xe8e8e8);
             gridHelper.position.y = -400;
             gridHelper.userData = { isBackgroundElement: true };
             scene.add(gridHelper);
             scene.fog = new THREE.FogExp2(0xf0f2f5, 0.0005);
        } else {
            scene.fog = null;
        }

        return () => {
             cleanupObjects.forEach(obj => scene.remove(obj));
             scene.fog = null;
        }
    }, [bgMode]);

    // Initial Camera
    useEffect(() => {
        if (fgRef.current) {
            setTimeout(() => {
                fgRef.current.cameraPosition({ x: 200, y: 200, z: 600 }, { x: 0, y: 0, z: 0 }, 1000);
            }, 500);
        }
    }, []);

    const closeDrawer = () => {
        setDrawerVisible(false);
        setSelectedDevice(null);
        
        // Auto-reset view to default position
        if (fgRef.current) {
             fgRef.current.cameraPosition(
                { x: 200, y: 200, z: 600 },
                { x: 0, y: 0, z: 0 },
                2000
            );
        }
    };

    const createTextSprite = useCallback((text, color, fontSize = 24) => {
        // Dynamic default color based on bgMode
        const defaultColor = bgMode === 'light' ? 'rgba(0, 0, 0, 0.85)' : 'rgba(255, 255, 255, 0.9)';
        const finalColor = color || defaultColor;
        const shadowColor = bgMode === 'light' ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.8)';
        
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        context.font = `Normal ${fontSize}px "Inter", sans-serif`;
        const textWidth = context.measureText(text).width;
        
        canvas.width = textWidth + 10;
        canvas.height = fontSize + 10;
        
        context.font = `Normal ${fontSize}px "Inter", sans-serif`;
        context.fillStyle = finalColor;
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.shadowColor = shadowColor;
        context.shadowBlur = 4;
        context.fillText(text, canvas.width / 2, canvas.height / 2);
        
        const texture = new THREE.CanvasTexture(canvas);
        texture.colorSpace = THREE.SRGBColorSpace;
        const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
        const sprite = new THREE.Sprite(material);
        
        const scale = 12 * (canvas.width / canvas.height); 
        sprite.scale.set(scale, 12, 1);
        
        return sprite;
    }, [bgMode]);

    const bgColors = {
        starfield: '#000005',
        grid: '#000510',
        solid: '#1a1a1a',
        light: '#f0f2f5'
    };

    return (
        <div style={{ width: '100%', height: '100%', position: 'relative', background: bgColors[bgMode] || '#000000' }}>
            <ForceGraph3D
                ref={fgRef}
                graphData={graphData}
                backgroundColor={bgColors[bgMode] || '#000000'} // Ensure fallback
                showNavInfo={false} // Custom controls instead
                
                // Interaction
                onNodeHover={node => document.body.style.cursor = node ? 'pointer' : null}

                // Node Visuals
                nodeThreeObject={node => {
                    const group = new THREE.Group();

                    // Visuals based on Theme
                    if (iconTheme === 'geometric') {
                        // GEOMETRIC THEME
                        let geometry, material;
                        const color = getGeometricColor(node.type);
                        
                        // Shapes based on type to distinguish
                        if (node.type === 'cloud') {
                            geometry = new THREE.IcosahedronGeometry(8, 0); // Techy ball
                        } else if (node.type === 'firewall') {
                            geometry = new THREE.BoxGeometry(12, 12, 12); // Box
                        } else if (node.type.includes('switch')) {
                            geometry = new THREE.CylinderGeometry(8, 8, 4, 6); // Hex disk
                            geometry.rotateX(Math.PI / 2);
                        } else if (node.type === 'database') {
                             geometry = new THREE.CylinderGeometry(6, 6, 14, 12); // Cylinder
                        } else {
                            // Server
                             geometry = new THREE.BoxGeometry(6, 14, 6);
                        }
                        
                        material = new THREE.MeshLambertMaterial({ 
                            color, 
                            transparent: true, 
                            opacity: 0.9,
                            emissive: color,
                            emissiveIntensity: 0.2
                        });
                        const mesh = new THREE.Mesh(geometry, material);
                        group.add(mesh);
                        
                        // Add wireframe for "tech" look
                         const wireframe = new THREE.LineSegments(
                            new THREE.EdgesGeometry(geometry),
                            new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3 })
                        );
                        group.add(wireframe);

                    } else {
                        // SPRITE THEMES (Premium / Classic)
                        const imgTexture = new THREE.TextureLoader().load(getIconPath(node.type, iconTheme));
                        imgTexture.colorSpace = THREE.SRGBColorSpace;
                        const iconMaterial = new THREE.SpriteMaterial({ map: imgTexture, transparent: true });
                        const iconSprite = new THREE.Sprite(iconMaterial);
                        iconSprite.scale.set(32, 32, 1); 
                        iconSprite.userData = { id: node.id };
                        group.add(iconSprite);
                    }

                    // 2. Label Sprite
                    if (showLabels) {
                        const labelSprite = createTextSprite(node.label || node.id);
                        labelSprite.position.y = -22; // Tighter spacing
                        group.add(labelSprite);
                    }

                    return group;
                }}

                // Link Visuals
                linkWidth={1} // Thinner links
                linkColor={() => '#1677ff'}
                linkOpacity={0.2} // More subtle
                linkDirectionalParticles={link => link.traffic > 0 ? 3 : 0} // Fewer particles
                linkDirectionalParticleSpeed={0.005}
                linkDirectionalParticleWidth={3}
                linkDirectionalParticleColor={() => '#52c41a'}

                onNodeClick={(node) => {
                    setSelectedDevice(node);
                    setDrawerVisible(true);
                    
                    // Consistent zoom offset
                    const distOffset = 220; 
                    const camPos = { 
                        x: node.x, 
                        y: node.y + 20, 
                        z: node.z + distOffset 
                    };

                    fgRef.current.cameraPosition(
                        camPos,
                        node,
                        2000
                    );
                }}
                
                d3Force="charge"
                d3VelocityDecay={0.2}
            />

            {/* CONTROL PANEL */}
            <div style={{
                position: 'absolute',
                top: 20,
                right: 20,
                zIndex: 100,
                display: 'flex',
                gap: 8,
                background: 'rgba(0, 10, 20, 0.8)', 
                padding: '8px 12px',
                borderRadius: 10,
                backdropFilter: 'blur(12px)',
                border: '1px solid rgba(100, 150, 255, 0.2)',
                alignItems: 'center' 
            }}>
                {/* SEARCH */}
                 <Select
                    showSearch
                    placeholder="搜索设备..."
                    optionFilterProp="children"
                    onChange={(val) => {
                         const node = graphData.nodes.find(n => n.id === val);
                         if (node) {
                            setSelectedDevice(node);
                            const distOffset = 220;
                            const camPos = { x: node.x, y: node.y + 20, z: node.z + distOffset };
                            fgRef.current.cameraPosition(camPos, node, 2000);
                            setDrawerVisible(true);
                         }
                    }}
                    filterOption={(input, option) =>
                        (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                    }
                    options={initialGraphData.nodes.map(n => ({ value: n.id, label: n.label }))}
                    style={{ 
                        width: 130,
                        background: 'rgba(255,255,255,0.08)',
                        borderRadius: 6
                    }}
                    size="small"
                    popupMatchSelectWidth={false}
                />

                {/* Switch to 2D View */}
                {onSwitchTo2D && (
                    <Tooltip title="切换到 2D 视图">
                        <Button 
                            type="text"
                            icon={<SwapOutlined />}
                            onClick={onSwitchTo2D}
                            style={{ 
                                color: bgMode === 'light' ? '#333' : '#e0f0ff',
                                background: bgMode === 'light' ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.08)',
                                borderRadius: 6
                            }}
                        >
                            2D
                        </Button>
                    </Tooltip>
                )}

                <div style={{ width: 1, height: 20, backgroundColor: 'rgba(100,150,255,0.3)', margin: '0 4px' }} />

                <Tooltip title={interactionMode === 'pan' ? "当前: 平移 (点击切换)" : "当前: 旋转 (点击切换)"}>
                    <Button 
                        type="text"
                        style={{ 
                            color: '#e0f0ff', 
                            background: interactionMode === 'rotate' ? 'rgba(22,119,255,0.4)' : 'rgba(255,255,255,0.08)',
                            borderRadius: 6,
                            fontWeight: 500
                        }}
                        icon={<DeploymentUnitOutlined rotate={interactionMode === 'rotate' ? 45 : 0}/>}
                        onClick={() => setInteractionMode(prev => prev === 'pan' ? 'rotate' : 'pan')}
                    >
                        {interactionMode === 'pan' ? '平移' : '旋转'}
                    </Button>
                </Tooltip>

                <div style={{ width: 1, height: 20, backgroundColor: 'rgba(100,150,255,0.3)', margin: '0 4px' }} />

                {/* SLIDERS - Zoom */}
                 <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                     <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12 }}>缩放</Text>
                     <Slider 
                        min={200} max={1200} 
                        defaultValue={600}
                        reverse
                        tooltip={{ formatter: null }}
                        onChange={(val) => {
                            if (fgRef.current) {
                                const cam = fgRef.current.camera();
                                const currentPos = cam.position.clone();
                                currentPos.setLength(val); 
                                fgRef.current.cameraPosition(currentPos, null, 300);
                            }
                        }}
                        style={{ width: 60, margin: 0 }}
                        styles={{ 
                            track: { background: '#1677ff' }, 
                            rail: { background: 'rgba(255,255,255,0.2)' },
                            handle: { borderColor: '#1677ff' }
                        }}
                     />
                </div>

                <div style={{ width: 1, height: 20, backgroundColor: 'rgba(100,150,255,0.3)', margin: '0 4px' }} />

                 <Tooltip title="切换图标主题">
                     <Segmented 
                        options={[
                            { label: '拟真', value: 'premium', icon: <DeploymentUnitOutlined /> },
                            { label: '经典', value: 'classic', icon: <AppstoreOutlined /> }, 
                            { label: '几何', value: 'geometric', icon: <CodeOutlined /> }
                        ]}
                        value={iconTheme}
                        onChange={setIconTheme}
                        size="small"
                        style={{ 
                            background: 'rgba(255,255,255,0.1)',
                            borderRadius: 6,
                            '--ant-segmented-item-color': 'rgba(255,255,255,0.75)',
                            '--ant-segmented-item-selected-color': '#fff'
                        }}
                     />
                </Tooltip>

                <div style={{ width: 1, height: 20, backgroundColor: 'rgba(100,150,255,0.3)', margin: '0 4px' }} />

                <Tooltip title="切换背景">
                     <Segmented 
                        options={[
                            { label: '星空', value: 'starfield', icon: <BgColorsOutlined /> },
                            { label: '网格', value: 'grid', icon: <GatewayOutlined /> }, 
                            { label: '纯色', value: 'solid', icon: <StopOutlined /> },
                            { label: '亮色', value: 'light', icon: <SunOutlined /> }
                        ]}
                        value={bgMode}
                        onChange={setBgMode}
                        size="small"
                        style={{ 
                            background: 'rgba(255,255,255,0.1)',
                            borderRadius: 6,
                            '--ant-segmented-item-color': 'rgba(255,255,255,0.75)',
                            '--ant-segmented-item-selected-color': '#fff'
                        }}
                     />
                </Tooltip>
                
                <Tooltip title={showLabels ? "隐藏标签" : "显示标签"}>
                    <Button 
                        type="text" 
                        icon={showLabels ? <EyeOutlined /> : <EyeInvisibleOutlined />} 
                        style={{ color: '#e0f0ff' }}
                        onClick={() => setShowLabels(!showLabels)}
                    />
                </Tooltip>
                
                <Tooltip title="重置视角">
                    <Button 
                        type="text" 
                        icon={<ReloadOutlined />} 
                        style={{ color: '#e0f0ff' }}
                        onClick={() => fgRef.current.cameraPosition({ x: 200, y: 200, z: 600 }, { x: 0, y: 0, z: 0 }, 2000)}
                    />
                </Tooltip>
            </div>

            <Drawer
                title={<span style={{ color: '#fff' }}>设备详情</span>}
                placement="right"
                onClose={closeDrawer}
                open={drawerVisible}
                getContainer={false}
                mask={false}
                rootStyle={{ position: 'absolute', width: 360  }} 
                styles={{
                    header: { background: 'rgba(0, 0, 0, 0.85)', borderBottom: '1px solid rgba(255,255,255,0.1)' },
                    body: { background: 'rgba(0, 0, 0, 0.85)', backdropFilter: 'blur(20px)' },
                    mask: { background: 'transparent' }
                }}
                extra={
                  <Button type="text" icon={<CloseOutlined style={{ color: '#fff' }} />} onClick={closeDrawer} />
                }
            >
                 {selectedDevice && (
                    <div style={{ color: 'rgba(255,255,255,0.85)' }}>
                        {/* Status Tag */}
                        <div style={{ marginBottom: 20 }}>
                            <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)', marginRight: 8 }}>当前状态:</span>
                            <Tag color={selectedDevice.status === 'success' ? '#1da57a' : '#ff4d4f'} style={{ border: 'none' }}>
                                 {selectedDevice.status === 'success' ? '正常运行' : '告警'}
                            </Tag>
                        </div>

                         <Typography.Title level={4} style={{ color: '#fff', margin: 0 }}>
                            {selectedDevice.label}
                        </Typography.Title>
                        <div style={{ marginTop: 8, fontSize: 13, color: 'rgba(255,255,255,0.45)' }}>ID: {selectedDevice.id}</div>
                         <div style={{ marginTop: 4, fontSize: 13, color: 'rgba(255,255,255,0.45)' }}>Type: {selectedDevice.type}</div>

                        <div style={{ margin: '24px 0', borderTop: '1px solid rgba(255,255,255,0.1)' }} />

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                            <div style={{ background: 'rgba(255,255,255,0.05)', padding: 12, borderRadius: 8 }}>
                                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>CPU 使用率</div>
                                <div style={{ fontSize: 20, color: '#fff', marginTop: 4 }}>{selectedDevice.metrics?.cpu ?? '45%'}</div>
                            </div>
                            <div style={{ background: 'rgba(255,255,255,0.05)', padding: 12, borderRadius: 8 }}>
                                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>内存使用率</div>
                                <div style={{ fontSize: 20, color: '#fff', marginTop: 4 }}>{selectedDevice.metrics?.memory ?? '60%'}</div>
                            </div>
                             <div style={{ background: 'rgba(255,255,255,0.05)', padding: 12, borderRadius: 8 }}>
                                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>网络流量</div>
                                <div style={{ fontSize: 20, color: '#fff', marginTop: 4 }}>{selectedDevice.metrics?.traffic ?? '1.2 Gbps'}</div>
                            </div>
                            <div style={{ background: 'rgba(255,255,255,0.05)', padding: 12, borderRadius: 8 }}>
                                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>在线时长</div>
                                <div style={{ fontSize: 20, color: '#fff', marginTop: 4 }}>12d 4h</div>
                            </div>
                        </div>
                    </div>
                 )}
            </Drawer>
        </div>
    );
};

export default TopologyCanvas3D;
