import React from 'react';
import { ConfigProvider, theme, Spin } from 'antd';
import MainLayout from './components/Layout/MainLayout';
import LoginPage from './components/Auth/LoginPage';
import { SettingsProvider, useSettings } from './context/SettingsContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LicenseProvider } from './context/LicenseContext';
import { I18nProvider } from './context/I18nContext';

const AppContent = () => {
    const { settings } = useSettings();
    const { isAuthenticated, loading } = useAuth();
    const isDark = settings.theme === 'dark';

    // 加载中状态
    if (loading) {
        return (
            <div style={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: isDark ? '#0a1628' : '#f0f2f5',
            }}>
                <Spin size="large" tip="加载中..." />
            </div>
        );
    }

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
                    },
                    Input: {
                        colorBgContainer: isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
                    },
                }
            }}
        >
            {isAuthenticated ? (
                <LicenseProvider>
                    <MainLayout />
                </LicenseProvider>
            ) : (
                <LoginPage />
            )}
        </ConfigProvider>
    );
};

function App() {
  return (
    <SettingsProvider>
        <I18nProvider>
            <AuthProvider>
                <AppContent />
            </AuthProvider>
        </I18nProvider>
    </SettingsProvider>
  );
}

export default App;

