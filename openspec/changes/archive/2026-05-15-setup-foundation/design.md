## Context

Nuxt 4 樣板已有前端骨架（Vue 3 + Element Plus + Pinia + i18n + 加密 Cookie `ss_t` + API 封裝 + 三 layouts 殼），但完全缺乏：資料庫、ORM、認證 middleware、後端工具、401 跳轉、權限檢查。本 change 是後續 7 個 changes 的共同地基，任何一個下游 change 都會用到本 change 產出的 schema、`server/utils`、middleware、layout。

關鍵約束（來自 `CLAUDE.md` 與藍圖）：
- 後端錯誤一律 `return` **不** `throw`
- 響應格式 `{ data, status: { code, message: { zh_tw, en, ja } } }`
- 後端回傳 null 值要轉空字串（sanitizeNulls）
- 三角色（admin / merchant_user / 顧客匿名）共存，JWT 區分
- 預約四種模式共存（TIME_SLOT / TIME_CAPACITY / RESOURCE / QUEUE），schema 一次包齊
- 顧客無 OTP 但 schema 保留 `CustomerOtp`
- 商家 `timezone` 欄位，所有時段計算以該 timezone 為準
- 軟刪除：可刪除實體加 `deletedAt`
- 多語錯誤訊息（zh_tw / en / ja）

## Goals / Non-Goals

**Goals:**
- 一次落地 17 個 Prisma model 與其關聯，避免後續 changes 持續改 schema
- 提供統一響應、Prisma singleton、JWT、R2、rate-limit 五個 server utils
- 在 StoreSelf 中表達「我是誰」（admin / merchant / 顧客）與 `HasRule()`
- 完成 401 自動跳轉登入頁（區分 admin vs merchant 路徑）
- 提供具名 middleware（`admin` / `merchant`）給後續頁面掛載
- 三套 layout 骨架到位（不含實際業務字段、留好 slot）
- `prisma migrate dev` 與 `npm run dev` 雙雙跑通

**Non-Goals:**
- 不實作任何業務 API（auth、merchant 管理、預約⋯⋯都在後續 changes）
- 不實作任何業務頁面（sign-in、admin 後台、顧客面⋯⋯都在後續 changes）
- 不做 seed data（避免污染 schema 設計）
- 不做 WebSocket（在 Change 7）
- 不做 cron / archive 邏輯（在 Change 8，僅 schema 已預留 `JobLock` / `AppointmentArchive`）
- 不做測試框架（藍圖建議 Change 5 順手加 vitest）
- 不部署 Railway / 不實際連 R2（用 placeholder）

## Decisions

### 決策 1：Prisma 而非 Drizzle / TypeORM
- **選擇**：Prisma 6.x（最新穩定）
- **理由**：Nuxt 4 + Nitro 環境 Prisma 支援成熟、`prisma studio` 對非工程師友善、藍圖明確指定
- **替代**：Drizzle（型別好但學習曲線陡）、TypeORM（同步差）

### 決策 2：單一 `prisma/schema.prisma` 整檔，不拆檔
- **選擇**：所有 17 個 model 寫在同一個 schema.prisma
- **理由**：Prisma multi-file schema 仍為 preview；單檔對 17 個 model 仍可讀
- **替代**：用 `previewFeatures = ["prismaSchemaFolder"]` 拆檔（暫不採用）

### 決策 3：主鍵全 `cuid()` 而非 `uuid` / `autoincrement`
- **選擇**：`@id @default(cuid())`
- **理由**：URL 友善（顧客分享連結會帶 ID）、無時序碰撞、跨表一致
- **替代**：uuid（更長）、autoincrement（會洩漏業務量）

### 決策 4：JWT 不存 DB（無 refresh token 表）
- **選擇**：JWT 自包含 `{ type, sub, merchantId?, role?, impersonatedBy? }`，HMAC-SHA256 + `JWT_SECRET`，TTL 14 天
- **理由**：MVP 簡化；登出由前端清 cookie 即可；代理（Change 3）會簽短 TTL 30 分鐘 token
- **替代**：refresh token 機制（之後若需強制下線再加）

