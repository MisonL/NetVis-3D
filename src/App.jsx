import React from 'react';
import { ConfigProvider, theme } from 'antd';
import MainLayout from './components/Layout/MainLayout';
import { SettingsProvider, useSettings } from './context/SettingsContext';

const AppContent = () => {
    const { settings } = useSettings();
    const isDark = settings.theme === 'dark';

    return (
        <ConfigProvider
            theme={{
                algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
                token: {
                    colorPrimary: '#1677ff',
                    colorBgBase: isDark ? '#000000' : '#ffffff',
                    colorBgContainer: isDark ? '#141414' : '#ffffff',
                    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
                    borderRadius: 8,
                },
                components: {
                    Layout: {
                        bodyBg: isDark ? '#050b14' : '#f0f2f5',
                        headerBg: isDark ? '#050b14' : '#ffffff',
                        triggerBg: isDark ? '#162130' : '#ffffff',
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
    );
};

function App() {
  return (
    <SettingsProvider>
        <AppContent />
    </SettingsProvider>
  );
}

export default App;
