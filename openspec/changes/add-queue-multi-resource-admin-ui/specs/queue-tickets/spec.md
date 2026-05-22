## MODIFIED Requirements

### Requirement: 商家叫號頁

The merchant queue page SHALL display the current serving tickets for each QUEUE service and provide controls to call next, mark any CALLED ticket done or skipped, register a walk-in, and filter the per-service ticket list. When a service has one or more bound active resources, the page SHALL render one sub-card per resource within the service's card area, each sub-card independently tracking its own currentServing, CALLED list, WAITING / called / history tabs, search input, call-next action, and walk-in registration action. When a service has no resources bound (or the backend returns `resources: [{ id: null, ... }]` fallback), the page SHALL render a single card preserving the existing single-card UX. The page SHALL remain usable on tablet portrait viewports (≥ 768px) for on-site touch operation.

#### Scenario: 控制台呈現（單一 service、無 resource）

- **Given** 商家當日有 QUEUE 服務 A（無綁定 resource、current=5）、服務 B（無綁定 resource、current=3）
- **When** 進入 `/admin/queue`
- **Then** 顯示兩張卡，各自呈現：
  - 卡片頂層動作：主按鈕「叫下一號」+ 次按鈕「現場登記」（共 2 顆）
  - 「服務中」區：列出該服務當前所有 status=CALLED 的票（多張時並列垂直顯示），每張掛獨立「完成 / 過號」操作
  - WAITING 列表加上狀態 tabs 與搜尋框
  - **不**顯示 segmented control「目前操作」

#### Scenario: 控制台呈現（service 綁多個 resource）

- **Given** 商家當日有 QUEUE 服務「看診」綁定 Resource A（current=5）與 Resource B（current=3）
- **When** 進入 `/admin/queue`
- **Then** 服務「看診」的卡片區內渲染兩張子卡並列，每張子卡顯示對應 resource name 標題、各自 currentServing 大字、各自 CALLED 列表、各自 WAITING / called / history tabs、各自搜尋框、各自「叫下一號」與「現場登記」按鈕
- **And** 卡片頂部出現 segmented control「目前操作」，列出兩個 resource 名稱

#### Scenario: 控制台呈現（service 綁單一 resource）

- **Given** 商家當日有 QUEUE 服務「看診」綁定唯一 Resource A
- **When** 進入 `/admin/queue`
- **Then** 服務「看診」卡片區渲染一張子卡（顯示 resource name 標題與 currentServing），**不**顯示 segmented control

#### Scenario: 自身叫號後即時更新

- **When** 在某子卡點「叫下一號」成功
- **Then** 該子卡服務中區追加新 CALLED 票、該子卡票列表移除被叫的票；同 service 其他 resource 的子卡狀態不變；其他 tab（含顧客等待頁）收到 WS 推播

#### Scenario: 卡片頂層動作層級

- **Given** 子卡渲染時
- **Then** 子卡頂層動作區只出現「叫下一號」與「現場登記」兩顆按鈕；「完成」「過號」**不出現於子卡頂層**，僅由「服務中」區內每張 CALLED row 各自掛載

#### Scenario: 服務中區無 CALLED 時的空狀態

- **Given** 某子卡對應的 (service, resource) 當日所有票皆為 WAITING/DONE/SKIPPED（無 CALLED）
- **When** 子卡渲染
- **Then** 「服務中」區顯示提示文案「目前無服務中號碼」，不出現完成/過號按鈕

#### Scenario: 狀態 tabs 切換

- **Given** 子卡內票列表
- **When** 點擊「服務中」tab
- **Then** 列表只顯示該 (service, resource) 之 status=CALLED 的票；tabs 顯示各分群計數（等待中 N / 服務中 M / 歷史 K）

#### Scenario: tabs 預設 active 為「等待中」

- **Given** 進入 `/admin/queue`
- **Then** 每張子卡的狀態 tabs 預設停在「等待中」

#### Scenario: 列表搜尋以號碼比對

- **Given** 子卡的「等待中」tab、列表中有 ticketNumber=12 的票
- **When** 在搜尋框輸入「12」
- **Then** 列表只顯示 ticketNumber 包含「12」的票（例如 12、120-129）

