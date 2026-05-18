## Why

Change 3（`platform-admin-console`）已讓管理員能審核 PENDING 商家並代理進入後台；但商家被審核通過後**沒有任何 UI / API 讓他們設定商家資訊、服務、資源、營業時段、休假、員工**。藍圖中四種預約模式（TIME_SLOT / TIME_CAPACITY / RESOURCE / QUEUE）的核心配置、服務↔資源多對多、每週時段規則 + 特定日期覆寫 + 整店休假，全部仰賴本 change 把資料面與 UI 拉通。

完成後 Change 5（availability-engine）可直接消費 `ScheduleRule / ScheduleOverride / MerchantHoliday / Service.slotIntervalMinutes`；Change 6（customer-booking-flow）能在已配置的服務 + 資源上開預約。

## What Changes

- **後端 API**（`server/routes/nuxt-api/`，全部需 `requireMerchant` 並以 `auth.merchantId` 限定 tenancy；員工層級限制透過 `StoreSelf.HasRule` 在前端遮蔽 OWNER-only 操作）：
  - `merchant/index.get.ts`：當前商家自己的完整資訊（含 logoUrl / coverUrl / cancelPolicy / slug）
  - `merchant/[id].put.ts`：更新自己的商家（含 logo/cover URL 寫入、cancelPolicy JSON、slug 衝突檢查）
  - `service/index.get.ts`、`service/index.post.ts`、`service/[id].{get,put,delete}.ts`：服務 CRUD（含 bookingMode 切換、resourceIds 關聯）
  - `resource/index.get.ts`、`resource/index.post.ts`、`resource/[id].{get,put,delete}.ts`：資源 CRUD
  - `schedule/rules.get.ts`、`schedule/rules.put.ts`：一次回傳 / 設定整週規則（含 MERCHANT scope 與每個 RESOURCE scope）
  - `schedule/override/index.get.ts`、`schedule/override/index.post.ts`、`schedule/override/[id].delete.ts`：特定日期覆寫
  - `holiday/index.get.ts`、`holiday/index.post.ts`、`holiday/[id].delete.ts`：整店休假日
  - `upload/image.post.ts`：multipart 上傳 → R2；R2 未配置時 fallback 回 placeholder URL（與 tinymce/upload.post.ts 一致的優雅降級）
- **Protocol 擴充**：
  - 擴充 `app/protocol/fetch-api/api/merchant/`（自身視角）：`GetSelfMerchant / UpdateSelfMerchant`
  - 新增 `app/protocol/fetch-api/api/service/`
  - 新增 `app/protocol/fetch-api/api/resource/`
  - 新增 `app/protocol/fetch-api/api/schedule/`
  - 新增 `app/protocol/fetch-api/api/holiday/`
  - 新增 `app/protocol/fetch-api/api/upload/`（單一 `UploadImage` 走 formData）
- **頁面**（全部 `back-desk` layout + `merchant` middleware）：
  - `app/pages/admin/index.vue`：Dashboard（今日預約數預留卡片，從 placeholder 升級）
  - `app/pages/admin/settings.vue`：商家資訊（logo / cover / slug / 描述 / 聯絡 / 取消政策）
  - `app/pages/admin/share-link.vue`：顯示 `/m/{slug}` 連結 + QR code
  - `app/pages/admin/services/index.vue`：服務清單 + 新增 / 編輯彈窗
  - `app/pages/admin/resources/index.vue`：資源清單 + 新增 / 編輯彈窗
  - `app/pages/admin/schedule/index.vue`：七天網格時段編輯器 + 特定日期覆寫
  - `app/pages/admin/holidays.vue`：休假日新增 / 刪除
  - `app/pages/admin/staff.vue`：MerchantUser 管理（OWNER only）
- **彈窗**：
  - `OpenDialogMerchantSettings` — 商家設定彈窗（可在 share-link 頁也可叫出）
  - `OpenDialogServiceEdit` — 服務新增 / 編輯（含 bookingMode 切換對應欄位動態顯示、resourceIds 多選）
  - `OpenDialogResourceEdit` — 資源新增 / 編輯
  - `OpenDialogScheduleRuleEdit` — 單筆每週規則編輯（時間 + 範圍）
  - `OpenDialogScheduleOverrideEdit` — 特定日期覆寫
  - `OpenDialogHolidayEdit` — 休假日新增
  - `OpenDialogStaffEdit` — 員工新增 / 編輯（OWNER only）
