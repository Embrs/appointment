## 1. 前置盤點

- [x] 1.1 確認本變更**不涉及** Prisma schema / migration / API / enum 值；於 PR 描述聲明「純前端 i18n value + layout template 變更」
- [x] 1.2 grep 列出所有引用點：`back-desk.vue` 4 處 + `app/pages/m/[slug]/index.vue:71` 1 處（顧客端共用 `admin.nav.services`，已於 design 預期）
- [x] 1.3 確認 `app/layouts/back-desk.vue` 中 `/admin/providers` 位於 sectionOperate 行 103–106（變更前快照）

## 2. Sidebar 結構調整

- [x] 2.1 修改 `app/layouts/back-desk.vue` template：把 providers NuxtLinkLocale 從 sectionOperate 整段剪下
- [x] 2.2 將該段貼到 sectionSettings 區塊內，位置介於 `對外連結 (share-link)` 之後、`服務 (services)` 之前
- [x] 2.3 確認 `t('admin.nav.providers', { label: providerLabel })` 的綁定與插值不動
- [x] 2.4 `v-if="providerModeEnabled"` 條件保留

## 3. i18n value 重命名（中文 zh.js）

- [x] 3.1 `admin.nav.services` "服務" → "服務項目"
- [x] 3.2 `admin.nav.resources` "資源" → "場所或設備"
- [x] 3.3 `admin.nav.staff` "成員" → "成員帳號"
- [x] 3.4 `admin.services.listTitle` "服務管理" → "服務項目管理"
- [x] 3.5 `admin.services.nameLabel` "服務名稱" → "項目名稱"；`admin.services.durationLabel` "服務時長（分鐘）" → "項目時長（分鐘）"
- [x] 3.6 `admin.services.resourcesLabel` "綁定資源" → "綁定場所或設備"
- [x] 3.7 `admin.services.providersLabel` "可服務的{label}" 不動（{label} 為 providerLabel）；`providersHint` / `providersEmptyError` 不動
- [x] 3.8 `admin.serviceEditCreate` "新增服務" → "新增項目"；`serviceEditEdit` "編輯服務" → "編輯項目"
- [x] 3.9 `admin.selectService` "請選擇服務" → "請選擇服務項目"
- [x] 3.10 `admin.resources.listTitle` "資源管理" → "場所或設備管理"
- [x] 3.11 `admin.resources.nameLabel` "資源名稱" → "名稱"（場所或設備名稱可省略「名稱」前綴避免重複）
- [x] 3.12 `admin.resources.boundServices` "已綁服務" → "已綁服務項目"；`boundServicesHint` 中「請在「服務」頁編輯服務時勾選此資源」→「請在『服務項目』頁編輯項目時勾選此場所或設備」
- [x] 3.13 `admin.resourceEditCreate` "新增資源" → "新增場所或設備"；`resourceEditEdit` "編輯資源" → "編輯場所或設備"
- [x] 3.14 `admin.selectResource` "請選擇資源" → "請選擇場所或設備"
- [x] 3.15 `admin.schedule.scopeResource` "資源" → "場所或設備"
- [x] 3.16 `admin.schedule.unboundResource.title` "此資源尚未被任何服務綁定…" → "此場所或設備尚未被任何服務項目綁定…"；`action` "前往服務頁綁定 →" → "前往服務項目頁綁定 →"
- [x] 3.17 `admin.schedule.emptyNoService` "尚未建立任何服務,請先到「服務」頁建立" → "尚未建立任何服務項目,請先到『服務項目』頁建立"；`goCreateService` "前往服務頁 →" → "前往服務項目頁 →"
- [x] 3.18 `admin.schedule.affects` "影響服務:{names}" → "影響服務項目:{names}"；`affectsAll` "影響:整店所有服務" → "影響:整店所有服務項目"；`affectsNone` "尚無對應服務" → "尚無對應服務項目"；`affectsCount` "影響 {n} 個服務" → "影響 {n} 個服務項目"
- [x] 3.19 `admin.staff.listTitle` 與相關標題 → "成員帳號"
- [x] 3.20 `admin.staffEditCreate` "新增成員" → "新增成員帳號"；`staffEditEdit` "編輯成員" → "編輯成員帳號"
- [x] 3.21 `admin.bookingMode.RESOURCE` "指定資源" → "場所或設備指定"
- [x] 3.22 `admin.bookingMode.RESOURCE_OPTIONAL` "可選資源" → "可選場所或設備"
- [x] 3.23 `admin.services.bookingModeLabel` 不動；其他含「服務」「資源」「成員」字眼之 hint/error/empty 字串掃描補完
- [x] 3.24 `grep -n "服務\|資源\|成員" i18n/locales/zh.js` 結果掃過一遍，殘留「服務人員」「服務時長（分鐘）→項目時長」等專有複合詞要正確保留或更新

## 4. i18n value 重命名（英文 en.js）

