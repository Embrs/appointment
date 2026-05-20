## 1. i18n locale 補檔

- [x] 1.1 在 `i18n/locales/zh.js` 新增 `appointment.status.CONFIRMED/CANCELED/COMPLETED/NO_SHOW` 四個 key（已預約／已取消／已完成／未到）
- [x] 1.2 在 `i18n/locales/zh.js` 新增 `appointment.customerTitle.MR/MRS/MISS/MX` 四個 key（先生／女士／小姐／客人）
- [x] 1.3 在 `i18n/locales/en.js` 同步補上 8 個 key（Confirmed / Canceled / Completed / No-show；Mr. / Mrs. / Miss / Mx.）
- [x] 1.4 在 `i18n/locales/ja.js` 同步補上 8 個 key（予約済み / キャンセル / 完了 / 未来店；様（男性）/ 様（既婚女性）/ 様（未婚女性）/ お客様）
- [x] 1.5 加入「顯示已結案」開關文案到三個語系：`appointment.list.showArchived`、`appointment.list.showArchivedHint`
- [x] 1.6 加入頁頭 tooltip 文案到三個語系：`appointment.tooltip.list`、`appointment.tooltip.archive`

## 2. AppointmentTable 操作欄重構

- [x] 2.1 修改 `app/components/biz/AppointmentTable.vue`：狀態欄改用 `$t('appointment.status.' + row.status, row.status)` 顯示
- [x] 2.2 修改顧客欄稱謂為 `$t('appointment.customerTitle.' + row.customerTitle, '')` 顯示
- [x] 2.3 將「取消」按鈕從外層 link 移除，併入「更多▾」下拉的第一個選項
- [x] 2.4 「更多」按鈕顯示條件改為 `row.status === 'CONFIRMED'`；下拉內容依時間判斷：未到只顯示「取消預約」、已過顯示「取消預約 / 標記完成 / 標記未到」
- [x] 2.5 操作欄寬度由 200px 調為 220px，並保持 `fixed="right"`
- [x] 2.6 新增 emit `click-cancel` 由「更多」下拉 command 觸發，與既有 `click-complete / click-no-show` 一致風格

## 3. 預約管理頁列表預設過濾

- [x] 3.1 在 `app/pages/admin/appointments/index.vue` script 區新增 `showArchived = ref(false)` 與 watcher
- [x] 3.2 進入頁面或切換到列表 view 時，若 `showArchived === false`，將 `filter.status` 設為 `'CONFIRMED'`、`filter.dateFrom` 設為今日（`$dayjs().format('YYYY-MM-DD')`），保留使用者手動修改的 `dateTo`
- [x] 3.3 切換 `showArchived = true` 時，清空 `filter.status`、`filter.dateFrom` 擴展為今日往前 90 天，重新呼叫 `ApiLoad()`
- [x] 3.4 切換 `showArchived = false` 時，重新套用活躍過濾並 `ApiLoad()`
- [x] 3.5 在 template 列表 view 的篩選列下方（或 filter 區右側）新增 `ElSwitch` + label `$t('appointment.list.showArchived')`，旁邊以 `ElTooltip` 顯示 `appointment.list.showArchivedHint`
- [x] 3.6 行事曆 view 不受 `showArchived` 影響，維持顯示所有狀態（行為已存在，需驗證）
- [x] 3.7 在右上角 toggle「列表」加 `ElTooltip` 顯示 `appointment.tooltip.list`；在「歷史紀錄」按鈕加 tooltip 顯示 `appointment.tooltip.archive`

## 4. 歷史紀錄頁返回入口與 i18n

- [x] 4.1 修改 `app/pages/admin/appointments/archive.vue`：在 `BizPageHeader` 加入 `#actions` slot 放置「← 返回預約管理」按鈕（`ElButton plain`），點擊呼叫 `router.push('/admin/appointments')`
- [x] 4.2 import `useRouter` 並初始化 `const router = useRouter()`
- [x] 4.3 狀態欄 `prop="status"` 改為自訂 `template`，以 `$t('appointment.status.' + row.status, row.status)` 顯示
- [x] 4.4 移除 hard-code 的 `TitleLabel` 函數（archive.vue:40-41），顧客欄改用 `$t('appointment.customerTitle.' + row.customerTitle, '')`

## 5. AppointmentCalendar 狀態 i18n 檢查

- [x] 5.1 檢查 `app/components/biz/AppointmentCalendar.vue` 是否有顯示 status 字串
- [x] 5.2 若有，比照表格改為 `$t('appointment.status.' + status, status)`；若無則此章節 skip（**結論：calendar 只用 status 決定顏色，未顯示英文字串，skip**）

## 6. 前端型別與 lint

- [x] 6.1 執行 `npm run lint` 確認無新增警告（既有 `.vscode/demo.vue` 一個 error 不在本次改動範圍）
- [x] 6.2 執行 `npx nuxi typecheck` 確認 i18n key 沒拼錯（新檔案無新 logic error；既有 Pug + v-for 解構誤判保持原狀）

## 7. Playwright 實際操作驗收

- [x] 7.1 啟動 `npm run dev`，登入示範商家帳號
- [x] 7.2 進入 `/admin/appointments?view=list`，截圖確認：預設只顯示 CONFIRMED 且今日起的預約、狀態為中文、操作欄不換行（截圖：`screenshots/<change-name>-list-default.png`）
- [x] 7.3 開啟「顯示已結案」開關，截圖確認列表多出 CANCELED / COMPLETED / NO_SHOW（`screenshots/<change-name>-list-show-archived.png`）
- [x] 7.4 切到行事曆 view，截圖確認所有狀態仍可見（`screenshots/<change-name>-calendar.png`）
- [x] 7.5 點「歷史紀錄」進 archive 頁，截圖確認狀態為中文、頂部有「← 返回預約管理」按鈕（`screenshots/<change-name>-archive.png`）
- [x] 7.6 點返回按鈕，截圖確認回到 `/admin/appointments`（`screenshots/<change-name>-back-to-main.png`）
- [x] 7.7 切換語系到 en，重複 7.2 / 7.5 驗證英文狀態顯示（`screenshots/<change-name>-list-en.png`、`-archive-en.png`）
- [x] 7.8 切換語系到 ja，截圖確認日文狀態顯示（`screenshots/<change-name>-list-ja.png`、`-archive-ja.png`）
- [x] 7.9 列表上點任一 CONFIRMED 預約的「更多▾」，截圖下拉內容（`screenshots/<change-name>-more-dropdown.png`）
- [x] 7.10 點下拉「取消預約」，確認流程仍與既有取消 dialog 一致（不需截圖，只需確認無 regression）

## 8. OpenSpec 驗收

- [x] 8.1 執行 `openspec validate merchant-appointment-management-ui-fix --strict` 通過
- [x] 8.2 確認 `screenshots/` 內所有驗收截圖齊全（11 張覆蓋 zh/en/ja × list/archive/calendar/dropdown/back/cancel-dialog）
- [ ] 8.3 commit 訊息採 Conventional Commits 繁中：`feat: 收斂預約列表語意並補齊狀態 i18n（merchant-appointment-management-ui-fix）`
