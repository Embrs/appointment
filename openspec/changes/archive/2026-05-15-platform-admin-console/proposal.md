## Why

Change 2（`auth-and-onboarding`）已讓商家能自助註冊（status=PENDING）、平台管理員能登入；但目前**沒有任何 UI / API 讓管理員審核待審商家、停用問題商家、或代理進入商家後台排查**。所有 Change 2 註冊進來的商家都卡在 PENDING、無法登入；Change 4 之後的商家後台對管理員也是黑盒。

本 change 把平台管理員後台（`/sys/*`）打通：商家列表 + 審核 / 停用 / 拒絕、商家詳情編輯、`impersonate` 代理進入商家後台（30 分鐘 TTL token + back-desk 紅色警示橫條 + 退出機制）、AdminUser 帳號管理。完成後管理員能完整管理平台、且能在 Change 4 上線前先把 Change 2 註冊的測試商家審核通過。

## What Changes

- **後端 API**（`server/routes/nuxt-api/sys/`，全部受 `requireAdmin` 保護）：
  - `merchant/index.get.ts`：列表，query 含 `status?`、`keyword?`（名稱/email）、`page`、`pageSize`；返回含每商家 OWNER email、Pending 數
  - `merchant/[id].get.ts`：詳情，含 OWNER MerchantUser 摘要 + 商家欄位
  - `merchant/[id].put.ts`：編輯商家基本資料（name、slug、description、contact*、timezone）
  - `merchant/[id]/approve.post.ts`：PENDING → ACTIVE（其他狀態 409）
  - `merchant/[id]/suspend.post.ts`：ACTIVE → SUSPENDED（其他狀態 409）
  - `merchant/[id]/activate.post.ts`：SUSPENDED → ACTIVE（讓「停用後復用」可行）
  - `merchant/[id]/reject.post.ts`：PENDING → REJECTED（可選 reason，存 cancelPolicy.rejectReason 暫存）
  - `merchant/[id]/impersonate.post.ts`：以管理員身分簽**短 TTL（30 分鐘）的商家 JWT**，payload 含 `type:'merchant'`、`sub:OWNER MerchantUser.id`、`merchantId`、`role:OWNER`、`impersonatedBy:adminId`
  - `admin/index.get.ts`、`admin/index.post.ts`、`admin/[id].put.ts`、`admin/[id]/toggle-active.post.ts`：AdminUser CRUD + 啟用切換
- **JWT payload 規範**：`AuthPayload.impersonatedBy?: string` 已於 Change 1 預留欄位；本 change 是第一個實際寫入該欄位、`/me.get.ts` 也將回拋此欄位讓前端判斷代理狀態
- **Protocol 擴充**：
  - 新增 `app/protocol/fetch-api/api/admin/{index.ts, mock.ts, type.d.ts}`：`GetAdminList / CreateAdmin / UpdateAdmin / ToggleAdminActive`
  - 新增 `app/protocol/fetch-api/api/merchant/{index.ts, mock.ts, type.d.ts}`（**管理員視角**）：`SysGetMerchantList / SysGetMerchantDetail / SysUpdateMerchant / SysApproveMerchant / SysSuspendMerchant / SysActivateMerchant / SysRejectMerchant / SysImpersonateMerchant`
  - 擴充 `auth/type.d.ts` 的 `MeInfoMerchantRes` 加入可選 `impersonatedBy?: string`，並於 `auth/me.get.ts` 帶回
- **頁面**（全部 `back-desk` layout + `admin` middleware）：
  - `app/pages/sys/index.vue`：Dashboard，顯示待審 / 在線商家數、管理員數量、近期審核紀錄
  - `app/pages/sys/merchants/index.vue`：商家列表，含 PENDING / ACTIVE / SUSPENDED / REJECTED 四個 tab + 關鍵字搜尋
  - `app/pages/sys/merchants/[id].vue`：詳情，含商家欄位編輯（slug/name/contact）、狀態切換按鈕、「進入該商家後台」按鈕
  - `app/pages/sys/admins.vue`：AdminUser 列表 + 新增 / 編輯 / 啟用切換
  - `app/pages/sys/impersonate/[merchantId].vue`：呼叫 impersonate API 取得短 TTL token → 覆寫 `StoreSelf.SetIdentity` 為 merchant 身分（**保留 admin 原 token 於 `ss_back_t` 加密 cookie**）→ redirect `/admin`
