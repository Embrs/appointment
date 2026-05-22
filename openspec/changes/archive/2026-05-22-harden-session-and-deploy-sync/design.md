## Context

### 現狀架構
- **JWT 簽發**：[server/routes/nuxt-api/auth/sign-in.post.ts](server/routes/nuxt-api/auth/sign-in.post.ts) 簽發 `{ type, sub, merchantId?, role?, impersonatedBy? }`，TTL 14 天。`Merchant.id` / `MerchantUser.id` / `AdminUser.id` 均為 Prisma `@default(cuid())`。
- **JWT 驗證**：[server/utils/auth.ts:75-90](server/utils/auth.ts) 的 `requireMerchant` / `requireAdmin` 只做 JWT 解碼 + type/role 比對，**不查資料庫**。
- **業務端點**：[server/routes/nuxt-api/merchant/index.get.ts](server/routes/nuxt-api/merchant/index.get.ts) 查 `merchant.findFirst` 不到時 `return notFoundError(event)` → 404。
- **前端 fetch**：[app/protocol/fetch-api/methods.ts:48-54](app/protocol/fetch-api/methods.ts) 的 `onResponseError` 只攔 401 → 呼叫 `StoreSelf.SignOut()`；404 不做事。
- **Middleware**：[app/middleware/merchant.ts](app/middleware/merchant.ts) 只檢查 `storeSelf.isSignIn`（= cookie `ss_t` 是否存在）+ `selfType==='merchant'`，**不打 API 驗證**。
- **部署**：Dockerfile 雖有 `prisma migrate deploy`，但失敗中止行為與健康檢查端點尚未明文化，正式/測試站可能在「程式新版 + schema 舊版」狀態啟動。

### 觸發情境
1. 開發者 `npm run dev` 啟動，本機 reseed → `Merchant.id` 全換新 → 瀏覽器 cookie 內舊 token 失效。
2. 正式/測試站部署 schema 變更，若忘記跑 migrate deploy 或 reseed 過 → 線上既有使用者 token 內 merchantId 失效。
3. 兩種情境結果都相同：使用者進入 `/admin` 看到滿屏 404，必須「手動登出再登入」才會恢復。

### 約束
- 不能把全站 404 全域改 401 — 子資源 not-found（找不到某個 service、appointment）仍應是 404，語意正確很重要。
- 不能破壞既有 14 天 token TTL — 使用者 UX 不該被影響。
- 守衛改動會影響所有受保護 API（數十支）— 必須穩妥，且不能顯著拖慢熱路徑。
- 部署層改動要與 Railway / Docker 相容，避免造成 deploy 流程斷裂。

## Goals / Non-Goals

**Goals:**
- 任何「身分主體在 DB 已不存在」的情境（reseed、軟刪除、停用、未跑 migration 導致 schema 不對）都能自動把使用者乾淨地踢回登入頁，不出現「滿屏 404」這種令人困惑的中間態。
- 部署層強制保證資料庫 schema 與程式碼同步：migration 沒跑成功就不啟動 server。
- 提供 `/health` 與啟動日誌讓「目前生產跑的是哪個版本」可被快速驗證。
- 用 Playwright MCP 在實機驗收：登入 → 模擬 token 失效 → 看到 redirect → 重新登入 → 全功能正常。

**Non-Goals:**
- 不重構整個 auth 架構，不引入 refresh token / OAuth / session table。
- 不快取守衛 DB 查詢（先以「每次查」為基準，未來若 p99 出問題再加 in-memory cache）。
- 不調整 admin/merchant 以外身分（customer session 走另一條 cookie，不在本變更內）。
- 不把全站 404 改 401；只在「身分驗證類查不到自己」改回 401。
- 不修改 JWT payload 結構或 TTL。

## Decisions

### D1：守衛內就地查 DB，而非包新 helper

**選擇**：直接在 `requireMerchant` / `requireAdmin` 函式內，於 JWT 驗證通過後 `await prisma.merchant.findFirst(...)` / `await prisma.adminUser.findFirst(...)`。

**理由**：
- 既有呼叫端散布在數十支 API（`if ('status' in r) return r` 模式），改 helper 簽名要全改。
- 守衛回傳型別維持 `AuthPayload | ApiResponse`，但函式變 async（既有呼叫端早已 `await`）。
- 失敗時用既有 `unauthorizedError(event)` 統一三語訊息：「會話已失效，請重新登入 / Session expired, please sign in again / セッションが失効しました。再度ログインしてください」。

