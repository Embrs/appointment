# merchant-platform Specification

## Purpose
TBD - created by archiving change merchant-config. Update Purpose after archive.
## Requirements
### Requirement: 商家自身資訊讀寫

系統 SHALL 提供商家讀取與修改**自己**的商家資訊端點，所有操作以 `auth.merchantId` 為唯一 tenancy 依據，不允許跨商家。

#### Scenario: 取得自身商家

- **GIVEN** 已登入商家
- **WHEN** `GET /nuxt-api/merchant`
- **THEN** 響應 200，`data.merchant` 含完整欄位（id、slug、name、description、logoUrl、coverUrl、cancelPolicy、contactPhone、contactEmail、timezone、address、status、createdAt、updatedAt）

#### Scenario: 修改自身商家

- **GIVEN** 已登入商家、`id === auth.merchantId`
- **WHEN** `PUT /nuxt-api/merchant/[id]` body 含 `{ name?, slug?, description?, logoUrl?, coverUrl?, contactPhone?, contactEmail?, timezone?, address?, cancelPolicy? }`
- **THEN** 響應 200，DB 同步更新；cancelPolicy 與既有 Json 合併（保留未提及 key）

#### Scenario: 嘗試修改他人商家

- **GIVEN** 已登入商家
- **WHEN** `PUT /nuxt-api/merchant/[id]` 但 `id !== auth.merchantId`
- **THEN** 響應 403

#### Scenario: slug 衝突

- **WHEN** 新 slug 已被其他商家使用
- **THEN** 響應 409，三語訊息「網址已被使用」

#### Scenario: cancelPolicy 結構驗證

- **WHEN** body `cancelPolicy = { mode: 'cutoff', hoursBeforeCannotCancel: 24 }`
- **THEN** 響應 200；mode='cutoff' 時 hoursBeforeCannotCancel 必為整數 1–168

#### Scenario: cancelPolicy 結構錯誤

- **WHEN** `cancelPolicy.mode='cutoff'` 但 `hoursBeforeCannotCancel` 缺失或 < 1
- **THEN** 響應 400

### Requirement: 服務 CRUD

系統 SHALL 提供 Service 的列表 / 詳情 / 新增 / 更新 / 軟刪除端點，並強制以 `auth.merchantId` 限定。

#### Scenario: 列表

- **GIVEN** 已登入商家
- **WHEN** `GET /nuxt-api/service`
- **THEN** 響應 200，`data.items` 為當前 merchantId、deletedAt=null 的所有 Service；每筆含 `resourceIds: string[]`；按 `displayOrder asc, createdAt asc`

#### Scenario: 新增服務（TIME_SLOT）

- **WHEN** `POST /nuxt-api/service` body `{ name: '拔牙', bookingMode: 'TIME_SLOT', durationMinutes: 60, slotIntervalMinutes: 30 }`
- **THEN** 響應 200，DB 寫入；capacityPerSlot 預設 1

#### Scenario: 新增服務（TIME_CAPACITY）

- **WHEN** body `{ name: '團體課', bookingMode: 'TIME_CAPACITY', durationMinutes: 60, slotIntervalMinutes: 60, capacityPerSlot: 10 }`
- **THEN** 響應 200

#### Scenario: 新增服務（RESOURCE + resourceIds）

- **WHEN** body `{ name: '醫師看診', bookingMode: 'RESOURCE', durationMinutes: 15, slotIntervalMinutes: 15, resourceIds: ['r1', 'r2'] }`
- **THEN** 響應 200；DB 寫入 Service + 兩筆 ServiceResource

#### Scenario: 新增服務（QUEUE）

- **WHEN** body `{ name: '排隊', bookingMode: 'QUEUE' }`
- **THEN** 響應 200；durationMinutes / capacityPerSlot 忽略（用 schema default）

#### Scenario: RESOURCE 模式但 resourceIds 含其他商家資源

- **WHEN** `resourceIds` 含的 id 不屬於 `auth.merchantId`
- **THEN** 響應 400 或 403（拒絕跨商家連結）

#### Scenario: 更新服務（整組覆蓋 resourceIds）

