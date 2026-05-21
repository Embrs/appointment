## Why

現場領號的顧客目前必須留在店內才能掌握叫號狀態，因為個人狀態頁 (`m/[slug]/queue/status`) 仰賴手機末 4 碼回查，現場票常常根本沒留電話、或顧客記不住領號當下選的服務。讓顧客「敢離場」是現場用戶體驗的最大瓶頸，也是 walk-in 與 ETA 兩個 change 完成後的自然下一步——只要在領號當下發一張不可猜測的 claim token，並以 QR Code 印在小單上，顧客掃碼即可在自己手機上即時追蹤 ETA、收到 WS 推播，整個現場流程才能升級成「先領號、再去吃飯」的離場模式。

## What Changes

- `QueueTicket` 新增 `claimToken: String?` 欄位（unique、nullable），由 `internalCreateTicket` 在交易內以 nanoid（排除易混淆字元 `O/0/I/l`）產生 8 碼字串並寫入。
- `POST /nuxt-api/public/queue/take` 與 `POST /nuxt-api/queue/create-for-customer` 的成功回應 body 新增 `claimToken: string`，與既有欄位並列。
- 新增匿名端點 `GET /nuxt-api/public/queue/claim/[token]`：以 token 反查當日且未進入終止狀態的票，回傳 `{ ticket, estimatedWaitMinutes }`（重用 ETA 純函式），並掛上 IP RateLimit；過期 / 跨日 / 不存在皆回 `errcode: TICKET_NOT_FOUND`，不洩漏 token 是否存在的差異。
- `app/pages/m/[slug]/queue/index.vue`：領號成功後改以對話框呈現 QR Code（前端以 `qrcode` 套件 render）＋顯示 8 碼 claim short code，內容為 `https://{host}/m/{slug}/queue/status?token={claimToken}`，顧客自行掃碼即可離場追蹤。
- `app/pages/m/[slug]/queue/status.vue`：支援 `?token=xxx` query，偵測到 token 時改走 `/public/queue/claim/[token]` 載入票券（不要求手機末 4 碼），其餘 WS 訂閱與 ETA 顯示沿用 Change B 既有邏輯。
- 補強 walk-in change A 的 `queue-walk-in.vue` 列印小單：列印區塊加入 QR Code 與 8 碼短碼，並標示「掃碼即可在手機追蹤叫號」說明文字，讓商家把離場追蹤能力傳遞給走進來的顧客。
- i18n（zh/en/ja）新增 `queue.claim.title / qrHint / shortCode / printSlip / scanToTrack` 等鍵。
- 知識庫：更新 `.claude/knowledge/queue-realtime.md` 描述 claim token 流程與雙入口（手機末 4 碼 vs. token）。

## Capabilities

### New Capabilities
- 無新 capability，所有變更皆屬於既有 `queue-tickets` 範圍延伸。

### Modified Capabilities
- `queue-tickets`：QueueTicket schema、`internalCreateTicket`、`POST /public/queue/take`、`POST /queue/create-for-customer` 回應結構，新增 `GET /public/queue/claim/[token]` 端點，並調整 `m/[slug]/queue/status` 頁的進入路徑。

## Impact

- **Schema / Migration**：新增 `QueueTicket.claimToken` 唯一索引；既有票券保留 `null`，不回填。
- **後端**：`server/utils/queue.ts/internalCreateTicket`、`server/routes/nuxt-api/public/queue/take.post.ts`、`server/routes/nuxt-api/queue/create-for-customer.post.ts`、新檔 `server/routes/nuxt-api/public/queue/claim/[token].get.ts`；複用 `server/utils/availability.ts` ETA 純函式與 `server/utils/rate-limit.ts`。
- **前端**：`app/pages/m/[slug]/queue/index.vue`、`app/pages/m/[slug]/queue/status.vue`、`app/components/biz/queue-walk-in.vue`（Change A 已建立）；新增 npm 相依 `qrcode`。
- **i18n**：`i18n/locales/{zh,en,ja}.js` 新增 `queue.claim.*` 區塊。
- **不影響**：ETA 演算法（沿用 Change B `estimateWaitMinutes`）、大螢幕 display 頁（屬 Change D）、`STATIONED` 規則 / 工作人員後台流程。
- **風險**：token 一旦外洩等於可在當日匿名查票，已透過「限制當日 + 非過期 + RateLimit + 不可猜測 nanoid」三層緩解。