#### Scenario: 列表搜尋以電話末 4 碼比對

- **Given** 子卡列表中有 ticket customerPhone=0912345678
- **When** 在搜尋框輸入「5678」
- **Then** 該票被命中顯示

#### Scenario: 列表搜尋無結果

- **Given** 搜尋輸入「9999」、子卡列表內無命中
- **Then** 列表顯示空狀態「找不到符合的號碼」提示，並可一鍵清除搜尋

#### Scenario: 搜尋字串跨 tab 保留

- **Given** 在某子卡「等待中」tab 輸入搜尋「12」
- **When** 切換該子卡至「歷史」tab
- **Then** 搜尋字串仍為「12」、列表以「12」於歷史票群中過濾

#### Scenario: 列表加捲動界線

- **Given** 某子卡對應的 (service, resource) 當日票數 > 30
- **Then** 列表容器套用 `max-height` 並可內部 `overflow-y: auto` 捲動；子卡整體高度不無限拉長

#### Scenario: 平板直立 RWD

- **Given** viewport 768×1024（直立平板）
- **When** 進入 `/admin/queue`
- **Then** 卡片以 grid 顯示且不破版；子卡頂層動作按鈕觸控區 ≥ 44px；列表 row 與 CALLED 區 chip 不互相擠壓；搜尋框不換多行

#### Scenario: 桌機 RWD 子卡橫排

- **Given** viewport ≥ 1280px、某 QUEUE service 綁定 3 個 resource
- **When** 進入 `/admin/queue`
- **Then** 該 service 的三張子卡以 grid `repeat(auto-fit, minmax(360px, 1fr))` 橫排（容器寬足時 3 欄、稍窄時 2 欄）

#### Scenario: 手機 RWD 子卡垂直堆疊

- **Given** viewport < 768px、某 QUEUE service 綁定 2 個 resource
- **When** 進入 `/admin/queue`
- **Then** 兩張子卡單欄垂直堆疊；segmented control 仍可使用，超寬時可水平捲動

## ADDED Requirements

### Requirement: 商家叫號台 segmented control「目前操作」

The merchant queue admin page SHALL show a "目前操作" segmented control on the parent card area when a QUEUE service has 2 or more bound active resources. The control SHALL persist the selected resource per (merchantId, serviceId) tuple to `localStorage` under key `queueOperatingResource:{merchantId}:{serviceId}`. The control SHALL act as a visual aid (scroll-into-view + highlight the corresponding sub-card) only, and SHALL NOT lock or hide any per-sub-card buttons; staff can still operate any sub-card regardless of which option is selected.

#### Scenario: 多 resource 顯示 segmented control

- **Given** 某 QUEUE service 綁定 2 個以上 active resource
- **When** 卡片渲染
- **Then** 出現 segmented control，options 對應每個 resource name（按 `displayOrder` 排序），預設選中 `localStorage` 內紀錄的 resource 或 fallback 到第一個

#### Scenario: 單一 resource 不顯示 segmented control

- **Given** 某 QUEUE service 綁定 ≤1 個 active resource（含 0 與未綁）
- **When** 卡片渲染
- **Then** segmented control 不渲染

#### Scenario: 切換時持久化

- **When** 點擊 segmented control 切換至 Resource B
- **Then** `localStorage.setItem('queueOperatingResource:{m}:{s}', 'B')` 立即寫入；下次重新整理頁面預設選中 Resource B

#### Scenario: localStorage stale 值降級

- **Given** `localStorage` 紀錄的 resourceId 已不存在於 `service.resources`（例如已被停用或刪除）
- **When** 卡片渲染
- **Then** 自動 fallback 到第一個 active resource 並把該值寫回 localStorage

#### Scenario: 切換時 scroll-into-view

- **When** 切換至 Resource B
- **Then** Resource B 對應子卡執行 `scrollIntoView({ behavior: 'smooth', block: 'nearest' })`、套上短暫高亮樣式（≤ 1 秒）

#### Scenario: 切換不鎖其他子卡