**Alternatives 考慮過**：
- 包新 helper `requireMerchantWithDb` → 改點太散，且容易誤用舊版。
- 在 `getAuth()` 內查 DB → `getAuth` 是純解碼，職責不混雜，否決。

### D2：守衛多一次 DB 查的效能影響可接受

**選擇**：先不加 cache，每次受保護 API 都查一次。

**理由**：
- Prisma 對 PK 查詢 < 5ms，相對於後續業務查詢（多表 join）佔比極小。
- Railway PostgreSQL 同 region 延遲 < 1ms。
- 若監控 p99 上升再加 `nitro-cached` 或自管 in-memory cache（key=merchantId，TTL=60s）。
- 預留 cache 介面：守衛內呼叫一個 `lookupMerchant(id)` / `lookupAdminUser(id)` 內部函式，未來加 cache 不影響守衛外觀。

### D3：`/auth/me` 既有端點承擔 middleware 預檢職責

**選擇**：重用 `GET /nuxt-api/auth/me`（既有，不新增端點），補強「merchant/admin 不存在」情境（回 401）。

**理由**：
- 端點已存在、已三語、前端已有 `MeInfo()` binding，直接重用最省事。
- middleware 改 async，進站前 `await $fetch('/nuxt-api/auth/me')`；失敗清 cookie 並 redirect。
- 不新增 `/auth/check` 之類冗端點，保持 API 簡潔。

### D4：Middleware 預檢的 SSR 與 client 行為一致

**選擇**：
- Client：`useNuxtApp().$api.auth.MeInfo()` 或直接 `$fetch('/nuxt-api/auth/me', { headers: { Authorization: 'Bearer ' + token } })`。
- SSR：在 Nuxt middleware（`defineNuxtRouteMiddleware`）內透過 `useRequestHeaders(['cookie'])` 把 cookie 傳給 `$fetch`，並讓 server 端能取得 `ss_t` 解出 token。
- 為避免 SSR/CSR token 不同源造成驗證錯位，**統一在 client 端做預檢**（SSR pass through），admin/merchant middleware 加 `if (import.meta.server) return;` 短路。

**理由**：
- Cookie 是加密的（`UseEncryptCookie`），SSR 端可讀但解密邏輯與 client 一致；但為了減少分支風險，先讓 SSR 不預檢，CSR 上來時馬上預檢一次即可。最壞情境是 SSR 渲染了第一個 admin 框架但 client 一進站就看到 redirect — 可接受，因為頁面尚未發出任何業務 API 請求（middleware 先跑）。

### D5：401 統一清身分的去重

**選擇**：在 `HandleUnauthorized` 內加 redirect lock — 第一次 401 觸發 `SignOut()` 後設一個 `isRedirecting` flag，後續 401 直接 return。

**理由**：
- 進站時常並發 5+ 支 API，全部 401 會觸發多次 `navigateTo`，視覺上閃跳。
- Flag 用 `StoreSelf` 內部 `_redirecting` ref，跳轉完成（或路由變更）後重置。

### D6：部署層 — entrypoint 失敗中止

**選擇**：Dockerfile entrypoint 改用 shell script：
```sh
#!/bin/sh
set -e
echo "[deploy] running prisma migrate deploy..."
npx prisma migrate deploy
echo "[deploy] migrate deploy OK"
exec node .output/server/index.mjs
```
- `set -e` 確保任一行失敗整個 entrypoint 退出非 0。
- Railway / Docker host 偵測 unhealthy → 保留前一個健康容器（rolling deploy 預設行為）。

**Alternatives**：
- 把 migrate deploy 包在 Nitro startup plugin 內 → 失敗時 Node process 可能進入半啟動狀態，較難偵測；否決。
- 用 `release_command`（Railway 專屬）→ 不通用，且本地 Docker 跑也要重現；otec script 方式更通用。

### D7：Health endpoint 設計

