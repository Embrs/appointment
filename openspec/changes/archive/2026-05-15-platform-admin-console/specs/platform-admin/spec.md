# Platform Admin Spec

## ADDED Requirements

### Requirement: Merchant 列表查詢

系統 SHALL 提供 `GET /nuxt-api/sys/merchant`（admin only），支援 status / keyword / 分頁。

#### Scenario: 預設不帶參數

- **GIVEN** Admin 已登入
- **WHEN** 呼叫 `GET /nuxt-api/sys/merchant`
- **THEN** 響應 200，`data = { items, total, page: 1, pageSize: 20 }`；items 包含 `id, name, slug, status, contactEmail, createdAt, ownerEmail`

#### Scenario: 篩選 PENDING

- **WHEN** `?status=PENDING`
- **THEN** items 僅含 status='PENDING' 商家

#### Scenario: keyword 搜尋

- **WHEN** `?keyword=test`
- **THEN** items 同時匹配 Merchant.name / Merchant.slug / OWNER MerchantUser.email 任一含 "test" 的商家（不區分大小寫）

#### Scenario: 非 admin 拒絕

- **WHEN** 帶 merchant token 或無 token
- **THEN** 響應 401

### Requirement: Merchant 詳情查詢

系統 SHALL 提供 `GET /nuxt-api/sys/merchant/[id]`（admin only），返回商家完整欄位 + OWNER 摘要。

#### Scenario: 商家存在

- **WHEN** id 對應 merchant 存在
- **THEN** 響應 200，`data = { merchant: {...full fields}, ownerUser: { id, name, email, role, isActive } | null }`

#### Scenario: 商家不存在

- **WHEN** id 對應 merchant 不存在或 deletedAt 非 null
- **THEN** 響應 404

### Requirement: Merchant 基本資料編輯

系統 SHALL 提供 `PUT /nuxt-api/sys/merchant/[id]`，允許 admin 修改商家欄位。

#### Scenario: 合法更新

- **GIVEN** id 對應 merchant 存在
- **WHEN** body `{ name?, slug?, description?, contactPhone?, contactEmail?, timezone?, address? }` 合法
- **THEN** 響應 200，DB 同步更新

#### Scenario: slug 衝突

- **WHEN** slug 已被其他商家使用
- **THEN** 響應 409，三語訊息對應「網址已被使用」

#### Scenario: slug 格式錯

- **WHEN** slug 不符 `^[a-z0-9-]{3,50}$`
- **THEN** 響應 400

### Requirement: Merchant 狀態轉換

系統 SHALL 提供四個獨立端點 approve / suspend / activate / reject，每個端點僅接受指定來源狀態。

#### Scenario: PENDING → ACTIVE（approve）

- **WHEN** `POST /nuxt-api/sys/merchant/[id]/approve`，merchant.status='PENDING'
- **THEN** 響應 200，merchant.status 更新為 ACTIVE

#### Scenario: approve 來源狀態錯誤

- **GIVEN** merchant.status='ACTIVE'
- **WHEN** 呼叫 approve
- **THEN** 響應 409，三語訊息對應「狀態不允許此操作」

#### Scenario: ACTIVE → SUSPENDED（suspend）

- **WHEN** `POST .../suspend`，status='ACTIVE'
- **THEN** 響應 200，status='SUSPENDED'

#### Scenario: SUSPENDED → ACTIVE（activate）

- **WHEN** `POST .../activate`，status='SUSPENDED'
- **THEN** 響應 200，status='ACTIVE'

#### Scenario: PENDING → REJECTED with reason

- **WHEN** `POST .../reject` body `{ reason: '...' }`，status='PENDING'
- **THEN** 響應 200，status='REJECTED'，merchant.cancelPolicy 含 `rejectReason` 與原其他欄位

#### Scenario: reject reason 過長

- **WHEN** reason 長度 > 200
- **THEN** 響應 400

### Requirement: 平台管理員代理進入商家後台

系統 SHALL 提供 `POST /nuxt-api/sys/merchant/[id]/impersonate`，簽發 30 分鐘 TTL 的商家 JWT，payload 含 `impersonatedBy`。

#### Scenario: 對 ACTIVE 商家代理成功

- **GIVEN** Admin 已登入、merchant.status='ACTIVE'、有 OWNER MerchantUser 啟用中
- **WHEN** 呼叫 impersonate
- **THEN** 響應 200，data 含 `{ token, merchantId, merchantName, ownerName, ownerEmail }`；JWT payload `{ type:'merchant', sub:OWNER.id, merchantId, role:'OWNER', impersonatedBy: adminId }`，exp = now + 30min

#### Scenario: 商家非 ACTIVE

- **WHEN** merchant.status 為 PENDING / SUSPENDED / REJECTED 任一
- **THEN** 響應 409，三語訊息對應「無法代理非啟用商家」

#### Scenario: 商家無 OWNER

- **WHEN** 商家所有 MerchantUser 都 deletedAt 非 null 或 isActive=false
- **THEN** 響應 409，三語訊息對應「商家無啟用中的 OWNER」

#### Scenario: 代理身分嘗試再代理（拒絕代理鏈）

- **GIVEN** 來源 token 為代理 token（payload.impersonatedBy 已有值）
- **WHEN** 呼叫 impersonate
- **THEN** 響應 403，三語訊息對應「無權執行此操作」

### Requirement: Admin 帳號管理

系統 SHALL 提供 AdminUser 列表 / 新增 / 編輯 / 啟用切換。

#### Scenario: 列表查詢

