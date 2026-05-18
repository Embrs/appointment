## 1. 後端：merchant 列表與詳情

- [x] 1.1 `server/routes/nuxt-api/sys/merchant/index.get.ts`：`requireAdmin`；query `{ status?: PENDING|ACTIVE|SUSPENDED|REJECTED|ALL, keyword?: string, page=1, pageSize=20 }`；組 where（status 過濾、keyword `contains` 比對 name/slug/OWNER email）；用 `prisma.merchant.findMany` + `include: { users: { where: { role: 'OWNER', deletedAt: null } } }`；排序 `[{ status: 'asc' }, { createdAt: 'desc' }]`（PENDING 排在 ACTIVE 前 — 以 raw sql 或 client 端二次排序；MVP 接受 client 端排序）；返回 `{ items, total, page, pageSize }`
- [x] 1.2 `server/routes/nuxt-api/sys/merchant/[id].get.ts`：`requireAdmin`；找 merchant + include OWNER users；查無 → 404；返回 `{ merchant, ownerUser }`
- [x] 1.3 `server/routes/nuxt-api/sys/merchant/[id].put.ts`：`requireAdmin`；zod 驗 body（name 1-60、slug `^[a-z0-9-]{3,50}$`、description?、contactPhone?、contactEmail?、timezone?、address?）；slug 衝突 409；成功 return 更新後資料

## 2. 後端：merchant 狀態轉換

- [x] 2.1 `server/routes/nuxt-api/sys/merchant/[id]/approve.post.ts`：`requireAdmin`；找 merchant；status !== PENDING → 409；transaction 更新 `status='ACTIVE'`；return success
- [x] 2.2 `server/routes/nuxt-api/sys/merchant/[id]/suspend.post.ts`：`requireAdmin`；status !== ACTIVE → 409；更新 SUSPENDED；return success
- [x] 2.3 `server/routes/nuxt-api/sys/merchant/[id]/activate.post.ts`：`requireAdmin`；status !== SUSPENDED → 409（PENDING 必須走 approve）；更新 ACTIVE；return success
- [x] 2.4 `server/routes/nuxt-api/sys/merchant/[id]/reject.post.ts`：`requireAdmin`；body `{ reason?: string<=200 }`；status !== PENDING → 409；更新 REJECTED 並把 reason 寫入 `cancelPolicy.rejectReason`（用 spread 保留其他欄位）；return success

## 3. 後端：impersonate

- [x] 3.1 `server/routes/nuxt-api/sys/merchant/[id]/impersonate.post.ts`：`requireAdmin`；若 `auth.impersonatedBy` 已存在 → 403（拒絕代理鏈）
- [x] 3.2 找 merchant（必須 ACTIVE 且 deletedAt=null）→ 否則 409「無法代理非啟用商家」
- [x] 3.3 找 OWNER MerchantUser（isActive=true、deletedAt=null）；若無 OWNER → 409「商家無啟用中的 OWNER」
- [x] 3.4 `signToken({ type: 'merchant', sub: ownerUser.id, merchantId, role: 'OWNER', impersonatedBy: auth.sub }, 30*60)` — TTL 30 分鐘
- [x] 3.5 return `{ token, merchantId, merchantName, ownerName, ownerEmail }`

## 4. 後端：admin 帳號

- [x] 4.1 `server/routes/nuxt-api/sys/admin/index.get.ts`：`requireAdmin`；列出所有 AdminUser（deletedAt=null），不含 passwordHash；按 createdAt desc
- [x] 4.2 `server/routes/nuxt-api/sys/admin/index.post.ts`：`requireAdmin`；zod 驗 `{ email, password (>=8 含字母+數字), name }`；email 衝突 → 409；bcrypt hash 寫入；return 新建後資料（不含 hash）
- [x] 4.3 `server/routes/nuxt-api/sys/admin/[id].put.ts`：`requireAdmin`；zod 驗 `{ name?, password?(>=8 含字母+數字) }`；email 不允許改（避免身分混淆）；return 更新後資料
- [x] 4.4 `server/routes/nuxt-api/sys/admin/[id]/toggle-active.post.ts`：`requireAdmin`；若 `id === auth.sub` → 400「不能停用自己」；toggle `isActive`；return 更新後資料

