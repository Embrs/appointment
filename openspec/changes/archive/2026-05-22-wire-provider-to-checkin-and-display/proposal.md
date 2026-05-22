## Why

前一個 change `introduce-provider-model`（2026-05-22 archive）已把 Provider 模型、`providerModeEnabled` 開關、`Appointment.providerId`、`Schedule*.providerId` 全部落地，但**現場端三個操作介面（報到台、叫號台、店面大螢幕）尚未串接 Provider 資訊**。當前狀態下，啟用 Provider 制的商家在後台叫號時看到的仍是純診間（Resource）視角，現場人員無法快速辨識「這位顧客是來看哪位醫師」；店面大螢幕也只能顯示號碼，無法呈現「A 診－王醫師 / B 診－李技師」的多軸視覺。

這對 Provider 制商家有三個直接痛點：
1. **報到台**：顧客出示號碼牌後，櫃台得自行翻紙本或猜「這號碼是哪位 Provider 的？」才能引導到正確診間
2. **叫號台**：商家手上多個診間並行運作時，難以一眼看出「現在叫的這號是哪位 Provider 的」造成誤指派
3. **大螢幕**：店面顯示沒有 Provider 副標，顧客在等候區無法確認「我的醫師現在叫到幾號」

本 change 把 Provider 顯示串到上述三個介面，**不動 schema、不動號碼池規則**，純前端 + WS payload 微調。**對未啟用 Provider 制商家 100% 不變**。

## What Changes

### 報到台（admin/queue.vue 新增單一報到卡片）

- 新增「待報到」清單區塊，列出當日 status=WAITING 的票（按 takenAt 升序）
- 每張票一張卡片，呈現：
  - 顧客姓名 / 號碼 / 服務名稱 / **Provider 名稱**（前綴用商家自訂稱呼，如「王醫師」）
  - 預設診間下拉：**自動帶入該 Provider 該時段預綁的診間**（透過 `Schedule*.providerId + resourceId` 比對），員工可改派為其他空閒診間
  - 「確認報到」按鈕：呼叫既有 `POST /queue/[id]/check-in`（若尚無則本 change 新增此端點）將票的 `resourceId` 改派並廣播
- 未啟用 Provider 制：卡片不顯示 Provider 列、診間下拉預帶值為現有 resourceId（不變）

### 叫號台（QueueControlPanel + QueueCallOverlay 加 Provider 副標）

- 排隊清單每張票卡 / NOW_CALLING 卡 / QueueCallOverlay 全螢幕通知，**全部新增一行小字顯示 Provider 名稱**（i18n 前綴用商家自訂稱呼）
- 不改主流程（call-next / done / skip / walk-in 既有 UX 全保留）
- 未啟用 Provider 制：Provider 列整段不渲染（CSS class 條件控制）

### 店面大螢幕（m/[slug]/display.vue 改多欄按診間版型）

- 從現有「單服務單欄」改為**「以診間為主軸」的多欄版型**：每欄頂部「A 診間」+ 副標 Provider 名稱，中段叫號中號碼 + 顧客姓名，下段下一號 + 等待人數
- RWD：手機橫向滑動 / 平板雙欄 / 大螢幕 N 欄；保留現有動畫、TTS、輪詢 fallback
- 未啟用 Provider 制：副標不渲染、版型仍按 Resource 多欄（即現有 add-queue-multi-resource-customer-ui change 已落地的多欄版型）；行為與現狀完全一致

### WS payload / API 回應補欄位

- `GET /queue/today` 每張票回應補 `providerId: string | null` / `providerName: string | null`（從 schedule + provider join 推導）
- `GET /public/m/[slug]` 對每個 QUEUE service 的 `resources[]` 每個 resource 補 `provider: { id, name } | null`（該 resource 該時段排定的 Provider）
- WebSocket 廣播 `TICKET_TAKEN` / `CALL_NEXT` 等 payload 補 `providerId` / `providerName`
- StoreQueueRealtime 既有 `serviceMap` patch 邏輯解析新欄位

### i18n

- 新增 key：`queue.checkIn.title`、`queue.checkIn.confirm`、`queue.checkIn.assignedRoom`、`display.providerSubtitle`、`queue.providerPrefix` 等
- 商家自訂稱呼 fallback 鏈：`Merchant.providerLabel[locale]` → i18n 預設 → 「服務人員」

## Capabilities

