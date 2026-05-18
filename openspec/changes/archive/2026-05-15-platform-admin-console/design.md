# Platform Admin Console 設計筆記

## 1. URL 命名：`/sys` 而非 `/admin`

**選擇**：平台管理員後台前綴 `/sys`，商家後台前綴 `/admin`。

**理由**：
- Change 1 既有規範：admin middleware 跳 `/sys/sign-in`、merchant middleware 跳 `/sign-in`，URL 已固定。
- `/admin` 是「商家後台」（merchant 視角），如果平台管理員也用 `/admin` 會混淆兩個視角，且 impersonate 後切到商家後台必須是不同 URL 才能讓使用者 / E2E 區分當下視角。
- 「sys」字義「系統管理」對應「平台」清楚。

## 2. Impersonation token：短 TTL + 平行存放原 admin token

**選擇**：
- 管理員按「進入該商家後台」→ server 簽 30 分鐘 TTL 的商家 JWT，payload 含 `impersonatedBy: adminId`。
- 前端 `app/pages/sys/impersonate/[merchantId].vue` 接到 token 後：
  1. 把目前 `ss_t`（admin token）備份到加密 cookie `ss_back_t`、`ss_back_type='admin'`、`ss_back_name`、`ss_back_email`
  2. `StoreSelf.SetIdentity` 寫入 impersonated merchant 身分（覆蓋 ss_t/ss_type/ss_mid/ss_role/ss_name/ss_email）
  3. `navigateTo('/admin', { replace: true })`
- back-desk layout 偵測 `MeInfo.impersonatedBy` 有值 → 顯示紅色橫條「平台管理員代理中｜退出代理」
- 「退出代理」按鈕：從 `ss_back_t` 還原 admin 身分、清除 `ss_back_*`、navigate `/sys/merchants`

**理由**：
- 30 分鐘 TTL：避免管理員意外保留商家身分過久；如需延長，回 `/sys` 再進一次即可。
- payload `impersonatedBy`：是「這個 token 是否為代理」的唯一真相；前端 cookie 可被竄改、不能信任。後端要做「拒絕代理鏈」「禁止代理身分執行高敏感操作（未來保留鉤子）」都靠這個欄位。
- `ss_back_t` 平行存放：比起重新登入 admin（需要密碼），備份原 token 後一鍵還原體驗順暢。雖加密 cookie 仍應視為「客戶端可見」，但 admin token 本身就在 `ss_t`，不增加額外風險。
- **不**用 sessionStorage：cookie 可跨頁面、加密層已存在；sessionStorage 在 SSR/CSR 切換 race condition。

**取捨**：
- 沒做 audit log（按下 impersonate 沒有持久化記錄）；藍圖風險清單已認列，未來補 `AuditLog` 表。
- 沒做 「Are you sure?」二段確認，UX 上點按鈕直接導向；可接受因為操作可逆（按退出代理即可回 admin 身分）。

## 3. 拒絕代理鏈：兩處攔截

**選擇**：
- `sys/merchant/[id]/impersonate.post.ts` 內 `requireAdmin(event)`：若 `auth.impersonatedBy` 存在表示來源就是代理 token，直接 403「無權執行此操作」。
- `auth/sign-in.post.ts` 不受影響（要求帳密，無法用 token 攜帶 impersonatedBy 進來）。
- `auth/me.get.ts`：將 `impersonatedBy` 原樣回拋（即使是代理 token 仍可查 me），前端 layout 依此渲染橫條。

**理由**：管理員實際上能否在「代理身分」再代理另一個商家是濫權範例，直接禁止；同時讓代理鏈為 0 層，後續 audit 邏輯也只需考慮一層。

## 4. Approve / Suspend / Reject / Activate：四個獨立端點 vs 通用 transition

**選擇**：四個獨立端點。

**理由**：
- 每個轉換有不同的前置檢查與副作用：
  - approve：PENDING → ACTIVE，副作用可能含初始化（未來 seed 預設服務）
  - reject：PENDING → REJECTED，需 reason
  - suspend：ACTIVE → SUSPENDED，未來可能需保留時間戳
  - activate：SUSPENDED → ACTIVE，需檢查不能直接從 PENDING 過來（PENDING 走 approve）
