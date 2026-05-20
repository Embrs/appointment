## ADDED Requirements

### Requirement: 服務卡片價格顯示規則

`BizServiceCard` SHALL 在顯示服務價格時，當 `service.priceCents == null` **或 `priceCents <= 0`** 時隱藏整個價格區塊（不渲染 `NT$ 0`、不渲染空欄位）。只有 `priceCents > 0` 時才顯示金額。

此規則 SHALL 同時套用於商家首頁 `/m/{slug}` 的服務卡片清單與預約流程 `/m/{slug}/book` 中的服務選擇步驟。

#### Scenario: 價格為零隱藏

- **GIVEN** 某服務 `priceCents = 0`
- **WHEN** 顧客瀏覽 `/m/{slug}` 看到該服務卡片
- **THEN** 卡片不顯示「NT$ 0」字樣；價格區塊整段不渲染

#### Scenario: 價格為 null 隱藏

- **GIVEN** 某服務 `priceCents = null`（未定價）
- **WHEN** 顧客瀏覽卡片
- **THEN** 不顯示任何價格區塊

#### Scenario: 價格 > 0 正常顯示

- **GIVEN** 某服務 `priceCents = 50000`（即 NT$ 500）
- **WHEN** 顧客瀏覽卡片
- **THEN** 顯示「NT$ 500」

#### Scenario: 預約流程服務選擇步驟一致

- **GIVEN** 顧客進入 `/m/{slug}/book` 服務選擇步驟、某服務 `priceCents = 0`
- **WHEN** 列出服務
- **THEN** 該服務不顯示價格欄位（與首頁規則一致）

### Requirement: 服務卡片時長須含明確單位

`BizServiceCard` SHALL 在顯示 `service.durationMinutes` 時帶上明確的時間單位文字，禁止單獨呈現純數字。單位文字 SHALL 透過 i18n 在三語系下分別顯示：

- `zh-tw`: `{n} 分鐘`
- `en`: `{n} min`
- `ja`: `{n} 分`

i18n key 建議：`service.durationLabel`（複數參數 `{n}`）。

此規則 SHALL 套用於 `BizServiceCard`、`/m/{slug}/book` 服務選擇步驟以及任何顯示「服務時長」的顧客面元件。

#### Scenario: 中文顯示分鐘

- **GIVEN** 顧客語系為 zh-tw、服務 `durationMinutes = 30`
- **WHEN** 瀏覽服務卡片
- **THEN** 時長欄顯示「30 分鐘」（不出現孤立的數字 `30`）

#### Scenario: 英文顯示 min

- **GIVEN** 語系為 en、`durationMinutes = 60`
- **WHEN** 瀏覽卡片
- **THEN** 顯示「60 min」

#### Scenario: 日文顯示分

- **GIVEN** 語系為 ja、`durationMinutes = 45`
- **WHEN** 瀏覽卡片
- **THEN** 顯示「45 分」

#### Scenario: 預約流程服務選擇步驟一致

- **GIVEN** 顧客在 `/m/{slug}/book` 服務選擇步驟、語系 zh-tw、`durationMinutes = 90`
- **WHEN** 列出服務
- **THEN** 該服務時長顯示「90 分鐘」，不顯示孤立的 `90`
