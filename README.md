<div align="center">
  <h1>🌐 NetVis Pro (Sci-Fi Edition)</h1>
  <p>
    <strong>基于 React + Three.js 的好莱坞级网络拓扑可视化平台</strong>
  </p>
  <p>
    <a href="https://vitejs.dev/" target="_blank">
      <img src="https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white" alt="Vite" />
    </a>
    <a href="https://react.dev/" target="_blank">
      <img src="https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React" />
    </a>
    <a href="https://ant.design/" target="_blank">
      <img src="https://img.shields.io/badge/Ant_Design-0170FE?style=for-the-badge&logo=ant-design&logoColor=white" alt="Ant Design" />
    </a>
    <a href="https://threejs.org/" target="_blank">
      <img src="https://img.shields.io/badge/Three.js-000000?style=for-the-badge&logo=three.js&logoColor=white" alt="Three.js" />
    </a>
  </p>
</div>

---

## ✨ 核心特性 (Features) (Phase 3 Updated)

<table align="center">
  <tr>
    <td align="center" width="25%">
      <h3>🌍 3D 沉浸视图</h3>
      <p>基于力导向图的交互式 3D 拓扑，支持自由缩放、旋转与平移，提供身临其境的监控体验。</p>
    </td>
    <td align="center" width="25%">
      <h3>📊 实时仪表盘</h3>
      <p>全新的系统级 Dashboard，实时监控总流量、在线率与告警状态，配合呼吸灯光效。</p>
    </td>
    <td align="center" width="25%">
      <h3>💎 玻璃拟态设计</h3>
      <p>全站采用 Deep Blue Glassmorphism 风格，配合半透明磨砂与霓虹点缀，极具科技感。</p>
    </td>
    <td align="center" width="25%">
      <h3>🤖 智能模拟</h3>
      <p>内置 SimulationService，提供逼真的随机流量波动与设备状态变更模拟。</p>
    </td>
  </tr>
</table>

## 📸 功能概览

- **视图系统**：
  - **仪表盘 (Dashboard)**：核心指标一目了然
  - **3D 拓扑**：空间化展示网络层级 (Cloud -> Core -> Aggregation -> Access)
  - **2D 拓扑**：扁平化视图，与 3D 共享实时状态，**✨ 新增完整控制面板**
  - **设备资产**：实时资产清单，支持快速定位
- **高级交互**：
  - **辉光特效 (Bloom)**：可配置的高性能后处理光效，**🌈 支持亮度调节**
  - **自动漫游**：平滑的摄像机自动旋转
  - **快速定位**：搜索设备后通过摄像机平滑飞行至目标
- **主题系统**：
  - **背景**：🌌 星空 | 🕸️ 暗色网格 | ☀️ 亮色网格 | ⬛ 纯色（支持自定义）
  - **图标**：💠 拟真 | 🆔 经典（重制 SVG） | 🧊 几何

## 服务端口说明

- **Web 前端 (Prod)**: 21800
- **Web 前端 (Dev)**: 3000
- **后端 API**: 21301
- **Collector Metrics**: 21900
- **PostgreSQL**: 5432
- **Redis**: 6379

## 🚀 快速开始 (Quick Start)

### 🐳 极速部署 (Docker Compose) - 推荐

一切已为您准备就绪。只需一条命令，即可启动整个监控平台。

**⚠️ 首次启动前必读：** 请复制环境变量配置文件并修改默认密码！

```bash
cp .env.example .env
# 编辑 .env 文件，修改默认的数据库和 Redis 密码
vim .env
```

```bash
# 启动所有服务 (Frontend, API, Collector, DB, Cache)
docker-compose up -d

# 查看服务状态
docker-compose ps
```

访问地址：

- **Web 控制台**: http://localhost:21800
- **API 文档**: http://localhost:21301/api/docs

### 🔧 高可用部署 (Production HA)

生产环境推荐使用高可用配置：

```bash
# 使用高可用配置启动
# 确保已配置 .env 文件
docker-compose -f docker-compose.ha.yml up -d

# 执行TimescaleDB迁移
./scripts/migrate-timescaledb.sh

# 检查集群健康状态
./scripts/health-check-ha.sh
```

详细配置请参考 [高可用架构设计](./docs/高可用架构设计.md)

---

## 📦 SDK 支持

提供官方 SDK 用于 API 集成：

| 语言          | 路径              | 文档                                 |
| ------------- | ----------------- | ------------------------------------ |
| TypeScript/JS | `sdk/typescript/` | [README](./sdk/typescript/README.md) |
| Go            | `sdk/go/`         | [README](./sdk/go/README.md)         |

