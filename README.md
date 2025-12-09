<div align="center">
  <h1>🌐 NetVis 3D</h1>
  <p>
    <strong>基于 React + Three.js 的企业级网络拓扑可视化平台</strong>
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

## ✨ 核心特性 (Features)

<table align="center">
  <tr>
    <td align="center" width="33%">
      <h3>🌍 3D 沉浸视图</h3>
      <p>基于力导向图的交互式 3D 拓扑，支持自由缩放、旋转与平移，提供身临其境的监控体验。</p>
    </td>
    <td align="center" width="33%">
      <h3>📊 实时数据监控</h3>
      <p>集成设备状态、流量指标与告警信息，直观展示网络健康状况与故障节点。</p>
    </td>
    <td align="center" width="33%">
      <h3>🎨 多维可视化</h3>
      <p>支持 2D/3D 视图一键切换，内置星空、网格等多种主题与图标风格，满足不同场景需求。</p>
    </td>
  </tr>
</table>

## 📸 功能概览

- **双视图支持**：无缝切换 3D 空间视图与 2D 平面视图
- **高级搜索**：支持按 IP、设备名称模糊搜索并自动定位
- **主题系统**：
  - **背景**：🌌 星空 | 🕸️ 网格 | ⬛ 纯色 | ☀️ 亮色
  - **图标**：💠 拟真 | 🆔 经典 | 🧊 几何
- **交互控制**：支持鼠标左键平移/右键旋转，滚轮缩放

## 🚀 快速开始 (Quick Start)

```bash
# 1. 克隆项目
git clone https://github.com/MisonL/NetVis-3D.git

# 2. 安装依赖
npm install

# 3. 启动开发服务器
npm run dev

# 4. 构建生产版本
npm run build
```

## 📁 项目架构 (Architecture)

```
src/
├── 🧩 components/      # UI 组件库
│   ├── DeviceList/     # 设备清单与检索
│   ├── Layout/         # 应用主框架
│   ├── Settings/       # 全局配置面板
│   └── Topology/       # 核心拓扑画布 (2D/3DCanvas)
├── 🎣 hooks/           # 自定义 Hooks (useDevices, etc.)
├── 📡 services/        # API 数据服务层
├── 🎨 styles/          # 主题 Token 与全局样式
└── 🛠️ utils/           # 工具函数与 Mock 数据
```

## 🔌 数据接入指南

本项目支持 **Mock 模式** 与 **真实 API 模式** 无缝切换。

### 1. 环境变量配置

复制 `.env.example` 为 `.env`：

```properties
# 后端接口地址
VITE_API_BASE_URL=http://api.your-domain.com/v1

# 数据源开关 (false 为接入真实数据)
VITE_USE_MOCK_DATA=false
```

### 2. 接口规范

需实现以下 RESTful 接口（参考 `src/utils/mockData.js`）：

| 方法 | 路径            | 描述                             |
| ---- | --------------- | -------------------------------- |
| GET  | `/api/devices`  | 获取设备列表数据                 |
| GET  | `/api/topology` | 获取拓扑节点(nodes)与链路(links) |

## 🛠️ 技术栈清单

- **核心框架**: [React 18](https://react.dev/) + [Vite](https://vitejs.dev/)
- **UI 组件库**: [Ant Design 5](https://ant.design/)
- **可视化引擎**: [Three.js](https://threejs.org/) + [react-force-graph](https://github.com/vasturiano/react-force-graph)
- **状态管理**: React Hooks + Context

## 📝 开源协议

MIT License &copy; 2024 NetVis 3D Team
