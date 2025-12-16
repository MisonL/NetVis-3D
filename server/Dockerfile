# Build stage
FROM oven/bun:1 AS builder
WORKDIR /app
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun install --production

# Run stage
FROM oven/bun:1-slim AS runner
WORKDIR /app

# 安装 ping (iputils-ping) 供网络发现功能使用
RUN apt-get update && apt-get install -y iputils-ping && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
# 复制所有必要源码目录
COPY --from=builder /app/routes ./routes
COPY --from=builder /app/db ./db
COPY --from=builder /app/middleware ./middleware
COPY --from=builder /app/services ./services
COPY --from=builder /app/utils ./utils
COPY --from=builder /app/types ./types
# 入口文件
COPY --from=builder /app/index.ts ./index.ts
COPY --from=builder /app/tsconfig.json ./tsconfig.json

ENV NODE_ENV=production
EXPOSE 21301
CMD ["bun", "run", "index.ts"]
