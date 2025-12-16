import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// 模块与菜单的映射关系
const MODULE_MENU_MAP = {
  CORE: ['0', '1', '4', '2', '3', '7', '13', '37'], // 仪表盘、拓扑、设备、设置、数据分析、通知中心、知识库
  ASSET: ['2', '23', '38', '49', '52'], // 设备管理、设备分组、资产盘点、CMDB、IP地址管理
  ALERT: ['6', '17', '61', '50', '39'], // 告警中心、告警规则、告警渠道、故障管理、值班管理
  REPORT: ['12', '30', '31', '43', '48', '27', '57'], // 报表中心、流量分析、性能基线、性能监控、容量规划、API统计、日志分析
  AUDIT: ['9', '33', '47'], // 审计日志、合规审计、变更管理
  CONFIG: ['11', '19', '20', '18', '56', '24', '54'], // 配置管理、采集器、SNMP模板、定时任务、设备模板、通知模板、固件升级
  API: ['10', '67'], // 开放API、API限流
  SSH: ['29'], // SSH管理
  HA: ['21', '64'], // 备份恢复、缓存管理
  MOBILE: [], // 移动端（暂无）
  SYSTEM: ['5', '8', '14', '22', '41', '42'], // 用户管理、License、系统监控、系统日志、系统配置、安全中心
  TOOLS: ['58', '65', '44', '34', '68', '16', '25', '26', '28'], // 网络工具、诊断、质量、脚本编排、工作流、发现、健康评分、拓扑连接、维护
  ADVANCED: ['32', '35', '40', '45', '46', '51', '53', '55', '59', '60', '62', '63', '66'], // 企微、导出、仪表盘配置、标签、批量、SLA、端口、链路、事件、数据中心、拓扑导出、租户、访问控制
  BIGSCREEN: ['15', '36'], // 监控大屏、大屏配置
};

const LicenseContext = createContext(null);

export const LicenseProvider = ({ children }) => {
  const { token } = useAuth();
  const [license, setLicense] = useState({
    status: 'loading',
    edition: 'development',
    modules: ['CORE', 'ASSET', 'ALERT', 'SSH', 'CONFIG', 'REPORT', 'AUDIT', 'HA', 'MOBILE', 'API', 'SYSTEM', 'TOOLS', 'ADVANCED', 'BIGSCREEN'],
    limits: { maxDevices: 1000, maxUsers: 100 },
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

// eslint-disable-next-line react-refresh/only-export-components
export const useLicense = () => {
  const context = useContext(LicenseContext);
  if (!context) {
    throw new Error('useLicense must be used within a LicenseProvider');
  }
  return context;
};

export default LicenseContext;
