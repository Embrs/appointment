# ===================================================================
# Stage 1: Builder
# ===================================================================
FROM node:24.11-alpine AS builder
WORKDIR /app

# 先複製 package & prisma schema 利於 layer cache
# scripts/ 必須在 npm ci 之前複製，因為 postinstall 會執行 scripts/copy-tinymce.mjs
COPY package*.json ./
COPY prisma ./prisma
COPY scripts ./scripts

ENV NODE_OPTIONS="--max-old-space-size=8192"
RUN npm cache clean --force
RUN npm ci

# postinstall 已執行 prisma generate；此處保留作為保險（冪等）
RUN npx prisma generate

# 複製其餘原始碼並構建
COPY . .
RUN npm run build

# 驗證構建產物
RUN test -f .output/server/index.mjs

# 精簡 node_modules，僅保留 production 依賴（prisma CLI 在 dependencies 中，會保留）
# 這樣 runner stage 可以一次複製整包，不會缺 transitive deps（如 effect）
RUN npm prune --omit=dev

# ===================================================================
# Stage 2: Production Runner
# ===================================================================
FROM node:24.11-alpine AS runner
WORKDIR /app

# 複製 Nuxt 構建產物
COPY --from=builder /app/.output ./.output
COPY --from=builder /app/version.ts ./version.ts

# 複製 Prisma migrations、package.json、與精簡後的 node_modules
# 整包複製確保 @prisma/config -> effect 等 transitive deps 都齊全
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules

# 環境變數
ENV NODE_ENV=production
ENV NUXT_HOST=0.0.0.0
ENV NUXT_PORT=3000

EXPOSE 3000

# 啟動前先跑 prisma migrate deploy（冪等，只套未套用的 migrations）
# 直接用 node 執行 prisma 入口，避開 node_modules/.bin 軟連結未複製的問題
# 失敗則容器啟動失敗，由 Railway 自動 rollback
CMD ["sh", "-c", "node ./node_modules/prisma/build/index.js migrate deploy && node ./.output/server/index.mjs"]