- **Given** segmented control 選中 Resource A
- **When** 商家直接在 Resource B 子卡點「叫下一號」
- **Then** Resource B 的叫號正常執行、不受 segmented control 選中狀態限制

### Requirement: Service 編輯彈窗允許 QUEUE 模式選擇 Resources

The merchant service-edit dialog (`app/components/open/dialog/service-edit.vue`) SHALL show the resource-binding selector when `bookingMode` is `RESOURCE`, `RESOURCE_OPTIONAL`, or `QUEUE`. When the selector is shown for `QUEUE`, the label and hint SHALL use QUEUE-specific i18n strings indicating the binding is optional and each bound resource forms an independent queue.

#### Scenario: QUEUE 模式顯示資源選擇器

- **Given** 商家在 service-edit 彈窗將 `bookingMode` 切到 `QUEUE`
- **When** 彈窗渲染
- **Then** 資源選擇器區塊顯示，標題顯示 `service.edit.queueResourcesLabel`（「可叫號的診間／櫃台／醫師（選填）」），提示顯示 `service.edit.queueResourcesHint`（「綁定後每個資源獨立一條號碼牌隊列；不綁則維持單一號池」）

#### Scenario: RESOURCE / RESOURCE_OPTIONAL 模式沿用原文案

- **Given** `bookingMode` 為 `RESOURCE` 或 `RESOURCE_OPTIONAL`
- **When** 彈窗渲染
- **Then** 資源選擇器標題與提示沿用既有 i18n（不出現 queue 專屬文案）

#### Scenario: BOOKING / SHOP 模式仍隱藏選擇器

- **Given** `bookingMode` 為 `BOOKING` 或 `SHOP`
- **When** 彈窗渲染
- **Then** 資源選擇器**不**顯示

#### Scenario: QUEUE 留空綁定可送出

- **Given** `bookingMode=QUEUE`、未選任何 resource（`resourceIds: []`）
- **When** 送出表單
- **Then** 後端接受空陣列、service 維持單一號池行為（依「Service create/update 允許 QUEUE 綁定 Resources」requirement）

#### Scenario: QUEUE 綁定多 resource 可送出

- **Given** `bookingMode=QUEUE`、選了 Resource A 與 B
- **When** 送出表單
- **Then** 後端 service 更新 `resources: [A, B]`，叫號台後續渲染依此分子卡（依「商家叫號頁」requirement）

### Requirement: 現場登記彈窗注入 resourceId

The walk-in registration dialog (`app/components/open/dialog/queue-walk-in.vue`) SHALL accept a `resourceId: string | null` field from its opener. When opened from a sub-card on the admin queue page, the opener SHALL inject the sub-card's resourceId; when opened from a card without resources, the opener SHALL pass `null`. The dialog SHALL include the resourceId in its submission payload to `POST /nuxt-api/queue/create-for-customer`.

#### Scenario: 從綁 resource 子卡開啟

- **Given** 商家在「看診」service 的 Resource A 子卡
- **When** 點「現場登記」
- **Then** 彈窗開啟時內部 state `resourceId='A'`；submit 時 body 含 `resourceId: 'A'`

#### Scenario: 從未綁 resource 卡片開啟

- **Given** 商家在未綁 resource 的 QUEUE service 卡片
- **When** 點「現場登記」
- **Then** 彈窗開啟時 `resourceId=null`；submit 時 body 不含 `resourceId` 或傳 `null`（後端皆兼容）

#### Scenario: 連續從不同子卡開啟不殘留

- **Given** 商家剛從 Resource A 子卡開過彈窗、已 close
- **When** 商家從 Resource B 子卡再開啟彈窗
- **Then** 彈窗內部 `resourceId='B'`（不殘留上次的 `'A'`）

#### Scenario: submit 成功後票券落在指定 resource

- **Given** Resource A 子卡開啟彈窗、submit 填妥姓名與稱謂
- **When** 後端建票成功
- **Then** 該 ticket `resourceId='A'`；WS 廣播 `TICKET_TAKEN { resourceId: 'A', resourceName: 'A 診間' }`；Resource A 子卡的 WAITING 列表新增一張票，Resource B 子卡不變
