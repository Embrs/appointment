## ADDED Requirements

### Requirement: 預約管理列表預設只顯示活躍預約

`/admin/appointments?view=list` SHALL 預設只顯示「活躍預約」：`status = CONFIRMED` 且 `startAt >= 當天 00:00`（以商家時區計）。篩選列 SHALL 提供顯眼的「顯示已結案」切換開關（建議 `ElSwitch`），預設關閉；開啟時 SHALL 清空 status 篩選預設值，並將 `dateFrom` 上限往前擴展至 90 天前（與 `appointment` 表保留範圍對齊），以同時顯示 `CANCELED / COMPLETED / NO_SHOW` 紀錄。「顯示已結案」開關狀態僅存在於當前 session（不持久化至 URL 或 localStorage），重新進頁面預設關閉。

行事曆 view 不受此預設過濾影響，仍 SHALL 顯示所有狀態的預約，避免格子空白。

#### Scenario: 預設過濾活躍預約

- **GIVEN** 商家於 2026-05-19 09:00 進入 `/admin/appointments?view=list`
- **AND** 資料庫存在多筆預約：A（CONFIRMED，2026-05-20）、B（CANCELED，2026-05-18）、C（COMPLETED，2026-05-18）、D（CONFIRMED，2026-05-19 08:00 已過）、E（CONFIRMED，2026-05-18）
- **WHEN** 列表載入完成
- **THEN** 只顯示 A、D（status=CONFIRMED 且 startAt >= 2026-05-19 00:00）
- **AND** 「顯示已結案」開關預設為關閉狀態

#### Scenario: 開啟「顯示已結案」顯示所有狀態

- **GIVEN** 同上初始狀態
- **WHEN** 使用者開啟「顯示已結案」開關
- **THEN** 列表重新查詢，顯示所有 status（含 CANCELED / COMPLETED / NO_SHOW），dateFrom 擴展至今日往前 90 天
- **AND** status 下拉篩選的預設值清空，使用者可自行選特定 status

#### Scenario: 行事曆 view 不受預設過濾影響

- **GIVEN** 商家在 `/admin/appointments?view=calendar`
- **WHEN** 行事曆載入完成
- **THEN** 顯示所有 status 的預約（包含 CANCELED / COMPLETED / NO_SHOW），不套用列表的活躍過濾

#### Scenario: 從行事曆切到列表觸發預設過濾

- **GIVEN** 商家在行事曆 view 看見所有狀態的預約
- **WHEN** 切換 toggle 到列表
- **THEN** 列表立即套用「只顯示 CONFIRMED + 今日起」的預設過濾
- **AND** 「顯示已結案」開關狀態為關閉

#### Scenario: 重新整理頁面後預設過濾仍有效

- **GIVEN** 商家在列表 view 已開啟「顯示已結案」開關
- **WHEN** 重新整理瀏覽器頁面
- **THEN** 開關恢復為關閉狀態，列表只顯示活躍預約

### Requirement: 預約狀態與顧客稱謂須經 i18n 顯示

商家後台所有顯示 `AppointmentStatus`（`CONFIRMED / CANCELED / COMPLETED / NO_SHOW`）與 `CustomerTitle`（`MR / MRS / MISS / MX`）的位置 SHALL 透過 `$t()` 顯示在地化文字，禁止直接渲染英文 enum 值或在 component 內 hard-code 中文對照表。對應的 i18n key 採 enum 同名命名：

- `appointment.status.<ENUM>`（4 個 key）
- `appointment.customerTitle.<ENUM>`（4 個 key）

三個語系檔（`i18n/locales/zh.js / en.js / ja.js`）SHALL 同步補齊上述 8 個 key。未翻譯時 SHALL fallback 到原始 enum 值（透過 `$t(key, fallback)` 第二參數），避免畫面顯示 key 本身。

#### Scenario: 列表狀態顯示中文（zh）

- **GIVEN** 商家當前語系為 zh-tw
- **WHEN** 訪 `/admin/appointments?view=list` 且列表有 CONFIRMED / CANCELED / COMPLETED / NO_SHOW 各一筆
- **THEN** 狀態欄分別顯示「已預約」「已取消」「已完成」「未到」，不出現英文

#### Scenario: 列表狀態顯示英文（en）

- **GIVEN** 商家當前語系為 en
- **WHEN** 訪同頁面
- **THEN** 狀態欄分別顯示 `Confirmed / Canceled / Completed / No-show`

#### Scenario: 歷史紀錄狀態欄 i18n

- **GIVEN** 商家在 `/admin/appointments/archive` 看到一筆 status=CANCELED 的紀錄
- **WHEN** 語系切換為 ja
- **THEN** 狀態欄即時更新為「キャンセル」