### New Capabilities

（無——本 change 是橫跨既有 `queue-tickets` capability 的 UX 串接）

### Modified Capabilities

- `queue-tickets`：
  - 新增 **「商家報到台」** requirement：admin/queue.vue 報到卡片 UX、自動帶入 Provider 預綁診間、可改派、確認報到後更新 ticket.resourceId
  - 擴充 **「商家叫號台」** requirement：排隊清單與 NOW_CALLING 卡片新增 Provider 副標
  - 擴充 **「店面大螢幕公開顯示頁」** requirement：版型從「單服務單欄」改為「多診間多欄 + Provider 副標」，明確 RWD 三檔行為
  - 擴充 **「商家當日票列表」** / **「公開商家快照」** requirement：回應補 `providerId` / `providerName` 欄位
  - 擴充 **「WebSocket 廣播」** requirement：payload 補 `providerId` / `providerName`
  - 所有上述 requirement 皆明確「未啟用 Provider 制商家行為不變」scenario

## Impact

### 受影響的程式碼

- `app/pages/admin/queue.vue` — 新增報到卡片區塊、串接報到 API
- `app/components/biz/QueueControlPanel.vue` — 票卡與 NOW_CALLING 卡加 Provider 副標
- `app/components/biz/QueueCallOverlay.vue` — 全螢幕通知加 Provider 副標
- `app/components/biz/AppointmentTable.vue`（如有共用視覺）— 視需要同步
- `app/pages/m/[slug]/display.vue` — 改多欄按診間版型
- `app/stores/7.store-queue-realtime.ts` — patch 邏輯解析新欄位
- `app/protocol/fetch-api/api/queue/type.d.ts` — `QueueTodayTicketItem` 加 `providerId` / `providerName`
- `app/protocol/fetch-api/api/merchant/type.d.ts` — `GetPublicMerchant` 回應補 `resources[].provider`
- `server/utils/queue.ts` — `GetQueueToday` / `internalCreateTicket` 廣播 payload 補欄位、新增 schedule → provider 查詢 helper
- `server/routes/nuxt-api/queue/[id]/check-in.post.ts` — **新建**（若報到改派 API 尚未存在）
- `server/routes/nuxt-api/public/m/[slug].get.ts` — 回應補 `resources[].provider`
- `i18n/locales/{zh,en,ja}.js` — 新增 i18n key
- `.claude/knowledge/queue-realtime.md` — 同步更新（報到台、Provider 副標、多欄版型）

### 資料相容性

- **不動任何 schema**：`QueueTicket` / `QueueCounter` / `Resource` / `Provider` 全部不改
- Provider 資訊一律從 `Schedule*.providerId + resourceId` join 推導（已在前一個 change 落地）
- 既有 prod / test 商家：`providerModeEnabled=false` → 所有新欄位回 null、所有新 UI 區塊不渲染
- 部署不需要資料遷移

### 風險與待釐清

- **Provider 推導的 join 策略**：給定 ticket 的 `resourceId` 與當下時間，如何找到「該時段排定的 Provider」？候選方案（待 design 階段定）：
  - (A) 從 ScheduleRule（按 weekday + time window）查 → 但 ScheduleRule 是「服務人員的可服務時段」，與「現在在哪間」未必 1:1
  - (B) 從 ScheduleOverride（特定日期覆寫）優先查 → 同上
  - (C) 引入新概念「Provider 當日簽到診間」（admin 可手動指定）→ 但這需要新表 / 欄位，與「不改 schema」衝突
  - **預設採 A → B fallback，無命中時 Provider 為 null（畫面不渲染副標）**
- **報到流程是否真的需要新端點 `/queue/[id]/check-in`**：目前 ticket 已有 `resourceId`（take 時就決定），若不改派則無需新端點，只需「展示確認」UX；新端點僅處理「改派到其他診間」場景。design 階段確認後再定。
- **大螢幕多欄版型與既有 multi-resource UI 的關係**：[add-queue-multi-resource-customer-ui](openspec/changes/archive/) 已落地多 resource 顯示，本 change 在其上加 Provider 副標，不重寫版型結構。
- **i18n fallback**：商家未填 `providerLabel[locale]` 時 fallback 鏈需明確（自訂 → 商家 preferred locale → i18n 預設）
- **效能**：每張票額外 join schedule 表，需評估是否快取或預先 batch fetch
