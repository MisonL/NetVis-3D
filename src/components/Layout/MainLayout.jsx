import React, { useState } from 'react';
import { Layout, Menu, Typography, Avatar, Space, Button } from 'antd';
import { 
  DeploymentUnitOutlined, 
  UnorderedListOutlined, 
  SettingOutlined,
  UserOutlined 
} from '@ant-design/icons';
import TopologyCanvas3D from '../Topology/TopologyCanvas3D';
import TopologyCanvas from '../Topology/TopologyCanvas';
import DeviceList from '../DeviceList/DeviceList';
import Settings from '../Settings/Settings';

const { Header, Content, Sider } = Layout;
const { Title } = Typography;

const MainLayout = () => {
  const [activeMenu, setActiveMenu] = useState('1');
  const [focusNodeId, setFocusNodeId] = useState(null);

  const handleLocate = (id) => {
    setActiveMenu('1');
    setTimeout(() => setFocusNodeId(id), 100);
  };

  const handleSwitchTo2D = () => {
      setActiveMenu('4');
  };

  const renderContent = () => {
    switch (activeMenu) {
      case '1': return <TopologyCanvas3D focusNodeId={focusNodeId} onFocusComplete={() => setFocusNodeId(null)} onSwitchTo2D={handleSwitchTo2D} />;
      case '2': return <div style={{ padding: 24 }}><DeviceList onLocate={handleLocate} /></div>;
      case '3': return <div style={{ padding: 24 }}><Settings /></div>;
      case '4': return <div style={{ height: '100%', background: '#fff' }}><TopologyCanvas /></div>; // 2D View
      default: return <TopologyCanvas3D />;
    }
  };

  return (
    <Layout style={{ minHeight: '100vh', width: '100vw' }}>
      {/* ... Sider ... */}
      <Sider width={240} theme="dark" style={{ overflow: 'auto', height: '100vh', position: 'fixed', left: 0, top: 0, bottom: 0, zIndex: 100 }}>
        {/* ... Header ... */}
        <div style={{ height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.05)', marginBottom: 16 }}>
          <Button type="primary" style={{ background: '#1677ff', border: 'none', fontWeight: 'bold' }}>NetVis Platform</Button>
        </div>

        <div style={{ padding: '0 16px', marginBottom: 24 }}>
             <Space align="center" style={{ padding: '12px', background: 'rgba(255,255,255,0.04)', borderRadius: 8, width: '100%' }}>
                <Avatar icon={<UserOutlined />} style={{ backgroundColor: '#1677ff' }} />
                <div>
                    <div style={{ color: '#fff', fontWeight: 500 }}>Admin User</div>
                    <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12 }}>Network Operator</div>
                </div>
             </Space>
        </div>

        <Menu 
          theme="dark" 
          mode="inline" 
          defaultSelectedKeys={['1']} 
          selectedKeys={[activeMenu]}
          onClick={({ key }) => setActiveMenu(key)}
          items={[
            { key: '1', icon: <DeploymentUnitOutlined />, label: '3D 拓扑视图' },
            { key: '4', icon: <DeploymentUnitOutlined />, label: '2D 拓扑视图' }, // New 2D Menu
            { key: '2', icon: <UnorderedListOutlined />, label: '设备列表' },
            { key: '3', icon: <SettingOutlined />, label: '系统设置' },
          ]} 
        />
      </Sider>
      
      <Layout style={{ marginLeft: 240, height: '100vh', overflow: 'hidden' }}>
        <Header style={{ 
          padding: '0 24px', 
          background: '#fff', 
          display: 'flex', 
          alignItems: 'center',
          boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
          zIndex: 90
        }}>
          <Title level={4} style={{ margin: 0 }}>3D 数据中心可视化平台</Title>
        </Header>
        
        <Content style={{ 
          position: 'relative', 
          overflow: activeMenu === '1' ? 'hidden' : 'auto',
          height: 'calc(100vh - 64px)',
          background: activeMenu === '1' ? '#000' : '#f0f2f5'
        }}>
           {renderContent()}
        </Content>
      </Layout>
    </Layout>
  );
};

export default MainLayout;