#### Scenario: 顧客稱謂 i18n

- **GIVEN** 商家在歷史紀錄或列表看到顧客欄「王先生」
- **WHEN** 語系切到 en
- **THEN** 顯示為「Wang Mr.」（或對應的 customerLastName + i18n title 拼接），不出現 `MR` 字串

### Requirement: 歷史紀錄頁須提供返回預約管理入口

`/admin/appointments/archive` SHALL 在頁面右上角（`BizPageHeader` 的 `#actions` slot）提供「← 返回預約管理」按鈕，點擊以 `router.push('/admin/appointments')` 導回主頁，禁止改用 `router.back` 以避免從外部書籤直接進入 archive 時跳出站外。

#### Scenario: 從預約管理進歷史紀錄再返回

- **GIVEN** 商家在 `/admin/appointments?view=list` 點擊「歷史紀錄」按鈕
- **AND** 進入 `/admin/appointments/archive`
- **WHEN** 點擊頁面右上角「← 返回預約管理」按鈕
- **THEN** 跳回 `/admin/appointments`，view 為 calendar（預設）

#### Scenario: 從外部書籤直接進歷史紀錄也能返回

- **GIVEN** 商家透過外部書籤直接訪 `/admin/appointments/archive`
- **WHEN** 點擊「← 返回預約管理」按鈕
- **THEN** 進入 `/admin/appointments`（即使瀏覽器歷史只有 archive 一筆），不會跳出站外

### Requirement: 列表操作欄收斂為「詳細 + 更多」

`BizAppointmentTable` 的「操作」欄 SHALL 主要動作只保留兩個 link button：「詳細」與「更多▾」。「更多」下拉 SHALL 依預約狀態與時間動態決定內容：

- `status = CONFIRMED` 且 `startAt > now`：更多下拉只含「取消預約」。
- `status = CONFIRMED` 且 `startAt <= now`：更多下拉含「取消預約」「標記完成」「標記未到」。
- 其他狀態（`CANCELED / COMPLETED / NO_SHOW`）：不顯示「更多」按鈕，只剩「詳細」。

操作欄寬度 SHALL 設為 220px 且 `fixed="right"`，確保不換行且滑動表格時仍可見。

#### Scenario: 未到時間的 CONFIRMED 顯示「詳細 + 更多（取消）」

- **GIVEN** 列表有一筆 CONFIRMED 預約，startAt 為 2026-05-25（未到）
- **WHEN** 觀察該列的操作欄
- **THEN** 顯示「詳細」與「更多▾」兩個 link，「更多」下拉只含「取消預約」一個選項

#### Scenario: 已過時間的 CONFIRMED 顯示「詳細 + 更多（取消／完成／未到）」

- **GIVEN** 列表有一筆 CONFIRMED 預約，startAt 為昨日 14:00
- **WHEN** 觀察該列的操作欄
- **THEN** 顯示「詳細」與「更多▾」，下拉含「取消預約」「標記完成」「標記未到」三個選項

#### Scenario: 結案狀態只顯示「詳細」

- **GIVEN** 列表有一筆 CANCELED / COMPLETED / NO_SHOW 的預約
- **WHEN** 觀察該列的操作欄
- **THEN** 只顯示「詳細」一個 link button，不顯示「更多」

#### Scenario: 操作欄不換行

- **GIVEN** 列表載入完成，視窗寬度 >= 1280px
- **WHEN** 觀察任一列操作欄
- **THEN** 「詳細」與「更多▾」在同一行顯示，欄寬 220px 內可完整呈現，不換行

### Requirement: 列表與歷史紀錄入口須提供 tooltip 或副標說明用途

`/admin/appointments` 的右上角「列表」toggle 與「歷史紀錄」按鈕 SHALL 提供 tooltip 或副標說明，明確區分用途：

- 「列表」tooltip 內容：「進行中的預約（可開啟『顯示已結案』查看已取消／完成／未到）」
- 「歷史紀錄」tooltip 內容：「90 天前已歸檔的舊預約紀錄」

#### Scenario: hover「列表」toggle 顯示說明

- **GIVEN** 商家在 `/admin/appointments`
- **WHEN** 滑鼠移到「列表」radio button 上停留
- **THEN** 顯示 tooltip：「進行中的預約（可開啟『顯示已結案』查看已取消／完成／未到）」

#### Scenario: hover「歷史紀錄」按鈕顯示說明

- **GIVEN** 同上
- **WHEN** 滑鼠移到「歷史紀錄」按鈕上停留
- **THEN** 顯示 tooltip：「90 天前已歸檔的舊預約紀錄」