**選擇**：
- 路徑 `GET /nuxt-api/health`，**無認證**（白名單，不掛 requireXxx）。
- 回應 200 / 503 兩種，body 含 `{ status, db, migration, commit, uptimeSec }`。
- `migration`：用 `prisma.$queryRawUnsafe<{ migration_name: string }[]>('SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL ORDER BY finished_at DESC LIMIT 1')` 查 `_prisma_migrations` 表。
- `commit`：讀 `process.env.GIT_COMMIT_SHA`（Dockerfile build-arg 注入），缺則 fallback 為 `'dev'` 或 `'unknown'`。
- DB 連線測試：`await prisma.$queryRaw\`SELECT 1\``。

### D8：啟動日誌

**選擇**：Nitro server plugin（`server/plugins/boot-log.ts`），onReady 印一行：
```
[boot] migration=20260521_xxxx commit=abc1234 nodeEnv=production
```
- 與 `/health` 共用查詢函式 `getCurrentMigration()`、`getCommitHash()`。

## Risks / Trade-offs

| 風險 | 緩解 |
|------|------|
| 守衛多一次 DB 查拖慢熱路徑 p99 | 監控 Railway p99，若 > 200ms 增 60s in-memory cache（key=merchantId/adminId） |
| migrate deploy 失敗導致部署無法上線 | 這是預期行為（fail fast）。配 Railway rolling deploy + 健康檢查，舊版繼續服務；同時讓 deploy log 完整顯示 prisma 錯誤供排查 |
| middleware async 預檢造成進站延遲 200-500ms | 接受。第一次進 admin 多一次往返換取「永遠不會看到滿屏 404」；後續頁面切換 middleware 仍會跑但通常本地快取 / SWR 命中 |
| 前端 401 redirect lock 邏輯漏掉某個進入點 | 統一在 `methods.ts` + `xhrFileUpload` 兩處呼叫 `HandleUnauthorized`，Vitest 補 unit test 覆蓋 |
| 守衛改 async 可能漏改某些呼叫端 | TypeScript 型別 `Promise<AuthPayload \| ApiResponse>` 會逼編譯期報錯；`npm run build` 全綠才合格 |
| `_prisma_migrations` 表查不到（fresh DB） | health endpoint 不要因為「無 migration 記錄」報 503，僅回 `migration: 'none'` |

## Migration Plan

實作建議分四批 PR 或單一 commit（取決於規模偏好）：

1. **後端守衛 + me 擴充**（最關鍵）
   - 改 `auth.ts` requireMerchant/requireAdmin 為 async，加 DB 查詢
   - 確認 `me.get.ts` 在 merchant/admin 不存在時走 401
   - Vitest 補單元測試

2. **部署層**（獨立可先上）
   - Dockerfile entrypoint 改 shell script + `set -e`
   - 新增 `server/routes/nuxt-api/health.get.ts`
   - 新增 `server/plugins/boot-log.ts`
   - `.env.example` 補 `GIT_COMMIT_SHA`

3. **前端 middleware + redirect lock**
   - `app/middleware/merchant.ts` / `admin.ts` 改 async + me 預檢
   - `app/protocol/fetch-api/methods.ts` 加 redirect lock
   - `app/stores/3.store-self.ts` 確認 `SignOut` 清乾淨

4. **知識庫 + 驗收**
   - 更新 `.claude/knowledge/auth-and-rbac.md`、`deploy-and-env.md`
   - Playwright MCP 跑驗收劇本

### Rollback
- 守衛改動：revert commit，DB 不受影響。
- 部署層：移除 entrypoint script 改回 CMD 即可，舊行為（migration 不自動跑）恢復；缺點是要回到手動跑 migration 的狀態。
- 前端：revert 即可，無資料變更。

## Open Questions

- **是否要快取守衛 DB 結果？** 先不做，視 p99 監控。
- **`/health` 是否要進階版（檢查 Redis、R2、外部服務）？** 不在本變更，先做最小版（DB + migration + commit）。
- **`GIT_COMMIT_SHA` 注入方式**：是 Dockerfile `ARG GIT_COMMIT_SHA` + CI 帶入，或在 build 階段 `git rev-parse HEAD` 寫進 build 產物？傾向 build-arg（更通用，本地 docker build 可省）。實作時擇一即可。
- **Admin 端 me 預檢失敗的 redirect 目標**：`/sign-in?type=admin` 還是 `/sys/sign-in`？本專案目前似乎是前者，依現況。
