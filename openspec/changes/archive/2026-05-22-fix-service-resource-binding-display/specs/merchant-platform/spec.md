## MODIFIED Requirements

### Requirement: 資源頁顯示綁定服務

`/admin/resources` 列表 SHALL 包含「已綁服務」column，顯示每個資源被哪些 service 透過 `ServiceResource` 綁定（含 RESOURCE / RESOURCE_OPTIONAL / QUEUE 三種 bookingMode，過濾條件為 `isActive === true && resourceIds` 包含該 resource）；未被任何 service 綁定的資源 SHALL 以視覺方式提醒商家。資料 SHALL 由客戶端 join `GetServiceList` 與 `GetResourceList` 計算，**不新增後端 endpoint**。

#### Scenario: 列表載入並 join 服務資料

- **WHEN** 訪 `/admin/resources`
- **THEN** 並行請求 `GetResourceList()` 與 `GetServiceList()`；組出 `Map<resourceId, ServiceItem[]>` 對應關係（過濾條件：`service.isActive === true` 且 `service.resourceIds` 包含該 resource）

#### Scenario: 已綁服務以 ElTag 列出

- **GIVEN** 資源 R 被服務 A（RESOURCE）與服務 B（QUEUE）綁定
- **WHEN** 渲染 R 那一列的「已綁服務」column
- **THEN** 顯示兩個 ElTag，文字分別為 A.name 與 B.name，**不依 `bookingMode` 過濾**

#### Scenario: 未綁服務顯示提醒

- **GIVEN** 資源 R 未被任何啟用 service 的 `resourceIds` 包含
- **WHEN** 渲染 R 那一列
- **THEN** 「已綁服務」column 顯示「— 尚未綁定」（灰色文字）+ 小 hint「請在『服務』頁編輯服務時勾選此資源」（**hint 不得提及任何特定 bookingMode 名稱**）

#### Scenario: QUEUE 模式多資源綁定正確顯示

- **GIVEN** 啟用的 QUEUE 服務「看診」綁定 A 診 / B 診
- **WHEN** 渲染 `/admin/resources`
- **THEN** A 診那列「已綁服務」顯示 ElTag「看診」；B 診那列亦顯示 ElTag「看診」

#### Scenario: 停用 service 不計入綁定

- **GIVEN** 服務 X 的 `isActive === false`，即使 `resourceIds` 包含 R
- **WHEN** 計算 R 的已綁服務
- **THEN** 不顯示 X（維持既有 UX：停用服務不出現在「已綁服務」column）

## ADDED Requirements

### Requirement: 服務頁顯示綁定資源

`/admin/services` 列表 SHALL 包含「資源」column，對於所有 `resourceIds.length > 0` 的 service（不依 `bookingMode` 過濾，含 RESOURCE / RESOURCE_OPTIONAL / QUEUE），SHALL 把 `resourceIds` 對照 `GetResourceList()` 結果展開為 ElTag 顯示資源名稱；`resourceIds` 為空陣列時 SHALL 顯示「—」placeholder。資料 SHALL 由客戶端 join `GetServiceList` 與 `GetResourceList` 計算，**不新增後端 endpoint**。

#### Scenario: RESOURCE 服務顯示已綁資源

- **GIVEN** RESOURCE 服務「美甲」綁定資源「技師 A」、「技師 B」
- **WHEN** 渲染 `/admin/services`
- **THEN** 「美甲」那列「資源」column 顯示兩個 ElTag：「技師 A」、「技師 B」

#### Scenario: QUEUE 服務顯示已綁資源

- **GIVEN** QUEUE 服務「看診」綁定資源「A 診」、「B 診」
- **WHEN** 渲染 `/admin/services`
- **THEN** 「看診」那列「資源」column 顯示兩個 ElTag：「A 診」、「B 診」（**不能顯示「—」**）

#### Scenario: RESOURCE_OPTIONAL 服務顯示已綁資源

- **GIVEN** RESOURCE_OPTIONAL 服務「按摩」綁定資源「按摩床 1」
- **WHEN** 渲染 `/admin/services`
- **THEN** 「按摩」那列「資源」column 顯示 ElTag「按摩床 1」

#### Scenario: 無資源綁定時顯示 placeholder

- **GIVEN** TIME_SLOT 服務「諮詢」的 `resourceIds` 為空陣列
- **WHEN** 渲染 `/admin/services`
- **THEN** 「諮詢」那列「資源」column 顯示「—」（灰色 placeholder）

#### Scenario: resourceId 對應不到 resource 時 fallback 顯示 id

- **GIVEN** service 的 `resourceIds` 含某個 id 在 `GetResourceList` 結果中找不到（例如資源已被軟刪除但 service 未同步）
- **WHEN** 渲染對應 ElTag
- **THEN** 該 ElTag 顯示原始 `rid` 字串（fallback），不阻塞整列渲染
