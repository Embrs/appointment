# Tasks：finalize-i18n-ads-cron-deploy

## 1. i18n 三語 audit

- [x] 1.1 掃描 `app/pages/m/**/*.vue`、`app/pages/admin/**/*.vue`、`app/pages/sys/**/*.vue` 找出 hardcoded 繁中字串
- [x] 1.2 擴充 `i18n/locales/zh.js`：新增 `common`、`booking.steps`、`titleOptions`、`merchant.share`、`admin.console` 等 key
- [x] 1.3 同步擴充 `i18n/locales/en.js`、`i18n/locales/ja.js`（三語 key 完全對應）
- [x] 1.4 替換頁面使用 `$t()`：`app/pages/m/[slug]/{index,book,lookup,my-bookings,queue/index,queue/status}.vue`
- [x] 1.5 替換後台頁面使用 `$t()`：`app/pages/admin/{settings,share-link,services,resources}` 等

## 2. 廣告插槽

- [x] 2.1 擴充 `app/stores/0.store-env.ts` 增加 `adConfig: Record<string, { enabled: boolean; html?: string }>`（MVP 空物件）
- [x] 2.2 新增 `app/components/biz/AdSlot.vue`：v-if + props name + data-slot attribute
- [x] 2.3 插入 `app/pages/m/[slug]/index.vue` 頂部：`AdSlot(name="merchant-page-top")`
- [x] 2.4 插入 `app/pages/m/[slug]/queue/status.vue` 號碼牌下方：`AdSlot(name="queue-status-below")`
- [x] 2.5 插入 `app/pages/m/[slug]/my-bookings.vue` 列表每 3 筆插一個：`AdSlot(name="my-bookings-inline")`

## 3. 排程歸檔 API

- [x] 3.1 `server/utils/job-lock.ts`：`acquireJobLock(name, ttlMinutes)` / `releaseJobLock(name)`
- [x] 3.2 `server/routes/nuxt-api/cron/archive.post.ts`：
  - header 驗證 → JobLock → 批次搬 Appointment → 清理 QueueCounter / RateLimitBucket → release lock
- [x] 3.3 三語訊息：`MSG_CRON_UNAUTHORIZED`、`MSG_ARCHIVE_RUNNING`、`MSG_ARCHIVE_SUCCESS`

## 4. Docker 與部署檔案

- [x] 4.1 修改 `Dockerfile`：builder 加 `npx prisma generate`、runner 加 `prisma/` + `migrate deploy` 啟動
- [x] 4.2 新增 `.env.example`：所有變數列出（含註解、無密鑰）
- [x] 4.3 修改 `.dockerignore` 確認 `prisma/migrations/` 不被排除

## 5. 驗證

- [x] 5.1 啟動 dev server，Playwright 跑三語切換 snapshot
- [x] 5.2 Playwright 跑 `/m/{slug}` 頁面 hasAd=false 確認無破版（screenshot 比對）
- [x] 5.3 臨時改 hasAd=true 注入假內容，確認版面平滑容納
- [x] 5.4 RWD 各尺寸 375/414/768/1024/1440 snapshot
- [x] 5.5 curl 觸發 cron/archive 端點，確認資料正確搬移
- [x] 5.6 `docker build` 本地能跑通（不部署，僅驗證）