- **GIVEN** Service 已存在綁定 `[r1, r2]`
- **WHEN** `PUT /nuxt-api/service/[id]` body `{ resourceIds: ['r2', 'r3'] }`
- **THEN** transaction 內 deleteMany 既有 ServiceResource 後 createMany `[r2, r3]`；最終只剩 r2、r3 關聯

#### Scenario: 軟刪除

- **WHEN** `DELETE /nuxt-api/service/[id]`
- **THEN** Service.deletedAt = now；列表不再出現

#### Scenario: 查不存在或他人服務

- **WHEN** id 不存在 / 屬其他 merchant / 已軟刪
- **THEN** 響應 404

### Requirement: 資源 CRUD

系統 SHALL 提供 Resource 同型態端點。

#### Scenario: 列表

- **WHEN** `GET /nuxt-api/resource`
- **THEN** 響應 200，所有當前商家 deletedAt=null 資源；按 `displayOrder asc, createdAt asc`

#### Scenario: 新增

- **WHEN** `POST /nuxt-api/resource` body `{ name: '王醫師' }`
- **THEN** 響應 200

#### Scenario: 編輯 / 軟刪

- **WHEN** PUT / DELETE，id 屬當前商家
- **THEN** 對應 update / 軟刪除

### Requirement: 整週時段規則設定

系統 SHALL 提供整週 ScheduleRule 的讀取與**整組覆蓋**寫入端點，按 `(merchantId, scope, resourceId)` 範圍隔離。

#### Scenario: 讀取所有規則

- **WHEN** `GET /nuxt-api/schedule/rules`
- **THEN** 響應 200，`data.rules` 為當前商家所有 ScheduleRule（含 MERCHANT 與 RESOURCE 兩種 scope）

#### Scenario: 讀取單一 scope

- **WHEN** `GET /nuxt-api/schedule/rules?scope=RESOURCE&resourceId=r1`
- **THEN** 響應 200，僅該 scope+resourceId 的規則

#### Scenario: 整組覆蓋 MERCHANT scope

- **GIVEN** 商家 MERCHANT scope 既有 3 筆 ScheduleRule
- **WHEN** `PUT /nuxt-api/schedule/rules` body `{ scope: 'MERCHANT', rules: [{ weekday: 1, startTime: '09:00', endTime: '12:00' }] }`
- **THEN** transaction 內 deleteMany 既有 3 筆後 createMany 新 1 筆；RESOURCE scope 規則完全不動

#### Scenario: 整組覆蓋特定資源

- **WHEN** `PUT` body `{ scope: 'RESOURCE', resourceId: 'r1', rules: [...] }`
- **THEN** 僅該 (RESOURCE, r1) 範圍替換；其他資源規則不動

#### Scenario: startTime ≥ endTime

- **WHEN** body 含任一 rule `startTime >= endTime`
- **THEN** 響應 400

#### Scenario: HH:mm 格式錯誤 / weekday 超範圍

- **WHEN** body 含 `weekday: 7` 或 `startTime: '9:00'`（缺零）
- **THEN** 響應 400

### Requirement: 特定日期覆寫

系統 SHALL 提供 ScheduleOverride CRUD 端點，按 `(merchantId, scope, resourceId, date)` 唯一。

#### Scenario: 列表

- **WHEN** `GET /nuxt-api/schedule/override?from=2026-05-15&to=2026-06-15`
- **THEN** 響應 200，list 該區間 override

#### Scenario: 新增（特定日期休息）

- **WHEN** `POST /nuxt-api/schedule/override` body `{ scope: 'MERCHANT', date: '2026-06-01', isClosed: true, note: '盤點' }`
- **THEN** 響應 200；DB upsert（若 (merchantId, scope, resourceId, date) 重複則更新）

#### Scenario: 新增（特定日期改時間）

- **WHEN** body `{ scope: 'RESOURCE', resourceId: 'r1', date: '2026-06-02', startTime: '10:00', endTime: '14:00' }`
- **THEN** 響應 200

#### Scenario: 刪除

- **WHEN** `DELETE /nuxt-api/schedule/override/[id]`
- **THEN** 響應 200；DB delete

