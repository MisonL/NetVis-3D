# NetVis Pro TypeScript SDK

官方 TypeScript/JavaScript SDK，用于与 NetVis Pro API 交互。

## 安装

```bash
npm install @netvis/sdk
# 或
pnpm add @netvis/sdk
# 或
bun add @netvis/sdk
```

## 快速开始

```typescript
import { createClient } from "@netvis/sdk";

// 创建客户端
const client = createClient({
  baseUrl: "http://localhost:21301",
});

// 登录
const loginResponse = await client.login({
  username: "admin",
  password: "admin123",
});

if (loginResponse.code === 0) {
  console.log("登录成功:", loginResponse.data.user.username);
}

// 获取设备列表
const devices = await client.getDevices({
  page: 1,
  pageSize: 20,
  status: "online",
});

console.log("设备列表:", devices.data.list);
```

## API 文档

### 认证

```typescript
// 登录
await client.login({ username: "admin", password: "xxx" });

// 获取当前用户
await client.getCurrentUser();

// 退出
await client.logout();
```

### 设备管理

```typescript
// 获取设备列表
await client.getDevices({ page: 1, pageSize: 20 });

// 获取单个设备
await client.getDevice("device-uuid");

// 创建设备
await client.createDevice({
  name: "Router-01",
  type: "router",
  ipAddress: "192.168.1.1",
});

// 更新设备
await client.updateDevice("device-uuid", { name: "New Name" });

// 删除设备
await client.deleteDevice("device-uuid");
```

### 告警管理

```typescript
// 获取告警列表
await client.getAlerts({ severity: "critical", status: "pending" });

// 确认告警
await client.acknowledgeAlert("alert-uuid");

// 解决告警
await client.resolveAlert("alert-uuid");
```

### 配置管理

```typescript
// 获取配置备份
await client.getConfigBackups("device-uuid");

// 创建配置备份
await client.createConfigBackup({ deviceId: "device-uuid" });

// 配置对比
await client.compareConfigs("backup-uuid-1", "backup-uuid-2");
```

### 指标数据

```typescript
// 获取设备指标
await client.getDeviceMetrics("device-uuid", "24h");
```

## License

MIT