**快速使用示例 (TypeScript):**

```typescript
import { createClient } from "@netvis/sdk";

const client = createClient({ baseUrl: "http://localhost:21301" });
await client.login({ username: "admin", password: "xxx" });
const devices = await client.getDevices();
```

---

### 🛠️ 手动开发模式 (Local Development)

如果您想参与代码开发：

**1. 启动基础设施**

```bash
docker-compose up -d postgres redis
```

**2. 启动后端 (Server)**

```bash
cd server
bun install
bun run dev
# API 将运行在 http://localhost:21301
```

**3. 启动前端 (Frontend)**

```bash
cd frontend
npm install
npm run dev
# 前端将运行在 http://localhost:3000
```

**4. 启动采集器 (Collector)**

```bash
cd collector
go run cmd/main.go
```

## 📁 项目架构 (Architecture)

```
frontend/src/
├── 🧩 components/
│   ├── Alerts/          # 告警中心 + 告警规则管理
│   ├── Analytics/       # 数据分析仪表盘
│   ├── Audit/           # 审计日志
│   ├── Collector/       # 采集器管理 [NEW]
│   ├── Config/          # 配置管理
│   ├── Dashboard/       # 系统概览仪表盘
│   ├── DeviceList/      # 设备资产管理 + 详情页
│   ├── Discovery/       # 网络发现 [NEW]
│   ├── Layout/          # 玻璃拟态主框架
│   ├── License/         # License授权管理
│   ├── Monitor/         # 监控大屏
│   ├── Notification/    # 通知中心
│   ├── OpenApi/         # 开放API管理
│   ├── Report/          # 报表中心
│   ├── Schedule/        # 定时任务管理 [NEW]
│   ├── Settings/        # 全局偏好设置
│   ├── Snmp/            # SNMP模板管理 [NEW]
│   ├── System/          # 系统监控
│   ├── Topology/        # 核心拓扑引擎 (2D/3D)
│   └── UserManagement/  # 用户管理
├── ⚛️ context/           # 全局状态
├── 📡 services/          # 数据模拟与API层
└── 🧪 tests/             # 自动化测试

server/routes/
├── alerts.ts            # 告警 + 告警规则
├── backup.ts            # 系统备份恢复 [NEW]
├── collector.ts         # 采集器API [NEW]
├── config.ts            # 配置管理
├── devices.ts           # 设备CRUD + 批量操作
├── discovery.ts         # 网络发现 [NEW]
├── groups.ts            # 设备分组管理 [NEW]
├── logs.ts              # 系统日志查看器 [NEW]
├── metrics.ts           # 时序指标 [NEW]
├── notification.ts      # 通知管理
├── report.ts            # 报表 + Excel导出
├── schedule.ts          # 定时任务 [NEW]
├── snmp.ts              # SNMP模板 [NEW]
├── templates.ts         # 通知模板管理 [NEW]
├── device-health.ts     # 设备健康评分 [NEW]
├── topology-manage.ts   # 拓扑连接管理 [NEW]
├── api-stats.ts         # API使用统计 [NEW]
├── maintenance.ts       # 维护计划管理 [NEW]
└── ...

collector/               # Go数据采集器 [NEW]
├── cmd/main.go
├── internal/
│   ├── collector/       # 采集核心
│   ├── config/          # 配置管理
│   └── reporter/        # 数据上报
├── Dockerfile
└── README.md
```

## 🔌 数据接入指南

本项目内置了强大的 **模拟器 (SimulationService)**，默认开启。如需接入真实后端：

1. 修改 `.env` 从 `VITE_USE_MOCK_DATA=true` 改为 `false`
2. 参考 `src/services/api.js` 实现对应的后端接口：
   - `/api/devices`: 返回设备列表
   - `/api/topology`: 返回节点与连线关系

## 🛠️ 技术栈清单

- **核心框架**: React 18 + Vite 5
- **UI 组件库**: Ant Design 5 (Glassmorphism Customized)
- **后端框架**: Bun + Hono + Drizzle ORM
- **数据采集**: Go 1.21+ (Native Snmp/ICMP)
- **3D 引擎**: Three.js + React Force Graph 3D
- **流程图**: React Flow (2D View)
- **测试框架**: Vitest + React Testing Library (Frontend) / Bun Test (Backend)

## 📝 开源协议

MIT License &copy; 2024 NetVis Pro Team
