## Why

號碼牌目前只能由顧客端公開取號（`POST /public/queue/take`），商家後台 `admin/queue.vue` 只能叫號、無法替「走進來的客人」建立號碼牌。實務上這阻塞了三類情境：(1) 沒帶手機或不會操作手機的長輩來店；(2) 預約已到、但因故延誤被轉領號的客戶；(3) 純 walk-in 客在櫃台請店員代為登記。本變更為第一線櫃台補上「現場登記」入口，同時把公開取號與商家代建的核心邏輯抽到共用函式，避免兩條路線各自維護一份 Counter / advisory lock 的脆弱實作。

## What Changes

### 資料模型
- `QueueTicket.customerPhone` 改為 nullable（商家代建容許「不留電話」）
- `QueueTicket` 新增 `createdByMerchant Boolean @default(false)`，用以區分票券來源
- 建立 Prisma migration（不破壞既有資料；現有 `customerPhone` 全為非空字串）

### 後端
- `server/utils/queue.ts` 新增 `internalCreateTicket()` 純函式：封裝 Counter `FOR UPDATE`、advisory lock、唯一鍵防併發、廣播 `TICKET_TAKEN` 的核心流程
- `server/routes/nuxt-api/public/queue/take.post.ts`：薄殼化，校驗 `isWithinQueueWindow / maxTickets / RateLimit` 後委派 `internalCreateTicket`
- 新增 `server/routes/nuxt-api/queue/create-for-customer.post.ts`：
  - `requireMerchant` 守衛、只能對自己旗下的 service 操作
  - 輸入 `{ serviceId, lastName, title, phone? }`（phone 可省略）
  - **跳過 `isWithinQueueWindow` 校驗**（商家可在時間窗外協助補單）
  - 仍校驗 `maxTickets`、服務必須為 `bookingMode=QUEUE`、同人同日重複領號規則（phone 為 null 時不套用此規則）
  - 委派 `internalCreateTicket`，廣播 `TICKET_TAKEN`
- 三語訊息（`MSG_QUEUE_FULL` / `MSG_NOT_QUEUE_SERVICE` / `MSG_QUEUE_ALREADY_TAKEN` / `MSG_SERVICE_NOT_FOUND`）沿用既有 key

### 前端
- `app/protocol/fetch-api/api/queue/`：新增 `CreateQueueTicketForCustomer` 的型別、ApiCall、mock
- 新增 `app/components/open/dialog/queue-walk-in.vue`：表單欄位 `lastName / title / phone?`；提交成功後以 toast 顯示「已領號 A12」並提供「列印小單」按鈕（`window.print()` + `@media print` CSS，純文字版，後續 Change C 再加 QR Code）
- `app/pages/admin/queue.vue`：每張 Service 卡新增「現場登記」按鈕，開啟 `queue-walk-in` 彈窗
- i18n (`zh / en / ja`) 新增 `queue.walkIn.title / queue.walkIn.fields.* / queue.walkIn.actions.* / queue.walkIn.printTicket`

### 知識庫與規格
- 更新 `.claude/knowledge/queue-realtime.md`「後端 API 範圍」表格與「領號流程」段落
- 更新 `openspec/specs/queue-tickets/` 對應 spec：把 `顧客拿號` 拆出商家代建分支，新增「商家現場代客領號」需求

## Capabilities

### New Capabilities
（無）

### Modified Capabilities
- `queue-tickets`：把「拿號」這條需求從「只有公開端」擴展為「公開端 + 商家代建端」兩條路徑，新增商家現場登記需求、放寬 `phone` 可為 null 的規範、新增 `createdByMerchant` 來源標記

## Impact

### 受影響檔案（程式碼）
- `prisma/schema.prisma` — `QueueTicket.customerPhone` 改 nullable、新增 `createdByMerchant`
- `prisma/migrations/<timestamp>_walk_in_ticket/` — 新 migration
- `server/utils/queue.ts` — 抽出 `internalCreateTicket()` 共用函式
- `server/routes/nuxt-api/public/queue/take.post.ts` — 委派至共用函式
- `server/routes/nuxt-api/queue/create-for-customer.post.ts` — **新增**
- `app/protocol/fetch-api/api/queue/index.ts` + `type.d.ts` + `mock.ts` — 新增 `CreateQueueTicketForCustomer`
- `app/components/open/dialog/queue-walk-in.vue` — **新增**
- `app/components/open/_index.d.ts` / `index.ts` — 註冊新 dialog
- `app/pages/admin/queue.vue` — 每張卡片加「現場登記」按鈕
- `i18n/locales/zh.js | en.js | ja.js` — 新增 `queue.walkIn.*`
- `.claude/knowledge/queue-realtime.md` — 同步知識庫
- `openspec/specs/queue-tickets/spec.md` — 同步 spec（由 archive 階段套用 delta）

### 不受影響
- `Service.avgServiceMinutes / claimToken / display 頁` — 由後續 Change B / C / D 處理
- `BookingMode` enum — 不變
- 顧客公開端的 `QueueWindow` / `RateLimit` / 「同人同日重複領號」規則 — 行為不變
- WebSocket 廣播協定 — 不變（仍使用 `TICKET_TAKEN`）
- 顧客查詢票、叫號、完成 / 過號、當日總覽 — 均不變
