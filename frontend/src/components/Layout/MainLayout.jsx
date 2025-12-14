import React, { useState, useRef, useEffect } from 'react';
import { Layout, Menu, Typography, Avatar, Space, Button, Switch, Dropdown, message } from 'antd';
import { 
  DeploymentUnitOutlined, 
  UnorderedListOutlined, 
  SettingOutlined,
  UserOutlined,
  DashboardOutlined,
  SunOutlined,
  MoonOutlined,
  LogoutOutlined,
  KeyOutlined,
  TeamOutlined,
  BellOutlined,
  SearchOutlined,
  DesktopOutlined,
  MenuOutlined,
  CloseOutlined
} from '@ant-design/icons';
import { CSSTransition, SwitchTransition } from 'react-transition-group';
import TopologyCanvas3D from '../Topology/TopologyCanvas3D';
import TopologyCanvas from '../Topology/TopologyCanvas';
import HeaderTitle from './HeaderTitle';
import DeviceList from '../DeviceList/DeviceList';
import Settings from '../Settings/Settings';
import Dashboard from '../Dashboard/Dashboard';
import UserManagement from '../UserManagement/UserManagement';
import AlertCenter from '../Alerts/AlertCenter';
import AlertBell from '../Alerts/AlertBell';
import AnalyticsDashboard from '../Analytics/AnalyticsDashboard';
import GlobalSearch from '../Common/GlobalSearch';
import LicenseManagement from '../License/LicenseManagement';
import AuditLogs from '../Audit/AuditLogs';
import OpenApiManagement from '../OpenApi/OpenApiManagement';
import ConfigManagement from '../Config/ConfigManagement';
import ReportCenter from '../Report/ReportCenter';
import NotificationCenter from '../Notification/NotificationCenter';
import SystemMonitor from '../System/SystemMonitor';
import FullScreenMonitor from '../Monitor/FullScreenMonitor';
import { useSettings } from '../../context/SettingsContext';
import { useAuth } from '../../context/AuthContext';
import { useLicense } from '../../context/LicenseContext';
import { useMobileSidebar } from '../../hooks/useMobile';

const { Header, Content, Sider } = Layout;
const { Title } = Typography;

