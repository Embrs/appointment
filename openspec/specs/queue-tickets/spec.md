# queue-tickets Specification

## Purpose
TBD - created by archiving change queue-tickets. Update Purpose after archive.
## Requirements
### Requirement: 顧客拿號

The system SHALL allow customers to take a queue ticket via public API without authentication, using the same triplet (lastName, title, phone), with concurrent-safe number assignment per (merchantId, serviceId, ticketDate).

#### Scenario: 拿號成功

- **Given** 商家 ACTIVE、服務 `bookingMode=QUEUE`、當日 QueueWindow 啟用且當前時間在窗內
- **When** 顧客 POST `/nuxt-api/public/queue/take` 帶 `slug/serviceId/lastName/title/phone`
- **Then** 後端在交易內以 `SELECT ... FOR UPDATE` 鎖 QueueCounter，自增 `lastTicketNumber`，寫入 QueueTicket，回 `{ ticketId, ticketNumber, ticketDate, currentServing }`，並廣播 `TICKET_TAKEN`

#### Scenario: 兩人同時拿號編號不重複

- **Given** 當前 lastTicketNumber=5
- **When** 兩個 request 幾乎同時提交
- **Then** FOR UPDATE 序列化兩交易，最終得到號碼 6 與 7（無重複、無跳號）

#### Scenario: 跨日重置

- **Given** 昨日 counter lastTicketNumber=20、今日尚無 counter
- **When** 顧客今日首次拿號
- **Then** 自動建立今日 counter（lastTicketNumber=0 → 1），新票號碼為 1

#### Scenario: 同人同日重複領號

- **Given** 同 phone 同日同 service 已有 status=WAITING 票
- **When** 再次 POST take
- **Then** 回 409 `MSG_QUEUE_ALREADY_TAKEN`，body 含現有 `ticketId`

#### Scenario: 非 QUEUE 模式拒絕

- **Given** 服務 `bookingMode=TIME_SLOT`
- **When** POST take
- **Then** 回 400 `MSG_NOT_QUEUE_SERVICE`

#### Scenario: 領號時間窗外

- **Given** 當日無啟用的 QueueWindow，或當前時間在窗外
- **When** POST take
- **Then** 回 400 `MSG_QUEUE_WINDOW_CLOSED`

#### Scenario: 達當日上限

- **Given** QueueWindow `maxTickets=10`、當日已發 10 張
- **When** POST take
- **Then** 回 409 `MSG_QUEUE_FULL`

#### Scenario: RateLimit 觸發

- **When** 同 IP 1 分鐘內第 6 次 take
- **Then** 回 429 + `Retry-After`

### Requirement: 顧客查詢票狀態

The system SHALL allow public lookup of a single queue ticket by id, returning the ticket state and current serving number for the same (merchantId, serviceId, ticketDate).

#### Scenario: 等待頁兜底輪詢

- **Given** 顧客有 ticketId
- **When** GET `/public/queue/[id]`
- **Then** 回 `{ ticket: { status, ticketNumber, ... }, currentServing, waitingAhead }`

#### Scenario: 票不存在

- **When** GET 未知 id
- **Then** 回 404 `MSG_QUEUE_TICKET_NOT_FOUND`

### Requirement: 商家叫號

The system SHALL allow merchants to call the next waiting ticket for a service, with concurrent-safe transition WAITING → CALLED.

#### Scenario: 叫下一號

- **Given** 商家 token、當日有 WAITING 票（最小號碼=5）
- **When** POST `/nuxt-api/queue/call-next` 帶 `serviceId`
- **Then** 鎖 counter → 找最小 WAITING 票 → 更新為 CALLED + calledAt + counter.lastCalledNumber=5；廣播 `CALL_NEXT { serviceId, current: 5, servingTicketId, timestamp }`；回該票資訊

#### Scenario: 無等待中票

- **Given** 當日所有票皆 DONE/SKIPPED 或無票
- **When** POST call-next
- **Then** 回 400 `MSG_QUEUE_NO_WAITING`

#### Scenario: 兩員工同按

- **Given** 兩個商家 tab 同時 POST call-next
- **When** 兩 request 抵達後端
- **Then** FOR UPDATE 序列化；其中一個成功進到下一號，另一個收到下下一號（或當已無 WAITING 票時收 400）；不會兩個都成功取同一號

### Requirement: 商家標記完成或過號

The system SHALL allow merchants to mark a CALLED ticket as DONE or SKIPPED, with each operation broadcasting to subscribed peers.

#### Scenario: 標完成

- **Given** ticket status=CALLED
- **When** POST `/nuxt-api/queue/[id]/done`
- **Then** status=DONE、doneAt=now()、廣播 `TICKET_DONE`；回該票

#### Scenario: 標過號

