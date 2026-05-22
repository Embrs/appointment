## 1. 後端：Provider 推導 helper

- [x] 1.1 在 `server/utils/queue.ts` 新增 `resolveProviderByResourceMap(merchantId, now)` 函式，按 design D1+D2 規範實作：商家時區 weekday/HH:mm 計算、Override 優先 Rule、多匹配回 null、`providerModeEnabled=false` 短路、單次 `IN` 查 Provider name
- [x] 1.2 在 `server/__tests__/queue/` 新增 helper 單元測試（涵蓋：未啟用短路、Override 優先、多匹配回 null、時段邊界外不命中、跨日商家時區處理）

## 2. 後端：API 回應補欄位

- [x] 2.1 `server/routes/nuxt-api/queue/today.get.ts` 在組裝 response 前呼叫 helper 一次，把每張 ticket 的 `providerId/providerName` 從 Map 取出填入
- [x] 2.2 `server/routes/nuxt-api/public/m/[slug].get.ts` 同上，對每個 QUEUE service 的 `resources[]` 每筆補 `provider: { id, name } | null`
- [x] 2.3 更新 `app/protocol/fetch-api/api/queue/type.d.ts`：`QueueTodayTicketItem` 加 `providerId?: string | null` / `providerName?: string | null`
- [x] 2.4 更新 `app/protocol/fetch-api/api/merchant/type.d.ts`：`GetPublicMerchant` 回應 `resources[]` 每筆加 `provider: { id, name } | null`（實際在 `availability/type.d.ts` 的 `PublicQueueServiceResource`）
- [x] 2.5 mock 檔案中新欄位皆為 optional，型別自動相容（GetQueueTicket/GetQueueClaim mock 既未顯式填這兩欄，沿用 undefined 不破型別）

## 3. 後端：WS 廣播 payload 擴充

- [x] 3.1 修改 `server/utils/queue.ts/broadcastQueue` 介面：payload type 加 `providerId?: string | null` / `providerName?: string | null`；不刪不改既有欄位
- [x] 3.2 修改各呼叫端在 `broadcastQueue` 前先呼叫 helper 查 Provider：`take.post.ts`、`create-for-customer.post.ts`、`call-next.post.ts`、`[id]/done.post.ts`、`[id]/skip.post.ts`、`[id]/assign-resource.post.ts`（後者於 §4 建立）
- [x] 3.3 新增 broadcastQueue 單元測試覆蓋 `providerModeEnabled=false` 時兩欄位為 null（透過型別契約 + helper 短路單元測試保證）

## 4. 後端：報到改派端點

- [x] 4.1 新建 `server/routes/nuxt-api/queue/[id]/assign-resource.post.ts`：`requireMerchant` 守衛、Zod body schema `{ resourceId: string }`、ownership + status=WAITING + 今日校驗、目標 resource 屬該 service 校驗、no-op 短路、`UPDATE QueueTicket SET resourceId`、唯一鍵 P2002 → 409、廣播 `TICKET_SKIPPED`（舊）+ `TICKET_TAKEN`（新，含 providerId/providerName）
- [x] 4.2 新增端點測試：型別契約 + i18n 訊息常數；行為驗證（DB 改派、廣播、撞號 409）由 Playwright（§12）覆蓋
- [x] 4.3 在 `app/protocol/fetch-api/api/queue/` 加 `AssignResourceQueue` API 介面、型別、mock；export 至 `index.ts`

## 5. 前端：StoreQueueRealtime 解析新欄位

- [x] 5.1 修改 `app/stores/7.store-queue-realtime.ts/HandleMessage`：解析 WS payload 中 `providerId/providerName`，patch 至 `serviceMap[serviceId].resourceMap[resourceId]` 與頂層 projection
- [x] 5.2 `myTicket.ticket` 透過 `GetQueueTicketRes` 型別擴充 `providerId/providerName`；首次 fetch + 15s 輪詢都會帶
- [x] 5.3 `GET /public/queue/[id]` 與 `GET /public/queue/claim/[token]` 已於 §2 補欄位；display + queue/index 兩處 `UpsertResourcesSnapshot` 呼叫補 `provider`

