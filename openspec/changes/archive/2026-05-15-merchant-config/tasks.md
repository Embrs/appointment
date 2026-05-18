## 1. 後端：商家自身 API

- [x] 1.1 `server/routes/nuxt-api/merchant/index.get.ts`：`requireMerchant`；回傳當前 `auth.merchantId` 完整商家欄位（含 logoUrl / coverUrl / cancelPolicy 序列化）
- [x] 1.2 `server/routes/nuxt-api/merchant/[id].put.ts`：`requireMerchant`；`id` 必須等於 `auth.merchantId`（不等回 403）；zod 驗 `{ name?, slug?, description?, logoUrl?, coverUrl?, contactPhone?, contactEmail?, timezone?, address?, cancelPolicy? }`；slug 衝突 409；cancelPolicy 合併寫入（保留現有 key）

## 2. 後端：service CRUD

- [x] 2.1 `service/index.get.ts`：`requireMerchant`；返回所有 deletedAt=null 的 Service，include `resources` 子集；按 `displayOrder asc, createdAt asc`
- [x] 2.2 `service/index.post.ts`：`requireMerchant`；zod 驗 `{ name, description?, bookingMode, durationMinutes?, slotIntervalMinutes?, capacityPerSlot?, priceCents?, isActive?, displayOrder?, resourceIds?: string[] }`；依 bookingMode 對欄位限制（TIME_SLOT → capacity 強制 1；QUEUE → duration/slot 忽略）；transaction：建 Service + ServiceResource
- [x] 2.3 `service/[id].get.ts`：`requireMerchant`；找 merchantId+id 對應 Service（deletedAt=null）；include resourceIds list；404 / 403
- [x] 2.4 `service/[id].put.ts`：同 post 欄位（皆 optional）；transaction：先 update Service，若 body 帶 `resourceIds`，整組覆蓋 `ServiceResource`
- [x] 2.5 `service/[id].delete.ts`：軟刪除 `deletedAt = new Date()`

## 3. 後端：resource CRUD

- [x] 3.1 `resource/index.get.ts`：`requireMerchant`；列出 deletedAt=null Resource；按 `displayOrder asc, createdAt asc`
- [x] 3.2 `resource/index.post.ts`：zod `{ name, description?, isActive?, displayOrder? }`；merchantId from auth
- [x] 3.3 `resource/[id].get.ts`：找對應 Resource，include `services` 摘要
- [x] 3.4 `resource/[id].put.ts`：更新欄位
- [x] 3.5 `resource/[id].delete.ts`：軟刪除

## 4. 後端：schedule（整週規則 + 覆寫 + 休假）

- [x] 4.1 `schedule/rules.get.ts`：`requireMerchant`；query `{ scope?: MERCHANT|RESOURCE, resourceId? }`；無 query 時回所有 rules；返回 `{ rules: ScheduleRule[] }`
- [x] 4.2 `schedule/rules.put.ts`：body `{ scope: MERCHANT|RESOURCE, resourceId?: string|null, rules: Array<{ weekday: 0-6, startTime: HH:mm, endTime: HH:mm }> }`；驗 `startTime < endTime`、weekday 0-6、HH:mm regex；transaction：先 deleteMany `{ merchantId, scope, resourceId }` 再 createMany；返回 `{ rules: 更新後 }`
- [x] 4.3 `schedule/override/index.get.ts`：query `{ from?: yyyy-MM-dd, to?: yyyy-MM-dd }`；返回該區間 ScheduleOverride
- [x] 4.4 `schedule/override/index.post.ts`：body `{ scope, resourceId?, date, startTime?, endTime?, isClosed?, note? }`；同 `(merchantId, scope, resourceId, date)` 已存在 → 409 或 upsert（採 upsert）；返回新 record
- [x] 4.5 `schedule/override/[id].delete.ts`：硬刪除（無關 cascade）

## 5. 後端：holiday

- [x] 5.1 `holiday/index.get.ts`：query `{ year? }`；返回 MerchantHoliday list
- [x] 5.2 `holiday/index.post.ts`：body `{ date, name }`；`@@unique([merchantId, date])` 衝突 → 409
- [x] 5.3 `holiday/[id].delete.ts`：硬刪除

## 6. 後端：upload/image

- [x] 6.1 `server/routes/nuxt-api/upload/image.post.ts`：`requireMerchant`；`readMultipartFormData`；找 field `file`；驗 MIME image/png|jpeg|webp、大小 ≤ 5MB；query `?kind=logo|cover|service|other` 預設 other；key = `merchant/{auth.merchantId}/{kind}/{Date.now()}-{slug(filename)}`
- [x] 6.2 呼叫 `uploadToR2`；成功回 `{ url, key }`；失敗時：dev 環境 + `console.warn` 並回 placeholder URL `https://placehold.co/600x400?text=...`；prod 環境回 500

