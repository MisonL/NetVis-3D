import React from 'react';
import { Button, Tooltip, Segmented, Select, Typography } from 'antd';
import { 
    ReloadOutlined, 
    EyeOutlined, 
    EyeInvisibleOutlined,
    BgColorsOutlined,
    SunOutlined,
    SwapOutlined
} from '@ant-design/icons';
import { useSettings } from '../../context/SettingsContext';

const { Text } = Typography;

const TopologyControlPanel2D = ({ 
    onSwitchTo3D,
    devices = [],
    onSearchSelect,
    onFitView
}) => {
    const { settings, updateSetting } = useSettings();

    const isDark = settings.canvasTheme2D === 'dark'; // Use local canvas theme
    const panelStyle = {
        position: 'absolute',
        top: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '8px 16px',
        background: isDark ? 'rgba(0, 0, 0, 0.6)' : 'rgba(255, 255, 255, 0.8)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderRadius: '12px',
        border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.1)',
        boxShadow: isDark ? '0 4px 24px rgba(0, 0, 0, 0.3)' : '0 4px 24px rgba(0, 0, 0, 0.1)',
        zIndex: 100,
        color: isDark ? '#fff' : '#333'
    };

    const separatorStyle = {
        width: 1, 
        height: 24, 
        backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' 
    };

    return (
        <div style={panelStyle}>
            {/* Device Search */}
            <Select
                showSearch
                placeholder="🔍 搜索设备..."
                optionFilterProp="children"
                onChange={onSearchSelect}
                filterOption={(input, option) =>
                    (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                }
                options={devices.map(n => ({ value: n.id, label: n.label }))}
                style={{ width: 160 }}
                classNames={{ popup: isDark ? 'glass-dropdown' : 'glass-dropdown-light' }} 
                size="middle"
                variant="borderless"
                className={isDark ? "glass-select" : "glass-select-light"}
            />

            <div style={separatorStyle} />

            {/* Switch to 3D */}
            <Tooltip title="切换到 3D 视图">
                <Button 
                    type="primary"
                    icon={<SwapOutlined />}
                    onClick={onSwitchTo3D}
                    style={{ 
                        background: 'rgba(22, 119, 255, 0.8)', 
                        border: 'none',
                        boxShadow: 'none'
                    }}
                >
                    3D View
                </Button>
            </Tooltip>

            <div style={separatorStyle} />

            {/* Canvas Theme Toggle */}
            <Tooltip title="切换背景主题">
                 <Segmented 
                    options={[
                        { label: '暗色', value: 'dark', icon: <BgColorsOutlined /> },
                        { label: '亮色', value: 'light', icon: <SunOutlined /> }
                    ]}
                    value={settings.canvasTheme2D}
                    onChange={(val) => updateSetting('canvasTheme2D', val)}
                    size="small"
                    className={isDark ? "glass-segmented" : ""}
                 />
            </Tooltip>

            <div style={separatorStyle} />
            
            {/* Show/Hide Labels */}
            <Tooltip title={settings.showLabels ? "隐藏标签" : "显示标签"}>
                <Button 
                    type="text" 
                    icon={settings.showLabels ? <EyeOutlined /> : <EyeInvisibleOutlined />} 
                    style={{ color: isDark ? 'var(--text-primary)' : '#333' }}
                    onClick={() => updateSetting('showLabels', !settings.showLabels)}
                />
            </Tooltip>
            
            {/* Fit View */}
            <Tooltip title="适应视图">
                <Button 
                    type="primary" 
                    icon={<ReloadOutlined />} 
                    style={{ 
                        background: 'rgba(22, 119, 255, 0.8)',
                        border: 'none',
                        fontWeight: 600,
                        boxShadow: 'none'
                    }}
                    onClick={onFitView}
                >
                    复位
                </Button>
            </Tooltip>
        </div>
    );
};

export default TopologyControlPanel2D;
