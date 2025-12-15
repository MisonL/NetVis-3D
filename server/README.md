# NetVis Pro 后端服务

## 技术栈

- **运行时**: Bun
- **框架**: Hono
- **ORM**: Drizzle
- **数据库**: PostgreSQL

## 开发

```bash
# 安装依赖
bun install

# 启动开发服务器
bun run dev

# 运行测试
bun test

# 生成数据库迁移
bun run db:generate

# 执行数据库迁移
bun run db:migrate
```

## API 端点

### 认证

- `POST /api/auth/login` - 登录
- `POST /api/auth/register` - 注册
- `GET /api/auth/me` - 获取当前用户
- `POST /api/auth/logout` - 登出
- `PUT /api/auth/password` - 修改密码

### 用户管理

- `GET /api/users` - 用户列表（管理员）
- `GET /api/users/:id` - 用户详情
- `POST /api/users` - 创建用户（管理员）
- `PUT /api/users/:id` - 更新用户
- `DELETE /api/users/:id` - 删除用户（管理员）

### 设备管理

- `GET /api/devices` - 设备列表
- `GET /api/devices/:id` - 设备详情
- `POST /api/devices` - 创建设备
- `PUT /api/devices/:id` - 更新设备
- `DELETE /api/devices/:id` - 删除设备
- `DELETE /api/devices/batch` - 批量删除

### 健康检查

- `GET /api/health` - 服务健康状态
- `GET /api/health/db` - 数据库连接状态
- `GET /api/metrics` - Prometheus 指标

## 环境变量

```bash
DATABASE_URL=postgres://netvis:netvis123@localhost:5432/netvis
JWT_SECRET=your-secret-key
PORT=21301
```