- **彈窗**：
  - `OpenDialogMerchantApprove`：審核通過 / 拒絕 二合一確認彈窗（with optional reason）
  - `OpenDialogAdminEdit`：新增 / 編輯 AdminUser（同一彈窗，創建模式才有密碼欄位）
- **back-desk layout**：
  - 加邏輯：當 `storeSelf.selfType === 'merchant'` 且 `MeInfo` 回傳 `impersonatedBy` 有值時，頂部顯示紅色橫條「平台管理員代理中｜退出代理」
  - 「退出代理」按鈕：清除商家 token、從 `ss_back_t` 還原 admin token、redirect `/sys/merchants`
  - 提取共用 composable `UseImpersonation()`（管理 ss_back_t、Enter/Exit 邏輯）
- **i18n**：補三語訊息 key（`sys.merchant.*`、`sys.admin.*`、`sys.impersonate.*`）

### 非本 change 範圍（明確排除）

- 商家設定 / 服務 / 資源 / 時段 UI（屬 Change 4）
- 顧客端 / 預約核心（屬 Change 6）
- AuditLog 表（藍圖風險清單已記錄，未來補；本 change 不做行為記錄）
- 商家批次操作（批次審核、批次停用）
- 寄送通知信給商家（MVP 不寄信）
- 重設密碼 token 機制（forgot-password 接口已存在但不發信）

## Capabilities

### New Capabilities

- `platform-admin`：平台管理員後台所有 API、頁面、`impersonate` 流程的完整 spec

### Modified Capabilities

- `auth-flow`：
  - 擴充 `/me` 回傳含 `impersonatedBy`
  - 新增「代理 token 發放」要求：管理員 → 商家 JWT TTL 30 分鐘、payload 必含 `impersonatedBy`
  - 新增「代理 token 不可再代理」要求：sign-in 端點與 impersonate 端點若偵測 `impersonatedBy` 已存在或來源 token 為代理 token 一律 403（避免代理鏈）

## Impact

- **新增檔案**：
  - `server/routes/nuxt-api/sys/merchant/{index.get, [id].get, [id].put}.ts`
  - `server/routes/nuxt-api/sys/merchant/[id]/{approve, suspend, activate, reject, impersonate}.post.ts`
  - `server/routes/nuxt-api/sys/admin/{index.get, index.post, [id].put}.ts`
  - `server/routes/nuxt-api/sys/admin/[id]/toggle-active.post.ts`
  - `app/protocol/fetch-api/api/admin/{index.ts, mock.ts, type.d.ts}`
  - `app/protocol/fetch-api/api/merchant/{index.ts, mock.ts, type.d.ts}`
  - `app/pages/sys/{index, merchants/index, merchants/[id], admins, impersonate/[merchantId]}.vue`
  - `app/components/open/dialog/{merchant-approve, admin-edit}.vue`
  - `app/composables/app/use-impersonation.ts`
- **修改檔案**：
  - `app/layouts/back-desk.vue`（接 impersonation 紅色橫條真實邏輯）
  - `app/components/open/_index.d.ts` 與 `app/components/open/index.ts`（註冊兩個新 dialog）
  - `app/protocol/fetch-api/api/auth/{me.get.ts 對應的 type.d.ts}`（MeInfoMerchantRes 加 impersonatedBy）
  - `server/routes/nuxt-api/auth/me.get.ts`（讀 JWT impersonatedBy 並回拋）
  - `app/pages/sys/index.vue`（從 placeholder 升級為 dashboard）
  - `i18n/locales/{zh,en,ja}.js`（補 sys.* 三語 key）
- **依賴**：無新增
- **下游依賴**：Change 4（商家後台 nav 內容）會看到 back-desk impersonation bar；其他 changes 不直接相依
