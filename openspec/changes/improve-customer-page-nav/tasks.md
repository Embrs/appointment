# improve-customer-page-nav — Tasks

## 1. 前置確認（Open Questions）

- [x] 1.1 確認 `BizCustomerPageHeader` 是否要支援 `eyebrow`（design 未列；本次先不加，按需擴充）→ 不加
- [x] 1.2 grep 既有 `BizPageHeader` 用點，列出所有後台頁清單；確認本次只動 `sys/merchants/[id].vue`，其餘後台頁不傳 `backTo`（向後相容）→ 13 個 admin/sys 頁有用，本次只動 sys/merchants/[id].vue
- [x] 1.3 grep `← 回首頁`、`返回登入`、`← {merchantName}`、`回首頁` 等手刻文案在前端的所有出現位置，建立待回收清單 → sign-in.vue:136、sign-up.vue:99/163/173、forgot-password.vue:50/85/94、queue/index.vue:79-81 自製 hero back link、queue/status.vue:73/98 `common.goHome` 按鈕

## 2. i18n 文案

- [x] 2.1 `i18n/locales/zh.js`：`common.back = '返回'`（既有 `common.backToSignIn='返回登入'` 不動，沿用）
- [x] 2.2 `i18n/locales/en.js`：`common.back = 'Back'`（既有 `common.backToSignIn='Back to sign-in'` 不動）
- [x] 2.3 `i18n/locales/ja.js`：`common.back = '戻る'`（既有 `common.backToSignIn='ログインに戻る'` 不動）
- [x] 2.4 跑 `npm run dev` 確認三語各切一次，console 無 i18n missing key（zh「返回」→ en「Back」→ ja「戻る」全部正確顯示）

## 3. 新增 BizCustomerPageHeader 元件

- [x] 3.1 新增 `app/components/biz/CustomerPageHeader.vue`，props：`title?: string`、`subtitle?: string`、`backTo?: string | null`、`backLabel?: string`、`variant?: 'inline' | 'overlay'`
- [x] 3.2 模板：inline 模式左側「← 返回」→ 中間 title/subtitle → 右側 `#actions` slot；overlay 模式左上 fixed 浮動圓角按鈕
- [x] 3.3 點擊「返回」呼叫 `navigateTo(backTo)`（不使用 `router.back()`）
- [x] 3.4 `backLabel` 未傳時預設 `t('common.back')`；有傳時使用 props
- [x] 3.5 SCSS：桌機 inline 返回鈕 + 文字並列、title 左對齊；overlay fixed 在左上角圓角按鈕
- [x] 3.6 SCSS：手機觸控區 ≥ 40px；overlay 位置內縮但仍可見
- [x] 3.7 自我驗證：留待 Playwright 階段在實際頁面驗證

## 4. 擴充 BizPageHeader

- [x] 4.1 `app/components/biz/PageHeader.vue`：新增 props `backTo?: string | null`、`backLabel?: string`
- [x] 4.2 template：左上加可選的「← 返回」（僅當 `backTo` 為 truthy 時顯示），點擊 `navigateTo(backTo)`
- [x] 4.3 SCSS：返回鈕視覺與既有豎條 / eyebrow 不衝突；桌機置中對齊、手機獨立成行
- [x] 4.4 向後相容：不傳 `backTo` 時 DOM 結構只多了 `button` 的 `v-if`，未渲染；既有 `admin/services` 等頁無視覺變化

## 5. 套用：顧客面 m/[slug]/*

- [x] 5.1 `app/pages/m/[slug]/book.vue`：頁面最上層包入 `BizCustomerPageHeader(title=立即預約, back-to=/m/${slug})`；頁內「上一步」按鈕保留
- [x] 5.2 `app/pages/m/[slug]/lookup.vue`：包入 `BizCustomerPageHeader(title=查詢預約, back-to=/m/${slug})`；移除重複的 eyebrow + h2 title
- [x] 5.3 `app/pages/m/[slug]/my-bookings.vue`：包入 `BizCustomerPageHeader(title=我的預約, subtitle=merchantName, back-to=/m/${slug})`；「切換身份」按鈕移到 `#actions` slot
- [x] 5.4 `app/pages/m/[slug]/queue/index.vue`：移除自製 `← {merchantName}` 連結，改用 `BizCustomerPageHeader(title=領號頁, back-to=/m/${slug})`
- [x] 5.5 `app/pages/m/[slug]/queue/status.vue`：移除底部「回首頁」按鈕，改用 `BizCustomerPageHeader(back-to=/m/${slug}/queue)`；error fallback 按鈕也改指向 queue 列表；onBeforeUnmount 既有 WS Disconnect 不動
- [x] 5.6 `app/pages/m/[slug]/index.vue`：**不**套 PageHeader 返回（首頁為根節點）— 確認無既有 BizPageHeader 使用