- **元件**：
  - `app/components/biz/SchedulerWeeklyEditor.vue`：七天網格時段編輯（MERCHANT scope 或 RESOURCE scope）
  - `app/components/biz/ImageUploader.vue`：通用圖片上傳（multipart → upload/image）+ 預覽
- **Layout / nav 補齊**：
  - `app/layouts/back-desk.vue`：商家視角 nav 補完整連結（首頁 / 商家設定 / 對外連結 / 服務 / 資源 / 時段 / 休假 / 員工）；OWNER-only 連結（員工 / 商家設定）以 `HasRule()` 控制顯示
- **i18n**：補三語 key `admin.nav.*`、`admin.settings.*`、`admin.services.*`、`admin.resources.*`、`admin.schedule.*`、`admin.holidays.*`、`admin.staff.*`、`admin.shareLink.*`、`admin.actions.*`、`admin.bookingMode.*`、`admin.errors.*`

### 非本 change 範圍（明確排除）

- 可預約時段算法（屬 Change 5）
- 顧客端預約流程、商家端預約管理（屬 Change 6）
- 號碼牌相關（屬 Change 7）
- 廣告插槽、cron 歸檔（屬 Change 8）
- AuditLog
- 員工密碼重設 token 機制（沿用 forgot-password）

## Capabilities

### New Capabilities

- `merchant-platform`：商家後台核心配置完整 spec（商家自身、服務、資源、時段、休假、員工、圖片上傳）

### Modified Capabilities

- `auth-flow`：補「OWNER-only 操作邊界」要求 — 員工管理、商家設定、上傳 logo / cover 屬 OWNER 專屬；服務 / 資源 / 時段 / 休假 OWNER 與 STAFF 共享編輯權

## Impact

- **新增檔案**：
  - `server/routes/nuxt-api/merchant/{index.get, [id].put}.ts`
  - `server/routes/nuxt-api/service/{index.get, index.post, [id].get, [id].put, [id].delete}.ts`
  - `server/routes/nuxt-api/resource/{index.get, index.post, [id].get, [id].put, [id].delete}.ts`
  - `server/routes/nuxt-api/schedule/{rules.get, rules.put}.ts`
  - `server/routes/nuxt-api/schedule/override/{index.get, index.post, [id].delete}.ts`
  - `server/routes/nuxt-api/holiday/{index.get, index.post, [id].delete}.ts`
  - `server/routes/nuxt-api/upload/image.post.ts`
  - `app/protocol/fetch-api/api/{service, resource, schedule, holiday, upload}/{index.ts, mock.ts, type.d.ts}`
  - `app/pages/admin/{settings, share-link, services/index, resources/index, schedule/index, holidays, staff}.vue`
  - `app/components/open/dialog/{merchant-settings, service-edit, resource-edit, schedule-rule-edit, schedule-override-edit, holiday-edit, staff-edit}.vue`
  - `app/components/biz/{SchedulerWeeklyEditor, ImageUploader}.vue`
- **修改檔案**：
  - `app/layouts/back-desk.vue`（補商家後台完整 nav）
  - `app/pages/admin/index.vue`（從 placeholder 升級為 Dashboard 卡片）
  - `app/protocol/fetch-api/api/merchant/{index.ts, mock.ts, type.d.ts}`（補商家自身視角 API）
  - `app/protocol/fetch-api/index.ts`（彙整新模組）
  - `app/components/open/_index.d.ts` 與 `app/components/open/index.ts`（註冊新 dialog）
  - `i18n/locales/{zh,en,ja}.js`（補商家後台三語 key）
- **依賴**：使用 [`qrcode`](https://www.npmjs.com/package/qrcode) 套件渲染 QR；尚未安裝則 `share-link.vue` 用 `qrserver.com` API 兜底（無外網時降級到純文字連結展示）。
- **下游依賴**：Change 5（availability-engine）讀本 change 寫入的 ScheduleRule / Override / Holiday；Change 6（customer-booking-flow）讀 Service / Resource。
