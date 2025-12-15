/**
 * NetVis Pro TypeScript SDK
 * 
 * 网络设备拓扑可视化管理平台 API 客户端
 * 
 * @version 1.0.0
 * @license MIT
 */

// ============================================
// Types
// ============================================

export interface NetVisConfig {
  baseUrl: string;
  token?: string;
  timeout?: number;
}

export interface ApiResponse<T = unknown> {
  code: number;
  message?: string;
  data: T;
}

export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
}

export interface PaginatedResponse<T> {
  list: T[];
  pagination: Pagination;
}

// User Types
export interface User {
  id: string;
  username: string;
  email: string;
  displayName?: string;
  role: 'admin' | 'user' | 'viewer';
  isActive: boolean;
  lastLoginAt?: string;
  createdAt: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: User;
}

// Device Types
export interface Device {
  id: string;
  name: string;
  type: 'router' | 'switch' | 'firewall' | 'server';
  vendor?: string;
  model?: string;
  ipAddress?: string;
  macAddress?: string;
  location?: string;
  status: 'online' | 'offline' | 'warning' | 'error';
  lastSeen?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDeviceRequest {
  name: string;
  type: Device['type'];
  vendor?: string;
  model?: string;
  ipAddress?: string;
  location?: string;
}

export interface UpdateDeviceRequest {
  name?: string;
  vendor?: string;
  model?: string;
  ipAddress?: string;
  location?: string;
}

export interface DeviceQuery {
  page?: number;
  pageSize?: number;
  status?: Device['status'];
  type?: Device['type'];
  search?: string;
}

// Alert Types
export interface Alert {
  id: string;
  deviceId?: string;
  ruleId?: string;
  severity: 'info' | 'warning' | 'critical';
  status: 'pending' | 'acknowledged' | 'resolved';
  message: string;
  details?: string;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  resolvedBy?: string;
  resolvedAt?: string;
  createdAt: string;
}

export interface AlertQuery {
  page?: number;
  pageSize?: number;
  severity?: Alert['severity'];
  status?: Alert['status'];
  deviceId?: string;
}

// Config Types
export interface ConfigBackup {
  id: string;
  deviceId: string;
  deviceName?: string;
  type: 'running' | 'startup' | 'full';
  version: string;
  size: number;
  hash: string;
  description?: string;
  createdBy?: string;
  createdAt: string;
}

export interface CreateBackupRequest {
  deviceId: string;
  type?: ConfigBackup['type'];
  description?: string;
}

export interface ConfigDiff {
  added: string[];
  removed: string[];
  modified: string[];
  unchanged: number;
  backup1: { id: string; version: string };
  backup2: { id: string; version: string };
}

// Metrics Types
export interface DeviceMetrics {
  deviceId: string;
  cpuUsage?: number;
  memoryUsage?: number;
  uptime?: number;
  latency?: number;
  packetLoss?: number;
  timestamp: string;
}

// ============================================
// SDK Client
// ============================================

export class NetVisClient {
  private baseUrl: string;
  private token: string | null = null;
  private timeout: number;

  constructor(config: NetVisConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.token = config.token || null;
    this.timeout = config.timeout || 30000;
  }

  /**
   * 设置认证 Token
   */
  setToken(token: string): void {
    this.token = token;
  }

  /**
   * 发起 HTTP 请求
   */
  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      const data = await response.json();
      return data as ApiResponse<T>;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // ============================================
  // Auth API
  // ============================================

  /**
   * 用户登录
   */
  async login(request: LoginRequest): Promise<ApiResponse<LoginResponse>> {
    const response = await this.request<LoginResponse>('POST', '/api/auth/login', request);
    if (response.code === 0 && response.data.token) {
      this.token = response.data.token;
    }
    return response;
  }

  /**
   * 获取当前用户信息
   */
  async getCurrentUser(): Promise<ApiResponse<User>> {
    return this.request<User>('GET', '/api/auth/me');
  }

  /**
   * 退出登录
   */
  async logout(): Promise<ApiResponse<void>> {
    const response = await this.request<void>('POST', '/api/auth/logout');
    this.token = null;
    return response;
  }

