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
  CloseOutlined,
  RadarChartOutlined,
  ThunderboltOutlined,
  ScheduleOutlined,
  CloudServerOutlined,
  ApiOutlined,
  CloudUploadOutlined,
  FileTextOutlined,
  ClusterOutlined,
  MailOutlined,
  HeartOutlined,
  BranchesOutlined,
  AreaChartOutlined,
  ToolOutlined,
  CodeOutlined,
  LineChartOutlined,
  WechatOutlined,
  SafetyCertificateOutlined,
  ApartmentOutlined,
  CloudDownloadOutlined,
  FundProjectionScreenOutlined,
  BookOutlined,
  AuditOutlined,
  FileSearchOutlined
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
import NetworkDiscovery from '../Discovery/NetworkDiscovery';
import AlertRuleManagement from '../Alerts/AlertRuleManagement';
import ScheduleManagement from '../Schedule/ScheduleManagement';
import CollectorManagement from '../Collector/CollectorManagement';
import SnmpTemplateManagement from '../Snmp/SnmpTemplateManagement';
import BackupManagement from '../Backup/BackupManagement';
import SystemLogs from '../LogViewer/SystemLogs';
import DeviceGroupManagement from '../Groups/DeviceGroupManagement';
import NotificationTemplates from '../Templates/NotificationTemplates';
import DeviceHealthScore from '../Health/DeviceHealthScore';
import TopologyConnectionManagement from '../TopologyManage/TopologyConnectionManagement';
import ApiUsageStats from '../ApiStats/ApiUsageStats';
import MaintenanceManagement from '../Maintenance/MaintenanceManagement';
import SshManagement from '../Ssh/SshManagement';
import TrafficAnalysis from '../Traffic/TrafficAnalysis';
import PerformanceBaseline from '../Baseline/PerformanceBaseline';
import WXWorkIntegration from '../WXWork/WXWorkIntegration';
import ComplianceCenter from '../Compliance/ComplianceCenter';
import WorkflowEditor from '../Workflow/WorkflowEditor';
import DataExport from '../Export/DataExport';
import BigScreen from '../BigScreen/BigScreen';
import KnowledgeBase from '../Knowledge/KnowledgeBase';
import AssetInventory from '../Inventory/AssetInventory';
import OncallManagement from '../Oncall/OncallManagement';
import DashboardCustomize from '../Dashboard/DashboardCustomize';
import SystemConfig from '../System/SystemConfig';
import SecurityCenter from '../Security/SecurityCenter';
import PerformanceDashboard from '../Performance/PerformanceDashboard';
import NetworkQuality from '../Network/NetworkQuality';
import TagManagement from '../Tags/TagManagement';
import BatchTaskManagement from '../Batch/BatchTaskManagement';
import ChangeManagement from '../Change/ChangeManagement';
import CapacityPlanning from '../Capacity/CapacityPlanning';
import CmdbManagement from '../Cmdb/CmdbManagement';
import IncidentManagement from '../Incident/IncidentManagement';
import SlaManagement from '../Sla/SlaManagement';
import IpamManagement from '../Ipam/IpamManagement';
import PortVlanManagement from '../Port/PortVlanManagement';
import FirmwareManagement from '../Firmware/FirmwareManagement';
import LinkMonitor from '../Link/LinkMonitor';
import DeviceTemplateManagement from '../Template/DeviceTemplateManagement';
import LogAnalysis from '../Log/LogAnalysis';
import NetworkTools from '../Tools/NetworkTools';
import EventBusManagement from '../Event/EventBusManagement';
import DataCenterManagement from '../DataCenter/DataCenterManagement';
import AlertChannelManagement from '../AlertChannel/AlertChannelManagement';
import TopologyExport from '../TopologyExport/TopologyExport';
import TenantManagement from '../Tenant/TenantManagement';
import CacheManagement from '../Cache/CacheManagement';
import NetworkDiagnostics from '../Diagnostics/NetworkDiagnostics';
import AccessControlManagement from '../Acl/AccessControlManagement';
import RateLimitManagement from '../RateLimit/RateLimitManagement';
import WorkflowManagement from '../Workflow/WorkflowManagement';
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
      case '16': return <NetworkDiscovery />;
      case '17': return <AlertRuleManagement />;
      case '18': return <ScheduleManagement />;
      case '19': return <CollectorManagement />;
      case '20': return <SnmpTemplateManagement />;
      case '21': return <BackupManagement />;
      case '22': return <SystemLogs />;
      case '23': return <DeviceGroupManagement />;
      case '24': return <NotificationTemplates />;
      case '25': return <DeviceHealthScore />;
      case '26': return <TopologyConnectionManagement />;
      case '27': return <ApiUsageStats />;
      case '28': return <MaintenanceManagement />;
      case '29': return <SshManagement />;
      case '30': return <TrafficAnalysis />;
      case '31': return <PerformanceBaseline />;
      case '32': return <WXWorkIntegration />;
      case '33': return <ComplianceCenter />;
      case '34': return <WorkflowEditor />;
      case '35': return <DataExport />;
      case '36': return <BigScreen />;
      case '37': return <KnowledgeBase />;
      case '38': return <AssetInventory />;
      case '39': return <OncallManagement />;
      case '40': return <DashboardCustomize />;
      case '41': return <SystemConfig />;
      case '42': return <SecurityCenter />;
      case '43': return <PerformanceDashboard />;
      case '44': return <NetworkQuality />;
      case '45': return <TagManagement />;
      case '46': return <BatchTaskManagement />;
      case '47': return <ChangeManagement />;
      case '48': return <CapacityPlanning />;
      case '49': return <CmdbManagement />;
      case '50': return <IncidentManagement />;
      case '51': return <SlaManagement />;
      case '52': return <IpamManagement />;
      case '53': return <PortVlanManagement />;
      case '54': return <FirmwareManagement />;
      case '55': return <LinkMonitor />;
      case '56': return <DeviceTemplateManagement />;
      case '57': return <LogAnalysis />;
      case '58': return <NetworkTools />;
      case '59': return <EventBusManagement />;
      case '60': return <DataCenterManagement />;
      case '61': return <AlertChannelManagement />;
      case '62': return <TopologyExport />;
      case '63': return <TenantManagement />;
      case '64': return <CacheManagement />;
      case '65': return <NetworkDiagnostics />;
      case '66': return <AccessControlManagement />;
      case '67': return <RateLimitManagement />;
      case '68': return <WorkflowManagement />;
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
            // 📊 监控中心
            {
              key: 'monitor',
              icon: <DashboardOutlined />,
              label: '监控中心',
              children: [
                { key: '0', icon: <DashboardOutlined />, label: '系统仪表盘' },
                { key: '1', icon: <DeploymentUnitOutlined />, label: '3D 拓扑视图' },
                { key: '4', icon: <DeploymentUnitOutlined />, label: '2D 拓扑视图' },
                { key: '15', icon: <DesktopOutlined />, label: '监控大屏' },
                hasPermission('admin') && { key: '36', icon: <FundProjectionScreenOutlined />, label: '大屏配置' },
              ].filter(Boolean),
            },
            // 📦 资产管理
            {
              key: 'asset',
              icon: <UnorderedListOutlined />,
              label: '资产管理',
              children: [
                { key: '2', icon: <UnorderedListOutlined />, label: '设备列表' },
                hasPermission('admin') && { key: '23', icon: <ClusterOutlined />, label: '设备分组' },
                hasPermission('admin') && { key: '38', icon: <AuditOutlined />, label: '资产盘点' },
                hasPermission('admin') && { key: '49', icon: <ClusterOutlined />, label: 'CMDB资产' },
                hasPermission('admin') && { key: '52', icon: <ApiOutlined />, label: 'IP地址管理' },
              ].filter(Boolean),
            },
            // 🔔 告警运维
            isModuleEnabled('ALERT') && {
              key: 'alert',
              icon: <BellOutlined />,
              label: '告警运维',
              children: [
                { key: '6', icon: <BellOutlined />, label: '告警中心' },
                hasPermission('admin') && { key: '17', icon: <ThunderboltOutlined />, label: '告警规则' },
                hasPermission('admin') && { key: '61', icon: <MailOutlined />, label: '告警渠道' },
                hasPermission('admin') && { key: '50', icon: <ThunderboltOutlined />, label: '故障管理' },
                hasPermission('admin') && { key: '39', icon: <TeamOutlined />, label: '值班管理' },
              ].filter(Boolean),
            },
            { key: '7', icon: <AreaChartOutlined />, label: '数据分析' },
            hasPermission('admin') && { key: '5', icon: <TeamOutlined />, label: '用户管理' },
            hasPermission('admin') && { key: '8', icon: <SettingOutlined />, label: 'License授权' },
            hasPermission('admin') && isModuleEnabled('AUDIT') && { key: '9', icon: <SettingOutlined />, label: '审计日志' },
            hasPermission('admin') && isModuleEnabled('API') && { key: '10', icon: <SettingOutlined />, label: '开放API' },
            hasPermission('admin') && isModuleEnabled('CONFIG') && { key: '11', icon: <SettingOutlined />, label: '配置管理' },
            hasPermission('admin') && isModuleEnabled('REPORT') && { key: '12', icon: <SettingOutlined />, label: '报表中心' },
            { key: '13', icon: <BellOutlined />, label: '通知中心' },
            hasPermission('admin') && { key: '14', icon: <DashboardOutlined />, label: '系统监控' },
            hasPermission('admin') && { key: '16', icon: <RadarChartOutlined />, label: '网络发现' },
            hasPermission('admin') && { key: '18', icon: <ScheduleOutlined />, label: '定时任务' },
            hasPermission('admin') && { key: '19', icon: <CloudServerOutlined />, label: '采集器管理' },
            hasPermission('admin') && { key: '20', icon: <ApiOutlined />, label: 'SNMP模板' },
            hasPermission('admin') && { key: '21', icon: <CloudUploadOutlined />, label: '备份恢复' },
            hasPermission('admin') && { key: '22', icon: <FileTextOutlined />, label: '系统日志' },
            hasPermission('admin') && { key: '24', icon: <MailOutlined />, label: '通知模板' },
            hasPermission('admin') && { key: '25', icon: <HeartOutlined />, label: '健康评分' },
            hasPermission('admin') && { key: '26', icon: <BranchesOutlined />, label: '拓扑连接' },
            hasPermission('admin') && { key: '27', icon: <AreaChartOutlined />, label: 'API统计' },
            hasPermission('admin') && { key: '28', icon: <ToolOutlined />, label: '维护计划' },
            hasPermission('admin') && { key: '29', icon: <CodeOutlined />, label: 'SSH管理' },
            hasPermission('admin') && { key: '30', icon: <LineChartOutlined />, label: '流量分析' },
            hasPermission('admin') && { key: '31', icon: <DashboardOutlined />, label: '性能基线' },
            hasPermission('admin') && { key: '32', icon: <WechatOutlined />, label: '企业微信' },
            hasPermission('admin') && { key: '33', icon: <SafetyCertificateOutlined />, label: '合规审计' },
            hasPermission('admin') && { key: '34', icon: <ApartmentOutlined />, label: '脚本编排' },
            hasPermission('admin') && { key: '35', icon: <CloudDownloadOutlined />, label: '数据导出' },
            { key: '37', icon: <BookOutlined />, label: '知识库' },
            hasPermission('admin') && { key: '40', icon: <DashboardOutlined />, label: '仪表盘配置' },
            hasPermission('admin') && { key: '41', icon: <SettingOutlined />, label: '系统配置' },
            hasPermission('admin') && { key: '42', icon: <SafetyCertificateOutlined />, label: '安全中心' },
            hasPermission('admin') && { key: '43', icon: <LineChartOutlined />, label: '性能监控' },
            hasPermission('admin') && { key: '44', icon: <RadarChartOutlined />, label: '网络质量' },
            hasPermission('admin') && { key: '45', icon: <ClusterOutlined />, label: '标签管理' },
            hasPermission('admin') && { key: '46', icon: <ScheduleOutlined />, label: '批量任务' },
            hasPermission('admin') && { key: '47', icon: <AuditOutlined />, label: '变更管理' },
            hasPermission('admin') && { key: '48', icon: <AreaChartOutlined />, label: '容量规划' },
            hasPermission('admin') && { key: '51', icon: <HeartOutlined />, label: 'SLA服务级别' },
            hasPermission('admin') && { key: '53', icon: <BranchesOutlined />, label: '端口VLAN' },
            hasPermission('admin') && { key: '54', icon: <CloudUploadOutlined />, label: '固件升级' },
            hasPermission('admin') && { key: '55', icon: <BranchesOutlined />, label: '链路监控' },
            hasPermission('admin') && { key: '56', icon: <FileTextOutlined />, label: '设备模板' },
            hasPermission('admin') && { key: '57', icon: <FileSearchOutlined />, label: '日志分析' },
            hasPermission('admin') && { key: '58', icon: <ToolOutlined />, label: '网络工具' },
            hasPermission('admin') && { key: '59', icon: <ThunderboltOutlined />, label: '事件总线' },
            hasPermission('admin') && { key: '60', icon: <ClusterOutlined />, label: '数据中心' },
            hasPermission('admin') && { key: '62', icon: <CloudDownloadOutlined />, label: '拓扑导出' },
            hasPermission('admin') && { key: '63', icon: <TeamOutlined />, label: '租户管理' },
            hasPermission('admin') && { key: '64', icon: <CloudServerOutlined />, label: '缓存管理' },
            hasPermission('admin') && { key: '65', icon: <ToolOutlined />, label: '网络诊断' },
            hasPermission('admin') && { key: '66', icon: <SafetyCertificateOutlined />, label: '访问控制' },
            hasPermission('admin') && { key: '67', icon: <ApiOutlined />, label: 'API限流' },
            hasPermission('admin') && { key: '68', icon: <ApartmentOutlined />, label: '工作流编排' },
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
