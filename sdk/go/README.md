# NetVis Pro Go SDK

官方 Go SDK，用于与 NetVis Pro API 交互。

## 安装

```bash
go get github.com/MisonL/NetVis-3D/sdk/go
```

## 快速开始

```go
package main

import (
    "fmt"
    "log"

    netvis "github.com/MisonL/NetVis-3D/sdk/go"
)

func main() {
    // 创建客户端
    client := netvis.NewClient("http://localhost:21301")

    // 登录
    err := client.Login("admin", "admin123")
    if err != nil {
        log.Fatal(err)
    }

    // 获取设备列表
    devices, pagination, err := client.GetDevices(&netvis.DeviceQuery{
        Page:     1,
        PageSize: 20,
        Status:   "online",
    })
    if err != nil {
        log.Fatal(err)
    }

    fmt.Printf("共 %d 台设备\n", pagination.Total)
    for _, device := range devices {
        fmt.Printf("- %s (%s)\n", device.Name, device.Status)
    }
}
```

## API 文档

### 认证

```go
// 登录
err := client.Login("admin", "password")

// 获取当前用户
user, err := client.GetCurrentUser()
```

### 设备管理

```go
// 获取设备列表
devices, pagination, err := client.GetDevices(&netvis.DeviceQuery{
    Status: "online",
})

// 获取单个设备
device, err := client.GetDevice("device-uuid")

// 创建设备
device, err := client.CreateDevice(&netvis.CreateDeviceRequest{
    Name:      "Router-01",
    Type:      "router",
    IPAddress: "192.168.1.1",
})

// 更新设备
name := "New Name"
device, err := client.UpdateDevice("device-uuid", &netvis.UpdateDeviceRequest{
    Name: &name,
})

// 删除设备
err := client.DeleteDevice("device-uuid")
```

### 告警管理

```go
// 获取告警列表
alerts, pagination, err := client.GetAlerts(&netvis.AlertQuery{
    Severity: "critical",
    Status:   "pending",
})

// 确认告警
err := client.AcknowledgeAlert("alert-uuid")

// 解决告警
err := client.ResolveAlert("alert-uuid")
```

### 配置管理

```go
// 获取配置备份
backups, err := client.GetConfigBackups("device-uuid")

// 配置对比
diff, err := client.CompareConfigs("backup-uuid-1", "backup-uuid-2")
```

### 指标数据

```go
// 获取设备指标
metrics, err := client.GetDeviceMetrics("device-uuid", "24h")
```

## License

MIT