- [x] 4.1 `admin.nav.services` "Services" → "Service Items"
- [x] 4.2 `admin.nav.resources` "Resources" → "Venue or Equipment"
- [x] 4.3 `admin.nav.staff` "Staff" → "Member Accounts"
- [x] 4.4 `admin.services.listTitle` "Services" → "Service Items"；`nameLabel` "Service name" → "Item name"
- [x] 4.5 `admin.services.boundServices` 對應「Bound Service Items」（注意：資源頁面看的是「已綁服務項目」方向）
- [x] 4.6 `admin.serviceEditCreate` "Add Service" → "Add Item"；`serviceEditEdit` "Edit Service" → "Edit Item"
- [x] 4.7 `admin.selectService` "Please select a service" → "Please select a service item"
- [x] 4.8 `admin.resources.listTitle` "Resources" → "Venues or Equipment"；`nameLabel` "Resource name" → "Name"
- [x] 4.9 `admin.resources.boundServicesHint` "Edit a service and check this resource…" → "Edit a service item and check this venue/equipment…"
- [x] 4.10 `admin.resourceEditCreate` "Add Resource" → "Add Venue/Equipment"；`resourceEditEdit` "Edit Resource" → "Edit Venue/Equipment"
- [x] 4.11 `admin.selectResource` "Please select a resource" → "Please select a venue or equipment"
- [x] 4.12 `admin.schedule.scopeResource` "Resource" → "Venue/Equipment"
- [x] 4.13 `admin.schedule.unboundResource.title` / `action` 英文版同步更新
- [x] 4.14 `admin.schedule.emptyNoService` "No services yet…" → "No service items yet…"；`goCreateService` "Go to Services →" → "Go to Service Items →"
- [x] 4.15 `admin.schedule.affects*` 系列英文同步
- [x] 4.16 `admin.staff.listTitle` "Staff" → "Member Accounts"
- [x] 4.17 `admin.staffEditCreate` "Add Staff Member" → "Add Member Account"；`staffEditEdit` "Edit Staff Member" → "Edit Member Account"
- [x] 4.18 `admin.bookingMode.RESOURCE` → "Venue or Equipment Required"；`RESOURCE_OPTIONAL` → "Venue or Equipment Optional"

## 5. i18n value 重命名（日文 ja.js）

- [x] 5.1 `admin.nav.services` "サービス" → "サービス項目"
- [x] 5.2 `admin.nav.resources` "リソース" → "場所・設備"
- [x] 5.3 `admin.nav.staff` "メンバー" → "メンバーアカウント"
- [x] 5.4 `admin.services.listTitle` "サービス" → "サービス項目"；`nameLabel` "サービス名" → "項目名"
- [x] 5.5 `admin.services.resourcesLabel` "紐付けリソース" → "紐付けの場所・設備"
- [x] 5.6 `admin.serviceEditCreate` "サービス追加" → "サービス項目追加"；`serviceEditEdit` "サービス編集" → "サービス項目編集"
- [x] 5.7 `admin.selectService` "サービスを選択してください" → "サービス項目を選択してください"
- [x] 5.8 `admin.resources.listTitle` "リソース" → "場所・設備"；`nameLabel` "リソース名" → "名称"
- [x] 5.9 `admin.resources.boundServices` "紐付けサービス" → "紐付けのサービス項目"；`boundServicesHint` 同步更新
- [x] 5.10 `admin.resourceEditCreate` "リソース追加" → "場所・設備の追加"；`resourceEditEdit` "リソース編集" → "場所・設備の編集"
- [x] 5.11 `admin.selectResource` "リソースを選択してください" → "場所・設備を選択してください"
- [x] 5.12 `admin.schedule.scopeResource` "リソース" → "場所・設備"
- [x] 5.13 `admin.schedule.unboundResource.title` / `action` 日文版同步更新
- [x] 5.14 `admin.schedule.emptyNoService` 系列「サービス」→「サービス項目」
- [x] 5.15 `admin.schedule.affects*` 系列「サービス」→「サービス項目」、`affectsAll` "店舗全体のサービス" → "店舗全体のサービス項目"
- [x] 5.16 `admin.staff.listTitle` "メンバー" → "メンバーアカウント"
- [x] 5.17 `admin.staffEditCreate` / `staffEditEdit` 日文同步
- [x] 5.18 `admin.bookingMode.RESOURCE` "リソース指定" → "場所・設備の指定"；`RESOURCE_OPTIONAL` "リソース選択（任意）" → "場所・設備（任意）"

## 5A. 硬編碼 → i18n key 重構（Playwright 實測後新增）

