# NetVis 数据采集器

Go 语言编写的轻量级网络设备数据采集器。

## 功能特性

- **设备探测**: Ping 探测设备在线状态和延迟
- **SNMP 采集**: 支持 SNMPv2c/v3 协议采集设备指标
- **并发采集**: 支持配置并发数，高效采集大规模设备
- **数据上报**: 批量上报采集数据到 NetVis API
- **心跳保活**: 定期发送心跳，保持采集器在线状态

## 项目结构

```
collector/
├── cmd/
│   └── main.go          # 主程序入口
├── internal/
│   ├── collector/
│   │   └── collector.go # 采集器核心
│   ├── config/
│   │   └── config.go    # 配置管理
│   └── reporter/
│       └── reporter.go  # 数据上报
├── pkg/
│   ├── snmp/           # SNMP工具
│   └── ping/           # Ping工具
├── config.yaml          # 配置文件
├── Dockerfile           # Docker构建
└── go.mod              # Go模块
```

## 快速开始

### 编译

```bash
cd collector
go build -o collector ./cmd/main.go
```

### 运行

```bash
./collector -config config.yaml
```

### Docker

```bash
docker build -t netvis-collector .
docker run -d --name collector \
  -v /path/to/config.yaml:/app/config.yaml \
  netvis-collector
```

## 配置说明

```yaml
api:
  endpoint: "http://api:3001/api" # API服务地址
  token: "your-api-token" # API认证Token
  timeout: 30s

collector:
  id: "collector-001" # 采集器ID
  name: "主机房采集器" # 采集器名称
  interval: 60s # 采集间隔
  concurrency: 10 # 并发数

snmp:
  community: "public" # SNMP团体名
  version: "2c" # SNMP版本
  timeout: 5s
  port: 161

ping:
  count: 3 # Ping次数
  timeout: 5s
```

## 采集指标

| 指标        | 说明                          |
| ----------- | ----------------------------- |
| status      | 设备在线状态 (online/offline) |
| latency     | 网络延迟 (ms)                 |
| packetLoss  | 丢包率 (%)                    |
| cpuUsage    | CPU 使用率 (%)                |
| memoryUsage | 内存使用率 (%)                |
| uptime      | 运行时间 (秒)                 |
| interfaces  | 接口流量统计                  |

## API 接口

采集器与 API 服务通信的接口：

- `POST /api/collector/register` - 注册采集器
- `POST /api/collector/heartbeat` - 心跳上报
- `POST /api/collector/metrics` - 指标数据上报
- `GET /api/collector/devices` - 获取设备列表
