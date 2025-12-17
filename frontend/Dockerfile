# 构建阶段
FROM oven/bun:1 AS builder
WORKDIR /app

# 复制依赖文件
COPY package.json bun.lockb* ./
RUN bun install --frozen-lockfile

# 复制源代码
COPY . .

# 构建
RUN bun run build

# 生产阶段
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
