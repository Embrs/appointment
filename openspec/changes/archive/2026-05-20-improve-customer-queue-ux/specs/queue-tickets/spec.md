## ADDED Requirements

### Requirement: 顧客端最近票紀錄自動還原

The customer queue landing page SHALL persist the most recent ticket(s) of the current day into client-side `localStorage` (key `customerQueueRecent`) and automatically prompt the customer to return to the waiting page when re-entering the page on the same device.

Stored fields per ticket: `{ slug, merchantId, ticketId, ticketNumber, ticketDate, serviceId, serviceName, phoneLast4, takenAt }`. Entries with `ticketDate !== today (merchant timezone of the device clock)` MUST be filtered out on read. The list MUST be capped at 20 entries to avoid unbounded growth.

#### Scenario: 領號後寫入 localStorage

- **GIVEN** 顧客在 `/m/[slug]/queue` 領號成功
- **WHEN** 前端收到 `{ ticketId, ticketNumber }`
- **THEN** 前端寫入 `localStorage.customerQueueRecent`（陣列 push 一筆）並導向 status 頁

#### Scenario: 重新進入領號頁時自動還原

- **GIVEN** localStorage 內有當日同 slug 的 ticket 紀錄
- **WHEN** 顧客重新進入 `/m/[slug]/queue`
- **THEN** 頁面頂端顯示「你今天已有 N 號 - 回到等待頁」橫幅，含一鍵跳轉按鈕

#### Scenario: 跨日紀錄自動失效

- **GIVEN** localStorage 內有昨日紀錄
- **WHEN** 顧客今日進入領號頁
- **THEN** 不顯示橫幅，並在讀取時將跨日紀錄從陣列移除

#### Scenario: localStorage 解析失敗自我修復

- **GIVEN** localStorage 內容已被破壞或格式不符
- **WHEN** 前端讀取
- **THEN** 不拋例外、不影響領號流程，並重置 `customerQueueRecent` 為空陣列

### Requirement: 顧客端手機末 4 碼查回票

The system SHALL provide a public endpoint `POST /nuxt-api/public/queue/find` and a customer-facing page `/m/[slug]/queue/find` to recover a customer's today ticket using `{ slug, serviceId, phoneLast4 }`, without exposing other customers' tickets or personal data.

The endpoint MUST: (a) match QueueTicket where `merchantId` belongs to `slug`, `serviceId` matches, `ticketDate = today (merchant timezone)`, `phone` ends with `phoneLast4`, **`status IN ('WAITING','CALLED')`**（只查進行中的票，避免已結束的票造成假性 ambiguous）; (b) return only `{ ticketId }` on single match; (c) NOT leak full phone, lastName, or title in any response.

#### Scenario: 單筆命中

- **GIVEN** 當日該服務只有一張**進行中**（status=WAITING 或 CALLED）的票其 phone 末 4 碼吻合
- **WHEN** POST `/nuxt-api/public/queue/find` 帶 `{ slug, serviceId, phoneLast4 }`
- **THEN** 回 `{ ticketId }`，前端導向 `/m/[slug]/queue/status?id=...`

#### Scenario: 多筆進行中命中視為模糊

- **GIVEN** 當日同服務有多張**進行中**（WAITING/CALLED）的票其 phone 末 4 碼吻合
- **WHEN** POST find
- **THEN** 回 400 `MSG_QUEUE_FIND_AMBIGUOUS`，前端提示顧客至櫃台出示手機協助核對

#### Scenario: 已結束的票不影響命中判斷

- **GIVEN** 當日有 3 張同末 4 碼的票，其中 2 張為 DONE/SKIPPED、1 張為 WAITING
- **WHEN** POST find
- **THEN** 視為單筆命中（已結束的票被排除），回 `{ ticketId }` 為 WAITING 那張

#### Scenario: 無命中

- **GIVEN** 當日無進行中的票符合（或所有同末 4 碼的票皆已結束）
- **WHEN** POST find
- **THEN** 回 404 `MSG_QUEUE_FIND_NOT_FOUND`

#### Scenario: 非數字輸入

- **WHEN** POST find 帶 `phoneLast4 = "abcd"` 或長度非 4
- **THEN** 回 400 `MSG_QUEUE_FIND_INVALID`

