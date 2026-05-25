## ADDED Requirements

### Requirement: 設定頁自訂稱呼區塊版面排版

商家後台 `/admin/settings` 「啟用服務人員制」區段內的「自訂稱呼」`ElFormItem` SHALL 以「Hint 文字 → 中文稱呼輸入框 → 英文稱呼輸入框 → 日文稱呼輸入框」自上而下垂直堆疊呈現；三個語言輸入框 SHALL 各自占滿 `el-form-item__content` 容器寬度（width: 100%），不得橫向並排或被 hint 文字壓擠。版面在桌面（≥768px）與手機（<768px）SHALL 維持相同的「垂直三列填滿」結構，斷點沿用專案既有 768px，不引入新斷點。三個輸入框 SHALL 持續響應 `providerModeEnabled` toggle 的 `disabled` 狀態。

#### Scenario: 桌面寬度三語輸入框垂直填滿

- **GIVEN** 商家已登入並啟用「服務人員制」toggle
- **WHEN** 在桌面瀏覽器（視窗寬度 ≥ 1024px）訪 `/admin/settings`
- **THEN** 「自訂稱呼」區塊由上至下依序為：hint 文字 → 中文稱呼輸入框 → 英文稱呼輸入框 → 日文稱呼輸入框
- **AND** 三個輸入框（含 prepend 標籤）寬度一致且皆填滿 `.PageAdminSettings__form` 容器可用寬度
- **AND** 任何兩個輸入框之間不出現橫向並排或重疊

#### Scenario: 手機寬度版面不破

- **WHEN** 在 375px 寬手機視窗訪 `/admin/settings`
- **THEN** 「自訂稱呼」區塊仍維持四元素垂直堆疊（hint + 三輸入框）
- **AND** 每個 ElInput 的 prepend 標籤（中文稱呼 / 英文稱呼 / 日文稱呼）完整顯示不被截斷
- **AND** 輸入框可正常點選與輸入文字
- **AND** 區塊不出現橫向捲軸

#### Scenario: 啟用 toggle 切換時 disabled 連動正確

- **GIVEN** 進入 `/admin/settings`
- **WHEN** 「啟用服務人員制」toggle 為「關閉」
- **THEN** 中文 / 英文 / 日文三個輸入框皆呈現 disabled 狀態（無法點選輸入）
- **WHEN** 將 toggle 切到「開啟」
- **THEN** 三個輸入框立即變為可編輯狀態，已存在的值持續顯示

#### Scenario: 儲存後資料正確回填

- **GIVEN** 開啟「啟用服務人員制」toggle
- **WHEN** 於三個輸入框依序填入「醫師」/「Doctor」/「医師」並按下「儲存」
- **THEN** 後端 `PUT /nuxt-api/merchant/[id]` 收到 `providerLabel: { zh: '醫師', en: 'Doctor', ja: '医師' }`
- **AND** 重新整理頁面後三個輸入框分別顯示「醫師」/「Doctor」/「医師」，垂直堆疊版面維持