### Requirement: 整店休假日

系統 SHALL 提供 MerchantHoliday CRUD。

#### Scenario: 列表

- **WHEN** `GET /nuxt-api/holiday`
- **THEN** 響應 200，list 當前商家所有休假日；可選 `?year=2026` 過濾

#### Scenario: 新增

- **WHEN** `POST /nuxt-api/holiday` body `{ date: '2026-02-17', name: '春節' }`
- **THEN** 響應 200

#### Scenario: 同日重複

- **WHEN** 同一 `(merchantId, date)` 再次 POST
- **THEN** 響應 409

#### Scenario: 刪除

- **WHEN** `DELETE /nuxt-api/holiday/[id]`
- **THEN** 響應 200

### Requirement: 圖片上傳

系統 SHALL 提供 `POST /nuxt-api/upload/image` multipart 端點，將圖片儲存到 R2 並回 public URL。

#### Scenario: 成功上傳 logo

- **GIVEN** R2 已配置、商家已登入
- **WHEN** 提交 multipart `file=logo.png`、query `?kind=logo`
- **THEN** 響應 200，`data.url` 為 R2 endpoint URL，`data.key = merchant/{merchantId}/logo/{timestamp}-logo.png`

#### Scenario: 非圖片

- **WHEN** 提交 `file.txt`（text/plain）
- **THEN** 響應 400，三語訊息「僅支援 PNG/JPEG/WebP 圖片」

#### Scenario: 檔案過大

- **WHEN** 提交 > 5MB 的圖片
- **THEN** 響應 400，三語訊息「圖片需在 5MB 以內」

#### Scenario: R2 未配置（dev fallback）

- **GIVEN** `process.env.NODE_ENV !== 'production'` 且 R2 環境變數缺失
- **WHEN** 成功提交合法圖片
- **THEN** 響應 200，`data.url` 為 `https://placehold.co/...` placeholder

#### Scenario: 未登入

- **WHEN** 無 token
- **THEN** 響應 401

### Requirement: 商家成員管理

系統 SHALL 提供 MerchantUser 在當前商家下的 CRUD 與啟用切換，OWNER-only。

#### Scenario: 列表

- **WHEN** `GET /nuxt-api/merchant/staff`
- **THEN** 響應 200，list 當前商家 MerchantUser（不含 passwordHash）

#### Scenario: 新增

- **GIVEN** 當前用戶 role='OWNER'
- **WHEN** `POST /nuxt-api/merchant/staff` body `{ email, password, name, role: 'STAFF' }`
- **THEN** 響應 200；DB insert MerchantUser

#### Scenario: STAFF 嘗試新增

- **GIVEN** 當前用戶 role='STAFF'
- **WHEN** 呼叫 POST
- **THEN** 響應 401

#### Scenario: email 衝突（同商家內）

- **WHEN** 該 merchantId + email 已存在
- **THEN** 響應 409

#### Scenario: 編輯 / 切換啟用

- **WHEN** PUT / toggle-active
- **THEN** 對應更新

#### Scenario: 不能停用自己

- **WHEN** `toggle-active` 的 id === auth.sub
- **THEN** 響應 400

### Requirement: 商家後台配置頁面

系統 SHALL 提供八個 `back-desk` layout + `merchant` middleware 保護的頁面。

#### Scenario: Dashboard /admin

- **GIVEN** 商家已登入
- **WHEN** 訪 `/admin`
- **THEN** 渲染 Dashboard，三張卡片（服務數、資源數、今日預約數預留 "—"）+ 最近編輯服務列表

#### Scenario: 設定 /admin/settings

- **WHEN** 訪 `/admin/settings`
- **THEN** 渲染商家欄位編輯表單（含 logo / cover ImageUploader、cancelPolicy 選擇）

#### Scenario: 對外連結 /admin/share-link

- **WHEN** 訪 `/admin/share-link`
- **THEN** 渲染 `/m/{slug}` 連結（複製按鈕）+ QR code 圖片

#### Scenario: 服務 /admin/services

