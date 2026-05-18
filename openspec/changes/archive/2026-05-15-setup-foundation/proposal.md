## Why

本專案要在 Nuxt 4 樣板上打造「多商家預約平台 SaaS」，涉及三角色（平台管理員、商家、顧客）、四種預約模式（TIME_SLOT / TIME_CAPACITY / RESOURCE / QUEUE）、Railway PostgreSQL + Cloudflare R2、繁中/英/日三語。樣板目前完全沒有資料庫、ORM、業務 API、認證 middleware 與後端工具。需先打底，**後續 7 個 change 全部依賴此 change**。

## What Changes

- **資料層**：安裝 Prisma + PostgreSQL，建立完整 17 個 model（AdminUser、Merchant、MerchantUser、Service、Resource、ServiceResource、ScheduleRule、ScheduleOverride、MerchantHoliday、QueueWindow、QueueTicket、QueueCounter、Appointment、AppointmentArchive、RateLimitBucket、JobLock、CustomerOtp）並執行 `prisma migrate dev --name init`
- **後端工具**：新增 `server/utils/` 五個檔案
  - `response.ts`：三語錯誤工具（`successResponse / badRequestError / notFoundError / forbiddenError / unauthorizedError / conflictError / serverError`）、`sanitizeNulls`
  - `prisma.ts`：PrismaClient singleton
  - `auth.ts`：JWT 簽發/解析、`getAuth / requireMerchant / requireAdmin`
  - `r2.ts`：`uploadToR2` 上傳輔助
  - `rate-limit.ts`：基於 `RateLimitBucket` 表的速率限制
- **權限基礎**：擴充 `app/stores/3.store-self.ts` 加 `selfType / merchantId / role / HasRule()`；補 `app/protocol/fetch-api/methods.ts` 401 自動跳轉登入頁
- **Middleware**：新增具名 `app/middleware/admin.ts`、`merchant.ts`；**刪除**空白 `demo.global.ts`
- **Layouts 骨架**：填充 `default.vue`（簡潔）、`front-desk.vue`（顧客面 header）、`back-desk.vue`（後台 nav）三個 layout
- **環境變數**：補 `.env.dev`：`DATABASE_URL`、`JWT_SECRET`、`R2_ENDPOINT`、`R2_ACCESS_KEY`、`R2_SECRET_KEY`、`R2_BUCKET`、`R2_PUBLIC_BASE`、`CRON_SECRET`
- **依賴**：新增 `prisma`、`@prisma/client`、`zod`、`jsonwebtoken`、`bcrypt`、`@aws-sdk/client-s3` 與對應 `@types`

## Capabilities

### New Capabilities

- `data-model`：完整資料模型（17 個 Prisma model），包含 merchant、user、service、resource、schedule、appointment、queue、archive、infra 表
- `server-foundation`：後端共用工具集（統一響應、Prisma singleton、JWT 認證、R2 上傳、rate limit）
- `client-auth`：前端認證基礎（StoreSelf 多角色身分、`HasRule()` 權限檢查、401 自動跳轉、具名 middleware）
- `app-layouts`：三套 layout 骨架（default 簡潔、front-desk 顧客面、back-desk 後台）

### Modified Capabilities

（無 — 樣板原本不存在任何 spec 等級行為）

## Impact

- **新增檔案**：`prisma/schema.prisma`、`server/utils/{response,prisma,auth,r2,rate-limit}.ts`、`app/middleware/{admin,merchant}.ts`、`.env.dev`、`prisma/migrations/*`
- **修改檔案**：`app/stores/3.store-self.ts`、`app/protocol/fetch-api/methods.ts`、`app/layouts/{default,front-desk,back-desk}.vue`、`package.json`、`types/nuxt.d.ts`（補環境變數型別）
- **刪除檔案**：`app/middleware/demo.global.ts`
- **依賴增量**：`prisma`、`@prisma/client`、`zod`、`jsonwebtoken`、`bcrypt`、`@aws-sdk/client-s3` + 對應 types
- **外部依賴**：需要可連線的 PostgreSQL（Railway 或本機 Docker），R2 設定可暫用 placeholder
- **下游依賴**：後續所有 changes（auth-and-onboarding、platform-admin-console、merchant-config、availability-engine、customer-booking-flow、queue-tickets、finalize-i18n-ads-cron-deploy）皆依賴此 change 產出的 schema、工具、middleware、layouts
