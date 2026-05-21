## Why

不會用手機（或不想下載/註冊）的長輩、外地客在現場只能盯實體看板看叫號。商家現有的 admin 後台與顧客等待頁都不適合直接投到電視/平板上：admin 介面密度太高、顧客等待頁是個人視角（綁定單張票）。需要一個全螢幕、單向播放、可遠處清楚閱讀的「店面大螢幕」頁面，讓商家把任意一台裝置（電視/平板/舊筆電）投到牆上當作叫號看板，並提供可選的 TTS 語音廣播覆蓋背景噪音。

此頁不引入新後端能力，完全複用 `queue-tickets` 既有 WebSocket 廣播與 `queue-eta-display` 已上線的 ETA 欄位，是純前端展示層的擴增。

## What Changes

- 新增公開頁 `app/pages/m/[slug]/display.vue`：全螢幕（不顯示 header/footer/語系切換 chrome），以服務為單位展示「目前叫號 / 下一位 / 再下一位 / 等待人數 / 預估等待時間」。
- 訂閱 `StoreQueueRealtime`：複用既有 WS（無需新端點），`CALL_NEXT` 時觸發短動畫；`TICKET_TAKEN / DONE / SKIPPED` 即時更新等待數與下一位號碼。
- TTS 語音廣播（client only）：使用 `window.speechSynthesis`，依當前 i18n locale（zh/en/ja）讀出「請 N 號至 X 服務」文案；商家可在頁面 toolbar 切換開關（localStorage 記憶）。
- Admin 入口：`app/pages/admin/queue.vue` toolbar 新增「開啟顯示頁」按鈕，新分頁開啟 `/m/{slug}/display`；附 QR Code 彈窗方便商家用手機掃在投影設備上開啟。
- Layout 機制：`app/layouts/front-desk.vue` 新增 `displayMode` prop（或同效機制），display 頁啟用後不渲染 header 與內距，背景改為深色高對比；既有顧客頁（`/m/[slug]/*` 其他頁）不受影響。
- 響應式：主目標 1920×1080 橫向；同時保證 1280×720（小投影機）與 768×1024（直立平板）可讀且不裁切。
- i18n：在 `i18n/locales/{zh,en,ja}.js` 新增 `display.*` namespace（`calling / next / nextAfter / waiting / estimate / minutes / ttsToggle / ttsOn / ttsOff / callPhrase` 等）。

## Capabilities

### New Capabilities

無。

### Modified Capabilities

- `queue-tickets`: 新增「店面大螢幕顯示」需求（公開全螢幕看板、TTS 廣播、admin 入口、響應式斷點），其餘 WAITING/CALLED 狀態語意與 WS 廣播 payload 不變。

## Impact

- **前端頁面**：新增 `app/pages/m/[slug]/display.vue`；修改 `app/pages/admin/queue.vue`（toolbar 新增按鈕 + QR 彈窗）。
- **Layout**：`app/layouts/front-desk.vue` 擴充顯示模式（不破壞既有顧客頁）。
- **Store**：`app/stores/7.store-queue-realtime.ts` 不改 schema；若需要把「下一位、再下一位」整理成 derived getter 可在 store 加 selector（不影響既有 consumer）。
- **i18n**：`zh / en / ja` 三語各新增 `display.*` 一組鍵；TTS 文案需可帶 `{ number, serviceName }` 變數。
- **不變動**：
  - Prisma schema / migrations 不動。
  - `server/routes/nuxt-api/**` 任何端點不動（純前端 + 複用 ETA 廣播）。
  - Change A（walk-in-ticket-creation）/ B（queue-eta-display）/ C（queue-claim-token-qr，本 change 不依賴）已交付的行為不動。
- **新外部依賴（可選）**：QR Code 彈窗若需要繪 QR，沿用既有 QR Code 元件（Change C 已引入）或退而使用純前端 lib（如已存在）；不引入額外後端依賴。
- **權限**：頁面位於 `m/[slug]/*` 公開區，無認證需求；admin 入口按鈕受既有 `requireMerchant` 守衛保護。