## 5. 後端：擴充 /me 帶 impersonatedBy

- [x] 5.1 `server/routes/nuxt-api/auth/me.get.ts`：merchant 分支 return 加 `impersonatedBy: auth.impersonatedBy ?? undefined`（admin 分支不加）

## 6. Protocol：admin

- [x] 6.1 `app/protocol/fetch-api/api/admin/type.d.ts`：定義 `AdminItem / GetAdminListRes / CreateAdminParams / CreateAdminRes / UpdateAdminParams / UpdateAdminRes / ToggleAdminActiveRes`
- [x] 6.2 `app/protocol/fetch-api/api/admin/index.ts`：`GetAdminList / CreateAdmin / UpdateAdmin / ToggleAdminActive`，遵循 mock gate（`useRuntimeConfig().public.testMode === 'T'`）
- [x] 6.3 `app/protocol/fetch-api/api/admin/mock.ts`：靜態回三筆假資料

## 7. Protocol：merchant（admin 視角）

- [x] 7.1 `app/protocol/fetch-api/api/merchant/type.d.ts`：`MerchantStatusType / SysMerchantItem / SysGetMerchantListParams / SysGetMerchantListRes / SysGetMerchantDetailRes / SysUpdateMerchantParams / SysImpersonateMerchantRes` 等
- [x] 7.2 `app/protocol/fetch-api/api/merchant/index.ts`：`SysGetMerchantList / SysGetMerchantDetail / SysUpdateMerchant / SysApproveMerchant / SysSuspendMerchant / SysActivateMerchant / SysRejectMerchant / SysImpersonateMerchant`
- [x] 7.3 `app/protocol/fetch-api/api/merchant/mock.ts`：對應 mock，至少含 PENDING + ACTIVE + SUSPENDED 各一筆

## 8. Protocol：auth 擴充

- [x] 8.1 `app/protocol/fetch-api/api/auth/type.d.ts`：`MeInfoMerchantRes` 加 `impersonatedBy?: string`
- [x] 8.2 `app/protocol/fetch-api/api/auth/mock.ts`：可選地於 MeInfo merchant mock 中註解預留欄位（不影響行為）
- [x] 8.3 確認 `app/protocol/fetch-api/index.ts`（彙整出口）— 若有，需 `export * from './api/admin'` 與 `./api/merchant'`；目前若由 `methods.ts` 暴露為 `$api.*` 則檢視 `nuxt.config` 的 imports

## 9. Composable：UseImpersonation

- [x] 9.1 `app/composables/app/use-impersonation.ts`：
  - 暴露 `EnterImpersonation({ token, merchantId, role, userName, userEmail, merchantName })`：寫入備份 cookie `ss_back_t / ss_back_type / ss_back_name / ss_back_email`，然後呼叫 `StoreSelf.SetIdentity` 寫入 merchant
  - `ExitImpersonation()`：讀 `ss_back_*` 還原 admin 身分（手動寫入 `apiToken` / `selfType` / `userName` / `userEmail` / 清掉 `merchantId` 與 `role`），清除 `ss_back_*`，`navigateTo('/sys/merchants')`
  - 內部用 `UseEncryptCookie` 同樣加密層

## 10. 頁面：sys/index.vue（Dashboard）

- [x] 10.1 改寫 placeholder：`back-desk` layout + `admin` middleware
- [x] 10.2 onMounted 同時打 `MeInfo()` + `SysGetMerchantList({ status: 'PENDING', pageSize: 1 })` + `SysGetMerchantList({ status: 'ACTIVE', pageSize: 1 })` + `GetAdminList()`
- [x] 10.3 渲染三張卡片：「待審核商家」（連到 `/sys/merchants?status=PENDING`）、「在線商家」、「管理員數」；另渲染「最近註冊」前 5 筆連結到該商家詳情
- [x] 10.4 RWD：卡片 grid 在窄屏自動換行

