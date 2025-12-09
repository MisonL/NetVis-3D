import React from 'react';
import { ConfigProvider } from 'antd';
import MainLayout from './components/Layout/MainLayout';

function App() {
  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#1677ff',
        },
      }}
    >
      <MainLayout />
    </ConfigProvider>
  );
}

export default App;