#### Scenario: RateLimit 防猜

- **WHEN** 同 IP 1 分鐘內第 6 次 POST find
- **THEN** 回 429 + `Retry-After`

#### Scenario: 失敗過多臨時鎖

- **GIVEN** 同 IP 連續 10 次得到 `NOT_FOUND` 或 `INVALID`
- **WHEN** 第 11 次 POST find
- **THEN** 在 5 分鐘內回 429，提示稍後再試

#### Scenario: 回應不洩漏完整資料

- **GIVEN** 任意 find 結果（命中或模糊或無）
- **WHEN** 顧客拿到 response
- **THEN** body 內絕不包含 `phone`、`lastName`、`title` 任一欄位

### Requirement: 顧客端全螢幕叫號蓋層

When the customer's own ticket transitions to `CALLED`, the waiting page SHALL display a full-viewport overlay with high-contrast colour, oversized ticket number, and an i18n-aware primary message indicating that the customer is being called. The overlay MUST be reachable on viewport widths down to 320px without horizontal overflow.

#### Scenario: 進入 CALLED 觸發蓋層

- **GIVEN** 顧客在 `/m/[slug]/queue/status` 等待，自己的票 `status=WAITING`
- **WHEN** 商家叫到自己的號碼（透過 WS `CALL_NEXT` 或 15s 輪詢推進 `currentServing`）
- **THEN** status 頁立即覆蓋全螢幕蓋層，主訊息顯示「該你了 / It's your turn / あなたの番です」、副訊息「請至櫃台」、號碼字級至少 viewport 短邊的 40%

#### Scenario: 蓋層含 dismiss 按鈕

- **GIVEN** 蓋層已顯示
- **WHEN** 顧客點「我知道了」
- **THEN** 蓋層隱藏，底層 status 頁仍顯示完整資訊；ticket 狀態仍為 CALLED

#### Scenario: DONE/SKIPPED 自動退出

- **GIVEN** 蓋層顯示中
- **WHEN** 後端推播 `TICKET_DONE` 或 `TICKET_SKIPPED`
- **THEN** 蓋層自動消失並顯示對應收尾畫面

#### Scenario: 動畫不無限刺激

- **GIVEN** 蓋層出現
- **WHEN** 載入背景脈動動畫
- **THEN** 動畫最多執行 3 個循環後停止；背景色保持靜態高對比

#### Scenario: prefers-reduced-motion 降級

- **GIVEN** 裝置設定 `prefers-reduced-motion: reduce`
- **WHEN** 蓋層出現
- **THEN** 不執行脈動動畫，僅保留靜態高對比配色

#### Scenario: 320px 不溢出

- **GIVEN** 螢幕寬度 320px
- **WHEN** 蓋層渲染含三語訊息
- **THEN** 主訊息與副訊息皆不發生水平溢出（必要時自動換行或縮小字級）

### Requirement: 顧客端被叫號時更新分頁標題

While the customer's ticket is in `CALLED` state, the document title SHALL be prefixed with an attention marker so that a browser tab in the background is visually distinguishable.

#### Scenario: 進入 CALLED 改 title

- **GIVEN** 顧客票 status=CALLED
- **WHEN** Vue 渲染完成
- **THEN** `document.title` 為 `🔔 該你了 - {serviceName} - 您的號碼 {N}`（三語各自的格式）

#### Scenario: 離開 CALLED 還原 title

- **GIVEN** title 含鈴鐺前綴
- **WHEN** ticket 變為 DONE 或 SKIPPED 或顧客離開頁面
- **THEN** title 恢復為等待頁原 title

### Requirement: 顧客端等待進度視覺化

The waiting page SHALL render a four-segment visual progress indicator showing `start → currentServing → myNumber → totalTaken`, with a label exposing how many people are ahead of the customer.

#### Scenario: 正常等待呈現

- **GIVEN** `myNumber=8`、`currentServing=5`、`totalTaken=10`
- **WHEN** 渲染進度條
- **THEN** 進度條顯示四個節點、目前叫號指示器位於 5、自己的指示器位於 8、徽章顯示「前面還有 2 位」

