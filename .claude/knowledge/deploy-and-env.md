---
name: 部署與環境變數
description: Dockerfile multi-stage、Railway 部署、環境變數清單、cron jobs、R2 物件儲存、JobLock 與 RateLimit
type: reference
---

# 部署與環境變數

Dockerfile、環境變數、cron 觸發、Cloudflare R2、排程互斥鎖。

## Dockerfile

`Dockerfile` 為 multi-stage：

| Stage | 基礎映像 | 動作 |
|-------|---------|------|
| `builder` | `node:24.11-alpine` | 先複製 `package*.json`、`prisma/`、`scripts/`（postinstall 依賴 `scripts/copy-tinymce.mjs`）→ `npm ci` → `prisma generate`（冪等保險）→ 複製其餘原始碼 → `npm run build` → 驗 `.output/server/index.mjs` 存在 |
| `runner` | `node:24.11-alpine` | 複製 `.output/`、`prisma/`、`node_modules/{.prisma,@prisma,prisma}` |

啟動指令（在 runner stage）：
```sh
node ./node_modules/prisma/build/index.js migrate deploy && node ./.output/server/index.mjs
```

- 直接以 `node` 執行 prisma 入口，避開 `node_modules/.bin` 軟連結未複製到 runner 的問題（不再依賴 `npx`）
- `prisma migrate deploy` 冪等，只套未套用的 migrations
- 失敗則容器啟動失敗（部署 platform 會自動 rollback）
- `EXPOSE 3000`、`NUXT_HOST=0.0.0.0`

## 環境變數清單

完整見 `.env.example`，分組：

### Nuxt

| 變數 | 用途 |
|------|------|
| `NUXT_API_BASE` | 瀏覽器端與 server 共用的 API base URL |
| `NUXT_PUBLIC_TEST_MODE` | `T`=mock 資料 / `F`=真實 API |
| `NUXT_PUBLIC_GTM_ID` | Google Tag Manager（選填） |
| `NUXT_PUBLIC_CLARITY_CODE` | Microsoft Clarity（選填） |
| `NUXT_PORT` | 開發用端口（預設 3000） |

### 資料庫

| 變數 | 用途 |
|------|------|
| `DATABASE_URL` | PostgreSQL 連線字串；Railway 自動注入 production 值 |

### 認證

| 變數 | 用途 |
|------|------|
| `JWT_SECRET` | JWT 簽署密鑰，**上線必須更換**；產生方式 `openssl rand -hex 32` |

### Cloudflare R2

| 變數 | 用途 |
|------|------|
| `R2_ACCOUNT_ID` | Cloudflare account ID |
| `R2_ACCESS_KEY_ID` | R2 API token access key |
| `R2_SECRET_ACCESS_KEY` | R2 API token secret key |
| `R2_BUCKET_NAME` | bucket 名稱（需在 dashboard 設定 public access） |
| `R2_PUBLIC_BASE_URL` | 自訂域名（選填） |

### Cron

| 變數 | 用途 |
|------|------|
| `CRON_SECRET` | 外部 cron service 呼叫 `/nuxt-api/cron/*` 需帶 `x-cron-secret` header |

## Cron jobs

`POST /nuxt-api/cron/archive`（`server/routes/nuxt-api/cron/archive.post.ts`）：

| 排程 | 每日 04:00 UTC |
|------|--------------|
| 觸發 | 外部 cron service（cron-job.org / Upstash QStash）帶 `x-cron-secret` |
| 互斥鎖 | `JobLock(jobName='archive-appointments', ttl=30min)`；同時觸發第二支會 409 |
| 動作 1 | `Appointment.startAt < now-90d` 批次 500 搬到 `AppointmentArchive`（事務內 `createMany` + `deleteMany`） |
| 動作 2 | `QueueCounter.counterDate < now-30d` 刪除 |
| 動作 3 | `RateLimitBucket.windowStart < now-1h` 刪除 |
| 失敗 | `try/catch` 包住所有動作，失敗會 `ReleaseJobLock` 後回 500 |

## Cloudflare R2

`server/utils/r2.ts`：

- 用 `@aws-sdk/client-s3` 走 S3 相容介面
- `endpoint = https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
- `forcePathStyle: true`
- 失敗一律 `return { error }`，**不拋例外**
- 上傳成功回 `{ key, url }`；`url` 為 S3 endpoint 形式（非公開 CDN），實際公開連結用 `R2_PUBLIC_BASE_URL` 拼接

兩個上傳端點都走這支：`/tinymce/upload`、`/upload/image`。

## JobLock 與 RateLimit

兩支系統 utility 都基於 DB 表實作（避免引入 Redis）：

### JobLock（`server/utils/job-lock.ts`）

```typescript
const lock = await AcquireJobLock({ jobName: 'archive-appointments', ttlMinutes: 30 });
if (!lock.acquired) return conflictError(event, ...);
try { /* 工作 */ } finally { await ReleaseJobLock(jobName); }
```

- `JobLock.jobName` 唯一鍵；過期判斷用 `expiresAt > now`
- 用 `prisma.jobLock.upsert` 重複取
- 失敗時呼叫端必須 `ReleaseJobLock` 釋放

### RateLimit（`server/utils/rate-limit.ts`）

```typescript
const limit = await checkRateLimit(`lookup:${phone}`, 5, 60);  // 60 秒 5 次
if (!limit.ok) return tooManyRequestsError(event);
```

- 固定窗口算法
- `(bucketKey, windowStart)` 唯一鍵 + `count` 累加
- 過 1 小時由 cron 清理

## 測試

- 框架：Vitest（`vitest.config.ts`）
- 位置：`server/__tests__/`
- 現有覆蓋：`availability.test.ts`（純函式 `buildSlots`）
- 執行：`npm test`
