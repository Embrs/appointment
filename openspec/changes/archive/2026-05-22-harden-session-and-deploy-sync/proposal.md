## Why

開啟 `http://localhost:3000/admin` 時，所有 merchant 相關 API（`/nuxt-api/merchant`、`/service`、`/resource`、`/appointment` …）一律回 404「資源不存在」，登出後重新登入即正常。根因是 reseed 或部署新 schema 後 `merchant.id`（CUID）已換新，但 cookie 內舊 JWT 殘留：後端 `requireMerchant` 只驗 JWT 格式不查資料庫、業務端點查不到 merchant 回 404、前端 `onResponseError` 只處理 401 不會清 token、middleware 進站前也不主動驗 session，導致使用者「看到滿屏 404」而非「被自動踢回登入頁」。此問題在每次測試/正式站部署遷移後都會重演，必須一次性把 session 失效偵測與部署同步流程一起補強。

## What Changes

- **後端守衛強化**：`requireMerchant` / `requireAdmin` 在 JWT 驗過後 SHALL 額外查 Prisma 確認 `merchant` / `adminUser` 仍存在（且 `deletedAt=null`、Merchant 非 SUSPENDED/REJECTED），不存在時回 **401**（非 404），讓前端既有 401 自動清 token 機制生效。
- **`/auth/me` 規格擴充**：原 `Me 自身資訊查詢` 增加「JWT 解開後 merchantId 在 DB 不存在」情境（回 401），明確標示為 middleware 進站預檢的契約。
- **前端 middleware 進站預檢**：`app/middleware/merchant.ts`、`app/middleware/admin.ts` 改為 async，進站前 `await` 呼叫 `/nuxt-api/auth/me`；失敗清 `ss_t/ss_mid/ss_type` 後 `navigateTo('/sign-in')`。
- **前端 fetch 401 處理補強**：`onResponseError` 收到 401 時 SHALL 完整清除 `StoreSelf` 所有身分相關 cookie（`ss_t`、`ss_mid`、`ss_type`）後再 redirect，避免遺漏。
- **部署層自動跑 migration**：Dockerfile / Railway release command 啟動時 SHALL 自動執行 `npx prisma migrate deploy`；若失敗 SHALL 中止啟動（exit code 非 0），避免進入 schema 與程式碼不一致的半套狀態。
- **健康檢查端點**：新增 `GET /nuxt-api/health`，回報 DB 連線狀態 + 最新已套用 migration 名稱 + commit hash，給 Railway/監控用。
- **啟動日誌**：Nitro 啟動時 SHALL 印出當前 migration 版本與 commit hash，方便確認部署到位。
- **非變更**：不把 404 全域改 401；僅在「身分驗證類查不到自己」改回 401。其他資源（找不到某個 service 等）維持 404。

## Capabilities

### New Capabilities

無。本變更全部落在既有 capability 內。

### Modified Capabilities

- `auth-flow`：新增「守衛資料庫存在性驗證」「Middleware 進站 me 預檢」「401 全域清 token 行為」三個 Requirement；修改既有「Me 自身資訊查詢」Requirement，補上「Merchant/Admin 在 DB 不存在」情境。
- `finalize-deploy`：修改既有「Docker 與部署可重現」Requirement，明確標示 `prisma migrate deploy` 失敗中止；新增「健康檢查端點 `/nuxt-api/health`」與「啟動日誌印出 migration 與 commit hash」兩個 Requirement。

## Impact

**程式碼**
- `server/utils/auth.ts` — `requireMerchant` / `requireAdmin` 加 DB 存在性查詢
- `server/routes/nuxt-api/auth/me.get.ts` — 確認 merchant 不存在情境也走 401
- 新增 `server/routes/nuxt-api/health.get.ts`
- `app/middleware/merchant.ts`、`app/middleware/admin.ts` — async 預檢
- `app/protocol/fetch-api/methods.ts` — 401 清 cookie 行為補強
- `app/stores/3.store-self.ts` — 補一個「完整登出/清身分」方法（若尚未統一）

**部署**
- `Dockerfile`（entrypoint / CMD）— 啟動先跑 `prisma migrate deploy`，失敗中止
- Railway / Render 等 release command 設定確認
- `nitro.config` 或 server plugin — 啟動日誌

**測試與驗收**
- Vitest：`requireMerchant` 守衛 + DB 存在性的單元測試（mock prisma）
- Playwright MCP 實機驗收：登入 → 模擬 token 失效 → 預期 redirect 登入頁 → 重新登入 → admin 全頁面 API 200
- 平台管理員（`/sys/*`）同流程也要驗

**知識庫**
- `.claude/knowledge/auth-and-rbac.md`：補守衛行為與 me 預檢段落
- `.claude/knowledge/deploy-and-env.md`：補 migrate deploy 失敗中止、health 端點、啟動日誌段落
- CLAUDE.md 受影響條目自動同步

**相依/風險**
- 守衛新增一次 DB 查詢，每個受保護 API 多一次往返；可接受（仍 < 5ms）。若想優化可加 60 秒 in-memory cache，但本次不做。
- 啟動失敗中止需確保 Railway 健康檢查不會把舊容器砍掉導致服務空窗——使用 Railway 預設的 rolling deploy 行為即可。
