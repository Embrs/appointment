## Why

`admin/resources` 頁的「已綁服務」欄位與 `admin/services` 頁的「資源」欄位目前都寫死只顯示 `RESOURCE / RESOURCE_OPTIONAL` 模式的綁定。前一個 change `add-queue-multi-resource-admin-ui` 開放 QUEUE（號碼牌）模式也可綁定多個資源（每個資源獨立號碼池），但這兩處列表沒同步更新，導致商家設定了「看診（QUEUE 模式）」綁定 A 診 / B 診後，兩邊列表都看不到綁定關係——商家會誤判「綁定沒生效」並重複設定，或無法判斷某資源是否被使用。

對應 `merchant-platform` spec 第 853 行 Requirement「資源頁顯示綁定服務」的字面條文也寫死了 `bookingMode === 'RESOURCE'`，所以 spec 與實作同時需要修正。

## What Changes

- 修正 `app/pages/admin/resources/index.vue` 計算 `boundServicesByResource` 時納入 `bookingMode === 'QUEUE'` 服務的 `resourceIds`
- 修正 `app/pages/admin/services/index.vue` 的「資源」column 渲染條件：只要 `resourceIds.length > 0` 就顯示，不再依賴 bookingMode（同時涵蓋 RESOURCE / RESOURCE_OPTIONAL / QUEUE）
- 修正 i18n 三語 `admin.resources.boundServicesHint` 的提示文字，移除「RESOURCE 模式」這種綁特定模式的字眼，改為中性說法（「在『服務』頁編輯時勾選此資源」之類）
- 不變更後端 API、Prisma schema、protocol 型別——後端 `GetServiceList` 早已回傳所有模式的 `resourceIds`

## Capabilities

### New Capabilities

（無新增）

### Modified Capabilities

- `merchant-platform`：
  - 修改 Requirement「資源頁顯示綁定服務」——把 `bookingMode === 'RESOURCE'` 改成「任何透過 ServiceResource 綁定的 service」，含 RESOURCE / RESOURCE_OPTIONAL / QUEUE 三種模式
  - 新增 Requirement「服務頁顯示綁定資源」——`/admin/services` 列表的「資源」column 須顯示 service 所有綁定的 resource 名稱，不依 bookingMode 過濾

## Impact

- **影響檔案**：
  - [app/pages/admin/resources/index.vue](app/pages/admin/resources/index.vue) — 計算屬性過濾條件
  - [app/pages/admin/services/index.vue](app/pages/admin/services/index.vue) — 「資源」column 渲染條件
  - [i18n/locales/zh.js](i18n/locales/zh.js)、[i18n/locales/en.js](i18n/locales/en.js)、[i18n/locales/ja.js](i18n/locales/ja.js) — `admin.resources.boundServicesHint` 文案
- **不影響**：
  - 後端 API（`server/routes/nuxt-api/service/*`、`server/routes/nuxt-api/resource/*`）
  - Prisma schema、ServiceResource 表結構
  - protocol 型別定義（`ServiceItem.resourceIds` 已是 `string[]`）
- **部署/資料遷移**：純前端 + i18n，**無需資料庫遷移**，測試站 / 正式站直接重新部署即可。
