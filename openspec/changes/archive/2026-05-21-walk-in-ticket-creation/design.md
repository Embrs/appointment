## Context

目前號碼牌系統有兩條核心路徑：

- **顧客公開取號**：`POST /nuxt-api/public/queue/take`，在 `server/utils/queue.ts` 內以 `prisma.$transaction` + `SELECT ... FOR UPDATE` 對 `QueueCounter` 做序列化，自增 `lastTicketNumber` 後寫入 `QueueTicket`。
- **商家叫號 / 完成 / 過號**：`server/routes/nuxt-api/queue/*`，僅做狀態流轉，不負責建票。

`take.post.ts` 包含的職責超過單純「拿號」：QueueWindow 時間校驗、RateLimit、`bookingMode=QUEUE` 校驗、Counter 序列化、唯一鍵防併發、廣播。要替商家開「現場登記」入口，若直接複製整段邏輯到新端點，會出現兩份 Counter / advisory lock 實作彼此漂移的風險（既有經驗：併發拿號 = 系統正確性最敏感的部分）。

另一方面，商家代建有兩個本質性差異：
1. **電話可省略**：櫃台情境下店員不一定能/想拿到顧客電話
2. **時間窗可忽略**：店員需要在午休或開門前替剛到的客人預先建票

因此 schema 與校驗策略必須有對應的彈性，但不能波及顧客公開端的嚴格度。

## Goals / Non-Goals

**Goals:**
- 把 Counter 序列化 + advisory lock + 唯一鍵防併發抽到一支共用純函式，讓兩條路徑共享，避免維護兩份。
- 為商家提供一個 minimal 的「現場登記」入口，UI 流程不超過「點按鈕 → 填三欄 → 送出 → 顯示號碼 + 可列印」。
- 在 `QueueTicket` 上保留「來源」可審計性（`createdByMerchant`），未來報表 / 對帳可區分。
- 列印小單先做純文字版（後續 Change C 會在小單上加 QR Code，避免本 change 同時動列印佈局又動 QR）。

**Non-Goals:**
- **不**改 `BookingMode` enum、**不**改 `Service.avgServiceMinutes` / `claimToken` / `display` 頁（屬 Change B/C/D）
- **不**改顧客公開端的時間窗 / RateLimit / 「同人同日重複領號」規則
- **不**改 WebSocket 廣播協定（仍用既有 `TICKET_TAKEN`）
- **不**改既有叫號 / 完成 / 過號 / 當日總覽端點
- **不**為「沒留電話的票」設計「顧客自助查回票」流程（用 `phoneLast4` 找票天生需要電話；櫃台代建沒電話的票，回票責任由櫃台承擔）

## Decisions

### Decision 1：抽出 `internalCreateTicket()`，而非把公開端複製貼上

**選擇**：在 `server/utils/queue.ts` 新增 `internalCreateTicket(input, { tx?, broadcast? })` 純函式，接受已通過外層校驗的輸入，只負責 Counter 鎖 + 寫票 + 廣播。

**理由**：
- Counter 序列化是整個系統的單一正確性熱點。重複實作 = 雙倍出 bug 機會。
- 兩條路徑的「外層校驗」是發散的（時間窗 / RateLimit 公開端有、商家端沒有；身份驗證商家端有、公開端沒有），但「內層拿號」是收斂的。
- 純函式好寫測試；既有 `availability` 模組的測試風格可直接沿用。

**Alternative considered**：在 `take.post.ts` 加一個 `bypassWindow: boolean` 參數讓商家端共用。否決，因為這會把「身份驗證 / 路由語意」混進「拿號」邏輯，模糊端點責任邊界。

### Decision 2：`customerPhone` 改 nullable，而不是用空字串

**選擇**：`QueueTicket.customerPhone: String?`（Prisma 中改成 `String?`）。

**理由**：
- 空字串會污染現有以 `phone` 為條件的查詢（特別是 `public/queue/find` 的「同末 4 碼」），nullable 在 SQL 層意義更乾淨。
- 既有資料目前都是非空字串，遷移時直接放 nullable 即可，無需 backfill。

**對下游的影響**：
- `public/queue/find.post.ts` 已用 `phone ENDSWITH phoneLast4`，phone 為 null 自然查不到（符合預期，店員代建的票顧客自助查不到）。
- 「同人同日重複領號」規則（`MSG_QUEUE_ALREADY_TAKEN`）僅在 phone 非 null 時觸發；商家代建沒留電話 = 不套用此規則。

### Decision 3：新增 `createdByMerchant Boolean @default(false)`

**理由**：
- 預留來源審計欄位，未來報表 / 異常追查 / 行為分析需要區分。
- 預設 `false` 不影響既有資料、不影響任何既有查詢。
- 不另開一個 `enum TicketSource`，避免過度設計；目前只有兩種來源，bool 即可。

### Decision 4：商家代建端跳過 `isWithinQueueWindow`，但保留 `maxTickets`

