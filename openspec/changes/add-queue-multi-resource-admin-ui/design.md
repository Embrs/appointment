## Context

階段 1 完成後，後端已能按 `(serviceId, resourceId)` 兩層分群處理 queue ticket / counter / call-next / take / create-for-customer / today / public，並且 `/queue/today` 與 `/public/m/[slug]` 都已每 service 回傳 `resources: [{ id, name, ... }]`（未綁 resource 的 service 回 `[{ id: null, name: null, ... }]`）。

但**商家後台 UI** 仍以「一個 service = 一張卡」呈現，無法操作多 resource：
- `service-edit.vue` L39-41 `showResource` 條件擋掉 QUEUE → 商家根本沒辦法把 A/B 兩間 resource 綁到 QUEUE service
- `admin/queue.vue` 依 `services[]` 渲染卡片，沒走 `service.resources[]` 分群
- `QueueControlPanel.vue` 設計時假設「service 一個 currentServing / 一個 WAITING list」，沒有 resource 維度
- `queue-walk-in.vue` 沒有 `resourceId` 欄位

另外，未歸檔的 `refine-admin-queue-console` change 已把單卡 UX（split-button、多 CALLED 並列、tabs / 搜尋 / RWD）做完，本階段要把那些 UX 原地搬到「每張子卡」內，不可破壞已實作行為。

## Goals / Non-Goals

**Goals:**
- service 有 ≥1 個 active resource 時，叫號台依 resource 渲染並列子卡，每張子卡持有獨立的 currentServing / WAITING / tabs / 叫號 / 現場登記
- service 沒綁 resource（後端回 `resources: [{ id: null, name: null, ... }]`）時 UX **完全不變**（迴歸保護）
- segmented control「目前操作」僅在 ≥2 個 resource 時顯示，切換時做視覺輔助（scroll / highlight），不做權限鎖；localStorage 持久化選擇
- 「現場登記」彈窗於子卡開啟時注入該子卡的 `resourceId`，submit 帶上後端
- service 編輯彈窗解除 QUEUE 模式的 resources 隱藏，並條件化 i18n 文案
- i18n 三語齊全（zh / en / ja）
- Playwright MCP 驗收覆蓋：多 resource service 渲染 / 各子卡叫號與現場登記 API payload / 未綁 resource 迴歸 / 三語 / RWD 三斷點

**Non-Goals:**
- 不動 Schema / 後端 API（階段 1 已完備）
- 不動公開頁 take / status / find / display / store resourceMap（階段 3）
- 不做店員 ↔ resource 權限鎖（segmented control 僅作高亮輔助）
- 不重寫 `refine-admin-queue-console` 已落地的子卡內 UX 元素（tabs / 搜尋 / 多 CALLED row 級操作 / split-button），僅把它們「下沉一層」到子卡

## Decisions

### 決策 1：資料來源以 `service.resources[]` 為單一真實來源（SSOT）

階段 1 已讓 `/queue/today` 回 `service.resources: [{ id, name, displayOrder, isActive, counter, tickets }]`，未綁 resource 的 service 走 fallback `[{ id: null, name: null, counter, tickets }]`。

前端 `QueueControlPanel` 改為**永遠** 走 `service.resources[]` 迴圈渲染子卡：
- 陣列長度 1 且 `id === null`：渲染成單卡（外觀與目前一致 → 迴歸保護）
- 陣列長度 1 且 `id !== null`：渲染成 1 張子卡（不顯示 segmented control）
- 陣列長度 ≥ 2：渲染成多張子卡 + segmented control

**為什麼不寫兩條路徑（單卡分支 / 多卡分支）？** 兩條路徑容易 UX drift（修了一邊忘了另一邊）。統一走 `resources[]` 渲染，靠 length === 1 + id === null 來決定要不要顯示子卡標題與 segmented control，使「未綁 resource」就是「resources 陣列退化成一個 null 元素的多 resource case」，行為自然一致。

### 決策 2：`QueueControlPanel` 元件邊界保持「一個 service 一個元件」

不拆成 `QueueControlPanel`（service 層）+ `QueueResourceCard`（resource 層）兩個元件。原因：
- service 層需要的資料（QueueWindow、`HasAnyQueueService`、segmented control 狀態、ApiLoad 共用 emit）會在 panel scope 共用；拆兩元件要拉一堆 props / emits 上下傳遞，反而更亂
- segmented control 需要在「service-resource 兩層之間」連動 scroll / highlight，留在同一個元件比較直覺

**改法**：`QueueControlPanel` 內部用 `v-for resource in service.resources` 渲染 `.BizQueueControlPanel__resource` 區塊。每個 resource 區塊內含：
- 區塊標題（若 `resource.id !== null` 顯示 `resource.name` + `currentServing` 大字；若 `null` 不顯示子卡標題）
- 服務中區（按 resource 篩出的 CALLED rows）
- 動作列（叫下一號 / 現場登記，按鈕 `disabled` 由 resource 自己的 WAITING / QueueWindow 決定）
- tabs + 搜尋 + 列表（按 resource 篩出的 tickets）

### 決策 3：`ClickCallNext` / `ClickWalkIn` 簽名擴充

目前簽名 `ClickCallNext(serviceId)`，改為 `ClickCallNext(serviceId, resourceId?: string | null)`：
- 子卡的按鈕呼叫時帶該子卡的 `resourceId`
- 單卡（`resourceId === null`）保留 `null`，後端已接 nullable
- 對應 `app/pages/admin/queue.vue` 內 `ApiCallNext` 也要把 `resourceId` 一起送到後端

