# Capability：finalize-deploy — delta for fix-customer-booking-ux

## ADDED Requirements

### Requirement: 顧客面語系切換 UI

The customer-facing layout (`LayoutFrontDesk`) SHALL provide a working locale switcher that uses `useI18n().setLocale(code)` to switch between zh / en / ja. The switcher MUST be a dropdown showing each locale's display name; the trigger button MUST use a translate icon (`mdi:translate` via `NuxtIcon`) — not arbitrary glyphs such as `⌐`.

#### Scenario: 點擊切換英文

- **GIVEN** 顧客位於 `/m/{slug}`（zh 預設）
- **WHEN** 點擊頂部語系下拉，選擇「English」
- **THEN** 整頁 UI 文字切換為英文（按鈕、卡片標籤、step labels），cookie `i18n_redirected` 寫入 `en`，下次造訪預設仍為英文

#### Scenario: 點擊切換日文

- **GIVEN** 顧客在預約流程任一步
- **WHEN** 切換語系為「日本語」
- **THEN** 步驟 label、按鈕、表單欄位提示全部變日文，沒有出現 i18n key 原文

#### Scenario: 下拉禁用當前語系

- **GIVEN** 當前語系為 zh
- **WHEN** 顧客打開語系下拉
- **THEN** 「繁體中文」項目為 disabled 狀態，無法重複切到相同語系

#### Scenario: Icon 正確呈現

- **GIVEN** 任何顧客面頁面
- **WHEN** header 渲染完成
- **THEN** 語系按鈕內顯示的是 translate icon（地球或翻譯圖示），不是 `⌐` 或其他非預期字符
