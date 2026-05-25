## Why

商家後台「設定 → 啟用服務人員制 → 自訂稱呼」區塊的三語（中/英/日）輸入框排版錯亂：第一個輸入框被擠到 hint 文字右側、英日輸入框並排到下一行，使用者反映很怪、不易辨識。屬於設定頁可用性 (usability) 缺陷，需修正以維持商家後台的專業度。

## What Changes

- 重排 `app/pages/admin/settings.vue` 中「自訂稱呼」`ElFormItem`：
  - 將 hint 「對顧客顯示的稱呼；未填則使用預設…」移到三個輸入框「上方」
  - 中文/英文/日文三個 `ElInput` 改為「垂直三列、各占滿容器寬度」
  - 修正 `.PageAdminSettings__labelRow` SCSS：補上 `display: block` / `width: 100%`，避免被 ElFormItem 內部 flex 容器壓擠
- RWD 沿用專案既有 768px 斷點，桌面與手機皆維持「垂直三列填滿」結構，僅容器寬度與內距收斂
- 維持與「啟用服務人員制」toggle 的 `disabled` 連動行為不變
- 不變動 API、Prisma schema、i18n key 字典、Pinia store 或任何後端邏輯

## Capabilities

### New Capabilities
<!-- 無新 capability -->

### Modified Capabilities
- `merchant-platform`: 商家後台「設定」頁「自訂稱呼」區塊新增「版面排版」需求；既有「資料持久化、disabled 連動」需求不變，僅補充版面呈現要求。

## Impact

- 受影響檔案：
  - `app/pages/admin/settings.vue`（template 結構微調 + scoped SCSS 補強）
- 不影響：
  - 任何 `server/routes/nuxt-api/**` 端點
  - `prisma/schema.prisma` 與遷移檔（**無資料結構變更**，因此「測試站／正式站資料同步修復」不適用）
  - i18n 翻譯 key（`admin.settings.providerMode.*` 既有 key 全部沿用）
  - `useMerchantStore` 與其他 Pinia stores
  - 預約流程、可用時段、號碼牌等其他模組
- 風險：極低，僅前端 scoped SCSS 與 template 結構調整；無向後相容問題
