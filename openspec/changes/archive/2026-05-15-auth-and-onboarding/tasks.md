## 1. 後端：共用驗證輔助

- [x] 1.1 確認 zod 已可用（Change 1 已安裝），不額外新增依賴
- [x] 1.2 本 change 採直接內聯 zod schema 於各端點，不抽 `parseJsonBody` 共用工具（單處使用無共用價值）

## 2. 後端：sign-in.post.ts

- [x] 2.1 接收 `{ type: 'admin' | 'merchant', email, password }`，zod 驗證
- [x] 2.2 `type='admin'`：查 `AdminUser`（email + isActive=true + deletedAt=null）；找不到 / 密碼錯回 401「帳號或密碼錯誤」（合併訊息防使用者列舉）
- [x] 2.3 `type='merchant'`：查 `MerchantUser`（email + isActive=true + deletedAt=null）含關聯 Merchant；密碼錯回 401；PENDING/SUSPENDED/REJECTED 各回 403 對應訊息；Merchant.deletedAt 視為 SUSPENDED
- [x] 2.4 通過後 `signToken({ sub, type, merchantId?, role? })`，return `{ token, type, role?, merchantId?, merchantName?, userName, userEmail }`

## 3. 後端：sign-up.post.ts（商家自助註冊）

- [x] 3.1 接收 `{ email, password, merchantName }`，zod 驗證（password ≥8 含字母與數字）
- [x] 3.2 先查 `MerchantUser`（同 email + deletedAt=null）→ 409 EMAIL_EXISTS
- [x] 3.3 產 slug `{normalize(emailLocal)}-{random6}`；P2002 衝突最多重試 3 次
- [x] 3.4 transaction 建立 `Merchant`(PENDING) + `MerchantUser`(OWNER)
- [x] 3.5 return `{ pending: true, merchantId }`，**不簽 JWT、不設 cookie**

## 4. 後端：me.get.ts

- [x] 4.1 `getAuth(event)` 取 payload；無 token return 401
- [x] 4.2 `type='admin'`：查 AdminUser，return `{ type, userName, userEmail }`
- [x] 4.3 `type='merchant'`：查 MerchantUser + Merchant；Merchant.status 非 ACTIVE / isActive=false / deletedAt 非 null 一律 401（強制重登）

## 5. 後端：forgot-password.post.ts

- [x] 5.1 接收 `{ email }`，zod 驗證
- [x] 5.2 `checkRateLimit('forgot:' + ip, 5, 600)` 超過回 429
- [x] 5.3 固定 return `successResponse({ sent: true })`，避免 email 列舉
- [x] 5.4 MVP 不寄信；以 `console.info` 留下審計痕跡（不直接 log email 全文）

## 6. Protocol 擴充

- [x] 6.1 改寫 `type.d.ts`：新增 `SignInAdminParams / SignInMerchantParams / SignInAdminRes / SignInMerchantRes / SignUpMerchantParams / SignUpMerchantRes / MeInfoAdminRes / MeInfoMerchantRes / MeInfoRes / ForgotPasswordParams / ForgotPasswordRes`
- [x] 6.2 改寫 `index.ts`：新增 `SignInAdmin / SignInMerchant / SignUpMerchant / MeInfo / ForgotPassword`，**移除**舊 `SignIn / SignUp`
- [x] 6.3 同步 `mock.ts`：對應五個 mock；以本地 `SuccessRes`（code=200）取代既有 mock-res 預設 code=0，避免 mock 與真實 status.code 分裂

## 7. 前端：sign-in.vue

- [x] 7.1 用 `default` layout；以 `useRoute().query.type` 判斷 merchant / admin（預設 merchant）
- [x] 7.2 表單欄位 email（maxlength=120）、password（maxlength=64、show-password）；用 `UseVerify().mail / enter`
- [x] 7.3 `SignInFlow` 呼叫 `ApiSignInMerchant/ApiSignInAdmin`；成功 `StoreSelf.SetIdentity` 並依身分跳 `/admin` / `/sys`
- [x] 7.4 失敗用 `ElMessage.error` 顯示 API 回傳的三語訊息（取 zh_tw → en → ja）
- [x] 7.5 merchant 模式提供「立即註冊」「忘記密碼」連結；admin 模式不提供
- [x] 7.6 標題依 type 顯示「商家登入」/「平台管理員登入」