- 統一 `PATCH /merchant/[id]/status` 雖然 DRY 但會讓 client 端散落 `if (status === 'ACTIVE') ...` 邏輯；分端點意圖更清楚。
- REST 純度上輸給 PATCH，但這四個操作本來就是「動詞」（approve / suspend / reject），URL 動詞化（`.post`）易讀。

## 5. Admin 帳號管理：軟刪除 vs toggle-active

**選擇**：用 `toggle-active.post.ts` 切換 `isActive`，**不**提供刪除（DELETE）。

**理由**：
- AdminUser 有 audit 意義（誰核准了哪些商家未來查得到），硬刪除會破壞歷史脈絡。
- MVP 沒有 audit log，但保留路徑：未來補 audit 時 isActive=false 的 admin 仍可查到歷史核准紀錄。
- 軟刪除（deletedAt）保留欄位但 UI 不暴露；E2E 與管理員都用 toggle-active 操作。
- 「不能停用自己」由端點檢查（auth.sub === adminId 直接 400），避免管理員把自己關門外。

## 6. Merchant 列表分頁與篩選

**選擇**：
- query `?status=PENDING|ACTIVE|SUSPENDED|REJECTED|ALL`（預設 ALL），`?keyword=`（同時匹配 Merchant.name / Merchant.slug / OWNER MerchantUser.email），`?page=1&pageSize=20`
- 返回 `{ items: [...], total, page, pageSize }`
- 排序：PENDING 優先（讓管理員一打開就看到待審）、其次 createdAt desc

**理由**：
- 商家數量 MVP 不會破萬，分頁是為了 UI 流暢；keyword 不做 full-text，`contains` 即可。
- ownerEmail 是高頻查詢場景（管理員收到一個申請信，回頭查商家），透過 OWNER MerchantUser join 拿。

## 7. Dashboard 內容範圍

**選擇**：只顯示三個聚合卡（PENDING 數、ACTIVE 數、Admin 數量）+ 最近 5 筆 createdAt desc 商家清單。

**理由**：
- 不做圖表、不做 24h 預約量等，這些屬於 Change 6 之後才有資料來源。
- 把 dashboard 變成「快速導覽到 PENDING 列表」的入口即達 MVP 價值。
- 後續 changes 可在這頁加 widget，不需要重構。

## 8. UI 框架：list / form / dialog 都用 Element Plus

**選擇**：
- 列表用 `ElTable + ElPagination + ElTabs + ElInput(search)`
- 詳情用 `ElDescriptions + ElForm`
- 操作確認彈窗用 `OpenDialogMerchantApprove`（包含 approve / reject 模式）、`OpenDialogAdminEdit`（create / edit 模式）
- 二次確認（suspend / activate / toggle-active）用 `UseAsk()`

**理由**：
- 與既有 layout、Change 2 sign-in 表單一致；reuse 樣板已注入的 SCSS mixin。
- 兩個 dialog 拆「需要表單輸入的」（approve 帶 reason、admin edit 帶欄位）vs「純確認的」（suspend / activate / toggle-active 走 UseAsk）— 避免每個動作一個 dialog 爆量。

## 9. impersonate 中介頁面（`sys/impersonate/[merchantId].vue`）

**選擇**：不直接在 `/sys/merchants/[id].vue` 按按鈕跳 `/admin`，而是經過一個專門 page。

**理由**：
- 從「拿到 token → 寫 store → navigate」是非同步流程；單獨 page 讓 loading UI 自然（顯示「正在進入商家後台...」），失敗時也容易顯示錯誤回到 `/sys/merchants`。
- 直接在點擊處跑會讓「先 navigate 再寫 store」與「先寫 store 再 navigate」競爭；中介頁面只負責一件事，順序清晰。

## 10. 風險與後續

- **代理 token 洩漏風險**：30 分鐘 TTL 已限縮；管理員若被 XSS 拿到 admin token，會直接寫商家身分而不必經 impersonate，所以這條本身不增加風險面。
- **沒有 audit**：MVP 接受；藍圖已記錄，Change 8 之後若需補可單獨開 change。
- **批次審核**：MVP 一個一個按；商家累積後可考慮加。
- **impersonation 模式下發 API 行為**：本 change 沒有針對「代理 token 不可呼叫哪些 API」做進一步攔截，後端 `requireMerchant` 仍會放行；後續若有「商家刪除自己」等敏感端點再加 `if (auth.impersonatedBy) return forbiddenError(...)`。
