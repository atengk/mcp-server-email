# ==============================================================================
# Multi-stage Dockerfile for mcp-server-email
# ==============================================================================

# Stage 1: Build
FROM node:22-alpine AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile || pnpm install

COPY tsconfig.json tsup.config.ts ./
COPY src/ ./src/

RUN pnpm build

# Stage 2: Runtime
FROM node:22-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --prod --frozen-lockfile || pnpm install --prod

COPY --from=builder /app/dist ./dist

# 默认切换非 root 用户
USER node

# SSE 模式端口暴露 (可选)
EXPOSE 3000

ENTRYPOINT ["node", "dist/index.js"]
