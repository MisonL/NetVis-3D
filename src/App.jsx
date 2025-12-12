import React from 'react';
import { ConfigProvider, theme } from 'antd';
import MainLayout from './components/Layout/MainLayout';
import { SettingsProvider } from './context/SettingsContext';

function App() {
  return (
    <SettingsProvider>
      <ConfigProvider
        theme={{
          algorithm: theme.darkAlgorithm,
          token: {
            colorPrimary: '#1677ff',
            colorBgBase: '#000000', // Deep black base
            colorBgContainer: '#141414',
            fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
            borderRadius: 8,
          },
          components: {
            Layout: {
                bodyBg: '#050b14',
                headerBg: '#050b14',
                triggerBg: '#162130',
            },
            Menu: {
                itemBg: 'transparent',
                itemSelectedBg: 'rgba(22, 119, 255, 0.15)',
                itemSelectedColor: '#1677ff',
            }
          }
        }}
      >
        <MainLayout />
      </ConfigProvider>
    </SettingsProvider>
  );
}

export default App;
