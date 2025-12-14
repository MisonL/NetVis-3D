/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// 用户信息类型
const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('netvis_token'));
  const [loading, setLoading] = useState(true);

  // 初始化时检查token有效性
  useEffect(() => {
    const checkAuth = async () => {
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(`${API_BASE}/api/auth/me`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (res.ok) {
          const data = await res.json();
          if (data.code === 0) {
            setUser(data.data);
          } else {
            // Token无效，清除
            localStorage.removeItem('netvis_token');
            setToken(null);
          }
        } else {
          localStorage.removeItem('netvis_token');
          setToken(null);
        }
      } catch (error) {
        console.error('Auth check failed:', error);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [token]);

  // 登录
  const login = useCallback(async (username, password) => {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password }),
    });

    const data = await res.json();

    if (data.code === 0) {
      localStorage.setItem('netvis_token', data.data.token);
      setToken(data.data.token);
      setUser(data.data.user);
      return { success: true };
    } else {
      return { success: false, message: data.message };
    }
  }, []);

  // 登出
  const logout = useCallback(async () => {
    if (token) {
      try {
        await fetch(`${API_BASE}/api/auth/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
      } catch (error) {
        console.error('Logout error:', error);
      }
    }

    localStorage.removeItem('netvis_token');
    setToken(null);
    setUser(null);
  }, [token]);

  // 注册
  const register = useCallback(async (userData) => {
    const res = await fetch(`${API_BASE}/api/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(userData),
    });

    const data = await res.json();

    if (data.code === 0) {
      return { success: true, data: data.data };
    } else {
      return { success: false, message: data.message };
    }
  }, []);

  // 修改密码
  const changePassword = useCallback(async (oldPassword, newPassword) => {
    const res = await fetch(`${API_BASE}/api/auth/password`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ oldPassword, newPassword }),
    });

    const data = await res.json();

    if (data.code === 0) {
      return { success: true };
    } else {
      return { success: false, message: data.message };
    }
  }, [token]);

  // 检查权限
  const hasPermission = useCallback((requiredRole) => {
    if (!user) return false;
    
    const roleHierarchy = {
      'admin': 3,
      'user': 2,
      'viewer': 1,
    };

    const userLevel = roleHierarchy[user.role] || 0;
    const requiredLevel = roleHierarchy[requiredRole] || 0;

    return userLevel >= requiredLevel;
  }, [user]);

  const value = {
    user,
    token,
    loading,
    isAuthenticated: !!user,
    login,
    logout,
    register,
    changePassword,
    hasPermission,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