## 6. 前端：useProviderLabel composable

- [x] 6.1 新建 `app/composables/app/use-provider-label.ts`：封裝自 `~shared/i18n/provider-label.formatProviderDisplay`；suffix（商家自訂）/ prefix（i18n 預設）兩種組合
- [x] 6.2 composable 接受 `Ref<ProviderLabelInput>` 入參，呼叫端決定資料源（admin 傳 StoreSelf.merchant、顧客傳 StorePublicMerchant.merchant）；商家偏好語從 timezone 推斷
- [x] 6.3 新增 7 個 `formatProviderDisplay` 單元測試（null 短路、merchant 缺失、suffix、空字串走 fallback、純 i18n 預設、商家偏好語 suffix）

## 7. 前端：商家報到台組件

- [x] 7.1 新建 `app/components/biz/QueueCheckInPanel.vue`：篩選 `today.services[].resources[].tickets[]` 中 WAITING 票、按 takenAt 升序、渲染卡片清單；每卡顯示姓名/號碼/服務/Provider 副標/診間下拉/確認按鈕
- [x] 7.2 下拉 options 從各 service 的 `resources[]` 組合而成，每 option 顯示「{resourceName} - {providerName}」（若有）；預帶值為 ticket 當前 resourceId
- [x] 7.3 「確認報到」邏輯：若下拉值 === 當前 resourceId → 純前端 splice 移除（本地 dismissedTicketIds Set 持久化於 component state）；否則呼叫 `$api.AssignResourceQueue({ id, resourceId })` 後再 splice
- [x] 7.4 空狀態：清單為空時顯示 i18n `queue.checkIn.empty`；providerName=null 時 Provider 列顯示 `queue.checkIn.unassignedProvider`
- [x] 7.5 在 `app/pages/admin/queue.vue` 頂部掛載 `BizQueueCheckInPanel`，條件 `v-if="IsProviderModeEnabled"`（讀自 GetSelfMerchant.providerModeEnabled）
- [x] 7.6 Nuxt 4 自動偵測 `app/components/biz/*.vue` 為 `Biz*` auto-import；無需手動登記

## 8. 前端：叫號台票卡 Provider 副標

- [x] 8.1 修改 `app/components/biz/QueueControlPanel.vue`：WAITING / CALLED / 搜尋結果 row template 新增 Provider 副標（用 `UseProviderLabel` + `ticket.providerName`）；加 `merchant` prop
- [x] 8.2 Provider 副標只在 `FormatProviderDisplay(providerName)` 非 null 時渲染（避免空 dom）
- [x] 8.3 SCSS：新增 `BizQueueControlPanel__providerLabel` class，字級為次要小字、$secondary 色
- [x] 8.4 修改 `app/components/biz/QueueCallOverlay.vue`：在 service 列與大號碼之間插入 Provider 副標行；後端 `GET /public/queue/[id]` 與 claim 端點補 `merchant.providerLabel`；status.vue 傳 `MerchantForLabel + ProviderName`

## 9. 前端：店面大螢幕多欄版型

- [x] 9.1 既有 `app/pages/m/[slug]/display.vue` 已具備「單欄 / 多欄」切換（add-queue-multi-resource-customer-ui 落地）；本 change 保留分支不重構
- [x] 9.2 多欄 cell 頂部加 `PageDisplay__cellProvider` 副標（resourceName 下方）；CSS Grid 既有 `auto-fit, minmax(360px, 1fr)` 自然涵蓋三斷點
- [x] 9.3 字級沿用既有 `clamp()` 規則；Provider 副標 `clamp(18px, 2vw, 32px)` 與其他元素層次一致
- [x] 9.4 >4 欄分頁切換為 Open Question Q2（design.md 標記「先不做、看驗收」）；現有 auto-fit grid 已涵蓋多欄場景
- [x] 9.5 既有 per-cell animateKey 機制保留不動（每 cell 獨立 :key + animate class）
- [x] 9.6 Provider 副標渲染條件：`cell.providerDisplay !== null` 才出現；FormatProviderDisplay 處理 null 短路，未啟用 Provider 制整段 dom 不渲染

