## Why

階段 1（`add-queue-multi-resource-backend`）已讓 `QueueTicket / QueueCounter` 支援 `resourceId`、queue API 全面接 `resourceId` 分群、`/queue/today` 與 `/public/m/[slug]` 也已每個 service 回傳 `resources` 陣列。但**商家後台 UI 還沒跟上**：

1. **Service 編輯彈窗**仍隱藏 QUEUE 模式的「綁定資源」區塊，商家無法把 A/B 兩間診療室掛到同一個 QUEUE service
2. **叫號台 `/admin/queue`** 仍以「一個 service = 一張卡」的單號池視角呈現，多 resource 的 service 會被擠在同一張卡片，看不出 A、B 各自的 currentServing / WAITING / 叫號動作
3. **「現場登記」彈窗 `queue-walk-in.vue`** 沒有 `resourceId` 欄位，無法把代建 ticket 落到指定 resource

本階段把後台 UX 補齊到「按 resource 子卡渲染、各子卡獨立操作、segmented control 持久化選擇」，並維持「未綁 resource 的 QUEUE service」單卡 UX 完全不變（迴歸保護）。

## What Changes

### Service 編輯彈窗（`service-edit.vue`）
- **解除 QUEUE 模式對「綁定資源」的隱藏**：`showResource` 條件 `['RESOURCE', 'RESOURCE_OPTIONAL']` 擴為 `['RESOURCE', 'RESOURCE_OPTIONAL', 'QUEUE']`
- **標題 / 提示文按 bookingMode 條件化 i18n**：QUEUE 模式顯示「可叫號的診間／櫃台／醫師（選填）」與「綁定後每個資源獨立一條號碼牌隊列；不綁則維持單一號池」

### 叫號台頁面（`/admin/queue` + `QueueControlPanel.vue`）
- **service 卡片若有 resources**：渲染成「依 resource 分子卡」的並列布局；每張子卡內各自有 currentServing / WAITING / tabs（waiting / called / history）/ 叫下一號 / 現場登記
- **service 無 resources（resources 空或唯一元素 id=null）**：完全保留現有單卡 UX（迴歸保護）
- **`ClickCallNext` 簽名擴為 `(serviceId, resourceId?)`**：自動帶該子卡的 `resourceId`
- **「目前操作」segmented control**（僅在 service 有 ≥2 個 resource 時顯示）：
  - 切換時 scroll / highlight 對應子卡（**不做權限鎖**，僅輔助高亮 + 預設選中）
  - `localStorage` key `queueOperatingResource:{merchantId}:{serviceId}` 持久化選擇
- **RWD 規格**：
  - ≥ 1280px：子卡橫排（`grid-template-columns: repeat(auto-fit, minmax(360px, 1fr))`）
  - 768–1279px：兩欄
  - < 768px：單欄垂直堆疊

### 現場登記彈窗（`queue-walk-in.vue`）
- **加 `resourceId` 隱藏欄位**：由開啟方（QueueControlPanel 子卡）注入，submit 時帶上送至 `POST /nuxt-api/queue/create-for-customer`
- service 沒有 resources 時 `resourceId` 為 `null`（後端已接 nullable，零迴歸）

### i18n（zh / en / ja 三語）
- `admin.queue.operatingRoom.label`：「目前操作」
- `service.edit.queueResourcesLabel`：「可叫號的診間／櫃台／醫師（選填）」
- `service.edit.queueResourcesHint`：「綁定後每個資源獨立一條號碼牌隊列；不綁則維持單一號池」

### 範圍外（明確不做）
- **不動 Schema、不改後端 API**（階段 1 已完備）
- **不動公開拿號頁 `/m/[slug]/queue/take`、查號 `status.vue`、大螢幕 `display.vue`、store 的 resourceMap 改造**（階段 3 處理）
- **不做店員 ↔ resource 細粒度權限**（已確認不做，segmented control 僅作高亮）
- **不動 `refine-admin-queue-console` 已實作的單卡內 UX**（tabs / 搜尋 / 多 CALLED 並列 / split-button）— 本階段把那些 UX 完整搬到「每個子卡」內

## Capabilities

### New Capabilities

（無新 capability）

### Modified Capabilities

- `queue-tickets`：擴充「商家叫號頁」UI 契約，新增「QUEUE service 綁定多個 resource 時，叫號台按 resource 渲染子卡並列；每張子卡獨立持有 currentServing / WAITING / tabs / 叫下一號 / 現場登記；segmented control 持久化選中 resource」的場景；擴充「商家現場代客領號」場景，現場登記彈窗於子卡開啟時注入 `resourceId`；擴充 service 編輯能力允許 QUEUE 模式綁定 resources。

## Impact

### 受影響的程式

- `app/components/open/dialog/service-edit.vue`（解除 QUEUE 隱藏、條件化 i18n）
- `app/pages/admin/queue.vue`（service 卡片改為依 `resources` 陣列渲染子卡 / 單卡 fallback）
- `app/components/biz/QueueControlPanel.vue`（接受 `resourceId?` prop、segmented control、localStorage 持久化、`ClickCallNext` 簽名擴充）
- `app/components/open/dialog/queue-walk-in.vue`（加 `resourceId` 隱藏欄位 + payload）
- `i18n/locales/{zh,en,ja}.js`（新增 3 個 keys）

### 資料 / 部署 / 同步
- **無 Schema 變動 / 無 migration**
- **無 API 介面變動**（階段 1 已完成）
- 前端可獨立部署，無相容性風險

### 驗收
- **Playwright MCP 必做**（商家後台流程）：
  - 登入測試商家 → 編輯 QUEUE service 綁定 A/B 兩 Resource
  - 進 `/admin/queue` 驗證該 service 渲染成兩張子卡並列
  - 各子卡分別點「叫下一號」、「現場登記」並驗證 API 請求帶上正確 `resourceId`
  - 切到未綁 resource 的另一個 QUEUE service 驗證 UX 完全不變（迴歸）
  - 切換 zh / en / ja 三語驗 i18n 完整
  - `browser_resize` 跑 1280 / 1024 / 375 三個寬度驗 RWD
- `npm run lint` 與 `npm test` 全綠（本階段不新增 Vitest，但既有測試不可破）