**現場登記**改為 `ClickWalkIn(serviceId, resourceId?: string | null)`，開啟 `useQueueWalkIn` 彈窗時透過 props / openQueueWalkInDialog payload 注入 `resourceId`，由彈窗 submit 帶到 `/queue/create-for-customer` body。

### 決策 4：Segmented control 用 localStorage 持久化，但不鎖權限

key: `queueOperatingResource:{merchantId}:{serviceId}` → 存 `resourceId` 字串。

行為：
- 元件 `onMounted` 讀 localStorage；若該值對應的 resource 仍 active 則設為「目前操作」
- 找不到或 stale 時 fallback：選 `service.resources[0]`（按 displayOrder 排序的第一個 active resource）
- 切換 segmented control 立刻寫回 localStorage
- 「目前操作」**僅影響視覺**（scroll-into-view + 高亮邊框 / 子卡標題加 `--is-active` modifier），**不影響**任何按鈕的 disabled / 隱藏邏輯（員工仍可在任意子卡操作）

**為什麼不做權限鎖？** 計畫檔 L24「店員權限：不鎖 — 店員可在叫號台自由切換操作中的診間」是已確認決策。鎖了反而妨礙臨時換人接 A / B 診間的場景。

### 決策 5：RWD 用 CSS grid，子卡 `grid-template-columns: repeat(auto-fit, minmax(...))`

- ≥ 1280px：`minmax(360px, 1fr)`（橫排，視容器寬自動 2~N 欄）
- 768–1279px：`minmax(320px, 1fr)`（多會跑成兩欄）
- < 768px：`grid-template-columns: 1fr`（單欄垂直堆疊）

不用 flex，因為 grid 的 auto-fit + minmax 對「子卡寬度下限 + 容器寬可變」最對味。

### 決策 6：service-edit.vue 改動最小化

只動兩處：
1. `showResource` 條件 `['RESOURCE', 'RESOURCE_OPTIONAL']` → `['RESOURCE', 'RESOURCE_OPTIONAL', 'QUEUE']`
2. 標題 / 提示文 i18n 條件化：用 `bookingMode === 'QUEUE' ? $t('service.edit.queueResourcesLabel') : $t('service.edit.resourcesLabel')` 之類分支（具體 key 名用既有 + 新增的 2 個）

驗證仍由後端 zod schema 把關，前端不加額外條件。

## Risks / Trade-offs

| Risk | Mitigation |
|------|-----------|
| 後端 `/queue/today` 對「未綁 resource service」的 fallback 是否真的回 `[{ id: null, name: null, ... }]`？萬一回空陣列前端會渲染空 panel | 在 `QueueControlPanel` 內加防呆：`resources.length === 0` 時 fallback 為 `[{ id: null, name: null, counter: service.counter, tickets: service.tickets }]`（兼容舊 payload 結構）。同時把這個假設寫進 tasks.md 驗收第一條 |
| `refine-admin-queue-console` 未歸檔，spec 上「商家叫號頁」requirement 仍是舊版（單卡） | 本 change 的 delta MODIFIED 「商家叫號頁」直接基於 refine 已實作後的行為書寫（tabs / 搜尋 / 多 CALLED / split-button + 新增子卡層）。歸檔順序由使用者掌控，本提案不阻塞 |
| segmented control 在 ≥ 2 個 resource 才顯示 → 突然從 2 個 resource 改回 1 個時 localStorage 殘留值會被忽略 | onMounted 重讀時若 resource 已不存在於 `service.resources` 直接 fallback 到 resources[0]，並把 localStorage 寫回最新值，避免下次仍 stale |
| 「現場登記」彈窗共用一個 `useAsk` 彈窗系統時，多次連續開不同子卡是否會殘留上次的 `resourceId`？ | 每次開啟以 props / payload 全量覆蓋 `resourceId`（不靠 reactive 殘留），彈窗 close 時清空內部 state |
| Playwright 驗收時 seed data 沒有 QUEUE service + Resource 綁定 | 驗收步驟 0：手動或腳本準備：1 個測試商家 + 1 個 QUEUE service「看診」+ 2 個 Resource「A 診間 / B 診間」。實作完先確認可在 service-edit 完成綁定（這是本 change 第一個功能），再走後續驗收 |
| 三語 i18n 漏 key 導致頁面顯示 raw key | 用 node 比對 zh / en / ja 三檔的新 keys 完整覆蓋；Playwright 驗收切三語並截畫面確認 |

## Migration Plan

無資料 migration（本階段純前端）。部署順序：階段 1 後端先到位（已完成）→ 本階段前端可獨立部署，且向後相容：
- 舊前端配新後端：舊前端不送 `resourceId`，新後端對未綁 resource service 接受 null，行為一致
- 新前端配新後端：完整 multi-resource 支援

回滾策略：本階段全為前端改動 + i18n 新增，回滾即 revert 該次部署，不影響資料。

## Open Questions

- segmented control 切換時 scroll-into-view 的 behavior 是用 `behavior: 'smooth'` 還是 `'instant'`？暫定 `smooth`，實作時若卡頓再改 instant
- 子卡標題（resource name）的字級與「currentServing 大字」相對權重？暫定參考 `BizQueueDisplay` 既有比例，實作時依視覺微調
