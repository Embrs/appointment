## 1. 相依套件與 Schema

- [x] 1.1 在 `package.json` `dependencies` 加入 `nanoid` 與 `qrcode`，devDependencies 加入 `@types/qrcode`；執行 `npm install`
- [x] 1.2 `prisma/schema.prisma` 為 `QueueTicket` 新增欄位 `claimToken String? @unique`，於 model 區塊保持原欄位順序
- [x] 1.3 執行 `npx prisma migrate dev --name add_queue_ticket_claim_token`，確認生成的 SQL 採 partial unique index `WHERE "claimToken" IS NOT NULL`；若 Prisma 預設未產出 partial index，手工編輯 migration SQL 改寫為 partial 形式
- [x] 1.4 重新跑 `npm run postinstall`（含 `prisma generate`）並確認 `@prisma/client` 型別含 `claimToken`

## 2. 後端共用函式與生成器

- [x] 2.1 在 `server/utils/queue.ts` 新增 `generateClaimToken(): string`：以 `nanoid` 的 `customAlphabet('23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz', 8)` 實作，並 export 供未來測試
- [x] 2.2 修改 `internalCreateTicket`：在交易內 `prisma.queueTicket.create.data` 加入 `claimToken: generateClaimToken()`，並把 `select` 加上 `claimToken: true`
- [x] 2.3 為 `internalCreateTicket` 加上 `P2002` 重試一次包裝：偵測 Prisma `P2002` 且 `target` 含 `claimToken` 時重新呼叫整段交易；超過一次仍衝突才往外拋
- [x] 2.4 更新 `InternalCreateTicketResult` 型別，使 `result.ticket` 含 `claimToken: string`

## 3. 後端 API 端點

- [x] 3.1 `server/routes/nuxt-api/public/queue/take.post.ts`：成功 response 加 `claimToken: result.ticket.claimToken`
- [x] 3.2 `server/routes/nuxt-api/queue/create-for-customer.post.ts`：成功 response 加 `claimToken: result.ticket.claimToken`
- [x] 3.3 新增 `server/routes/nuxt-api/public/queue/claim/[token].get.ts`：
  - 讀 `event.context.params.token`、IP，逐桶呼叫 `checkRateLimit('queue-claim-ip:'+ip, 30, 60)` 與 `checkRateLimit('queue-claim-token:'+token, 20, 60)`
  - 任何桶超限回 `tooManyRequestsError` + `Retry-After`
  - 查 `prisma.queueTicket.findUnique({ where: { claimToken: token } })` 並 include service / merchant.timezone 與 counter 所需資料
  - 套用「當日 + status ∈ WAITING/CALLED」過濾，其餘一律 `notFoundError`
  - 呼叫與 `[id].get.ts` 同一段 `estimateWaitMinutes` 計算 `estimatedWaitMinutes`
  - response shape 對齊 `[id].get.ts`（不含 `customerPhone/customerLastName/customerTitle`）外加 `estimatedWaitMinutes`
- [x] 3.4 在 `app/protocol/fetch-api/api/queue/index.ts` 補上前端呼叫 helper `GetQueueClaim(token)`，對應 `app/protocol/fetch-api/api/queue/type.d.ts` 與 `mock.ts`
- [x] 3.5 把 `QueueTakeResult` / `QueueCreateForCustomerResult` 型別補上 `claimToken: string`，並確認 mock 回傳含此欄位

## 4. 前端領號 dialog 與 status 頁

- [x] 4.1 新增 `app/components/open/dialog/queue-claim-qr.vue`：接收 `{ claimToken, slug, ticketNumber }`，動態 `import('qrcode')`、render `<canvas>`，含短碼大字、三語說明，提供「我知道了」關閉鈕；載入失敗顯示 URL + 短碼 fallback
- [x] 4.2 在 `app/components/open/_index.d.ts` / `index.ts` 註冊新 dialog 並補型別 `DialogQueueClaimQrParams`
- [x] 4.3 `app/pages/m/[slug]/queue/index.vue`：領號成功後（仍走 `localStorage` 寫入流程）改為先彈出 `$open.QueueClaimQr({...})`，關閉後再導向 `status?id=...&token=...`（或只帶 token）
- [x] 4.4 `app/pages/m/[slug]/queue/status.vue`：
  - 讀 `route.query.token` 為第一優先，若存在則改打 `$api.GetQueueClaim(token)` 取代既有 `[id]` 載入路徑
  - 載入結果接到既有 `useQueueWS` / `StoreQueueRealtime` 訂閱與 ETA 顯示
  - claim 失敗（404/429）顯示一次性 ElMessage 並導向 `/m/[slug]/queue/find`
  - 確認 `?token=` 與 `?id=` 並存時以 token 為主（id 視為被覆蓋）
- [x] 4.5 `app/components/open/dialog/queue-walk-in.vue`：
  - 把 API 回應的 `claimToken` 保存進 `issued.value`
  - 在列印區塊新增 QR Code（同樣動態 import qrcode）+ 短碼 + 「掃碼追蹤」說明
  - 加入 `@media print` CSS 確保 QR ≥ 30mm、`page-break-inside: avoid`、底色純白

## 5. i18n 與知識庫

- [x] 5.1 `i18n/locales/zh.js / en.js / ja.js` 新增 `queue.claim.title / qrHint / shortCode / todayOnly / printSlip / scanToTrack / tokenExpired / fallbackToPhoneLookup` 等 key，三語一致
- [x] 5.2 更新 `.claude/knowledge/queue-realtime.md`：補上「claim token + QR Code」流程章節，描述 token 來源、status 頁雙入口、walk-in 列印 QR 流程、RateLimit 桶設定
- [x] 5.3 對 `openspec/specs/queue-tickets/spec.md` 不直接改動（由 `openspec-archive-change` 步驟在歸檔時合併本 change 的 delta）

## 6. 測試與驗收

- [x] 6.1 在 `server/__tests__/` 新增單元測試覆蓋：`generateClaimToken` alphabet 與長度、`internalCreateTicket` 寫入 token、`P2002` retry 一次的行為（可 mock prisma client）
- [x] 6.2 新增整合測試覆蓋 `GET /public/queue/claim/[token]`：當日命中、跨日 404、已 DONE 404、IP RateLimit 與 token RateLimit、回應不含個資
- [x] 6.3 `npm test` 全綠
- [x] 6.4 Playwright MCP E2E（截圖落 `screenshots/queue-claim-token-qr/`）：
  - 顧客在 `/m/{slug}/queue` 領號 → QR Code dialog 開啟 → 截圖
  - 用 `?token=xxx` URL 直接進 status 頁 → 驗證 WS 連線與 ETA 顯示 → 截圖
  - 商家 `OpenDialogQueueWalkIn` 代客領號 → 列印預覽含 QR + 短碼 → 截圖
  - token 失敗（手動改 URL）→ 顯示降級提示並導向 find 頁 → 截圖
- [x] 6.5 執行 `openspec-verify-change`，依結果補洞
- [x] 6.6 commit 訊息採 Conventional Commits 繁體中文（例：`feat(queue): 領號加發 claimToken 與 QR Code 對話框`），完成後執行 `openspec-archive-change`
