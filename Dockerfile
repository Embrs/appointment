# ===================================================================
# Stage 1: Builder
# ===================================================================
FROM node:24.11-alpine AS builder
WORKDIR /app

# 先複製 package & prisma schema 利於 layer cache
COPY package*.json ./
COPY prisma ./prisma

ENV NODE_OPTIONS="--max-old-space-size=8192"
RUN npm cache clean --force
RUN npm ci

# 生成 Prisma Client（需在 build 前；build 階段會 import @prisma/client）
RUN npx prisma generate

# 複製其餘原始碼並構建
COPY . .
RUN npm run build

# 驗證構建產物
RUN test -f .output/server/index.mjs

# ===================================================================
# Stage 2: Production Runner
# ===================================================================
FROM node:24.11-alpine AS runner
WORKDIR /app

# 複製 Nuxt 構建產物
COPY --from=builder /app/.output ./.output
COPY --from=builder /app/version.ts ./version.ts

# 複製 Prisma 啟動時需要的檔案（migrations 與 client）
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/package.json ./package.json

# 環境變數
ENV NODE_ENV=production
ENV NUXT_HOST=0.0.0.0
ENV NUXT_PORT=3000

EXPOSE 3000

# 啟動前先跑 prisma migrate deploy（冪等，只套未套用的 migrations）
# 失敗則容器啟動失敗，由 Railway 自動 rollback
CMD ["sh", "-c", "npx prisma migrate deploy && node ./.output/server/index.mjs"]