### 決策 5：三語錯誤訊息走「工具函式回傳」而非 i18n 中間件
- **選擇**：`server/utils/response.ts` 直接吐 `{ zh_tw, en, ja }` 物件
- **理由**：API 響應一律帶三語，前端按 `useI18n().locale` 挑；後端無需感知語系；對齊 CLAUDE.md 既定格式
- **替代**：後端讀 `Accept-Language` 只回單語（前端切語系時需重打 API，否決）

### 決策 6：`HasRule()` 採「角色+資源」字串檢查
- **選擇**：`HasRule(rule: string): boolean`，例如 `HasRule('merchant.service.delete')`；StoreSelf 內存 `role` 與 `selfType`，邏輯硬編
- **理由**：MVP 角色組合固定（admin / OWNER / STAFF / 顧客），無需 RBAC 表
- **替代**：DB-driven RBAC（之後可換）

### 決策 7：401 跳轉路徑由 `selfType` 決定
- **選擇**：methods.ts 攔截 401，讀 StoreSelf.selfType → admin 跳 `/sys/sign-in`、merchant 跳 `/sign-in`、顧客頁面不跳（顧客頁面不該收到 401）
- **理由**：避免 admin 後台被誤踢到顧客登入頁
- **替代**：URL 前綴判斷（耦合路由設計，否決）

### 決策 8：Middleware 具名而非 global
- **選擇**：`app/middleware/admin.ts` + `merchant.ts` 為**具名** middleware，頁面以 `definePageMeta({ middleware: ['admin'] })` 掛載
- **理由**：顧客頁面不需要任何認證；global middleware 會誤攔顧客頁
- **動作**：**刪除** `demo.global.ts`（檔內空白，無用）

### 決策 9：R2 用 S3 SDK 而非 Cloudflare 官方 SDK
- **選擇**：`@aws-sdk/client-s3` + `endpoint: R2_ENDPOINT`
- **理由**：R2 完全相容 S3 API；可重用既有知識；藍圖明確指定
- **替代**：`@cloudflare/r2-sdk`（覆蓋面小）

### 決策 10：Rate limit 表 `RateLimitBucket` 用 PG 計數，不用 Redis
- **選擇**：PG row + 樂觀鎖 / `INSERT ON CONFLICT`
- **理由**：MVP 流量低、避免新基建；表已在 schema
- **替代**：Redis（量上來再換）

### 決策 11：`Appointment` 與 `AppointmentArchive` 兩張表 schema 完全一致
- **選擇**：手動同步欄位定義
- **理由**：歸檔表純複製，查詢 archive 走獨立路徑（Change 8 才寫 cron），主表保持小、查詢快
- **替代**：分區表（PG 支援但 Prisma 不直接支持）

### 決策 12：`MerchantHoliday` 獨立表，不塞 `ScheduleOverride`
- **選擇**：休假日獨立 `MerchantHoliday` 表
- **理由**：UI 上「休假日」與「特定日期時段覆寫」是兩個獨立功能，獨立表更直觀
- **替代**：合併進 ScheduleOverride 加 `type` 欄位（被藍圖明確否決）

### 決策 13：`MerchantStatus` enum 含 `PENDING / ACTIVE / SUSPENDED / REJECTED`
- **選擇**：4 個狀態
- **理由**：商家自助註冊 → PENDING；管理員審核 → ACTIVE；停權 → SUSPENDED；拒絕 → REJECTED
- **轉換規則**：PENDING → ACTIVE / REJECTED；ACTIVE ↔ SUSPENDED；REJECTED 不可恢復（重新註冊）

### 決策 14：`BookingMode` enum 直接綁在 `Service` 上
- **選擇**：每個 Service 單一 `bookingMode`
- **理由**：同商家可有多個 service 用不同 mode；服務本身就是預約的 entry point
- **替代**：mode 綁在 Merchant 上（無法混用，否決）

### 決策 15：layout 切換策略 `default` / `front-desk` / `back-desk` 三套
- **選擇**：頁面用 `definePageMeta({ layout: 'front-desk' })` 顯式指定
- **理由**：前後台視覺差異大、middleware 不同
- **本 change 範圍**：只填骨架（header/nav 殼 + `<slot>`），實際 nav 內容由後續 changes 補

## Risks / Trade-offs

