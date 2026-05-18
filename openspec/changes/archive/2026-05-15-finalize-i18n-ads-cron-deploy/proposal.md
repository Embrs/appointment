# Change：finalize-i18n-ads-cron-deploy

## Why

預約平台 MVP 的 Change 1–7 已交付商家設定、可預約時段算法、顧客預約流程與號碼牌即時叫號。本 change（第 8 也是最後一個）負責**整合收尾**：

- **i18n 三語 audit**：前 7 個 changes 各自實作時，部分頁面遺留繁中 hardcoded 字串，需統一搬到 `i18n/locales/{zh,en,ja}.js` 並改用 `$t()`
- **廣告插槽**：藍圖決策「MVP 不放廣告但預留插槽」需具體落地，需可隨時開啟而不破版
- **排程歸檔**：3 個月前 Appointment 須搬至 `AppointmentArchive`，QueueCounter / RateLimitBucket 過期資料需清理；目前完全沒有 cron 端點
- **部署**：Railway 部署需要 Dockerfile 跑 prisma migrate、`.env.example` 列出所有變數

完成後預約平台 MVP 即可上線。

## What Changes

### i18n 三語 audit（覆蓋 ~50 個業務字串）

- 對 `app/pages/m/`、`app/pages/admin/`、`app/pages/sys/`、`app/components/biz/`、`app/components/open/` 全面掃描繁中 hardcoded 字串
- 補入 `i18n/locales/zh.js / en.js / ja.js`，三語 key 完全對應
- 將 hardcoded 字串改為 `$t()` / `t()` 呼叫
- 保留錯誤訊息 fallback：`res.status.message?.zh_tw` 仍可用（後端已三語），但 UI 字串必須 i18n

### 廣告插槽

- 新增 `app/components/biz/AdSlot.vue`：
  - props：`name: string`（slot 名稱用於日後 targeting，例：`merchant-page-top`）
  - 計算：`hasAd = StoreEnv().adConfig[name]?.enabled` MVP 永遠 false
  - `v-if="hasAd"` 控制渲染（無內容時不占空間）
  - 預留 `data-slot` attribute 便於外部測試/分析
- StoreEnv 擴充 `adConfig: Record<string, { enabled: boolean; html?: string }>` MVP 為空物件
- 預留位置（3 處）：
  - `app/pages/m/[slug]/index.vue` 頂部 banner（name="merchant-page-top"）
  - `app/pages/m/[slug]/queue/status.vue` 號碼牌下方（name="queue-status-below"）
  - `app/pages/m/[slug]/my-bookings.vue` 列表每 3 筆插一個（name="my-bookings-inline"）

### 排程歸檔

- `server/routes/nuxt-api/cron/archive.post.ts`：
  - 驗證 `x-cron-secret` header（不通過回 401）
  - `JobLock` 表 acquire 互斥鎖（`name='archive-appointments'`、過期時間 30 分鐘）
  - 事務批次（每批 500 筆）：搬 `startAt < now() - 90 days` 的 Appointment → AppointmentArchive，原表刪除
  - 同時清理：QueueCounter `ticketDate < now() - 30 days`、RateLimitBucket `windowStart < now() - 1 hour`
  - 回傳 `{ archived: number, queueCounterDeleted: number, rateLimitDeleted: number, durationMs: number }`
- protocol 不需要（內部 cron 用，前端不呼叫）
- 外部 cron service：使用 cron-job.org（免費、易設定）每日 04:00 UTC 觸發

### Docker 與部署

- 修改 `Dockerfile`：
  - builder stage：`npm ci` 後加 `npx prisma generate`
  - runner stage：copy `prisma/` 與 `node_modules/.prisma/`
  - CMD 啟動前：`npx prisma migrate deploy && node /.output/server/index.mjs`
- 新增 `.env.example`：列出所有變數（不含密鑰），每個變數附用途註解
- Railway 部署文件 README 段落新增「部署 checklist」

## Impact

- Specs：新增 capability `finalize-deploy`（含 i18n audit / ad slot / cron archive / deployment 四節 requirements）
- Code：
  - 新增 `app/components/biz/AdSlot.vue`、`server/routes/nuxt-api/cron/archive.post.ts`、`.env.example`
  - 修改 `i18n/locales/{zh,en,ja}.js`、`app/stores/0.store-env.ts`、`Dockerfile`
  - 修改 `app/pages/m/[slug]/{index,book,lookup,my-bookings,queue/index,queue/status}.vue` 等頁面字串
- 對前面 changes 的功能 zero-impact，僅新增與字串替換

## Non-goals

- 不實作實際廣告投放（Google Ads 整合、追蹤像素）
- 不做 Email/簡訊通知（藍圖明示 MVP 不做）
- 不做跨商家 i18n 自訂（商家自己的內容仍用單語）
- 不部署到 Railway（本 change 只準備檔案，實際部署由人類執行）
