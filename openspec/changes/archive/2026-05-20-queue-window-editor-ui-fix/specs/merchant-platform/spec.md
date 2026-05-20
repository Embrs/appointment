# merchant-platform — delta (queue-window-editor-ui-fix)

## ADDED Requirements

### Requirement: BizQueueWindowEditor 元件 UI

`app/components/biz/QueueWindowEditor.vue` SHALL 提供商家於 `/admin/queue-window` 編輯每週 7 天領號時段的 UI；星期欄 MUST 以本地化文字呈現、平日與週末 MUST 視覺區分、且 MUST 提供以「已啟用列」為來源的批次套用操作。

#### Scenario: 星期欄顯示本地化週名

- **GIVEN** 商家以任一語系（zh / en / ja）登入 `/admin/queue-window`
- **WHEN** 元件渲染 7 列
- **THEN** 每列日期欄顯示對應語系的完整週名（例如 zh：週日／週一／…／週六；en：Sun / Mon / … / Sat；ja：日曜／月曜／…／土曜），不得出現 i18n key 字串或單一字元

#### Scenario: i18n 取陣列失敗時的 fallback

- **GIVEN** `common.weekdayLong` 對應 message resource 不是長度 7 的字串陣列（key 漂移、locale 檔損壞）
- **WHEN** 元件渲染
- **THEN** 元件 MUST 顯示硬編碼的繁中週名 fallback（`週日 / 週一 / … / 週六`），不得顯示 i18n key 字串、不得顯示空白或單字元

#### Scenario: 平日與週末視覺區分

- **GIVEN** 元件渲染 7 列
- **WHEN** 使用者目視
- **THEN** 週日（weekday=0）與週六（weekday=6）兩列的背景色或日期欄文字色 MUST 與週一至週五（weekday=1..5）有可辨識的差異

#### Scenario: 無已啟用列時批次按鈕 disabled

- **GIVEN** 7 列皆 `isActive=false`
- **WHEN** 使用者檢視批次工具列
- **THEN** 「套用到所有平日」與「套用到所有日」按鈕 MUST 皆為 disabled 狀態，且 MUST 顯示提示文字「請先啟用任一列做為來源」（或對應語系翻譯）

#### Scenario: 套用到所有平日

- **GIVEN** 至少有一列 `isActive=true`（例如週一 startTime=10:00、endTime=17:00、maxTickets=30）
- **WHEN** 使用者點擊「套用到所有平日」
- **THEN** weekday 1..5 五列的 `startTime / endTime / maxTickets` MUST 與來源列一致、且 `isActive` 皆 true；weekday 0 與 weekday 6 的 `isActive` 與值 MUST 保持原狀不變

#### Scenario: 套用到所有日（需確認）

- **GIVEN** 至少有一列 `isActive=true`
- **WHEN** 使用者點擊「套用到所有日」
- **THEN** 元件 MUST 先彈出確認對話框（`ElMessageBox.confirm`）說明此操作會覆蓋週六、週日的設定
- **AND WHEN** 使用者確認
- **THEN** weekday 0..6 七列的 `startTime / endTime / maxTickets` MUST 與來源列一致、且 `isActive` 皆 true

#### Scenario: 多個 active 列時的 source 選擇

- **GIVEN** 有多列 `isActive=true`（例如週一、週三皆啟用，值不同）
- **WHEN** 使用者點擊任一批次按鈕
- **THEN** 元件 MUST 以**按 weekday 升序排列下的第一個** `isActive=true` 列作為來源（本例為週一）

#### Scenario: 不變更對外 v-model 契約

- **GIVEN** 父元件 `app/pages/admin/queue-window.vue` 仍以 `v-model: QueueWindowItem[]` 綁定
- **WHEN** 批次操作或單列編輯觸發 emit
- **THEN** emit 出去的陣列型別與順序語意 MUST 與本變更前一致（每列含 `weekday / startTime / endTime / maxTickets / isActive`），後端 `PUT /nuxt-api/merchant/queue-window` 行為不變