- **When** POST `/nuxt-api/queue/[id]/skip`
- **Then** status=SKIPPED、廣播 `TICKET_SKIPPED`

#### Scenario: 狀態非 CALLED

- **Given** ticket status=WAITING
- **When** POST done
- **Then** 回 400 `MSG_QUEUE_INVALID_TRANSITION`

### Requirement: 商家當日總覽

The system SHALL provide merchants with the day's tickets grouped by service, including each service's counter state.

#### Scenario: 當日總覽

- **When** GET `/nuxt-api/queue/today`
- **Then** 回 `{ services: [{ serviceId, serviceName, counter: { lastTicketNumber, lastCalledNumber }, tickets: [...] }] }`

### Requirement: WebSocket 即時推播

The system SHALL provide a WebSocket endpoint that broadcasts queue events to all peers subscribed by merchantId.

#### Scenario: 連線訂閱

- **When** 客戶端 `wss://.../nuxt-api/queue/ws?merchantId=xxx`
- **Then** 後端 `open` 事件將 peer 加入 `peerMap[merchantId]`

#### Scenario: 叫號廣播

- **When** 商家叫號觸發 `broadcastQueue(merchantId, payload)`
- **Then** 所有 `peerMap[merchantId]` 內 peer 收到 JSON `{ type, serviceId, current, servingTicketId, timestamp }`

#### Scenario: 心跳

- **When** 客戶端送 `ping`
- **Then** 後端回 `pong`

#### Scenario: 離開清除

- **When** peer 連線關閉
- **Then** 從 `peerMap[merchantId]` 移除；空 set 自動清除

### Requirement: 顧客等待頁 WS 兜底

The customer waiting page SHALL connect via WebSocket for live updates and fall back to 15-second polling if disconnected.

#### Scenario: WS 推播即時更新

- **Given** 等待頁已連線、自己的票號=5
- **When** 商家叫號 5
- **Then** 等待頁無需手動重整即顯示「服務中：5、請進入」

#### Scenario: WS 斷線輪詢兜底

- **Given** WS 因網路問題斷線、自己的票號=5
- **When** 商家叫號 5
- **Then** 等待頁透過每 15 秒 `GET /public/queue/[id]` 取得最新 currentServing，最遲 15 秒內顯示「服務中：5」

### Requirement: 商家叫號頁

The merchant queue page SHALL display the current serving number for each QUEUE service and provide controls to call next, mark done, and skip.

#### Scenario: 控制台呈現

- **Given** 商家當日有 QUEUE 服務 A（current=5）、服務 B（current=3）
- **When** 進入 `/admin/queue`
- **Then** 顯示兩張卡，各自大顯示當前 current、列出該服務 WAITING 票、提供「叫下一號/完成/過號」按鈕

#### Scenario: 自身叫號後即時更新

- **When** 點「叫下一號」成功
- **Then** 該卡 current 更新、票列表移除被叫的票；同時其他 tab（含顧客等待頁）收到 WS 推播

### Requirement: 領號頁

The customer queue landing page SHALL list QUEUE-mode services, display current serving number with live updates via WebSocket, and allow taking a ticket via triplet form.

#### Scenario: 列服務

- **Given** 商家有多個服務，僅 2 個是 QUEUE
- **When** 訪客進入 `/m/{slug}/queue`
- **Then** 僅顯示 2 個 QUEUE 服務卡

#### Scenario: 領號流程

- **When** 點服務卡 → 填三元組 → 送出
- **Then** 後端拿號成功 → 自動導向 `/m/{slug}/queue/status?id=...`

#### Scenario: 顯示當前叫號

- **Given** 服務 A 當日已叫到 5 號、發到 10 號
- **When** 顧客進入 `/m/{slug}/queue`
- **Then** 服務 A 卡片顯示「目前叫到 5 號 · 等待 5 人」

#### Scenario: 尚未開始服務

- **Given** 當日尚無人領號（lastTicketNumber=0）
- **When** 進入頁面
- **Then** 卡片顯示「尚未開始服務」（不顯示數字）

#### Scenario: 已發號未叫號

- **Given** lastTicketNumber=3、lastCalledNumber=0
- **When** 進入頁面
- **Then** 卡片顯示「目前叫到 — · 等待 3 人」

#### Scenario: WebSocket 即時更新

- **Given** 顧客已進入 `/m/{slug}/queue`、看到「目前叫到 5 號」
- **When** 商家透過後台叫到 6 號
- **Then** 不需重新整理，卡片自動更新為「目前叫到 6 號 · 等待 4 人」（透過 `StoreQueueRealtime` WS 推播 `CALL_NEXT`）

#### Scenario: 新顧客領號廣播

- **Given** 顧客 A 在頁面上、看到「等待 3 人」
- **When** 顧客 B 從另一裝置領號成功（`TICKET_TAKEN` 廣播）
- **Then** A 的頁面更新為「等待 4 人」