  // ============================================
  // Devices API
  // ============================================

  /**
   * 获取设备列表
   */
  async getDevices(query?: DeviceQuery): Promise<ApiResponse<PaginatedResponse<Device>>> {
    const params = new URLSearchParams();
    if (query?.page) params.set('page', String(query.page));
    if (query?.pageSize) params.set('pageSize', String(query.pageSize));
    if (query?.status) params.set('status', query.status);
    if (query?.type) params.set('type', query.type);
    if (query?.search) params.set('search', query.search);
    
    const queryString = params.toString();
    return this.request<PaginatedResponse<Device>>('GET', `/api/devices${queryString ? '?' + queryString : ''}`);
  }

  /**
   * 获取单个设备
   */
  async getDevice(id: string): Promise<ApiResponse<Device>> {
    return this.request<Device>('GET', `/api/devices/${id}`);
  }

  /**
   * 创建设备
   */
  async createDevice(request: CreateDeviceRequest): Promise<ApiResponse<Device>> {
    return this.request<Device>('POST', '/api/devices', request);
  }

  /**
   * 更新设备
   */
  async updateDevice(id: string, request: UpdateDeviceRequest): Promise<ApiResponse<Device>> {
    return this.request<Device>('PUT', `/api/devices/${id}`, request);
  }

  /**
   * 删除设备
   */
  async deleteDevice(id: string): Promise<ApiResponse<void>> {
    return this.request<void>('DELETE', `/api/devices/${id}`);
  }

  // ============================================
  // Alerts API
  // ============================================

  /**
   * 获取告警列表
   */
  async getAlerts(query?: AlertQuery): Promise<ApiResponse<PaginatedResponse<Alert>>> {
    const params = new URLSearchParams();
    if (query?.page) params.set('page', String(query.page));
    if (query?.pageSize) params.set('pageSize', String(query.pageSize));
    if (query?.severity) params.set('severity', query.severity);
    if (query?.status) params.set('status', query.status);
    if (query?.deviceId) params.set('deviceId', query.deviceId);
    
    const queryString = params.toString();
    return this.request<PaginatedResponse<Alert>>('GET', `/api/alerts${queryString ? '?' + queryString : ''}`);
  }

  /**
   * 确认告警
   */
  async acknowledgeAlert(id: string): Promise<ApiResponse<void>> {
    return this.request<void>('POST', `/api/alerts/${id}/acknowledge`);
  }

  /**
   * 解决告警
   */
  async resolveAlert(id: string): Promise<ApiResponse<void>> {
    return this.request<void>('POST', `/api/alerts/${id}/resolve`);
  }

  // ============================================
  // Config API
  // ============================================

  /**
   * 获取配置备份列表
   */
  async getConfigBackups(deviceId?: string): Promise<ApiResponse<PaginatedResponse<ConfigBackup>>> {
    const params = deviceId ? `?deviceId=${deviceId}` : '';
    return this.request<PaginatedResponse<ConfigBackup>>('GET', `/api/config/backups${params}`);
  }

  /**
   * 创建配置备份
   */
  async createConfigBackup(request: CreateBackupRequest): Promise<ApiResponse<ConfigBackup>> {
    return this.request<ConfigBackup>('POST', '/api/config/backups', request);
  }

  /**
   * 配置对比
   */
  async compareConfigs(backupId1: string, backupId2: string): Promise<ApiResponse<ConfigDiff>> {
    return this.request<ConfigDiff>('POST', '/api/config/compare', { backupId1, backupId2 });
  }

  // ============================================
  // Metrics API
  // ============================================

  /**
   * 获取设备指标
   */
  async getDeviceMetrics(deviceId: string, range?: string): Promise<ApiResponse<DeviceMetrics[]>> {
    const params = range ? `?range=${range}` : '';
    return this.request<DeviceMetrics[]>('GET', `/api/metrics/${deviceId}${params}`);
  }
}

// ============================================
// Factory Function
// ============================================

/**
 * 创建 NetVis API 客户端
 */
export function createClient(config: NetVisConfig): NetVisClient {
  return new NetVisClient(config);
}

export default NetVisClient;