## 11. 頁面：sys/merchants/index.vue

- [x] 11.1 `back-desk` layout + `admin` middleware；router query 同步 `?status & ?keyword & ?page`
- [x] 11.2 上方 ElTabs（ALL/PENDING/ACTIVE/SUSPENDED/REJECTED）；右側搜尋框 `ElInput(maxlength=60)` + 搜尋按鈕
- [x] 11.3 ElTable 顯示欄位：商家名、slug、OWNER email、status（tag 顯示）、註冊時間、操作（檢視 / 審核 / 進入後台）
- [x] 11.4 操作按鈕：
  - PENDING：「審核」開 `OpenDialogMerchantApprove`、「拒絕」開同彈窗 reject 模式、「檢視」連到詳情
  - ACTIVE：「進入後台」連 `/sys/impersonate/[id]`、「停用」用 `UseAsk()` 確認後 ApiSuspend
  - SUSPENDED：「啟用」用 `UseAsk()` 確認後 ApiActivate
  - REJECTED：僅「檢視」
- [x] 11.5 ElPagination 同步 query
- [x] 11.6 操作後重新 ApiLoad

## 12. 頁面：sys/merchants/[id].vue

- [x] 12.1 `back-desk` layout + `admin` middleware；取 params.id 呼叫 `SysGetMerchantDetail`
- [x] 12.2 顯示商家欄位（ElDescriptions）+ OWNER 摘要
- [x] 12.3 提供編輯區（ElForm + name/slug/description/contactPhone/contactEmail/timezone/address），存檔呼叫 `SysUpdateMerchant`
- [x] 12.4 狀態相關操作按鈕（同列表，依當前 status 顯示對應動作）
- [x] 12.5 ACTIVE 時顯示「進入該商家後台」按鈕連 `/sys/impersonate/[id]`

## 13. 頁面：sys/admins.vue

- [x] 13.1 `back-desk` layout + `admin` middleware
- [x] 13.2 ElTable 列出 admin（name / email / isActive / 操作）
- [x] 13.3 「新增管理員」按鈕開 `OpenDialogAdminEdit`（create 模式）
- [x] 13.4 列內「編輯」開 edit 模式（不顯示密碼欄位，留空白選填）
- [x] 13.5 「停用 / 啟用」用 `UseAsk()` 確認後 ApiToggle；若 id===自己 → 直接 `ElMessage.warning` 擋
- [x] 13.6 操作後重新 ApiLoad

## 14. 頁面：sys/impersonate/[merchantId].vue

- [x] 14.1 `default` layout + `admin` middleware；不顯示後台殼（避免閃爍）
- [x] 14.2 onMounted 呼叫 `SysImpersonateMerchant({ id: params.merchantId })`
- [x] 14.3 成功：`UseImpersonation().EnterImpersonation(...)`，`navigateTo('/admin', { replace: true })`
- [x] 14.4 失敗：`ElMessage.error`，3 秒後 `navigateTo('/sys/merchants')`
- [x] 14.5 過程中顯示 loading 訊息「正在進入商家後台...」

## 15. 彈窗：OpenDialogMerchantApprove

- [x] 15.1 `app/components/open/dialog/merchant-approve.vue`
- [x] 15.2 params: `{ mode: 'approve' | 'reject', merchantId, merchantName }`
- [x] 15.3 approve 模式：顯示確認語、單一「確認通過」按鈕；reject 模式：顯示 reason textarea（maxlength=200，選填）+ 「確認拒絕」按鈕
- [x] 15.4 確認 → 呼叫對應 API，resolve `{ done: true }` 給 caller，emit `on-close`
- [x] 15.5 註冊到 `app/components/open/_index.d.ts` 與 `app/components/open/index.ts`

## 16. 彈窗：OpenDialogAdminEdit