## 6. 套用：公開頁

- [x] 6.1 `app/pages/sign-in.vue`：加 `BizCustomerPageHeader(variant=overlay, back-to=/)` 浮動返回鈕；左欄手刻連結文案 i18n 化（用 `common.goHome`）
- [x] 6.2 `app/pages/sign-up.vue`：同上
- [x] 6.3 `app/pages/forgot-password.vue`：加 `BizCustomerPageHeader(variant=overlay, back-to=/sign-in, back-label=$t('common.backToSignIn'))`；左欄手刻連結文案 i18n 化
- [x] 6.4 `app/pages/index.vue` (landing)：**不**套（保留現有 hero）

## 7. 套用：後台二級頁示範

- [x] 7.1 `app/pages/sys/merchants/[id].vue`：移除自製「返回列表」按鈕，改用 `BizPageHeader(:back-to="/sys/merchants")`；同步清掉無用 SCSS class 與 unused `useRouter` import
- [x] 7.2 其餘後台頁本次**不動**

## 8. Lint / Test

- [x] 8.1 `npm run lint:fix` 通過（唯一 error 是 `.vscode/demo.vue` 既有問題，與本變更無關）
- [x] 8.2 `npm test` 既有 vitest 全綠（22/22）
- [x] 8.3 `npm run dev` 啟動成功（port 3001）、Playwright 驗收期間 console 0 errors / 0 warnings

## 9. Playwright MCP 驗收

- [x] 9.1 啟動 `npm run dev`（port 3001），用 seed 帳號 admin@demo.test / 商家 slug demo-clinic
- [x] 9.2 桌機 1024×768 跑全部 9 條返回流程全部通過：
  - book → /m/demo-clinic ✓
  - lookup → /m/demo-clinic ✓
  - my-bookings → /m/demo-clinic ✓（loading 階段 PageHeader 也正確顯示）
  - queue → /m/demo-clinic ✓（修掉 H1 重複：PageHeader 不顯示 title，只留返回鈕）
  - queue/status?id=invalid → /m/demo-clinic/queue ✓（error fallback 與 PageHeader 同目的地）
  - sign-in → / ✓
  - sign-up → / ✓
  - forgot-password → /sign-in ✓（顯示「返回登入」客製 label）
  - sys/merchants/[id] → /sys/merchants ✓
- [x] 9.3 手機 375×812 跑 lookup 與 sign-in：返回鈕仍可見且可點，sign-in overlay 浮在左上不蓋表單
- [x] 9.4 i18n 三語驗收：zh「返回」、en「Back」、ja「戻る」全部正確；forgot-password 的「返回登入」使用既有 `common.backToSignIn`
- [x] 9.5 PageBook：點服務進 step=date 後，header 返回直接 → /m/demo-clinic（離開預約流程），step 內「上一步」未受影響
- [x] 9.6 截圖留存 `screenshots/improve-customer-page-nav/desktop/*.png`（13 張）與 `mobile/*.png`（2 張關鍵）
- [x] 9.7 外部連結場景：另開新頁直接貼 `/m/demo-clinic/queue/status?id=invalid`，點 PageHeader 返回 → /m/demo-clinic/queue（非 about:blank）✓

## 10. 收尾

- [ ] 10.1 PR description 引用 `openspec show improve-customer-page-nav` 摘要、列 9.6 截圖縮圖
- [x] 10.2 **無 Prisma migration、無 API 變更**：本變更純前端（新增 1 個元件、擴充 1 個元件、改 8 個頁面、3 個 i18n locale 新增 `common.back` key）；不觸發測試 / 正式自動同步流程
- [x] 10.3 本次回收的手刻返回連結清單：
  - `sign-in.vue:136` `← 回首頁` → 文案 i18n 化為 `← {{ $t('common.goHome') }}`，並加 overlay PageHeader
  - `sign-up.vue:99` `← 回首頁` → 同上
  - `forgot-password.vue:50` `← 返回登入` → 文案改 `{{ $t('common.backToSignIn') }}`，並加 overlay PageHeader（客製 backLabel）
  - `queue/index.vue:79-81` 自製 hero `← {merchantName}` 連結 → 完全移除，由 PageHeader 取代
  - `queue/status.vue:73` error fallback「回首頁」按鈕 → 改為 → queue 列表
  - `queue/status.vue:98` 底部 actions「回首頁」按鈕 → 移除（PageHeader 已提供返回）
  - `sys/merchants/[id].vue:185-186` 自製「‹ 返回列表」按鈕 + SCSS class → 完全移除，由 BizPageHeader.backTo 取代；同步移除 unused `useRouter` import
- [ ] 10.4 merge 後在測試站 smoke：跑 9.2 的 9 條返回流程；通過後通知使用者驗收