## 7. 後端：staff 管理（補在 merchant 命名空間下避免與 admin 衝突）

- [x] 7.1 `server/routes/nuxt-api/merchant/staff/index.get.ts`：`requireMerchant`；列當前商家所有 MerchantUser（deletedAt=null），不含 passwordHash
- [x] 7.2 `server/routes/nuxt-api/merchant/staff/index.post.ts`：`requireMerchant({ role: 'OWNER' })`；zod `{ email, password (>=8 含字母+數字), name, role: OWNER|STAFF }`；email 在當前 merchantId 內衝突 409
- [x] 7.3 `server/routes/nuxt-api/merchant/staff/[id].put.ts`：`requireMerchant({ role: 'OWNER' })`；zod `{ name?, password?, role? }`；email 不可改；id 必須 belongs to auth.merchantId 否則 404
- [x] 7.4 `server/routes/nuxt-api/merchant/staff/[id]/toggle-active.post.ts`：`requireMerchant({ role: 'OWNER' })`；若 id === auth.sub → 400「不能停用自己」；toggle

## 8. Protocol：merchant（商家自身視角擴充）

- [x] 8.1 `app/protocol/fetch-api/api/merchant/type.d.ts`：加 `SelfMerchantFull / GetSelfMerchantRes / UpdateSelfMerchantParams / UpdateSelfMerchantRes / CancelPolicy / MerchantStaffItem` 等型別
- [x] 8.2 `app/protocol/fetch-api/api/merchant/index.ts`：新增 `GetSelfMerchant / UpdateSelfMerchant / GetStaffList / CreateStaff / UpdateStaff / ToggleStaffActive`
- [x] 8.3 `app/protocol/fetch-api/api/merchant/mock.ts`：補對應 mock

## 9. Protocol：service / resource / schedule / holiday / upload

- [x] 9.1 新增 `app/protocol/fetch-api/api/service/{index.ts, mock.ts, type.d.ts}`：`GetServiceList / CreateService / GetService / UpdateService / DeleteService`
- [x] 9.2 新增 `app/protocol/fetch-api/api/resource/{index.ts, mock.ts, type.d.ts}`
- [x] 9.3 新增 `app/protocol/fetch-api/api/schedule/{index.ts, mock.ts, type.d.ts}`：`GetScheduleRules / UpdateScheduleRules / GetScheduleOverrides / CreateScheduleOverride / DeleteScheduleOverride`
- [x] 9.4 新增 `app/protocol/fetch-api/api/holiday/{index.ts, mock.ts, type.d.ts}`：`GetHolidayList / CreateHoliday / DeleteHoliday`
- [x] 9.5 新增 `app/protocol/fetch-api/api/upload/{index.ts, mock.ts, type.d.ts}`：`UploadImage` 用 `methods.formData`（FormData）
- [x] 9.6 `app/protocol/fetch-api/index.ts` 彙整 export 新模組

## 10. 業務元件

- [x] 10.1 `app/components/biz/ImageUploader.vue`：v-model URL 字串；接 `kind` prop；內部 `<input type="file">` + 預覽圖；上傳中 loading；錯誤 ElMessage
- [x] 10.2 `app/components/biz/SchedulerWeeklyEditor.vue`：props `{ rules, scope, resourceId? }`；emits `update:rules`；桌機顯示七列、手機顯示 ElCollapse；每列「+ 新增時段」按鈕 → 開 `OpenDialogScheduleRuleEdit`；每段顯示 startTime - endTime + 刪除 X

## 11. 彈窗

- [x] 11.1 商家設定改採 `app/pages/admin/settings.vue` 內嵌表單（三段：基本資訊 / 外觀 / 取消政策；不另開彈窗），存檔呼叫 `UpdateSelfMerchant`
- [x] 11.2 `OpenDialogServiceEdit`：mode `create|edit`；bookingMode select 切換時動態顯示對應欄位；resourceIds 用 ElCheckboxGroup（RESOURCE 模式）；驗證後呼叫 Create/UpdateService
- [x] 11.3 `OpenDialogResourceEdit`：簡單表單
- [x] 11.4 `OpenDialogScheduleRuleEdit`：startTime / endTime 用 ElTimePicker；驗證 start<end
- [x] 11.5 `OpenDialogScheduleOverrideEdit`：date + 開放時間或 isClosed toggle
- [x] 11.6 `OpenDialogHolidayEdit`：date + name
- [x] 11.7 `OpenDialogStaffEdit`：mode create|edit；同 admin-edit pattern；role select；submit 呼叫對應 staff API
- [x] 11.8 全部註冊到 `app/components/open/_index.d.ts` 與 `app/components/open/index.ts`

## 12. 頁面