- [x] 16.1 `app/components/open/dialog/admin-edit.vue`
- [x] 16.2 params: `{ mode: 'create' | 'edit', admin?: AdminItem }`
- [x] 16.3 表單：name (maxlength=40)、email (maxlength=120，edit 模式 disabled)、password (maxlength=64，edit 模式選填)
- [x] 16.4 自訂 validator：密碼至少 8 含字母+數字（edit 時若留空跳過）
- [x] 16.5 確認 → 呼叫 CreateAdmin / UpdateAdmin，resolve `{ done: true }`
- [x] 16.6 註冊到 `_index.d.ts` 與 `index.ts`

## 17. back-desk layout：impersonation 紅色橫條

- [x] 17.1 改 `app/layouts/back-desk.vue`：在 onMounted 打 `MeInfo()` 抓 `impersonatedBy`；存於本地 `isImpersonating = ref(false)`
- [x] 17.2 模板：橫條 v-if `isImpersonating` 顯示，左側「平台管理員代理中」、右側「退出代理」按鈕
- [x] 17.3 「退出代理」按鈕：呼叫 `UseImpersonation().ExitImpersonation()`
- [x] 17.4 樣式：背景 `#f56c6c` 白字、置中、保留 padding；按鈕透明白底（避免色衝）
- [x] 17.5 確認 admin 視角（selfType==='admin'）絕對不會顯示此橫條

## 18. i18n 與環境

- [x] 18.1 `i18n/locales/{zh,en,ja}.js` 補三語 key：
  - `sys.tabs.{all,pending,active,suspended,rejected}`
  - `sys.actions.{approve, reject, suspend, activate, impersonate, exit_impersonation}`
  - `sys.notice.{impersonation_active, suspend_confirm, activate_confirm}`
- [x] 18.2 `.env.dev` 已有 JWT_SECRET / DATABASE_URL，本 change 不修改

## 19. 驗證（Playwright MCP）

- [x] 19.1 啟動 `npm run dev` 背景
- [x] 19.2 用 seed 腳本或 SQL 建立一個 AdminUser（email=`admin-test@example.com` / password=`Admin1234`）
- [x] 19.3 確認有一個 Change 2 註冊但仍 PENDING 的測試商家；若無則先用 sign-up 註冊一個
- [x] 19.4 browser_navigate `/sign-in?type=admin`，填表登入
- [x] 19.5 應 redirect `/sys`，browser_snapshot 確認 dashboard 渲染（看得到三張卡片 + 最近商家）
- [x] 19.6 browser_navigate `/sys/merchants?status=PENDING`，browser_snapshot 應看到測試商家
- [x] 19.7 browser_click 該列「審核」→ 確認彈窗 → browser_click 確認 → 列表刷新 status 為 ACTIVE
- [x] 19.8 browser_click「進入該商家後台」→ 等 redirect 到 `/admin`，browser_snapshot 確認紅色橫條「平台管理員代理中」存在
- [x] 19.9 browser_click「退出代理」→ 確認回到 `/sys/merchants`
- [x] 19.10 對另一商家試 suspend（UseAsk 確認）→ 列表狀態變 SUSPENDED；再 activate → 變 ACTIVE
- [x] 19.11 browser_navigate `/sys/admins`，按「新增管理員」開彈窗 → 填表存檔 → 列表多一筆
- [x] 19.12 browser_resize 到 375x667，再瀏覽 `/sys/merchants`，確認列表 RWD 不破版（橫向滾動或卡片堆疊均可）
- [x] 19.13 browser_console_messages 確認無 JS error（401 fetch 警告為瀏覽器原生網路狀態提示，可接受）
- [x] 19.14 截圖存 `~/screenshots/change-3-*.png`

## 20. OpenSpec 收尾

- [x] 20.1 `openspec validate platform-admin-console --strict` 通過
- [x] 20.2 `npm run lint`：本 change 新增/修改檔案乾淨；既有 lint warning 不引入新增項
- [x] 20.3 歸檔到 `openspec/changes/archive/2026-05-15-platform-admin-console/`，main specs 同步 `auth-flow`（MODIFIED）與 `platform-admin`（ADDED）
