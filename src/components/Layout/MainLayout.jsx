import React, { useState, useRef } from 'react';
import { Layout, Menu, Typography, Avatar, Space, Button, Switch } from 'antd';
import { 
  DeploymentUnitOutlined, 
  UnorderedListOutlined, 
  SettingOutlined,
  UserOutlined,
  DashboardOutlined,
  SunOutlined,
  MoonOutlined
} from '@ant-design/icons';
import { CSSTransition, SwitchTransition } from 'react-transition-group';
import TopologyCanvas3D from '../Topology/TopologyCanvas3D';
import TopologyCanvas from '../Topology/TopologyCanvas';
import DeviceList from '../DeviceList/DeviceList';
import Settings from '../Settings/Settings';
import Dashboard from '../Dashboard/Dashboard';
import { useSettings } from '../../context/SettingsContext';

const { Header, Content, Sider } = Layout;
const { Title } = Typography;

const MainLayout = () => {
  const { settings, updateSetting } = useSettings();
  const [activeMenu, setActiveMenu] = useState('0');
  const [focusNodeId, setFocusNodeId] = useState(null);
  const nodeRef = useRef(null);

  const handleLocate = (id) => {
    setActiveMenu('1');
    setTimeout(() => setFocusNodeId(id), 100);
  };

  const handleSwitchTo2D = () => {
      setActiveMenu('4');
  };

  const handleSwitchTo3D = () => {
      setActiveMenu('1');
  };

  const renderContent = () => {
    switch (activeMenu) {
      case '0': return <Dashboard />;
      case '1': return <TopologyCanvas3D focusNodeId={focusNodeId} onFocusComplete={() => setFocusNodeId(null)} onSwitchTo2D={handleSwitchTo2D} />;
      case '2': return <div style={{ padding: '32px 48px', height: '100%', width: '100%', boxSizing: 'border-box' }}><DeviceList onLocate={handleLocate} /></div>;
      case '3': return <div style={{ padding: '32px 48px', height: '100%', width: '100%', boxSizing: 'border-box' }}><Settings /></div>;
      case '4': return <div style={{ height: '100%', background: 'transparent' }}><TopologyCanvas onSwitchTo3D={handleSwitchTo3D} /></div>;
      default: return <Dashboard />;
    }
  };

  const isDark = settings.theme === 'dark';

  return (
    <Layout style={{ minHeight: '100vh', width: '100vw', background: 'var(--bg-app)' }}>
      {/* --- Glass Sider --- */}
      <Sider 
        width={260} 
        style={{ 
            height: '100vh', 
            position: 'fixed', 
            left: 0, 
            top: 0, 
            bottom: 0, 
            zIndex: 100,
            background: 'var(--glass-sidebar-bg)', 
            backdropFilter: 'blur(20px)',     
            borderRight: '1px solid var(--glass-border)'
        }}
      >
        {/* Brand Area */}
        <div style={{ 
            height: 80, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            borderBottom: '1px solid var(--glass-border)',
            marginBottom: 24,
            background: 'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0) 100%)'
        }}>
          <div style={{ 
              fontSize: 20, 
              fontWeight: 800, 
              background: 'linear-gradient(45deg, #1677ff, #00f0ff)', 
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              color: 'transparent',
              letterSpacing: 1
          }}>
              NETVIS PRO
          </div>
        </div>

        {/* User Profile Card */}
        <div style={{ padding: '0 20px', marginBottom: 32 }}>
             <Space align="center" style={{ 
                 padding: '16px', 
                 background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)', 
                 border: '1px solid var(--glass-border)',
                 borderRadius: 12, 
                 width: '100%',
                 boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
             }}>
                <Avatar 
                    size="large" 
                    icon={<UserOutlined />} 
                    style={{ background: 'linear-gradient(135deg, #1677ff 0%, #00f0ff 100%)' }} 
                />
                <div>
                    <div style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: 14 }}>管理员 (Admin)</div>
                    <div style={{ color: 'var(--text-tertiary)', fontSize: 11, marginTop: 2 }}>
                        <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: '#52c41a', marginRight: 4 }}></span>
                        Online
                    </div>
                </div>
             </Space>
        </div>

        {/* Navigation Menu */}
        <Menu 
          mode="inline" 
          defaultSelectedKeys={['0']} 
          selectedKeys={[activeMenu]}
          onClick={({ key }) => setActiveMenu(key)}
          style={{ borderRight: 'none', background: 'transparent' }}
          items={[
            { key: '0', icon: <DashboardOutlined />, label: '系统仪表盘' },
            { key: '1', icon: <DeploymentUnitOutlined />, label: '3D 拓扑视图' },
            { key: '4', icon: <DeploymentUnitOutlined />, label: '2D 拓扑视图' },
            { key: '2', icon: <UnorderedListOutlined />, label: '设备列表' },
            { key: '3', icon: <SettingOutlined />, label: '系统设置' },
          ]} 
        />
      </Sider>
      
      <Layout style={{ marginLeft: 260, marginTop: 16, height: 'calc(100vh - 16px)', overflow: 'hidden', background: 'transparent' }}>
        {/* --- Glass Header --- */}
        <Header style={{ 
          padding: '0 48px', 
          background: 'var(--glass-header-bg)', 
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid var(--glass-border)',
          height: 80,
          zIndex: 90,
          width: '100%',
          boxSizing: 'border-box',
          display: 'flex', 
          alignItems: 'center',
          justifyContent: 'flex-end', // Align buttons to right
          position: 'relative' // Anchor for absolute title
        }}>
            {/* Absolute Centered Title - The "Safety Zone" */}
            <div style={{
                position: 'absolute',
                left: '50%',
                top: '58%',
                transform: 'translate(-50%, -50%)',
                textAlign: 'center',
                width: 'auto',
                whiteSpace: 'nowrap'
            }}>
                <Title level={4} style={{ margin: 0, fontWeight: 600, letterSpacing: 0.5, lineHeight: 1.2 }}>
                    数据中心实时监控平台
                </Title>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>
                    Data Center Real-time Monitoring Platform
                </div>
            </div>

            {/* Right Side Buttons */}
            <Space size={16}>
                 <Switch 
                    checkedChildren={<SunOutlined />}
                    unCheckedChildren={<MoonOutlined />}
                    checked={settings.theme === 'light'}
                    onChange={(checked) => updateSetting('theme', checked ? 'light' : 'dark')}
                 />
                 <Button type="primary" ghost size="small" style={{ fontSize: 12 }}>帮助文档</Button>
                 <Button type="primary" size="small" style={{ fontSize: 12, background: '#1677ff' }}>联系支持</Button>
            </Space>
        </Header>
        
        {/* --- Animated Content Area --- */}
        <Content style={{ 
          position: 'relative', 
          height: 'calc(100vh - 80px)',
          overflow: activeMenu === '1' ? 'hidden' : 'auto', // Disable scroll for 3D view
          background: activeMenu === '1' ? '#000' : 'transparent',
        }}>
            <SwitchTransition mode="out-in">
                <CSSTransition
                    key={activeMenu}
                    nodeRef={nodeRef}
                    timeout={300}
                    classNames="fade"
                    unmountOnExit
                >
                    <div ref={nodeRef} style={{ height: '100%', width: '100%' }}>
                        {renderContent()}
                    </div>
                </CSSTransition>
            </SwitchTransition>
        </Content>
      </Layout>
    </Layout>
  );
};

export default MainLayout;
