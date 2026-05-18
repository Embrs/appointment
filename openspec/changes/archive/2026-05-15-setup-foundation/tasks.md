## 1. 依賴安裝與 Prisma 初始化

- [x] 1.1 `npm i prisma @prisma/client zod jsonwebtoken bcrypt @aws-sdk/client-s3`
- [x] 1.2 `npm i -D @types/jsonwebtoken @types/bcrypt`
- [x] 1.3 `npx prisma init`（產出 `prisma/schema.prisma` 骨架）
- [x] 1.4 將 `prisma generate` 加入 `package.json` postinstall（與既有 `nuxt prepare && node scripts/copy-tinymce.mjs` 串接）

## 2. Prisma Schema（17 個 model）

- [x] 2.1 設定 datasource (PostgreSQL) 與 generator (prisma-client-js)
- [x] 2.2 定義 enum：`MerchantStatus`、`MerchantUserRole`、`BookingMode`、`ScheduleScope`、`AppointmentMode`、`AppointmentStatus`、`CanceledBy`、`QueueTicketStatus`、`CustomerTitle`
- [x] 2.3 model `AdminUser`
- [x] 2.4 model `Merchant`（含 cancelPolicy Json、status enum、timezone default 'Asia/Taipei'）
- [x] 2.5 model `MerchantUser`（OWNER/STAFF + `@@unique([merchantId, email])` + cascade）
- [x] 2.6 model `Service`（bookingMode enum + slotInterval + capacity）
- [x] 2.7 model `Resource`
- [x] 2.8 model `ServiceResource`（複合主鍵）
- [x] 2.9 model `ScheduleRule`（scope enum）
- [x] 2.10 model `ScheduleOverride`
- [x] 2.11 model `MerchantHoliday`（`@@unique([merchantId, date])`）
- [x] 2.12 model `QueueWindow`
- [x] 2.13 model `QueueTicket`（status enum + `@@unique([merchantId, serviceId, ticketDate, ticketNumber])`）
- [x] 2.14 model `QueueCounter`（`@@unique([merchantId, serviceId, counterDate])`）
- [x] 2.15 model `Appointment`（mode/status enum + index `[merchantId, startAt]` + `[merchantId, customerPhone]`）
- [x] 2.16 model `AppointmentArchive`（schema 同 Appointment + `archivedAt`）
- [x] 2.17 model `RateLimitBucket`（`@@unique([bucketKey, windowStart])`）
- [x] 2.18 model `JobLock`（jobName unique）
- [x] 2.19 model `CustomerOtp`（index `[merchantId, phone]`）

## 3. 環境變數

- [x] 3.1 建立 `.env.dev` 含 `DATABASE_URL / JWT_SECRET / R2_ENDPOINT / R2_ACCESS_KEY / R2_SECRET_KEY / R2_BUCKET / R2_PUBLIC_BASE / CRON_SECRET`
- [x] 3.2 在 `types/nuxt.d.ts` 補對應環境變數型別宣告（如需）— 後端透過 `process.env` 取用，types/nuxt.d.ts 僅前端 plugin 型別，不需擴充
- [x] 3.3 確認 `.gitignore` 已忽略 `.env*`（檢視現有，必要時補）— 既有 `.env` 排除、`!.env.dev` 例外規則正確

## 4. Server Utils

- [x] 4.1 `server/utils/response.ts`：`successResponse / badRequestError / notFoundError / forbiddenError / unauthorizedError / conflictError / serverError / sanitizeNulls`，全帶三語訊息
- [x] 4.2 `server/utils/prisma.ts`：singleton PrismaClient（dev 模式掛 `globalThis.__prisma`）
- [x] 4.3 `server/utils/auth.ts`：`signToken / verifyToken / getAuth / requireAdmin / requireMerchant / hashPassword / verifyPassword`
- [x] 4.4 `server/utils/r2.ts`：`uploadToR2(key, body, contentType)`，失敗 return error 物件而非 throw
- [x] 4.5 `server/utils/rate-limit.ts`：`checkRateLimit(key, limit, windowSeconds)` 用 `RateLimitBucket` 表