- **WHEN** 訪 `/admin/services`
- **THEN** 渲染表格 + 新增 / 編輯彈窗；bookingMode 切換時對應欄位動態顯示

#### Scenario: 資源 /admin/resources

- **WHEN** 訪 `/admin/resources`
- **THEN** 渲染表格 + 新增 / 編輯彈窗

#### Scenario: 時段 /admin/schedule

- **WHEN** 訪 `/admin/schedule`
- **THEN** 渲染 scope 切換（MERCHANT / 各 RESOURCE）+ SchedulerWeeklyEditor + 特定日期覆寫清單

#### Scenario: 休假 /admin/holidays

- **WHEN** 訪 `/admin/holidays`
- **THEN** 渲染休假日清單 + 新增彈窗

#### Scenario: 員工 /admin/staff（OWNER only）

- **GIVEN** 當前用戶 role='OWNER'
- **WHEN** 訪 `/admin/staff`
- **THEN** 渲染員工表格 + 新增 / 編輯 / 啟用切換

#### Scenario: 員工頁 STAFF 訪問

- **GIVEN** 當前用戶 role='STAFF'
- **WHEN** 訪 `/admin/staff`
- **THEN** 顯示「無權限」訊息，不渲染表格

#### Scenario: 非商家訪 /admin/*

- **GIVEN** 未登入或 selfType !== 'merchant'
- **WHEN** 訪 `/admin/*`
- **THEN** middleware 跳轉到 `/sign-in`

### Requirement: SchedulerWeeklyEditor 元件

`app/components/biz/SchedulerWeeklyEditor.vue` SHALL 提供桌機 / 手機雙形態的整週時段編輯介面。

#### Scenario: 桌機顯示七列

- **GIVEN** viewport ≥ 641px
- **WHEN** 元件渲染
- **THEN** 顯示週日到週六七個橫列，每列含該日多個時段段落 + 「新增時段」按鈕

#### Scenario: 手機顯示折疊清單

- **GIVEN** viewport ≤ 640px
- **WHEN** 元件渲染
- **THEN** 顯示 ElCollapse 七節，每節展開該日所有時段

#### Scenario: 新增時段段落

- **WHEN** 點擊任一天的「新增時段」
- **THEN** 開啟 `OpenDialogScheduleRuleEdit`；確認後新增到該日 rules array

#### Scenario: 刪除時段段落

- **WHEN** 點擊段落上的 X
- **THEN** 從 rules array 移除

#### Scenario: 儲存整週

- **WHEN** 元件呼叫 emit `update:rules`，父元件呼叫 `UpdateScheduleRules`
- **THEN** 後端整組覆蓋

### Requirement: ImageUploader 元件

`app/components/biz/ImageUploader.vue` SHALL 提供 v-model URL 字串的圖片上傳介面。

#### Scenario: 選檔上傳

- **GIVEN** 商家在 settings 頁
- **WHEN** 點擊上傳區、選擇 logo.png
- **THEN** 元件呼叫 `UploadImage({ file, kind: 'logo' })`、loading 中顯示遮罩；成功後 emit v-model 為新 URL

#### Scenario: 上傳失敗

- **WHEN** API 回非 200
- **THEN** ElMessage.error 顯示三語錯誤訊息

#### Scenario: 預覽

- **GIVEN** v-model 有值
- **WHEN** 元件渲染
- **THEN** 使用 ElImage 顯示預覽

### Requirement: Protocol bindings

`app/protocol/fetch-api/api/{merchant, service, resource, schedule, holiday, upload}/` SHALL 暴露商家後台所有 API 方法，並支援 `NUXT_PUBLIC_TEST_MODE='T'` 時走 mock。

#### Scenario: service 模組 mock 路由

- **GIVEN** testMode='T'
- **WHEN** 呼叫 `$api.GetServiceList()`
- **THEN** 回 mock 資料，不發 HTTP 請求

#### Scenario: schedule 模組真實路由

- **GIVEN** testMode='F'
- **WHEN** 呼叫 `$api.UpdateScheduleRules({ scope: 'MERCHANT', rules: [...] })`
- **THEN** 向 `PUT /nuxt-api/schedule/rules` 發請求