const MainLayout = () => {
  const { settings, updateSetting } = useSettings();
  const { user, logout, hasPermission } = useAuth();
  const { isModuleEnabled } = useLicense();
  const { isMobile, sidebarVisible, toggleSidebar, closeSidebar, onMenuSelect } = useMobileSidebar();
  const [activeMenu, setActiveMenu] = useState('0');
  const [focusNodeId, setFocusNodeId] = useState(null);
  const [searchVisible, setSearchVisible] = useState(false);
  const nodeRef = useRef(null);

  // 快捷键支持 Cmd+K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchVisible(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleLogout = async () => {
    await logout();
    message.success('已退出登录');
  };

  const userMenuItems = [
    { key: 'profile', icon: <UserOutlined />, label: '个人信息' },
    { key: 'password', icon: <KeyOutlined />, label: '修改密码' },
    { type: 'divider' },
    { key: 'logout', icon: <LogoutOutlined />, label: '退出登录', danger: true },
  ];

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
      case '5': return <UserManagement />;
      case '6': return <AlertCenter />;
      case '7': return <AnalyticsDashboard />;
      case '8': return <LicenseManagement />;
      case '9': return <AuditLogs />;
      case '10': return <OpenApiManagement />;
      case '11': return <ConfigManagement />;
      case '12': return <ReportCenter />;
      case '13': return <NotificationCenter />;
      case '14': return <SystemMonitor />;
      case '15': return <FullScreenMonitor />;
      default: return <Dashboard />;
    }
  };

  const isDark = settings.theme === 'dark';

  return (
    <>
    <Layout style={{ minHeight: '100vh', width: '100vw', background: 'var(--bg-app)' }}>
      {/* 移动端遮罩层 */}
      {isMobile && (
        <div 
          className={`mobile-overlay ${sidebarVisible ? 'visible' : ''}`}
          onClick={closeSidebar}
        />
      )}
      
      {/* --- Glass Sider --- */}
      <Sider 
        width={260}
        className={isMobile && sidebarVisible ? 'mobile-visible' : ''}
        style={{ 
            height: '100vh', 
            position: 'fixed', 
            left: isMobile && !sidebarVisible ? -280 : 0, 
            top: 0, 
            bottom: 0, 
            zIndex: 1000,
            background: 'var(--glass-sidebar-bg)', 
            backdropFilter: 'blur(20px)',     
            borderRight: '1px solid var(--glass-border)',
            transition: 'left 0.3s ease',
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
          <Dropdown
            menu={{
              items: userMenuItems,
              onClick: ({ key }) => {
                if (key === 'logout') handleLogout();
              },
            }}
            trigger={['click']}
          >
             <Space align="center" style={{ 
                 padding: '16px', 
                 background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)', 
                 border: '1px solid var(--glass-border)',
                 borderRadius: 12, 
                 width: '100%',
                 boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                 cursor: 'pointer',
                 transition: 'all 0.3s',
             }}>
                <Avatar 
                    size="large" 
                    icon={<UserOutlined />} 
                    style={{ background: 'linear-gradient(135deg, #1677ff 0%, #00f0ff 100%)' }} 
                />
                <div>
                    <div style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: 14 }}>
                      {user?.displayName || user?.username || '用户'}
                    </div>
                    <div style={{ color: 'var(--text-tertiary)', fontSize: 11, marginTop: 2 }}>
                        <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: '#52c41a', marginRight: 4 }}></span>
                        {user?.role === 'admin' ? '管理员' : user?.role === 'user' ? '用户' : '访客'}
                    </div>
                </div>
             </Space>
          </Dropdown>
        </div>

        {/* Navigation Menu */}
        <Menu 
          mode="inline" 
          defaultSelectedKeys={['0']} 
          selectedKeys={[activeMenu]}
          onClick={({ key }) => { setActiveMenu(key); onMenuSelect(); }}
          style={{ borderRight: 'none', background: 'transparent' }}
          items={[
            { key: '0', icon: <DashboardOutlined />, label: '系统仪表盘' },
            { key: '1', icon: <DeploymentUnitOutlined />, label: '3D 拓扑视图' },
            { key: '4', icon: <DeploymentUnitOutlined />, label: '2D 拓扑视图' },
            { key: '2', icon: <UnorderedListOutlined />, label: '设备列表' },
            isModuleEnabled('ALERT') && { key: '6', icon: <BellOutlined />, label: '告警中心' },
            { key: '7', icon: <DashboardOutlined />, label: '数据分析' },
            hasPermission('admin') && { key: '5', icon: <TeamOutlined />, label: '用户管理' },
            hasPermission('admin') && { key: '8', icon: <SettingOutlined />, label: 'License授权' },
            hasPermission('admin') && isModuleEnabled('AUDIT') && { key: '9', icon: <SettingOutlined />, label: '审计日志' },
            hasPermission('admin') && isModuleEnabled('API') && { key: '10', icon: <SettingOutlined />, label: '开放API' },
            hasPermission('admin') && isModuleEnabled('CONFIG') && { key: '11', icon: <SettingOutlined />, label: '配置管理' },
            hasPermission('admin') && isModuleEnabled('REPORT') && { key: '12', icon: <SettingOutlined />, label: '报表中心' },
            { key: '13', icon: <BellOutlined />, label: '通知中心' },
            hasPermission('admin') && { key: '14', icon: <DashboardOutlined />, label: '系统监控' },
            { key: '15', icon: <DesktopOutlined />, label: '监控大屏' },
            { key: '3', icon: <SettingOutlined />, label: '系统设置' },
          ].filter(Boolean)} 
        />
      </Sider>
      
      <Layout style={{ marginLeft: 260, height: '100vh', overflow: 'hidden', background: 'transparent' }}>
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
          justifyContent: 'flex-end',
          position: 'relative',
          overflow: 'visible', // Critical: Allow title to overflow if needed
        }}>
            {/* Center: Brand Title Refactored */}
            <HeaderTitle />

            {/* Right: Actions */}
            <Space size={16}>
                 {/* 移动端菜单按钮 */}
                 {isMobile && (
                   <Button 
                     type="text"
                     icon={sidebarVisible ? <CloseOutlined /> : <MenuOutlined />}
                     onClick={toggleSidebar}
                     style={{ fontSize: 18 }}
                   />
                 )}
                 <Button 
                    type="text" 
                    icon={<SearchOutlined />} 
                    onClick={() => setSearchVisible(true)}
                    style={{ fontSize: 16 }}
                 />
                 <AlertBell onClick={() => setActiveMenu('6')} />
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
    
    {/* 全局搜索 */}
    <GlobalSearch 
      visible={searchVisible}
      onClose={() => setSearchVisible(false)}
      onNavigate={(item) => {
        if (item.type === 'device') setActiveMenu('2');
        else if (item.type === 'alert') setActiveMenu('6');
        else if (item.type === 'user') setActiveMenu('5');
        else if (item.type === 'page') {
          if (item.title.includes('设置')) setActiveMenu('3');
          else if (item.title.includes('分析')) setActiveMenu('7');
        }
      }}
    />
  </>
  );
};

export default MainLayout;
