# NetVis 3D

3D 网络拓扑可视化平台 - 基于 React + Three.js 的企业级网络监控解决方案。

## ✨ 功能特性

- **3D 拓扑视图** - 基于 `react-force-graph-3d` 的交互式 3D 网络拓扑
- **2D 拓扑视图** - 简洁的 2D 网络拓扑展示
- **设备管理** - 设备列表、搜索、筛选、定位功能
- **多主题支持** - 星空/网格/纯色/亮色四种背景主题
- **图标主题** - 拟真/经典/几何三种设备图标风格
- **数据接入就绪** - 支持 Mock 数据与真实 API 切换

## 🚀 快速开始

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build
```

## 📁 项目结构

```
src/
├── components/          # UI 组件
│   ├── DeviceList/      # 设备列表
│   ├── Layout/          # 主布局
│   ├── Settings/        # 系统设置
│   └── Topology/        # 拓扑视图 (2D/3D)
├── hooks/               # 自定义 Hooks
│   └── useDevices.js    # 设备数据 Hook
├── services/            # API 服务层
│   └── api.js           # 数据获取封装
├── styles/              # 样式主题
│   └── theme.js         # 主题配置
└── utils/               # 工具函数
    └── mockData.js      # Mock 数据
```

## ⚙️ 环境配置

复制 `.env.example` 为 `.env` 并修改配置：

```env
# API 地址
VITE_API_BASE_URL=http://localhost:8000/api

# Mock 模式开关 (true=使用模拟数据, false=使用真实API)
VITE_USE_MOCK_DATA=true
```

## 🔌 接入真实数据

1. 设置 `VITE_USE_MOCK_DATA=false`
2. 确保后端 API 返回格式与 `mockData.js` 一致
3. 必需接口：
   - `GET /api/devices` - 设备列表
   - `GET /api/topology` - 拓扑数据 (nodes + links)

## 🛠️ 技术栈

- **框架**: React 18 + Vite
- **3D 渲染**: Three.js + react-force-graph-3d
- **UI 组件**: Ant Design 5
- **状态管理**: React Hooks

## 📝 License

MIT