#### Scenario: 尚未開始叫號

- **GIVEN** `currentServing=0`
- **WHEN** 渲染進度條
- **THEN** 顯示「尚未開始叫號」標籤，目前叫號指示器置於起點

#### Scenario: 自己已過號

- **GIVEN** `myNumber=3`、`currentServing=5`、且自身 status 不是 CALLED
- **WHEN** 渲染進度條
- **THEN** 自己的指示器顯示為「已過號」樣式，並提示「您的號碼已過、請聯絡店家或重新領號」

#### Scenario: 推進動畫

- **GIVEN** `currentServing` 由 4 變為 5
- **WHEN** 前端收到推播
- **THEN** 目前叫號指示器以 ≤ 0.8 秒平滑過渡到新位置

### Requirement: 顧客端連線狀態四態反饋

The customer waiting page SHALL surface one of four explicit connection states — `live`, `reconnecting`, `fallback`, `offline` — each with a distinct, accessible visual. Transitions between states MUST be debounced by at least 1.5 seconds to prevent UI flicker on transient network blips.

#### Scenario: live 狀態

- **GIVEN** WS 已成功連線
- **THEN** 顯示細條綠色提示「即時更新中」

#### Scenario: reconnecting 倒數

- **GIVEN** WS 剛斷線
- **WHEN** 等待重連
- **THEN** 顯示橙色 banner「連線中斷，N 秒後重試」、N 每秒遞減；含「立即重試」按鈕

#### Scenario: fallback 提示

- **GIVEN** WS 重連連續失敗 3 次
- **WHEN** 仍透過 15s 輪詢取得更新
- **THEN** 顯示灰色 banner「即時連線不穩，仍會自動更新」

#### Scenario: offline 偵測

- **GIVEN** `navigator.onLine === false`
- **THEN** 顯示紅色 banner「裝置目前離線」，覆蓋其他連線狀態

#### Scenario: 短瞬斷不抖動

- **GIVEN** WS 斷線 500 毫秒後自動重連成功
- **WHEN** UI 處理
- **THEN** UI 不切換到 reconnecting，仍維持 live（受 debounce 保護）

#### Scenario: 手動立即重試

- **GIVEN** 處於 reconnecting 或 fallback 狀態
- **WHEN** 顧客點「立即重試」
- **THEN** 前端立即關閉舊 WS 並重新嘗試連線一次

### Requirement: 顧客端完成與跳號收尾畫面

When the customer's ticket reaches `DONE` or `SKIPPED`, the waiting page SHALL display a dedicated closing screen with an explicit status indicator and at least one clear call-to-action.

#### Scenario: DONE 收尾畫面

- **GIVEN** 顧客票 status=DONE
- **WHEN** 渲染 status 頁
- **THEN** 顯示綠色勾選圖示、訊息「服務完成，謝謝您」、CTA「回首頁」與「重新領號」

#### Scenario: SKIPPED 收尾畫面

- **GIVEN** 顧客票 status=SKIPPED
- **WHEN** 渲染 status 頁
- **THEN** 顯示橙色提示圖示、訊息「您的號碼已被跳過」、CTA「重新領號」「聯絡店家」

#### Scenario: 收尾畫面停用 WS 蓋層

- **GIVEN** DONE 或 SKIPPED 顯示中
- **WHEN** WS 因為後續其他票推播而變動
- **THEN** 不再彈出叫號蓋層（蓋層僅綁定自己的 CALLED）

### Requirement: 顧客端號碼牌 i18n 完整三語覆蓋

All customer-facing text introduced or modified in this change SHALL exist in `zh`, `en`, and `ja` locale files under the `queue.page.*` namespace. Layouts MUST not break for any locale at viewport widths down to 320px.

#### Scenario: 三語 key 齊備

- **WHEN** 啟動應用並切換語系
- **THEN** 所有新文案 key 在 `zh / en / ja` 三檔皆有對應字串，無回退到 key 名稱的情形

#### Scenario: 全螢幕叫號三語不溢出

- **GIVEN** 320px 寬度螢幕
- **WHEN** 分別以 zh / en / ja 渲染全螢幕叫號蓋層
- **THEN** 主訊息與副訊息均不水平溢出