#### Scenario: WebSocket 斷線降級

- **Given** WS 因網路斷線
- **When** 商家叫號
- **Then** 領號頁透過 `StoreQueueRealtime` 既有 15 秒輪詢 fallback，最遲 15 秒內更新顯示

#### Scenario: 離開頁面清理連線

- **When** 顧客離開 `/m/{slug}/queue`
- **Then** `onBeforeUnmount` 呼叫 `queueStore.Disconnect()`，peer 從 `peerMap` 移除

### Requirement: 顧客等待頁返回入口

`/m/{slug}/queue/status` 頁 SHALL 使用 `BizCustomerPageHeader` 渲染頁首，並設定 `backTo='/m/{slug}/queue'`，使顧客可從個別票號狀態頁回到該商家的領號列表；既有的自製「回首頁」按鈕 SHALL 由 PageHeader 返回入口取代。

#### Scenario: 票號狀態頁顯示返回入口

- **GIVEN** 顧客已領號並進入 `/m/{slug}/queue/status?id=...`
- **THEN** 頁面頂部以 `BizCustomerPageHeader` 渲染，左上顯示「← 返回」
- **WHEN** 顧客點擊返回
- **THEN** 跳轉至 `/m/{slug}/queue`

#### Scenario: WS / 輪詢不受返回入口影響

- **GIVEN** 票號狀態頁的 WebSocket 連線或 15 秒輪詢正在運行
- **WHEN** 顧客點擊返回離開該頁
- **THEN** Vue 元件 unmount 觸發既有 WS 斷線與輪詢停止邏輯（沿用 `useQueueWS` / cleanup）
- **AND** 不留下殘留連線

### Requirement: 商家管理 QueueWindow

系統 SHALL 提供商家後台讀取與整批覆寫某服務每週領號時間窗的端點，僅 `requireMerchant` 商家可操作自己的資料。

#### Scenario: 讀取列表

- **GIVEN** 已登入商家、選定 `serviceId`
- **WHEN** GET `/nuxt-api/merchant/queue-window?serviceId=xxx`
- **THEN** 回 `{ windows: [{ weekday, startTime, endTime, maxTickets, isActive }] }`，按 weekday 升序

#### Scenario: 整批覆寫

- **GIVEN** 已登入商家
- **WHEN** PUT `/nuxt-api/merchant/queue-window` body `{ serviceId, windows: [...] }`
- **THEN** 事務內 `deleteMany({ merchantId, serviceId })` → `createMany(windows)`，原子；回 200 + 新列表

#### Scenario: 跨商家越權

- **GIVEN** 商家 A 已登入、`serviceId` 屬於商家 B
- **WHEN** PUT
- **THEN** 回 404 `MSG_SERVICE_NOT_FOUND`（不洩漏存在與否）

#### Scenario: 非 QUEUE 服務拒絕

- **GIVEN** 服務 `bookingMode != QUEUE`
- **WHEN** PUT
- **THEN** 回 400 `MSG_NOT_QUEUE_SERVICE`

#### Scenario: 欄位格式驗證

- **WHEN** body 含 `weekday=8` 或 `startTime='25:00'` 或 `maxTickets=-1`
- **THEN** 回 400（Zod 驗證失敗）

#### Scenario: 空陣列代表全停用

- **WHEN** PUT body `windows: []`
- **THEN** 該服務所有 QueueWindow 被刪除；顧客領號回 `MSG_QUEUE_WINDOW_CLOSED`

### Requirement: 公開查詢當前叫號

公開 `GET /nuxt-api/public/m/[slug]` SHALL 對每個 `bookingMode=QUEUE` 服務多回傳當日 `currentServing` 與 `waitingCount`，讓領號頁顯示即時叫號狀態。

#### Scenario: 含 counter 資訊

- **GIVEN** 商家當日 QUEUE 服務 A 已發 10 號、叫到 5 號
- **WHEN** GET `/public/m/[slug]`
- **THEN** services 內 A 物件多含 `currentServing: 5`、`waitingCount: 5`、`ticketsTaken: 10`

#### Scenario: 當日無 counter

- **GIVEN** QUEUE 服務 B 當日無人領號
- **WHEN** GET
- **THEN** 物件含 `currentServing: 0`、`waitingCount: 0`、`ticketsTaken: 0`

#### Scenario: 非 QUEUE 服務不含這些欄位

- **GIVEN** 服務 C 是 TIME_SLOT
- **WHEN** GET
- **THEN** C 物件**不**含 `currentServing`、`waitingCount`、`ticketsTaken`（避免誤導）

#### Scenario: 公開端點不需鑑權

- **WHEN** 無 token 呼叫
- **THEN** 仍正常回傳（與既有 public endpoint 一致）

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

