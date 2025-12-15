# Build stage
FROM oven/bun:1 AS builder
WORKDIR /app
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile
COPY . .
# 假如有构建步骤（如 bun build），在这里执行。目前Server直接运行ts，但我们可以只复制必要文件。
# 或者，我们可以使用bun build --compile（如果需要二进制），或者保持源码运行但移除devDeps。
# 这里采用标准的 "prune dev dependencies" 策略。
RUN bun install --production

# Run stage
FROM oven/bun:1-slim AS runner
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/src ./src
COPY --from=builder /app/routes ./routes
COPY --from=builder /app/db ./db
COPY --from=builder /app/middleware ./middleware
# 如果有其他源码目录，也需要复制
COPY --from=builder /app/index.ts ./index.ts
COPY --from=builder /app/tsconfig.json ./tsconfig.json

ENV NODE_ENV=production
EXPOSE 21301
CMD ["bun", "run", "index.ts"]
