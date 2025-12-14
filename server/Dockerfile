FROM oven/bun:1 AS base
WORKDIR /app

# 安装依赖
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

# 复制源代码
COPY . .

# 暴露端口
EXPOSE 3001

# 启动命令
CMD ["bun", "run", "start"]
