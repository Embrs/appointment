## Why

顧客端號碼牌目前可以正常領號、即時更新，但實地以顧客視角試走後，存在三個關鍵體驗缺口：

1. **領完號就斷線**：顧客拿到號碼牌後若關掉分頁、清掉快取、或被簡訊／LINE 打斷，回到 `/m/[slug]/queue` 看到的是領號頁而非自己的號碼，沒有任何「我剛剛幾號？」的回口。
2. **叫號訊號太弱**：被叫到時只有頂端「目前叫號」數字變動，主視覺仍維持平靜配色，顧客若沒盯著螢幕極易錯過。
3. **資訊密度不足**：等待頁只有「前面還有 N 位」的純文字，沒有視覺化進度感；連線中斷時也僅以小角落 chip 表示，重連倒數不明顯，造成「畫面到底有沒有在更新」的焦慮。

這些都是已上線顧客面的高頻體驗痛點，且全部能在不動 schema 的前提下處理掉，是性價比很高的一輪打磨。

## What Changes

### 領號回流（解決 1）
- 領完號後將 `{ slug, ticketId, ticketDate, phoneLast4 }` 寫入 `localStorage`（命名：`customerQueueRecent`），跨日／跨 service 以陣列保存，按 `ticketDate` 自動過期。
- `/m/[slug]/queue` 進入時自動掃 localStorage，若有今日同 slug 的有效 ticket，顯示「你今天已有 X 號 - 回到等待頁」的醒目橫幅，點擊一鍵跳回 `status`。
- 新增「找回我的號碼」入口：顧客面 `/m/[slug]/queue/find` 輸入手機末 4 碼 + 選擇服務，後端比對當日 ticket 後回傳 `ticketId`；用於跨裝置／清快取後的兜底救援。
- 新增公開 endpoint `POST /nuxt-api/public/queue/find`（不動 schema，純讀；RateLimit 比照 take 收緊：每 IP 5/分鐘）。

### 叫號強化（解決 2）
- 被叫到（`status=CALLED` 且為自己）時，等待頁切換為「全螢幕叫號模式」：滿版高對比色（warning 漸層）、號碼放大到 viewport 60%、主訊息「該你了 / It's your turn / あなたの番です」、副訊息「請至櫃台」。
- 進入叫號模式時觸發 5 秒節流的全頁背景閃光動畫（CSS keyframes，3 次脈動後停止避免長期刺激）。
- 切換 tab 回來時若期間有被叫到，標題列加上 `🔔 該你了 -` 前綴讓背景分頁也能感知（用 `document.title` 與 `visibilitychange`）。
- **不做**聲音與震動（使用者本輪未要求；iOS Safari 自動播放與 vibrate 支援度差，留待後續評估）。

### 資訊密度與連線狀態（加碼 1、2）
- 等待頁主卡片下加入「等待進度條」：基於 `currentServing` / `myNumber` / `ticketsTaken`，呈現「起始 → 目前叫號 → 你 → 隊尾」四段視覺；含「前面還有 N 位」徽章與「剛剛叫了 X 號」即時 toast。
- 連線狀態 chip 升級為更顯眼的 banner：
  - WS 正常 → 細條綠色（淡化、不打擾）
  - WS 斷線 → 橙色 banner「連線中斷，N 秒後重試」+ 倒數秒數（接 `UseWS` 的 reconnectInterval）+ 手動重試按鈕
  - 兜底輪詢中（WS 失敗但 15s 輪詢有 fetch 成功）→ 灰色提示「即時連線不穩，仍會自動更新」
- 已完成（`DONE`）與被跳號（`SKIPPED`）狀態給專屬收尾畫面（綠勾／橙色提示），含明確 CTA「重新領號」或「回首頁」。

### i18n 與 RWD
- 所有新文案皆新增 `zh / en / ja` 三語 key（locale 檔在 `i18n/locales/`），叫號文案在大字尺寸下確認三語字寬不溢出。
- 全螢幕叫號模式、進度條、找回頁皆在 320–414px 手機寬度下驗證。

## Capabilities

### New Capabilities
（無；本變更為純 UX 強化，沒有跨領域的新能力）

### Modified Capabilities
- `queue-tickets`: 公開 API 端新增 `POST /public/queue/find`（手機末 4 碼查號）；顧客等待頁 UI 行為（叫號模式、進度條、連線狀態、收尾畫面）新增 spec scenarios；新增 localStorage 客戶端 recent ticket 還原機制（前端行為要納入 spec）。

## Impact

### 程式碼
- `app/pages/m/[slug]/queue/index.vue` — 加入 recent ticket 自動還原橫幅。
- `app/pages/m/[slug]/queue/status.vue` — 叫號全螢幕模式、進度條、連線 banner、收尾畫面、document.title 切換。
- `app/pages/m/[slug]/queue/find.vue` — **新增**找回號碼頁。
- `app/components/biz/QueueDisplay.vue` — 加入 highlight 強化模式。
- `app/components/biz/QueueProgress.vue`（**新增**）— 進度條視覺化組件。
- `app/components/biz/QueueCallOverlay.vue`（**新增**）— 全螢幕叫號蓋層。
- `app/stores/7.store-queue-realtime.ts` — 暴露 reconnect 倒數秒數、ws-state enum（`live / reconnecting / fallback / offline`）。
- `app/protocol/fetch-api/api/queue/` — 新增 `FindQueueTicket` 介面。
- `server/routes/nuxt-api/public/queue/find.post.ts` — **新增**公開查詢端點。
- `i18n/locales/zh.js | en.js | ja.js` — 補三語文案。

### 資料庫
- **無 schema 變動**。不新增欄位、不新增表、不修改現有約束。

### 部署同步
- 因無 migration，測試站與正式站升級即生效；不需要額外的同步腳本。
- 既有 Railway release 階段的 `prisma migrate deploy` 流程不受影響。

### 風險
- localStorage 跨裝置不同步：以「找回我的號碼」頁兜底，雙保險。
- 全螢幕叫號蓋層干擾性：限定僅 `status=CALLED` 且為自己時觸發，DONE/SKIPPED 後自動退出；閃光動畫 3 次後停止。
- 連線 banner 反覆閃爍：debounce 1.5 秒避免短瞬斷連造成 UI 跳動。