## 5. 前端身分與權限

- [x] 5.1 擴充 `app/stores/3.store-self.ts`：新增 `selfType / merchantId / role / userName / userEmail` ref（加密 cookie 持久化）
- [x] 5.2 新增 `HasRule(rule: string): boolean` 方法
- [x] 5.3 擴充 `SignOut()`：清除新增的所有欄位後依 `selfType` 跳轉

## 6. API 攔截與 401 跳轉

- [x] 6.1 修改 `app/protocol/fetch-api/methods.ts`：onResponseError 中偵測 response 狀態 401
- [x] 6.2 401 時呼叫 `StoreSelf.SignOut()` 並依 `selfType` 跳 `/sys/sign-in` 或 `/sign-in`
- [x] 6.3 顧客 (`guest`) 不做跳轉

## 7. Middleware

- [x] 7.1 新增 `app/middleware/admin.ts`：未登入或非 admin 跳 `/sys/sign-in`
- [x] 7.2 新增 `app/middleware/merchant.ts`：未登入或非 merchant 跳 `/sign-in`
- [x] 7.3 grep 確認 `demo.global.ts` 無引用後刪除
- [x] 7.4 確認 Nuxt middleware autodiscover 仍正常（兩個具名 middleware 都能掛載）— 將在 npm run dev 階段一併驗證

## 8. Layouts 骨架

- [x] 8.1 填充 `app/layouts/default.vue`：簡潔 `<NuxtPage />` 包裝
- [x] 8.2 填充 `app/layouts/front-desk.vue`：頂部 header 殼（商家名 placeholder + 語系切換按鈕殼）+ `<NuxtPage />`
- [x] 8.3 填充 `app/layouts/back-desk.vue`：頂部 header（含登出按鈕呼叫 `StoreSelf.SignOut`）+ 側邊 nav 殼 + admin 標記殼 + 代理中橫條殼（v-if 暫綁 false）+ `<NuxtPage />`

## 9. 資料庫遷移與驗證

- [x] 9.1 確保使用者本機有可連線的 PostgreSQL — `.env.dev` 含 docker 一行指令註解；本機驗證階段未啟動 PG，使用者執行下列前需先起 PG
- [ ] 9.2 跑 `npx prisma migrate dev --name init`（**使用者環境執行**：本機未安裝 PG/Docker，無法在 apply 階段執行；schema 已以 `prisma migrate diff --from-empty --script` 驗證可生成完整 17 表 + 9 enum 的 SQL）
- [x] 9.3 跑 `npx prisma generate` 確認 client 產出 — `node_modules/@prisma/client` 已生成
- [ ] 9.4 跑 `npx prisma studio` 看到 17 張表（**使用者環境執行**：需 9.2 完成後）

## 10. 整體驗證

- [x] 10.1 `npm run dev` 啟動不報錯，能開 `http://localhost:3000` 看到首頁 — Nuxt 4.4.4 + Nitro + Vite 正常啟動，`curl /` 回 200 並渲染 `LayoutDefault`
- [x] 10.2 `npm run lint` 通過 — 本 change 新增/修改的檔案全乾淨；剩 2 個 lint error 來自既有 `.vscode/demo.vue` 與 `app/composables/tool/use-ws.ts:505`，**非本 change 引入**
- [ ] 10.3 在某頁加 `definePageMeta({ middleware: ['admin'] })` 暫測（**選擇性**：middleware 內部行為已單純，待 Change 2 / 3 實際接入時自然驗證）
- [ ] 10.4 暫時 mock `/api/test` 回 401 驗證跳轉（**選擇性**：待 Change 2 sign-in API 上線時自然驗證）

## 11. OpenSpec 收尾

- [x] 11.1 `openspec validate setup-foundation` 通過（CLI 無 `verify` 命令，改用 validate）
- [x] 11.2 `git status` 檢查無多餘檔案；`.env.dev` **依 `.gitignore` `!.env.dev` 規則屬於入庫檔案**（dev 共享配置，無敏感資料），原 tasks.md 描述錯誤已修正