- **[Prisma migration 衝突]** 17 個 model 一次落地若有設計失誤，後續改 schema 要 `--name` 多次 migration
  → **Mitigation**：本 change 內反覆檢視 schema，必要時重置（dev 環境 `prisma migrate reset` 無痛）
- **[本機沒 PostgreSQL]** 使用者環境若無 PG，`migrate dev` 跑不起來
  → **Mitigation**：`.env.dev` 用範例 `DATABASE_URL`，使用者需自行架本機 PG（Docker 一行）或先連 Railway dev DB
- **[R2 環境變數空白]** 本 change 不實際呼叫 R2，placeholder 即可；下游 Change 4 上傳功能才會真用到
  → **Mitigation**：`r2.ts` 內函式失敗時返回明確錯誤訊息，不在啟動時驗證 ENV
- **[JWT_SECRET 弱 secret]** dev 用 placeholder 不安全
  → **Mitigation**：`.env.dev` 註解明確標示 production 必須換、Dockerfile 不打包此檔
- **[StoreSelf 擴充破壞既有用法]** 既有 `apiToken / isSignIn / SetToken / SignOut` 介面必須相容
  → **Mitigation**：純增加新欄位，舊欄位簽名不動
- **[methods.ts 401 處理破壞既有錯誤流]** 既有 onResponse 把 _showErr 邏輯交給呼叫端
  → **Mitigation**：只在 status code 401 時觸發跳轉，其他錯誤走原本流程
- **[layout 骨架過於詳細導致範圍蔓延]** 容易在 layout 內塞業務邏輯
  → **Mitigation**：本 change 內 layout 只有 header/nav 殼 + 語系切換 + 登出按鈕（連到 StoreSelf.SignOut），無業務字段
- **[`demo.global.ts` 刪除若被引用]** 雖檔內空白但需確認無其他檔 import
  → **Mitigation**：刪除前 grep 確認

## Migration Plan

1. **依賴安裝**：`npm i prisma @prisma/client zod jsonwebtoken bcrypt @aws-sdk/client-s3` + `npm i -D @types/jsonwebtoken @types/bcrypt`
2. **prisma init**：`npx prisma init`（產出 prisma/ 目錄與骨架，再覆寫 schema.prisma）
3. **撰寫 schema**：17 個 model + 5 個 enum
4. **撰寫 server/utils**：5 個檔（response/prisma/auth/r2/rate-limit）
5. **修改 StoreSelf**：新增 4 個欄位 + `HasRule()`
6. **修改 methods.ts**：onResponseError 中 status === 401 觸發 `StoreSelf.SignOut()` 並依 `selfType` 跳轉
7. **建立 middleware**：`admin.ts` / `merchant.ts`
8. **刪除** `demo.global.ts`（確認無引用後）
9. **填充 layouts**：default / front-desk / back-desk 骨架
10. **補 `.env.dev`**：所有 ENV 變數（含註解）
11. **跑 migration**：`npx prisma migrate dev --name init`（需本機有 PG 或連線可達 Railway dev DB）
12. **驗證**：`npx prisma studio` 看到 17 張表 / `npm run dev` 起得來 / `npm run lint` 通過

**Rollback**：
- 因 dev 環境，rollback = `prisma migrate reset` 清庫 + git revert
- production 尚未上線，無需考慮 prod rollback

## Open Questions

- **Q1**：本機 PG 連線字串使用者要自己準備嗎？  
  **A**：是。`.env.dev` 提供範本（`postgresql://postgres:postgres@localhost:5432/appointment_dev`），使用者需自行起 PG（Docker `docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=postgres --name pg postgres:16` 或自有實例）
- **Q2**：要不要在本 change 內 seed 一筆 admin？  
  **A**：不要。Seed 留給 Change 2 `auth-and-onboarding`（連同 sign-in 流程驗證）
- **Q3**：Layouts 是否要做 i18n 語系切換器？  
  **A**：可以放但不接邏輯（畫面有按鈕但點擊先 console.log）；正式語系切換邏輯由 finalize-i18n-ads-cron-deploy（Change 8）統一檢視
- **Q4**：`bcrypt` rounds 多少？  
  **A**：10（標準預設，後端工具 `auth.ts` 內常數）
