import React from 'react';
import { Button, Tooltip, Slider, Segmented, Select, Typography, ColorPicker } from 'antd';
import { 
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
    SwapOutlined,
    ThunderboltOutlined 
} from '@ant-design/icons';
import { useSettings } from '../../context/SettingsContext';

const { Text } = Typography;

const TopologyControlPanel = ({ 
    interactionMode, 
    setInteractionMode, 
    onZoomchange, 
    onResetCamera, 
    onSwitchTo2D,
    devices,
    onSearchSelect
}) => {
    const { settings, updateSetting } = useSettings();

    return (
        <div style={{
            position: 'absolute',
            top: 24,
            right: 24,
            zIndex: 100,
            display: 'flex',
            gap: 12,
            background: 'var(--glass-panel-bg)', 
            padding: '10px 16px',
            borderRadius: 12,
            backdropFilter: 'var(--glass-blur)',
            border: '1px solid var(--glass-panel-border)',
            boxShadow: 'var(--glass-panel-shadow)',
            alignItems: 'center',
            flexWrap: 'wrap',
            maxWidth: 'calc(100vw - 300px)' // Prevent overlap with header roughly
        }}>
            {/* SEARCH */}
             <Select
                showSearch
                placeholder="🔍 搜索设备..."
                optionFilterProp="children"
                onChange={onSearchSelect}
                filterOption={(input, option) =>
                    (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                }
                options={devices.map(n => ({ value: n.id, label: n.label }))}
                style={{ 
                    width: 160,
                }}
                classNames={{ popup: 'glass-dropdown' }} 
                size="middle"
                variant="borderless"
                className="glass-select"
            />

            <div style={{ width: 1, height: 24, backgroundColor: 'rgba(255,255,255,0.1)' }} />

            {/* Switch to 2D View */}
            {onSwitchTo2D && (
                <Tooltip title="切换到 2D 视图">
                    <Button 
                        type="text"
                        icon={<SwapOutlined />}
                        onClick={onSwitchTo2D}
                        style={{ color: 'var(--text-primary)' }}
                        className="glass-btn"
                    >
                        2D View
                    </Button>
                </Tooltip>
            )}

            <Tooltip title={interactionMode === 'pan' ? "当前: 平移 (点击切换)" : "当前: 旋转 (点击切换)"}>
                <Button 
                    type="text"
                    style={{ 
                        color: 'var(--text-primary)', 
                        background: interactionMode === 'rotate' ? 'rgba(22,119,255,0.3)' : 'transparent',
                        border: interactionMode === 'rotate' ? '1px solid var(--primary-color)' : '1px solid transparent'
                    }}
                    icon={<DeploymentUnitOutlined rotate={interactionMode === 'rotate' ? 45 : 0}/>}
                    onClick={() => setInteractionMode(prev => prev === 'pan' ? 'rotate' : 'pan')}
                >
                    {interactionMode === 'pan' ? '平移模式' : '旋转模式'}
                </Button>
            </Tooltip>

            {/* Bloom Toggle */}
            <Tooltip title={settings.bgMode === 'light' ? "亮色模式下辉光特效不可用" : (settings.bloomEnabled ? "关闭辉光特效" : "开启辉光特效 (高性能)")}>
                <Button 
                    type="text"
                    icon={<ThunderboltOutlined />}
                    disabled={settings.bgMode === 'light'}
                    style={{ 
                        color: settings.bgMode === 'light' ? 'rgba(0,0,0,0.25)' : (settings.bloomEnabled ? '#faad14' : 'var(--text-tertiary)'),
                        background: settings.bgMode === 'light' ? 'transparent' : (settings.bloomEnabled ? 'rgba(250,173,20,0.15)' : 'transparent'),
                        boxShadow: (settings.bloomEnabled && settings.bgMode !== 'light') ? '0 0 8px rgba(250,173,20,0.4)' : 'none',
                        cursor: settings.bgMode === 'light' ? 'not-allowed' : 'pointer'
                    }}
                    onClick={() => updateSetting('bloomEnabled', !settings.bloomEnabled)}
                />
            </Tooltip>

            {/* Bloom Intensity Slider - only show when enabled */}
            {/* Bloom Intensity Slider - only show when enabled */}
            {settings.bloomEnabled && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Text style={{ color: settings.bgMode === 'light' ? 'rgba(0,0,0,0.25)' : '#faad14', fontSize: 11 }}>亮度</Text>
                    <Slider
                        min={0.1}
                        max={1.5}
                        step={0.1}
                        disabled={settings.bgMode === 'light'}
                        value={settings.bloomIntensity}
                        onChange={(val) => updateSetting('bloomIntensity', val)}
                        style={{ width: 60, margin: 0 }}
                        styles={{ 
                            track: { background: settings.bgMode === 'light' ? 'rgba(0,0,0,0.1)' : '#faad14' }, 
                            rail: { background: settings.bgMode === 'light' ? 'rgba(0,0,0,0.05)' : 'rgba(250,173,20,0.1)' },
                            handle: { borderColor: settings.bgMode === 'light' ? 'rgba(0,0,0,0.25)' : '#faad14' }
                        }}
                    />
                </div>
            )}

            <div style={{ width: 1, height: 24, backgroundColor: 'rgba(255,255,255,0.1)' }} />

            {/* SLIDERS - Zoom */}
             <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                 <Text style={{ color: 'var(--text-secondary)', fontSize: 12 }}>缩放</Text>
                 <Slider 
                    min={200} max={1200} 
                    defaultValue={600}
                    reverse
                    tooltip={{ formatter: null }}
                    onChange={onZoomchange}
                    style={{ width: 80, margin: 0 }}
                    styles={{ 
                        track: { background: 'var(--primary-color)' }, 
                        rail: { background: 'rgba(255,255,255,0.1)' },
                        handle: { borderColor: 'var(--primary-color)', boxShadow: '0 0 0 2px rgba(22,119,255,0.2)' }
                    }}
                 />
            </div>

            <div style={{ width: 1, height: 24, backgroundColor: 'rgba(255,255,255,0.1)' }} />

             <Tooltip title="切换图标主题">
                 <Segmented 
                    options={[
                        { label: '拟真', value: 'premium', icon: <DeploymentUnitOutlined /> },
                        { label: '经典', value: 'classic', icon: <AppstoreOutlined /> }, 
                        { label: '几何', value: 'geometric', icon: <CodeOutlined /> }
                    ]}
                    value={settings.iconTheme}
                    onChange={(val) => updateSetting('iconTheme', val)}
                    size="small"
                    className="glass-segmented"
                 />
            </Tooltip>

            <Tooltip title="切换背景">
                 <Segmented 
                    options={[
                        { label: '星空', value: 'starfield', icon: <BgColorsOutlined /> },
                        { label: '暗色网格', value: 'grid', icon: <GatewayOutlined /> }, 
                        { label: '亮色网格', value: 'light', icon: <SunOutlined /> },
                        { label: '纯色', value: 'solid', icon: <StopOutlined /> }
                    ]}
                    value={settings.bgMode}
                    onChange={(val) => updateSetting('bgMode', val)}
                    size="small"
                    className="glass-segmented"
                 />
            </Tooltip>

            {settings.bgMode === 'solid' && (
                <Tooltip title="选择背景颜色">
                    <ColorPicker 
                        value={settings.solidBgColor}
                        onChange={(color) => updateSetting('solidBgColor', color.toHexString())}
                        size="small"
                        presets={[
                            {
                                label: '推荐',
                                colors: ['#1a1a2e', '#16213e', '#0f0f23', '#1a1a1a', '#0d1117', '#2d2d44', '#1e1e3f', '#0a0a14'],
                            },
                        ]}
                    />
                </Tooltip>
            )}
            
            <Tooltip title={settings.showLabels ? "隐藏标签" : "显示标签"}>
                <Button 
                    type="text" 
                    icon={settings.showLabels ? <EyeOutlined /> : <EyeInvisibleOutlined />} 
                    style={{ color: 'var(--text-primary)' }}
                    onClick={() => updateSetting('showLabels', !settings.showLabels)}
                />
            </Tooltip>
            
            <Tooltip title="重置视角到初始位置">
                <Button 
                    type="primary" 
                    icon={<ReloadOutlined />} 
                    style={{ 
                        background: 'rgba(22, 119, 255, 0.8)',
                        border: 'none',
                        fontWeight: 600
                    }}
                    onClick={onResetCamera}
                >
                    复位
                </Button>
            </Tooltip>
            

        </div>
    );
};

export default TopologyControlPanel;