## 8. 前端：sign-up.vue

- [x] 8.1 用 `default` layout，無 query 切換
- [x] 8.2 表單欄位 merchantName（maxlength=60）、email（maxlength=120）、password（maxlength=64、show-password）、passwordConfirm
- [x] 8.3 自定 validator：密碼至少 8 含字母與數字、兩次密碼一致
- [x] 8.4 `SignUpFlow` 呼叫 `SignUpMerchant`；成功切換到「待管理員審核」靜態畫面，提供「返回登入」按鈕（**不自動跳轉**）
- [x] 8.5 失敗顯示三語錯誤（含 409 email 已註冊）

## 9. 前端：forgot-password.vue

- [x] 9.1 用 `default` layout；email 欄位
- [x] 9.2 `ForgotFlow` 呼叫 `ForgotPassword`；不論結果顯示通用成功訊息
- [x] 9.3 提供返回登入連結

## 10. i18n 與環境

- [x] 10.1 `i18n/locales/{zh,en,ja}.js` 補 `auth.errors.*` 與 `auth.notice.*`（三語）
- [x] 10.2 `.env.dev`：將 `NUXT_PUBLIC_TEST_MODE=T` 改為 `F`（走真實 API）；保留 mock 路徑以便切回
- [x] 10.3 確認 `i18n.config.ts` 無變動需求 — 既有設定已支援；本 change 不需動

## 11. 對應 placeholder 頁面（最小可驗證集）

- [x] 11.1 建 `app/pages/sys/sign-in.vue` thin redirect 到 `/sign-in?type=admin`（保留 Change 1 的 admin middleware/401 跳轉 `/sys/sign-in` 規範不破壞）
- [x] 11.2 建 `app/pages/admin/index.vue`：merchant middleware 保護，掛 `back-desk` layout，呼 `MeInfo` 顯示商家名
- [x] 11.3 建 `app/pages/sys/index.vue`：admin middleware 保護，掛 `back-desk` layout，呼 `MeInfo` 顯示 admin 名

## 12. 驗證（Playwright）

- [x] 12.1 啟 PG（docker run pg postgres:16）、建庫 appointment_dev、`prisma migrate dev --name init` 成功，17 業務表 OK
- [x] 12.2 `npm run dev` 啟動，`http://localhost:3000/{,sign-in,sign-up}` 200 OK
- [x] 12.3 `/sign-up` 填表註冊 `merchant-test@example.com` → 看到「申請已送出 / 待管理員審核」（截圖 change-2-01）
- [x] 12.4 SQL `UPDATE "Merchant" SET status='ACTIVE' WHERE id=...` 通過
- [x] 12.5 `/sign-in?type=merchant` 填表登入 → 自動 redirect 到 `/admin` 並顯示「歡迎，Test Merchant」（截圖 change-2-02）
- [x] 12.6 `document.cookie` 確認 `ss_t / ss_type / ss_role / ss_mid / ss_name / ss_email` 全部存在
- [x] 12.7 已登入直接訪 `/admin` 可進入（middleware 放行）
- [x] 12.8 清除 ss_* cookies 後訪 `/admin` → merchant middleware 跳回 `/sign-in`（預設商家版）（截圖 change-2-03）
- [x] 12.9 console 無 JS error（401 fetch warning 為瀏覽器原生網路狀態，非程式碼錯誤；登入成功路徑無 error）
- [x] 12.10 補測 admin 流程：建 AdminUser → `/sign-in?type=admin` 登入 → redirect `/sys` 顯示「平台管理員 / Test Admin」（截圖 change-2-04）
- [x] 12.11 截圖移到 `~/screenshots/change-2-*.png`

## 13. OpenSpec 收尾

- [x] 13.1 `openspec validate auth-and-onboarding --strict` 通過
- [x] 13.2 `npm run lint`：本 change 新增/修改檔案乾淨；剩 2 個 lint error 為既有 `.vscode/demo.vue` 與 `app/composables/tool/use-ws.ts:505`，**非本 change 引入**（與 Change 1 archive tasks 一致）
- [x] 13.3 歸檔到 `openspec/changes/archive/2026-05-15-auth-and-onboarding/`，main specs/auth-flow 同步建立