- [x] 5A.1 為 `app/pages/admin/services/index.vue` 標題、副標、按鈕、表格表頭、`(停用)` 後綴、編輯/刪除按鈕補 i18n key
- [x] 5A.2 為 `app/pages/admin/resources/index.vue` 同上補 i18n key
- [x] 5A.3 為 `app/pages/admin/staff.vue` 同上補 i18n key（含 OWNER 權限封鎖訊息、狀態切換按鈕）
- [x] 5A.4 為 `app/pages/admin/share-link.vue` 補 hint/empty/copy 等 i18n key
- [x] 5A.5 zh.js 新增 `common.col.{name,actions}`、`common.tagInactive`、`admin.services.{subtitle,newButton,columns.*,inactiveSuffix}`、`admin.resources.{subtitle,newButton,columns.*}`、`admin.staff.{subtitle,newButton,noPermission,columns.*}`、`admin.shareLink.{subtitleText,empty,goSettings,copyFailed,copySuccessAlt}`
- [x] 5A.6 en.js 同步補上述所有新 key
- [x] 5A.7 ja.js 同步補上述所有新 key
- [x] 5A.8 確認 `t(...)` 在 services/resources/staff/share-link 4 個頁面 import composables 正確（既有 `t` 或 `$t` 用法）
- [x] 5A.9 三語 i18n 檔 keys 對齊（zh/en/ja 同 key 同層級）

## 6. 程式碼自我驗證

- [x] 6.1 `npx eslint app/layouts/back-desk.vue i18n/locales/*.js` 無新增警告
- [x] 6.2 `grep -n "PageAdminSettings\|providers\|services\|resources\|staff" app/layouts/back-desk.vue` 確認 sidebar template 結構符合 spec 描述
- [x] 6.3 `grep -cE "服務|資源|成員" i18n/locales/zh.js` 與前後對照，確認移除了「服務 / 資源 / 成員」單獨字樣，保留「服務人員」「服務時長 / 項目時長」等預期保留的字樣
- [x] 6.4 三個 locale 檔的 key 路徑保持一致（zh / en / ja 對齊），不引入新 key 或刪除 key

## 7. Playwright 實測（必做）

- [x] 7.1 確認 dev server 運行（localhost:3000），登入 `owner@provider.test` / `Password123`（providerModeEnabled=true 帳號）
- [x] 7.2 桌面 1440×900：截圖 sidebar，驗證「設定」分群包含「商家設定 / 對外連結 / 醫師（providerLabel）/ 服務項目 / 場所或設備 / 成員帳號」順序
- [x] 7.3 切換 i18n locale 到 en/ja 各拍一張 sidebar 截圖，驗證三語顯示正確
- [x] 7.4 進入 `/admin/services`：驗證頁面標題「服務項目管理」、新增按鈕「新增項目」、表格表頭「綁定場所或設備」；操作新增 dialog 驗證 bookingMode 下拉顯示「場所或設備指定 / 可選場所或設備」
- [x] 7.5 進入 `/admin/resources`：驗證頁面標題「場所或設備管理」、新增按鈕「新增場所或設備」、表格表頭「已綁服務項目」、empty/unbound hint 文案
- [x] 7.6 進入 `/admin/staff`：驗證頁面標題「成員帳號」、新增按鈕「新增成員帳號」
- [x] 7.7 進入 `/admin/schedule`：驗證 scope 切換器顯示「場所或設備」label、empty state 「尚未建立任何服務項目…」、affects 文案
- [x] 7.8 切換到 RWD 768px / 375px 驗證 sidebar 折疊 / 抽屜行為（若有 hamburger menu）未受影響；版面無破損

## 8. 顧客端副作用驗證（必做）

- [x] 8.1 訪 `/m/demo-provider-clinic`：確認 `admin.nav.services` 引用點（`PageMerchantHome__sectionTitle`）顯示為「服務項目」，視覺合理（非錯位）
- [x] 8.2 若顧客端顯示「服務項目」反而不直覺，記錄為 Open Question 與使用者討論是否拆 key
- [x] 8.3 確認顧客端預約流程（時段選擇、確認、提交）無 i18n 文案漏改字

## 9. 相鄰功能無回歸測試（必做）

- [x] 9.1 進入 `/admin/providers`（providerModeEnabled=true）：頁面內容不變，可新增 Provider
- [x] 9.2 進入 `/admin/settings`：「自訂稱呼」區塊（前一個 change 修正過）排版仍正常
- [x] 9.3 進入 `/admin/appointments`、`/admin/queue`：營運分群剩下 3 個入口正常
- [x] 9.4 platform admin 登入路徑 `/sys/sign-in` → `/sys`：sidebar 維持既有三個 link，不套用分群

## 10. 收尾

- [ ] 10.1 撰寫 Conventional Commits 格式 commit message（繁中），例如 `refactor(merchant-ui): 重整 sidebar 並重命名服務/資源/成員為更語意化文案`
- [ ] 10.2 確認 git diff 範圍只含：`app/layouts/back-desk.vue` + `i18n/locales/{zh,en,ja}.js` + `openspec/changes/refactor-merchant-sidebar-and-rename-modules/**`
- [ ] 10.3 推送至 `dev` 分支，等 Railway 自動部署到 `appointment-develop.up.railway.app` 後做 Playwright 煙霧測試（步驟 7.2、7.4、7.5、7.6 重做）
- [ ] 10.4 staging 驗收完成後執行 `/opsx:archive` 歸檔，同步 delta 進 `openspec/specs/merchant-platform/spec.md`