- **WHEN** `GET /nuxt-api/sys/admin`
- **THEN** 響應 200，data 為 array，每筆含 `{ id, email, name, isActive, createdAt }`，**不含** passwordHash；deletedAt 非 null 的不出現

#### Scenario: 新增 admin

- **WHEN** `POST /nuxt-api/sys/admin` body `{ email, password, name }`，email 不存在、password 至少 8 含字母+數字
- **THEN** 響應 200，DB 新增；返回不含 hash

#### Scenario: 新增 email 衝突

- **WHEN** email 已被使用（deletedAt=null）
- **THEN** 響應 409，三語對應「Email 已被使用」

#### Scenario: 編輯 admin

- **WHEN** `PUT /nuxt-api/sys/admin/[id]` body `{ name?, password? }`，password 留空表示不變
- **THEN** 響應 200，DB 同步

#### Scenario: 編輯 email 被禁止

- **WHEN** body 帶 email 欄位
- **THEN** 響應 400（zod 不接受 email 欄位 / strict 模式 / 或忽略並提示）

#### Scenario: 啟用切換

- **WHEN** `POST /nuxt-api/sys/admin/[id]/toggle-active`
- **THEN** 響應 200，isActive 取反

#### Scenario: 不能停用自己

- **GIVEN** `id === auth.sub`
- **WHEN** 呼叫 toggle-active
- **THEN** 響應 400，三語對應「不能停用自己」

### Requirement: 平台後台頁面

系統 SHALL 提供五個 `back-desk` layout + `admin` middleware 保護的頁面。

#### Scenario: Dashboard 路由 /sys

- **GIVEN** Admin 已登入
- **WHEN** 訪 `/sys`
- **THEN** 渲染 dashboard，顯示 PENDING 數、ACTIVE 數、Admin 數，以及最近 5 筆商家連結

#### Scenario: 商家列表路由 /sys/merchants

- **GIVEN** Admin 已登入
- **WHEN** 訪 `/sys/merchants`
- **THEN** 顯示 tabs（ALL/PENDING/ACTIVE/SUSPENDED/REJECTED）+ 搜尋框 + 表格 + 分頁
- **AND** URL 同步 `?status & ?keyword & ?page`

#### Scenario: 商家詳情路由 /sys/merchants/[id]

- **GIVEN** Admin 已登入
- **WHEN** 訪 `/sys/merchants/[id]`
- **THEN** 顯示商家欄位、OWNER 摘要、編輯表單、依當前狀態的操作按鈕

#### Scenario: Admin 列表路由 /sys/admins

- **GIVEN** Admin 已登入
- **WHEN** 訪 `/sys/admins`
- **THEN** 顯示 admin 表格、新增 / 編輯 / 啟用切換按鈕

#### Scenario: 代理進入中介頁 /sys/impersonate/[merchantId]

- **GIVEN** Admin 已登入
- **WHEN** 訪 `/sys/impersonate/[merchantId]`
- **THEN** 頁面顯示 loading「正在進入商家後台...」
- **AND** 背景呼叫 impersonate API；成功後寫入 ss_back_* cookie 備份 admin 身分、覆寫 ss_t 為 merchant token、navigateTo `/admin`
- **AND** 失敗則 `ElMessage.error` 並 3 秒後返回 `/sys/merchants`

#### Scenario: 非 admin 訪 /sys/*

- **GIVEN** 未登入或 selfType !== 'admin'
- **WHEN** 訪任一 /sys/* 頁面
- **THEN** middleware 跳轉到 `/sys/sign-in`

### Requirement: Back-desk Impersonation 紅色橫條

`app/layouts/back-desk.vue` SHALL 在 selfType='merchant' 且當前 token 為代理 token（impersonatedBy 有值）時顯示紅色橫條與退出按鈕。

#### Scenario: 一般商家登入無橫條

- **GIVEN** 使用者以商家身分一般登入（無 impersonatedBy）
- **WHEN** 進入 `/admin`
- **THEN** back-desk 不顯示紅色橫條

#### Scenario: 代理身分顯示橫條

- **GIVEN** 透過 /sys/impersonate/* 進入
- **WHEN** 進入 `/admin`
- **THEN** 頂部顯示紅色橫條「平台管理員代理中」+ 「退出代理」按鈕

#### Scenario: 退出代理

- **GIVEN** 代理橫條顯示中
- **WHEN** 使用者點擊「退出代理」
- **THEN** ss_back_t 還原為 admin 身分（ss_t / ss_type / ss_name / ss_email 對應更新），清除 ss_back_*，navigateTo `/sys/merchants`

#### Scenario: Admin 視角無橫條

- **GIVEN** Admin 登入 `/sys/*`
- **THEN** back-desk 在 admin 視角絕不顯示代理橫條（橫條僅針對 selfType='merchant' + impersonatedBy）

### Requirement: Protocol bindings

`app/protocol/fetch-api/api/admin/` 與 `app/protocol/fetch-api/api/merchant/` SHALL 暴露 admin 與 merchant（admin 視角）的 API 方法，並支援 `NUXT_PUBLIC_TEST_MODE='T'` 時走 mock。

#### Scenario: admin 模組 mock 路由

- **GIVEN** `NUXT_PUBLIC_TEST_MODE='T'`
- **WHEN** 呼叫 `$api.GetAdminList()`
- **THEN** 回 mock 資料，不發 HTTP 請求

#### Scenario: merchant 模組真實路由

- **GIVEN** `NUXT_PUBLIC_TEST_MODE='F'`
- **WHEN** 呼叫 `$api.SysApproveMerchant({ id })`
- **THEN** 向 `POST /nuxt-api/sys/merchant/[id]/approve` 發請求
