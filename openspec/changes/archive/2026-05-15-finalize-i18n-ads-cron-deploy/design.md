# Design：finalize-i18n-ads-cron-deploy

## i18n audit 策略

### 掃描範圍

優先掃描使用者介面（顯示字串），不掃 API 錯誤訊息（後端已三語）：

- `app/pages/m/**/*.vue`（顧客端頁面）
- `app/pages/admin/**/*.vue`（商家後台頁面）
- `app/pages/sys/**/*.vue`（平台管理員頁面）
- `app/components/biz/*.vue`、`app/components/open/**/*.vue`

### 識別規則

- 使用 grep regex 找 `'[繁中字串]'`：`'[一-鿿]'`
- 排除：`ElMessage.error(res.status.message?.zh_tw || '...')` 的 fallback（後端已三語）
- 排除：型別檔案、`<!-- 註解 -->`、SCSS 中的字串
- 排除：mock data 中的範例字串

### key 命名規則

延續既有結構（看 `i18n/locales/zh.js`）：
- `auth.*`：認證頁
- `merchant.*`：商家相關
- `customer.*`：顧客端
- `admin.*`：平台管理員
- `appointment.*`：預約共用
- `queue.*`：號碼牌
- 新增：`common.*`（按鈕、確認、取消等通用詞）

## AdSlot 設計

```vue
<script setup lang="ts">
interface Props { name: string }
const props = defineProps<Props>();
const storeEnv = StoreEnv();
const ad = computed(() => storeEnv.adConfig[props.name]);
const hasAd = computed(() => !!ad.value?.enabled && !!ad.value?.html);
</script>

<template lang="pug">
.AdSlot(v-if="hasAd" :data-slot="name")
  div(v-html="ad.html")
</template>
```

**為何 v-if 而非 v-show**：v-show 會留 DOM 但 `display:none` 仍不占空間，但若內部有圖片仍會載入。藍圖要求「無內容時不渲染」，v-if 完全跳過 render。

**StoreEnv adConfig**：MVP 為空物件 `{}`，未來可從後端 `/nuxt-api/public/ad-config` 拉取。

**為何只開 3 個位置**：藍圖明示這 3 個位置足以覆蓋顧客流程的主要曝光點。其他頁面（後台、平台管理）不放廣告（B2B 介面不適合）。

## 排程歸檔設計

### 為何需要 JobLock

cron-job.org 不保證單次觸發（網路重試可能造成同一時刻兩個請求）。排程歸檔涉及大量 DB 操作，必須互斥。`JobLock` 表已在 schema 設計：

```prisma
model JobLock {
  name      String   @id
  lockedAt  DateTime @default(now())
  expiresAt DateTime
}
```

acquire 邏輯：
1. `findUnique({ name })` 若不存在或 `expiresAt < now()` 則 `upsert` 寫入新 lock（過期 30 分鐘）
2. 失敗（lock 仍有效）：回 409 `MSG_ARCHIVE_RUNNING`
3. 完成後 `delete({ name })` 釋放

### 為何批次 500

- 一次性搬幾萬筆 Appointment 可能撐爆事務 log
- 500 是 Postgres + Prisma 的甜蜜點（太小開 IO 太多，太大事務太長）
- 用 `take(500)` 迴圈直到沒資料

### 清理 QueueCounter / RateLimitBucket

- QueueCounter：每日每服務一筆，30 天前的已用不到（純歷史紀錄無業務意義）
- RateLimitBucket：1 小時前的視窗已過期，純垃圾

均使用 `deleteMany({ where: { ... } })` 一次完成（資料量少）。

### cron 觸發時間

選 04:00 UTC（亞洲 12:00 中午、美洲半夜），原因：
- 商家少人使用、不影響上線商家流量
- 失敗有時間人工介入

## Docker 部署設計

### 為何 prisma generate 放在 builder

`@prisma/client` 需要根據 `schema.prisma` 生成 client（位於 `node_modules/.prisma/`）。若不生成，build 階段 `import { PrismaClient }` 會炸。Multi-stage build 中：
- builder：`npm ci` → `npx prisma generate` → `npm run build`
- runner：複製 `.output/`、`node_modules/.prisma/`、`prisma/`（migrate deploy 需要）

### 為何 migrate deploy 放在啟動時

Railway 每次部署都會啟動新容器。`prisma migrate deploy` 是冪等的（只跑未套用的 migration），放啟動時保證資料庫 schema 永遠最新。失敗則容器啟動失敗，Railway 會 rollback。

### .env.example 結構

```
# ----- Nuxt -----
NUXT_API_BASE=
...
# ----- DB -----
DATABASE_URL=
...
```

註解每個變數的：用途、範例格式、是否必填。

## 風險與權衡

| 風險 | 緩解 |
|------|------|
| i18n key 漏補 → en/ja 顯示 `key.path` 字面 | grep 驗證三語 key 數量一致 |
| 廣告插槽以 v-html 渲染 → XSS | MVP adConfig 永遠 false，未來啟用時需驗證來源並 sanitize |
| 排程歸檔長事務 → 鎖表 | 批次 500 + 短事務 + JobLock 互斥 |
| Dockerfile prisma migrate 失敗 → 容器無法啟動 | Railway 自動 rollback，且失敗可看 build log |
| cron-job.org 免費版有限制 | 已知限制（每分鐘 1 次 / 每月 50 萬次）對日歸檔綽綽有餘 |