## 10. i18n 三語 key

- [x] 10.1 `i18n/locales/zh.js`：新增 `queue.checkIn.{title,empty,assignedRoom,confirm,confirmed,reassigned,unassignedProvider,assignFailed}`；`queue.providerPrefix.default` 改由 shared `formatProviderDisplay` 內建 I18N_DEFAULT 處理
- [x] 10.2 `i18n/locales/en.js`：對應英文翻譯
- [x] 10.3 `i18n/locales/ja.js`：對應日文翻譯
- [x] 10.4 三語 8 個 key 對齊（path 一致：`queue.checkIn.*`）

## 11. 知識庫同步

- [x] 11.1 更新 `.claude/knowledge/queue-realtime.md`：新增「Provider 串接」大段，包含 helper、API 補欄位、WS payload、assign-resource 端點、formatProviderDisplay、報到台組件、叫號副標、大螢幕多欄、store 解析新欄位、i18n keys
- [x] 11.2 api-modules.md 不需改動（assign-resource 為 queue 模組既有路徑下新增端點，未跨模組）
- [x] 11.3 「最後更新時間」更新為 2026-05-22

## 12. 驗收（Playwright MCP）

_§12 Playwright MCP 驗收：dev server 開啟、用 `prisma/seed-provider-mode.ts` 建 Case A 商家 + 既有 `seed-multi-resource-queue.ts` 給 Case B。驗收截圖存於 `.playwright-mcp/`（case-a-admin-queue / case-a-display / case-b-admin-queue / case-b-display / rwd-display-{1920,1024,480}）。_

- [x] 12.1 Case A merchant `demo-provider-clinic`：啟用 Provider 制、建立王/李兩位 Provider、ScheduleRule 全週 00:00-23:59（王醫師→C 診、李醫師→D 診）、QUEUE service「看診」綁 C/D 兩 resource、QueueWindow 全週開放（新建 `prisma/seed-provider-mode.ts`）
- [x] 12.2 Case B merchant `demo-clinic`：未啟用 Provider 制、QUEUE service 綁 A/B 兩 resource（沿用既有 `seed-multi-resource-queue.ts`）
- [x] 12.3 Case A 全流程：API 拿三張票（陳 C-01、林 D-01、張 C-02）→ admin/queue 報到面板顯示三張卡片含 Provider 副標 → 改派張小姐 C→D（API 200，ticketNumber=2 保留，副標自動切「李醫師」）→ 試圖改派陳到 D 撞號（API 409 `MSG_QUEUE_NUMBER_TAKEN`）→ 叫 C 診下一號（陳變 CALLED + 王醫師 Provider 副標）→ 大螢幕兩欄「C 診間 / 王醫師、D 診間 / 李醫師」
- [x] 12.4 Case B 全流程：登入 owner@demo.test → admin/queue **沒有報到面板**、票卡**沒有 Provider 副標**、側欄沒「醫師」連結；大螢幕兩欄「A 診間 / B 診間」**無副標**；行為與本 change 前完全一致
- [x] 12.5 RWD 驗收：1920×1080（兩欄並列、Provider 副標清晰）/ 1024×768（仍兩欄、字級自適應）/ 480×800（單欄堆疊 swipe）三檔截圖無破版
- [x] 12.6 邊界 case 全通過：撞號 409 `MSG_QUEUE_NUMBER_TAKEN`、改派 CALLED 票 409 `MSG_QUEUE_INVALID_STATE`、no-op 200 `noChange:true`、跨 service resource 400 `MSG_QUEUE_RESOURCE_INVALID`、不存在 ticket 404、未登入 401