**選擇**：`create-for-customer.post.ts` **不**校驗 `QueueWindow` 的時間區間，但仍校驗該 service 當日 `maxTickets`。

**理由**：
- 跳時間窗是這個 change 的明確使用情境（午休 / 提前到 / 延誤補單）。
- 但 `maxTickets` 是商家自己設定的「當日承載量」，連店員都應遵守；如果想超過上限，請改 QueueWindow 設定。

### Decision 5：列印用 `window.print()` + `@media print`，不引入第三方列印 lib

**選擇**：彈窗成功 toast 旁附「列印小單」按鈕，按下後呼叫 `window.print()`；小單 DOM 用一個固定隱藏 `<div class="print-only">`，搭配 `@media print` 隱藏其他元素。

**理由**：
- 本 change 列印內容極簡（商家名 + 服務名 + 號碼 + 時間），無需熱感印表機驅動。
- 後續 Change C 會把 QR Code 加進來；改用第三方 lib 會綁死後續決策。
- 純 CSS 列印讓本地測試門檻最低（不需要實體印表機，可用「另存 PDF」驗證）。

### Decision 6：UI 入口放在 admin/queue.vue 每張 Service 卡上，而不是頁面右上角

**理由**：
- 「現場登記」與「服務」是 1:1 關係，從卡片上進去語意自然、不需再選一次 service。
- 頁面右上角適合放跨服務的工具按鈕（後續 Change D 的「大螢幕模式」就會放那）。

## Risks / Trade-offs

| 風險 | 緩解 |
|------|------|
| 抽 `internalCreateTicket()` 時動到公開端，可能引入 regression | 既有 `__tests__` 已覆蓋 availability，本次同步補 `queue.test.ts` 對 `internalCreateTicket` 做併發測試（兩個 promise 同時呼叫，確認號碼不重） |
| `customerPhone` 改 nullable 後，部分 TypeScript 推導從 `string` 變 `string \| null`，可能在前端出現 `.slice(-4)` 之類的 runtime 錯 | 全文搜尋 `customerPhone`、`phoneLast4` 相關用法逐一補 nullable 防呆；前端 `queue/find` 與 status 頁的展示均要可承受 null |
| 跳過 `isWithinQueueWindow` 後，店員若在「QueueWindow=全停用」的服務上代建，會繞過商家自己設定的「今日不接號碼牌」意圖 | 在 `create-for-customer.post.ts` 仍校驗「該 service 至少有一筆 QueueWindow（不論是否啟用、不論是否在區間內）」+「`maxTickets` 仍生效」；若整個服務的 QueueWindow 為空陣列，視為「商家明確關閉此服務的號碼牌」，回 `MSG_QUEUE_WINDOW_CLOSED` |
| 列印小單跨瀏覽器差異（Safari 列印對 `@media print` 寬度處理較寬鬆） | 小單樣式用 `mm` 單位 + `width: 80mm`（適配常見熱感印表機紙寬），多瀏覽器以「另存 PDF」驗證即可 |
| `createdByMerchant` 預設 false，若未來「QueueTicket 來源」需要四種以上分類，bool 會不夠 | 紀錄此風險；屆時改 enum 並 migrate；目前 YAGNI |

## Migration Plan

1. **DB migration**：`prisma migrate dev --name walk_in_ticket`，產生兩個 DDL：`ALTER COLUMN customer_phone DROP NOT NULL` + `ADD COLUMN created_by_merchant BOOLEAN NOT NULL DEFAULT false`。對既有資料無破壞性（既有非空 phone 仍合法、新欄位帶預設值）。
2. **部署順序**：
   - Step 1：先部署 schema + 後端（公開端委派 `internalCreateTicket`、新增商家端）→ 既有顧客流程不變
   - Step 2：再部署前端（admin/queue.vue 加按鈕、新彈窗）
3. **Rollback**：若上線後發現 `internalCreateTicket` 抽函式有 bug，前端按鈕可先用 feature flag 隱藏；schema 變更可保留（向下相容），只 revert server 程式碼即可。
4. **資料一致性**：本 change 不動既有資料，只擴展 schema；不需要寫 backfill。

## Open Questions

- **沒留電話的票，顧客若想自助查詢狀態怎麼辦？**
  目前回答：交由櫃台口頭告知或由店員以裝置展示 status 頁；本 change 不為這類票增加自助查詢路徑（`phoneLast4` 流程天生需要電話）。
- **是否要在 `QueueTicket` 上同時記錄「代建的店員身分」？**
  目前不做。`requireMerchant` 解析出的 `merchantId` 已可追蹤帳號層級；若未來想細到員工層級，再加 `createdByStaffId` 欄位。
- **列印小單 CSS 細節（字級、間距）的最終樣板**
  以本 change 純文字版為基準，預留位置給 Change C 的 QR Code 區塊；最終視覺於 implementation phase 再迭代。