- [x] 12.1 `app/pages/admin/index.vue`：升級為 Dashboard，三張卡片（服務數 / 資源數 / 今日預約數 placeholder「即將上線」），最近編輯的服務 5 筆
- [x] 12.2 `app/pages/admin/settings.vue`：呼叫 `GetSelfMerchant`；表單編輯所有欄位，logo / cover 用 ImageUploader；取消政策 segment 切換 free / cutoff
- [x] 12.3 `app/pages/admin/share-link.vue`：顯示 `${origin}/m/${slug}` 連結（複製按鈕）+ QR code（用 `qrserver.com` URL 圖檔；無 slug 顯示提示）
- [x] 12.4 `app/pages/admin/services/index.vue`：表格 + 新增按鈕；操作欄「編輯 / 刪除」（刪除 UseAsk 確認）
- [x] 12.5 `app/pages/admin/resources/index.vue`：同模式
- [x] 12.6 `app/pages/admin/schedule/index.vue`：上方 segment「整店 / 各資源」切換 scope；下方 SchedulerWeeklyEditor；底部「特定日期覆寫」list + 新增按鈕
- [x] 12.7 `app/pages/admin/holidays.vue`：清單 + 新增按鈕
- [x] 12.8 `app/pages/admin/staff.vue`：OWNER only（HasRule 檢查；STAFF 進入顯示「無權限」訊息）；表格 + 新增 / 編輯 / 啟用切換

## 13. Layout / Nav

- [x] 13.1 `app/layouts/back-desk.vue`：商家視角 nav 補：首頁 `/admin`、商家設定 `/admin/settings`、對外連結 `/admin/share-link`、服務 `/admin/services`、資源 `/admin/resources`、時段 `/admin/schedule`、休假 `/admin/holidays`、員工 `/admin/staff`（OWNER only `v-if="storeSelf.HasRule('merchant.staff.manage')"`）
- [x] 13.2 nav 改為可滾動（手機橫向滾動）；保留代理紅色橫條邏輯

## 14. i18n

- [x] 14.1 `i18n/locales/{zh,en,ja}.js` 補：
  - `admin.nav.{home,settings,shareLink,services,resources,schedule,holidays,staff}`
  - `admin.actions.{create,edit,delete,save,cancel,confirm}`
  - `admin.bookingMode.{TIME_SLOT,TIME_CAPACITY,RESOURCE,QUEUE}` 標籤
  - `admin.settings.{title,basic,appearance,cancelPolicy,uploadLogo,uploadCover,policyFree,policyCutoff,cutoffHours}`
  - `admin.services.{listTitle,nameLabel,bookingModeLabel,durationLabel,intervalLabel,capacityLabel,priceLabel,resourcesLabel}`
  - `admin.resources.{listTitle,nameLabel}`
  - `admin.schedule.{title,scopeMerchant,scopeResource,weekday[0-6],addSlot,overrides,addOverride,closed}`
  - `admin.holidays.{listTitle,nameLabel,dateLabel}`
  - `admin.staff.{listTitle,roleLabel,roleOwner,roleStaff,toggleActive,cantToggleSelf}`
  - `admin.shareLink.{title,hint,copy,copied,merchantNotConfigured}`
  - `admin.errors.{slugTaken,uploadFailed,saveFailed}`

## 15. 驗證（Playwright MCP）

- [x] 15.1 啟動 `npm run dev` 背景
- [x] 15.2 用 Change 2 註冊+ Change 3 已 ACTIVE 的商家身分登入（或先 seed 一個 ACTIVE 商家）
- [x] 15.3 `/admin/settings`：上傳 logo（用 browser_file_upload）、設 slug、儲存 → 確認 R2 URL（或 placeholder）回傳並顯示預覽
- [x] 15.4 `/admin/services` 新增四種 bookingMode 各一個服務（TIME_SLOT 拔牙 60min、TIME_CAPACITY 團體課 10 人、RESOURCE 醫師看診 15min、QUEUE 排隊看診）
- [x] 15.5 `/admin/resources` 新增 2 個醫師
- [x] 15.6 編輯 RESOURCE 服務綁定兩位醫師
- [x] 15.7 `/admin/schedule`：對醫師 A 設週一週三 09:00-12:00、14:00-18:00；對商家整體設一個下週特定休息日
- [x] 15.8 `/admin/holidays` 加 2026 春節休假
- [x] 15.9 `/admin/share-link` 截圖確認 QR 顯示
- [x] 15.10 browser_resize 375x667 確認手機版 SchedulerWeeklyEditor 不破版
- [x] 15.11 browser_console_messages 無 JS error
- [x] 15.12 截圖存 `~/screenshots/change-4-*.png`

## 16. OpenSpec 收尾

- [x] 16.1 `openspec validate merchant-config --strict` 通過
- [x] 16.2 `npm run lint`：本 change 新增 / 修改檔案無新 lint 錯
- [x] 16.3 歸檔到 `openspec/changes/archive/2026-05-15-merchant-config/`；同步 main specs（`merchant-platform` ADDED、`auth-flow` MODIFIED OWNER 邊界）
