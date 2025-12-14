import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// 模块与菜单的映射关系
const MODULE_MENU_MAP = {
  CORE: ['0', '1', '4', '2', '3'], // 仪表盘、拓扑、设备、设置
  ASSET: ['2'], // 设备管理
  ALERT: ['6'], // 告警中心
  REPORT: ['12'], // 报表中心
  AUDIT: ['9'], // 审计日志
  CONFIG: ['11'], // 配置管理
  API: ['10'], // 开放API
  SSH: [], // SSH管理（暂无独立页面）
  HA: [], // 高可用
  MOBILE: [], // 移动端
};

const LicenseContext = createContext(null);

export const LicenseProvider = ({ children }) => {
  const { token } = useAuth();
  const [license, setLicense] = useState({
    status: 'loading',
    edition: 'community',
    modules: ['CORE'],
    limits: { maxDevices: 10, maxUsers: 3 },
    usage: { devices: 0, users: 0 },
    expiresAt: null,
  });
  const [loading, setLoading] = useState(true);

  // 获取License信息
  const fetchLicense = useCallback(async () => {
    if (!token) {
      setLicense(prev => ({ ...prev, status: 'unlicensed' }));
      setLoading(false);
      return;
    }

    try {
      const [infoRes, usageRes] = await Promise.all([
        fetch(`${API_BASE}/api/license/info`, {
          headers: { 'Authorization': `Bearer ${token}` },
        }),
        fetch(`${API_BASE}/api/license/usage`, {
          headers: { 'Authorization': `Bearer ${token}` },
        }),
      ]);

      const infoData = await infoRes.json();
      const usageData = await usageRes.json();

      if (infoData.code === 0) {
        setLicense({
          status: infoData.data.status,
          edition: infoData.data.edition,
          modules: infoData.data.modules || ['CORE'],
          limits: infoData.data.limits || { maxDevices: 10, maxUsers: 3 },
          usage: usageData.code === 0 ? {
            devices: usageData.data.devices?.used || 0,
            users: usageData.data.users?.used || 0,
          } : { devices: 0, users: 0 },
          expiresAt: infoData.data.expiresAt,
          customer: infoData.data.customer,
        });
      }
    } catch (err) {
      console.error('Failed to fetch license:', err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchLicense();
  }, [fetchLicense]);

  // 检查模块是否已授权
  const isModuleEnabled = useCallback((moduleCode) => {
    return license.modules.includes(moduleCode);
  }, [license.modules]);

  // 检查菜单项是否可见
  const isMenuVisible = useCallback((menuKey) => {
    // 核心模块始终可见
    if (MODULE_MENU_MAP.CORE.includes(menuKey)) {
      return true;
    }

    // 检查菜单对应的模块是否授权
    for (const [module, menuKeys] of Object.entries(MODULE_MENU_MAP)) {
      if (menuKeys.includes(menuKey)) {
        return isModuleEnabled(module);
      }
    }

    // 默认可见
    return true;
  }, [isModuleEnabled]);

  // 检查是否可以添加设备
  const canAddDevice = useCallback(() => {
    return license.usage.devices < license.limits.maxDevices;
  }, [license]);

  // 检查是否可以添加用户
  const canAddUser = useCallback(() => {
    return license.usage.users < license.limits.maxUsers;
  }, [license]);

  // License是否过期
  const isExpired = useCallback(() => {
    if (!license.expiresAt) return false;
    return new Date(license.expiresAt) < new Date();
  }, [license.expiresAt]);

  // 刷新License
  const refreshLicense = useCallback(() => {
    setLoading(true);
    fetchLicense();
  }, [fetchLicense]);

  return (
    <LicenseContext.Provider value={{
      license,
      loading,
      isModuleEnabled,
      isMenuVisible,
      canAddDevice,
      canAddUser,
      isExpired,
      refreshLicense,
    }}>
      {children}
    </LicenseContext.Provider>
  );
};

export const useLicense = () => {
  const context = useContext(LicenseContext);
  if (!context) {
    throw new Error('useLicense must be used within a LicenseProvider');
  }
  return context;
};

export default LicenseContext;
