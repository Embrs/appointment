## Why

兩個串連的問題讓號碼牌功能在生產環境形同失效：

1. **「目前不在領號時間」必然錯誤的根因**：系統有 `QueueWindow` model 與 `isWithinQueueWindow` 校驗，但**完全沒有 CRUD API**，商家從來無法新增、編輯 QueueWindow row；既有 `merchant-config` 設計文件把這部分推給 `queue-tickets` change，而 `queue-tickets` 又寫「已由 merchant-config 處理」— 兩邊互相推卸，結果都沒做。顧客點「立即領號」必然撞到 `MSG_QUEUE_WINDOW_CLOSED`
2. **顧客領號頁看不到「目前叫到幾號」**：`/m/[slug]/queue` 領號落地頁只列服務卡片，沒有當下叫號狀態，顧客無從判斷「現在排隊大概要多久」

本 change 補齊缺漏的 QueueWindow 商家設定，並讓顧客領號頁顯示即時叫號（重用既有 `StoreQueueRealtime` WebSocket + 15 秒輪詢雙軌制，零新增後端推播機制）。

## What Changes

### 後端：QueueWindow CRUD
- **新增 `GET /nuxt-api/merchant/queue-window`**：回傳當前商家所有 QueueWindow（按 serviceId、weekday 分群），`requireMerchant`
- **新增 `PUT /nuxt-api/merchant/queue-window`**：整批覆蓋（與 `PUT /schedule/rules` 同風格），body = `{ serviceId, windows: [{ weekday, startTime, endTime, maxTickets, isActive }] }`
- 整批覆蓋邏輯：先 `deleteMany({ merchantId, serviceId })`，再 `createMany`，事務包裹

### 後端：擴充公開 API 回傳當前叫號
- **`GET /nuxt-api/public/m/[slug]` 擴充**：每個 QUEUE service 的回傳物件多帶 `currentServing: number`（當日 `QueueCounter.lastCalledNumber`，若無 counter 則 0）
- **新增 `GET /nuxt-api/public/queue/current`**：query `slug` 回傳該商家所有 QUEUE 服務當下叫號 snapshot，給領號頁初始載入使用（可重用上一條）

### 商家後台
- **新增頁面 `/admin/queue-window`** 或 **整合進 `/admin/queue` 加 tab**（決策見 design.md）：商家可逐服務設定每週 7 天的領號時間窗
- UI 風格沿用 `SchedulerWeeklyEditor`（既有元件），但因為含 `maxTickets` 額外欄位，**新建 `BizQueueWindowEditor.vue`** 元件
- 補側邊欄入口

### 顧客領號頁
- **`/m/[slug]/queue/index.vue` 加叫號顯示**：每個 QUEUE service 卡片新增「目前叫到 N 號」與「等待 M 人」chip
- **WebSocket 即時更新**：頁面 onMounted 連 `StoreQueueRealtime.Connect(merchantId)`、onBeforeUnmount 斷線；`serviceMap` 已支援多服務，UI 從中讀 `currentServing`
- 不需要新後端推播 endpoint：既有 `broadcastQueue` 已對 merchant 全廣播，領號頁訂閱即可收到 `CALL_NEXT` / `TICKET_TAKEN` 事件

### 三語訊息
- 顧客面：補 i18n key `queue.page.currentServing`、`queue.page.waitingCount`、`queue.page.notServing`（尚無叫號時）
- 商家面：補 i18n key `admin.queueWindow.*`（標題、欄位 label、儲存成功 toast）

## Capabilities

### New Capabilities
<!-- 無新增 capability -->

### Modified Capabilities
- `queue-tickets`: 領號頁加當前叫號顯示；新增 QueueWindow CRUD 需求
- `merchant-platform`: 後台新增「領號時間窗」設定頁；補對應 Protocol bindings

## Impact

- **後端新增檔案**：
  - `server/routes/nuxt-api/merchant/queue-window.get.ts`
  - `server/routes/nuxt-api/merchant/queue-window.put.ts`
- **後端修改檔案**：
  - `server/routes/nuxt-api/public/m/[slug].get.ts`（每個 QUEUE service 多查 counter）
- **前端新增檔案**：
  - `app/pages/admin/queue-window.vue`（或整合至 `/admin/queue` 多 tab）
  - `app/components/biz/QueueWindowEditor.vue`
- **前端修改檔案**：
  - `app/pages/m/[slug]/queue/index.vue`（連 WS + 顯示 currentServing）
  - `app/protocol/`（補 4 個 ApiCall + types）
  - `app/layouts/back-desk.vue`（側邊欄補入口）
  - `i18n/locales/{zh,en,ja}.ts`（補 key）
- **不動 schema**：`QueueWindow` model 已存在
- **不動推播架構**：重用既有 `broadcastQueue` + `StoreQueueRealtime` 雙軌制
- **依賴**：無新增；`isWithinQueueWindow` 邏輯不變
