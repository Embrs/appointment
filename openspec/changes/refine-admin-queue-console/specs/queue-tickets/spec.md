## MODIFIED Requirements

### Requirement: 商家標記完成或過號

The system SHALL allow merchants to mark any CALLED ticket as DONE or SKIPPED by ticket id, with each operation broadcasting to subscribed peers. The merchant queue console SHALL expose per-ticket DONE/SKIP controls so that when multiple tickets are simultaneously in CALLED status, the merchant can target a specific ticket without being forced to operate on the most-recently-called one.

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

#### Scenario: 多張 CALLED 共存時可指定任一張完成

- **Given** 同一 service 當日同時存在 CALLED 票 A（ticketNumber=5）、B（ticketNumber=7）、C（ticketNumber=9）
- **When** 商家在 `/admin/queue` 對 ticket B 點「完成」
- **Then** 僅 ticket B 變 DONE、A 與 C 仍為 CALLED；廣播 `TICKET_DONE` 帶 `servingTicketId=B.id`
- **And** UI 從「服務中」區移除 B 但保留 A 與 C

#### Scenario: 多張 CALLED 共存時可指定任一張過號

- **Given** 同一 service 當日同時存在 CALLED 票 A（ticketNumber=5）、B（ticketNumber=7）
- **When** 商家對 ticket A 點「過號」並通過確認
- **Then** 僅 ticket A 變 SKIPPED、B 仍為 CALLED；廣播 `TICKET_SKIPPED`

#### Scenario: row 級 loading 不互鎖

- **Given** 商家對 ticket A 點「完成」、請求仍在進行中
- **When** 同時對 ticket B 點「完成」
- **Then** ticket B 的請求正常發起、不被 A 的 loading 阻擋；A、B 各自 row 內按鈕分別呈現 loading 狀態

### Requirement: 商家叫號頁

The merchant queue page SHALL display the current serving tickets for each QUEUE service and provide controls to call next, mark any CALLED ticket done or skipped, register a walk-in, and filter the per-service ticket list. The page SHALL remain usable on tablet portrait viewports (≥ 768px) for on-site touch operation.

#### Scenario: 控制台呈現

- **Given** 商家當日有 QUEUE 服務 A（current=5）、服務 B（current=3）
- **When** 進入 `/admin/queue`
- **Then** 顯示兩張卡，各自呈現：
  - 卡片頂層動作：主按鈕「叫下一號」+ 次按鈕「現場登記」（共 2 顆，不含完成/過號）
  - 「服務中」區：列出該服務當前所有 status=CALLED 的票（多張時並列垂直顯示），每張掛獨立「完成 / 過號」操作
  - WAITING 列表加上狀態 tabs 與搜尋框

#### Scenario: 自身叫號後即時更新

- **When** 點「叫下一號」成功
- **Then** 該卡服務中區追加新 CALLED 票、票列表移除被叫的票；同時其他 tab（含顧客等待頁）收到 WS 推播

#### Scenario: 卡片頂層動作層級

- **Given** 卡片渲染時
- **Then** 頂層動作區只出現「叫下一號」與「現場登記」兩顆按鈕；「完成」「過號」**不出現於卡片頂層**

#### Scenario: 服務中區無 CALLED 時的空狀態

- **Given** 某服務當日所有票皆為 WAITING/DONE/SKIPPED（無 CALLED）
- **When** 卡片渲染
- **Then** 「服務中」區顯示提示文案「目前無服務中號碼」，不出現完成/過號按鈕

#### Scenario: 狀態 tabs 切換

- **Given** 卡片內票列表
- **When** 點擊「服務中」tab
- **Then** 列表只顯示 status=CALLED 的票；tabs 顯示各分群計數（等待中 N / 服務中 M / 歷史 K）

#### Scenario: tabs 預設 active 為「等待中」

- **Given** 進入 `/admin/queue`
- **Then** 每張卡片的狀態 tabs 預設停在「等待中」

#### Scenario: 列表搜尋以號碼比對

- **Given** 「等待中」tab、列表中有 ticketNumber=12 的票
- **When** 在搜尋框輸入「12」
- **Then** 列表只顯示 ticketNumber 包含「12」的票（例如 12、120-129）

#### Scenario: 列表搜尋以電話末 4 碼比對

- **Given** 列表中有 ticket customerPhone=0912345678
- **When** 在搜尋框輸入「5678」
- **Then** 該票被命中顯示

#### Scenario: 列表搜尋無結果

- **Given** 搜尋輸入「9999」、列表內無命中
- **Then** 列表顯示空狀態「找不到符合的號碼」提示，並可一鍵清除搜尋

#### Scenario: 搜尋字串跨 tab 保留

- **Given** 在「等待中」tab 輸入搜尋「12」
- **When** 切換至「歷史」tab
- **Then** 搜尋字串仍為「12」、列表以「12」於歷史票群中過濾

#### Scenario: 列表加捲動界線

- **Given** 某服務當日票數 > 30
- **Then** 列表容器套用 `max-height` 並可內部 `overflow-y: auto` 捲動；卡片整體高度不無限拉長

#### Scenario: 平板直立 RWD

- **Given** viewport 768×1024（直立平板）
- **When** 進入 `/admin/queue`
- **Then** 卡片以 grid 顯示且不破版；卡片頂層動作按鈕觸控區 ≥ 44px；列表 row 與 CALLED 區 chip 不互相擠壓；搜尋框不換多行

### Requirement: Admin 顯示頁入口

The system SHALL provide a single split-button entry in the admin queue page (`/admin/queue`) toolbar that opens `/m/{slug}/display` in a new browser tab on primary click and exposes a "copy link" action via its dropdown. The admin entry SHALL be visible to authenticated merchants and SHALL NOT require any new permission or RBAC rule beyond the existing admin queue page guard.

#### Scenario: Admin toolbar 出現「開啟顯示頁」主按鈕

- **GIVEN** 商家已登入、進入 `/admin/queue`
- **WHEN** 頁面渲染
- **THEN** toolbar 顯示一個 split-button：主按鈕文案為 `display.openDisplay`（「開啟顯示頁」），右側附下拉箭頭

#### Scenario: 點主按鈕開新分頁

- **GIVEN** 商家在 `/admin/queue`、slug=acme
- **WHEN** 點擊主按鈕本體
- **THEN** 瀏覽器執行 `window.open('/m/acme/display', '_blank', 'noopener,noreferrer')`，原頁面不導航

#### Scenario: 複製顯示頁連結

- **GIVEN** 商家在 `/admin/queue`
- **WHEN** 點擊主按鈕右側下拉箭頭、再點選「複製連結」
- **THEN** `navigator.clipboard.writeText(displayUrl)` 執行成功、出現 `display.linkCopied` toast

#### Scenario: 無 QUEUE 服務時整顆 disabled

- **GIVEN** 商家當日無任何 `bookingMode=QUEUE` 的服務
- **WHEN** 頁面渲染
- **THEN** split-button 整顆 disabled（主按鈕與下拉皆不可點），hover 顯示 tooltip `display.needQueueService`

#### Scenario: 連線狀態獨立呈現為頁首 chip

- **GIVEN** 商家在 `/admin/queue`
- **WHEN** 頁面渲染
- **THEN** WS 連線狀態（即時連線中 / 連線中斷）顯示為頁首右上獨立小 chip，不混入 split-button
