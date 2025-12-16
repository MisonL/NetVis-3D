import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import ForceGraph3D from 'react-force-graph-3d';
import * as THREE from 'three';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass';
import { useSettings } from '../../context/SettingsContext';
import { useTopologyData } from '../../hooks/useTopologyData';
import TopologyControlPanel from './TopologyControlPanel';
import DeviceDetailDrawer from './DeviceDetailDrawer';

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
        cloud: '/icons/icon_cloud_classic.svg',
        firewall: '/icons/icon_firewall_classic.svg',
        switch: '/icons/icon_switch_classic.svg',
        server: '/icons/icon_server_classic.svg',
        database: '/icons/icon_database_classic.svg'
    }
};

const getIconPath = (type, theme) => {
    let key = 'server';
    if (!type) return ICON_SETS.premium['server'];
    
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

const simpleHash = (str) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
};

const getDeterministicRandom = (id, seedOffset = 0) => {
    const hash = simpleHash(id + seedOffset.toString());
    return (hash % 1000) / 1000; // 0 to 1
};

const TopologyCanvas3D = ({ focusNodeId, onFocusComplete, onSwitchTo2D }) => {
    const fgRef = useRef();
    const { settings } = useSettings();
    const { nodes: backendNodes, edges: backendEdges, loading } = useTopologyData(settings.refreshRate); // Use Real Data
    const devices = backendNodes; // Alias

    // Local Interaction State
    const [interactionMode, setInteractionMode] = useState('pan');
    
    // Store ID instead of object to prevent synchronization issues
    const [selectedDeviceId, setSelectedDeviceId] = useState(null);
    const [drawerVisible, setDrawerVisible] = useState(false);
    const bloomPassRef = useRef(null); // Track the specific bloom pass instance

    // Derive selected device from current devices list
    const selectedDevice = devices.find(d => d.id === selectedDeviceId) || null;

    // Compute graph data from devices
    const graphData = useMemo(() => {
        if (loading) return { nodes: [], links: [] };

        const nodes = backendNodes.map((device) => {
           // Fixed Hierarchical Layout - calculate exact positions
           let fx = 0, fy = 0, fz = 0;
           
           // Simple hierarchical layouting based on role/type if available
           const type = device.type || 'unknown';

           // Tier 1: Cloud (top)
           if (type === 'cloud') {
               fx = 0; fy = 300; fz = 0;
           }
           // Tier 2: Firewall
           else if (type === 'firewall') {
               fx = 0; fy = 150; fz = 0;
           }
           // Tier 3: Core Switch
           else if (type === 'core-switch' || type === 'router') {
               fx = 0; fy = 0; fz = 0;
           }
           // Tier 4: Aggregation and everything else distributed
           else {
               // Pseudo-random distribution in a plane below, or strictly layered if recognized
               if (type.includes('agg')) {
                    fx = (getDeterministicRandom(device.id, 'x') - 0.5) * 300;
                    fy = -150;
                    fz = (getDeterministicRandom(device.id, 'z') - 0.5) * 100;
               } else {
                    // Servers, DBs, etc.
                    fx = (getDeterministicRandom(device.id, 'x') - 0.5) * 500;
                    fy = -300;
                    fz = (getDeterministicRandom(device.id, 'z') - 0.5) * 300;
               }
           }
   
           return {
               id: device.id,
               ...device,
               fy: fy, 
           };
       });
   
       const links = backendEdges.map(conn => ({
           source: conn.source,
           target: conn.target,
           traffic: conn.utilization > 0 ? 1 : 0,
           status: conn.status
       }));

       return { nodes, links };
    }, [backendNodes, backendEdges, loading]);

    // Update selected device if the data changes in background - REMOVED

    // Handle "Locate" from external component
    useEffect(() => {
        if (focusNodeId && fgRef.current) {
            const node = graphData.nodes.find(n => n.id === focusNodeId);
            if (node) {
                setTimeout(() => {
                    setSelectedDeviceId(node.id);
                    setDrawerVisible(true);
                }, 0);

                const distOffset = 220;
                const camPos = { x: node.fx, y: node.fy + 20, z: node.fz + distOffset };
                fgRef.current.cameraPosition(camPos, { x: node.fx, y: node.fy, z: node.fz }, 2000);
                if (onFocusComplete) onFocusComplete();
            }
        }
    }, [focusNodeId, onFocusComplete, graphData]);

    // Interaction Mode Effect - Mouse Controls
    useEffect(() => {
        if (!fgRef.current) return;
        const controls = fgRef.current.controls();
        if (controls) {
            const timer = setTimeout(() => {
                if (interactionMode === 'pan') {
                    controls.mouseButtons.LEFT = THREE.MOUSE.PAN;
                    controls.mouseButtons.RIGHT = THREE.MOUSE.ROTATE;
                } else {
                    controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
                    controls.mouseButtons.RIGHT = THREE.MOUSE.PAN;
                }
                controls.enableDamping = false; // No smoothing - pure direct control
                controls.panSpeed = 0.25;   // Slower pan for precision
                controls.rotateSpeed = 0.25; // Slower rotation
                controls.zoomSpeed = 0.5;   // Slower zoom
                controls.autoRotate = settings.autoRotate;
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [interactionMode, settings.autoRotate]);

    // Update autoRotate when setting changes
    useEffect(() => {
        if (fgRef.current && fgRef.current.controls()) {
            fgRef.current.controls().autoRotate = settings.autoRotate;
        }
    }, [settings.autoRotate]);

    // Background Effect
    useEffect(() => {
        if (!fgRef.current) return;
        const scene = fgRef.current.scene();
        
        const cleanupObjects = [];
        scene.children.forEach(child => {
            if (child.userData && child.userData.isBackgroundElement) cleanupObjects.push(child);
        });
        cleanupObjects.forEach(obj => scene.remove(obj));

        if (settings.bgMode === 'starfield') {
            // Layer 1: Many small stars
            const count1 = 8000;
            const positions1 = new Float32Array(count1 * 3);
            for(let i = 0; i < count1 * 3; i++) positions1[i] = (Math.random() - 0.5) * 6000;
            const geo1 = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(positions1, 3));
            const mat1 = new THREE.PointsMaterial({ color: 0xaabbcc, size: 2.5, transparent: true, opacity: 0.85 });
            const s1 = new THREE.Points(geo1, mat1); s1.userData = { isBackgroundElement: true };
            scene.add(s1);

            // Layer 2: Bright prominent stars
            const count2 = 800;
            const positions2 = new Float32Array(count2 * 3);
            for(let i = 0; i < count2 * 3; i++) positions2[i] = (Math.random() - 0.5) * 5000;
            const geo2 = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(positions2, 3));
            const mat2 = new THREE.PointsMaterial({ color: 0xffffff, size: 5, transparent: true, opacity: 1, blending: THREE.AdditiveBlending });
            const s2 = new THREE.Points(geo2, mat2); s2.userData = { isBackgroundElement: true };
            scene.add(s2);

        } else if (settings.bgMode === 'grid') {
             // Enhanced grid for maximum visibility
             const gridHelper = new THREE.GridHelper(3000, 80, 0x66bbff, 0x3388dd);
             gridHelper.position.y = -400; 
             gridHelper.material.transparent = true; 
             gridHelper.material.opacity = 1.0;
             gridHelper.userData = { isBackgroundElement: true }; 
             scene.add(gridHelper);
             // Add a second finer grid for depth
             const fineGrid = new THREE.GridHelper(3000, 160, 0x336699, 0x114477);
             fineGrid.position.y = -401;
             fineGrid.material.transparent = true;
             fineGrid.material.opacity = 0.6;
             fineGrid.userData = { isBackgroundElement: true };
             scene.add(fineGrid);
             scene.fog = new THREE.FogExp2(0x000510, 0.0004);
        } else if (settings.bgMode === 'light') {
             // Stronger main grid
             const gridHelper = new THREE.GridHelper(3000, 80, 0x444444, 0x999999);
             gridHelper.position.y = -400;
             gridHelper.material.opacity = 0.9;
             gridHelper.material.transparent = true;
             gridHelper.userData = { isBackgroundElement: true };
             scene.add(gridHelper);
             
             // Secondary fine grid for detail and contrast
             const fineGrid = new THREE.GridHelper(3000, 160, 0x888888, 0xbbbbbb);
             fineGrid.position.y = -401;
             fineGrid.material.opacity = 0.5;
             fineGrid.material.transparent = true;
             fineGrid.userData = { isBackgroundElement: true };
             scene.add(fineGrid);

             scene.fog = new THREE.FogExp2(0xf0f2f5, 0.0003); // Lighter fog
        } else {
            scene.fog = null;
        }

        return () => {
             cleanupObjects.forEach(obj => scene.remove(obj));
             scene.fog = null;
        }
    }, [settings.bgMode]);

    // Initial Camera
    useEffect(() => {
        if (fgRef.current) {
            setTimeout(() => {
                fgRef.current.cameraPosition({ x: 200, y: 200, z: 600 }, { x: 0, y: 0, z: 0 }, 1000);
            }, 500);
        }
    }, []);

    // Bloom Effect implementation with intensity control and reference tracking
    useEffect(() => {
        if (!fgRef.current) return;
        
        const postProcessingComposer = fgRef.current.postProcessingComposer();
        if (!postProcessingComposer) return;
        
        // 1. CLEANUP: Remove specifically the pass we added previously
        if (bloomPassRef.current) {
            const passIndex = postProcessingComposer.passes.indexOf(bloomPassRef.current);
            if (passIndex > -1) {
                postProcessingComposer.passes.splice(passIndex, 1);
            }
            bloomPassRef.current = null;
        }
        
        // 2. SAFETY CHECK: Legacy cleanup (in case older passes persist from previous reloads)
        // Ensure no other UnrealBloomPass exists to prevent nuclear stacking
        for (let i = postProcessingComposer.passes.length - 1; i >= 0; i--) {
            if (postProcessingComposer.passes[i].constructor.name === 'UnrealBloomPass') {
                postProcessingComposer.passes.splice(i, 1);
            }
        }

        // 3. SETUP: Check if we effectively want bloom
        const isLightMode = settings.bgMode === 'light';
        const shouldEnableBloom = settings.bloomEnabled && !isLightMode;

        if (shouldEnableBloom) {
             const bloomPass = new UnrealBloomPass();
             bloomPass.strength = settings.bloomIntensity;
             bloomPass.radius = 0.4;
             bloomPass.threshold = 0.2;
             
             postProcessingComposer.addPass(bloomPass);
             bloomPassRef.current = bloomPass; // Track usage
        }
        
        return () => {
             // Cleanup on unmount or re-render
             if (bloomPassRef.current && postProcessingComposer) {
                 const passIndex = postProcessingComposer.passes.indexOf(bloomPassRef.current);
                 if (passIndex > -1) {
                     postProcessingComposer.passes.splice(passIndex, 1);
                 }
                 bloomPassRef.current = null;
             }
         };
    }, [settings.bloomEnabled, settings.bloomIntensity, settings.bgMode]);


    const createTextSprite = useCallback((text, color, fontSize = 36) => {
        const defaultColor = settings.bgMode === 'light' ? 'rgba(0, 0, 0, 0.95)' : 'rgba(255, 255, 255, 1)';
        const finalColor = color || defaultColor;
        const shadowColor = settings.bgMode === 'light' ? 'rgba(255,255,255,1)' : 'rgba(0,0,0,1)';
        
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        context.font = `Bold ${fontSize}px "Inter", sans-serif`;
        const textWidth = context.measureText(text).width;
        
        canvas.width = textWidth + 20;
        canvas.height = fontSize + 20;
        
        context.font = `Bold ${fontSize}px "Inter", sans-serif`;
        context.fillStyle = finalColor;
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.shadowColor = shadowColor;
        context.shadowBlur = 6;
        context.fillText(text, canvas.width / 2, canvas.height / 2);
        
        const texture = new THREE.CanvasTexture(canvas);
        texture.colorSpace = THREE.SRGBColorSpace;
        const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
        const sprite = new THREE.Sprite(material);
        const scale = 18 * (canvas.width / canvas.height); 
        sprite.scale.set(scale, 18, 1);
        return sprite;
    }, [settings.bgMode]);

    const bgColors = {
        starfield: '#000005',
        grid: '#000510',
        solid: settings.solidBgColor || '#1a1a2e',
        light: '#f0f2f5'
    };

    return (
        <div style={{ width: '100%', height: '100%', position: 'relative', background: bgColors[settings.bgMode] || '#000000' }}>
            <ForceGraph3D
                ref={fgRef}
                graphData={graphData}
                backgroundColor={bgColors[settings.bgMode] || '#000000'}
                showNavInfo={false}
                
                // Interaction
                onNodeHover={node => document.body.style.cursor = node ? 'pointer' : null}

                // Node Visuals
                nodeThreeObject={node => {
                    const group = new THREE.Group();

                    if (settings.iconTheme === 'geometric') {
                        let geometry, material;
                        const color = getGeometricColor(node.type);
                        
                        if (node.type === 'cloud') {
                            geometry = new THREE.IcosahedronGeometry(8, 0); 
                        } else if (node.type === 'firewall') {
                            geometry = new THREE.BoxGeometry(12, 12, 12); 
                        } else if (node.type.includes('switch')) {
                            geometry = new THREE.CylinderGeometry(8, 8, 4, 6); 
                            geometry.rotateX(Math.PI / 2);
                        } else if (node.type === 'database') {
                             geometry = new THREE.CylinderGeometry(6, 6, 14, 12);
                        } else {
                             geometry = new THREE.BoxGeometry(6, 14, 6);
                        }
                        
                        material = new THREE.MeshLambertMaterial({ 
                            color, 
                            transparent: true, 
                            opacity: 0.9,
                            emissive: color,
                            emissiveIntensity: 0.4 // Higher emission for bloom
                        });
                        const mesh = new THREE.Mesh(geometry, material);
                        group.add(mesh);
                        
                         const wireframe = new THREE.LineSegments(
                            new THREE.EdgesGeometry(geometry),
                            new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3 })
                        );
                        group.add(wireframe);

                    } else {
                        const imgTexture = new THREE.TextureLoader().load(getIconPath(node.type, settings.iconTheme));
                        imgTexture.colorSpace = THREE.SRGBColorSpace;
                        const iconMaterial = new THREE.SpriteMaterial({ map: imgTexture, transparent: true });
                        const iconSprite = new THREE.Sprite(iconMaterial);
                        iconSprite.scale.set(32, 32, 1); 
                        group.add(iconSprite);
                    }

                    // Status Indicator Ring
                    if (node.status !== 'online' && node.status !== 'success') {
                         const ringGeo = new THREE.RingGeometry(20, 22, 32);
                         const ringMat = new THREE.MeshBasicMaterial({ 
                             color: node.status === 'warning' ? 0xfaad14 : 0xff4d4f, 
                             side: THREE.DoubleSide, 
                             transparent: true, 
                             opacity: 0.8
                         });
                         const ring = new THREE.Mesh(ringGeo, ringMat);
                         ring.lookAt(fgRef.current.camera().position); // Billboard effect
                         group.add(ring);
                    }

                    if (settings.showLabels) {
                        const labelSprite = createTextSprite(node.label || node.id);
                        labelSprite.position.y = -22; 
                        group.add(labelSprite);
                    }

                    return group;
                }}

                // Link Visuals - Enhanced for visibility
                linkWidth={3}
                linkColor={() => '#4dabf7'}
                linkOpacity={0.7}
                linkDirectionalParticles={settings.particleEffects ? (link => link.traffic > 0 ? 4 : 0) : 0}
                linkDirectionalParticleSpeed={0.006}
                linkDirectionalParticleWidth={5}
                linkDirectionalParticleColor={() => '#69db7c'}

                onNodeClick={(node) => {
                    setSelectedDeviceId(node.id);
                    setDrawerVisible(true);
                    
                    const distOffset = 220; 
                    const camPos = { 
                        x: node.fx, 
                        y: node.fy + 20, 
                        z: node.fz + distOffset 
                    };
                    fgRef.current.cameraPosition(camPos, { x: node.fx, y: node.fy, z: node.fz }, 2000);
                }}
                
                d3Force="charge"
                d3VelocityDecay={0.2}
            />

            <TopologyControlPanel 
                interactionMode={interactionMode}
                setInteractionMode={setInteractionMode}
                onZoomchange={(val) => {
                    if (fgRef.current) {
                        const cam = fgRef.current.camera();
                        const currentPos = cam.position.clone();
                        currentPos.setLength(val); 
                        fgRef.current.cameraPosition(currentPos, null, 300);
                    }
                }}
                onResetCamera={() => fgRef.current.cameraPosition({ x: 200, y: 200, z: 600 }, { x: 0, y: 0, z: 0 }, 2000)}
                onSwitchTo2D={onSwitchTo2D}
                devices={devices}
                onSearchSelect={(val) => {
                     const node = graphData.nodes.find(n => n.id === val);
                     if (node) {
                        setSelectedDeviceId(node.id);
                        const distOffset = 220;
                        const camPos = { x: node.fx, y: node.fy + 20, z: node.fz + distOffset };
                        fgRef.current.cameraPosition(camPos, { x: node.fx, y: node.fy, z: node.fz }, 2000);
                        setDrawerVisible(true);
                     }
                }}
            />

            <DeviceDetailDrawer 
                open={drawerVisible}
                onClose={() => {
                    setDrawerVisible(false);
                    setSelectedDeviceId(null);
                    // Reset View
                    if (fgRef.current) {
                         fgRef.current.cameraPosition({ x: 200, y: 200, z: 600 }, { x: 0, y: 0, z: 0 }, 2000);
                    }
                }}
                device={selectedDevice}
            />
        </div>
    );
};

export default TopologyCanvas3D;
