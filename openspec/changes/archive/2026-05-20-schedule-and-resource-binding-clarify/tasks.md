## 1. 前置確認

- [x] 1.1 確認 `merchant-nav-restructure` 變更狀態:本變更編輯該變更建立的 panel 與 container 檔案,實作上不衝突;若 `merchant-nav-restructure` 尚未 archive,本變更可平行進行,但合併與 spec sync 順序為 `merchant-nav-restructure` 先
- [x] 1.2 確認 `app/pages/admin/resources/` 目錄或檔名(可能為 `resources/index.vue` 或 `resources.vue`),記錄正確路徑供後續任務引用

## 2. i18n 文案

- [x] 2.1 `i18n/locales/zh.js`:更新 `admin.schedule.tab.weekly = '📅 預約時段'`、`admin.schedule.tab.overrides = '🔧 單日調整'`、`admin.schedule.tab.holidays = '🚫 公休日'`、`admin.schedule.tab.queueWindow = '🎟 現場領號時段'`;新增 `admin.schedule.affects` 模板與 `admin.schedule.affectsAll`(「整店所有服務」)、`admin.schedule.affectsNone`;新增 `admin.schedule.unboundResource.title`、`admin.schedule.unboundResource.action`;新增 `admin.schedule.emptyNoService`(無服務 empty state)+ goCreateService 連結文字;新增 `admin.resources.boundServices`、`admin.resources.boundServicesEmpty`、`admin.resources.boundServicesHint`
- [x] 2.2 `i18n/locales/en.js`:同步補入英文翻譯(Booking Hours / Single-day Override / Closed Days / On-site Queue Hours;Bound to: ... / Unbound; etc.)
- [x] 2.3 `i18n/locales/ja.js`:同步補入日文翻譯(予約時間 / 単日調整 / 定休日 / 来店受付時間;紐付けサービス 等)

## 3. 排班頁容器:tab 條件顯示與預設邏輯

- [x] 3.1 `app/pages/admin/schedule/index.vue`:onMounted 階段並行 `$api.GetServiceList()`,在 ref 中保留 `services`;計算 `hasNonQueueService` 與 `hasQueueService` 兩個 computed
- [x] 3.2 把 `TAB_KEYS` 改為 computed `visibleTabs`,根據 `hasNonQueueService` / `hasQueueService` 過濾;`weekly / overrides / holidays` 需要 `hasNonQueueService=true`,`queue-window` 需要 `hasQueueService=true`
- [x] 3.3 預設 tab 邏輯改為:若 URL `?tab=` 在 `visibleTabs` 中則用之;否則 fallback 至 `visibleTabs[0]`(順序 `weekly → overrides → holidays → queue-window`)
- [x] 3.4 `visibleTabs` 為空(無服務)時,渲染 empty state:「尚未建立任何服務,請先到『服務』頁建立」+ `<NuxtLink to="/admin/services">` 按鈕,不渲染 tab list
- [x] 3.5 Tab 標題使用新的 i18n key(已含 emoji 字面值);保留 `data-testid="schedule-tab-${key}"` 不變
- [x] 3.6 Verify:訪 `/admin/schedule?tab=queue-window` 但商家無 QUEUE 服務 → fallback 到 `weekly`(若有非 QUEUE 服務)或 empty state
- [x] 3.7 透過 props 把 `services` 往下傳給四個 panel(避免每個 panel 各自再拉一次,但保留 panel 內若無 prop 則自行 fetch 的退路以利獨立使用)

## 4. Panel 副標 — 影響服務

- [x] 4.1 `ScheduleWeeklyPanel.vue`:在 hint 區下方加 `.affectsServices` 行,依「啟用且非 QUEUE 服務」過濾;>5 個時前 3 + 「等 N 個」可展開
- [x] 4.2 `ScheduleOverridesPanel.vue`:同上(影響服務集合相同)
- [x] 4.3 `ScheduleHolidaysPanel.vue`:顯示「影響:整店所有服務」(用 `admin.schedule.affectsAll` key)
- [x] 4.4 `ScheduleQueueWindowPanel.vue`:依「啟用且 QUEUE 服務」過濾;若 0 個顯示「無 QUEUE 服務」hint
- [x] 4.5 副標容器 SCSS:`overflow: hidden; text-overflow: ellipsis`;mobile breakpoint 改顯示「影響 N 個服務」+ tap 展開

## 5. 未綁定資源警告

- [x] 5.1 `ScheduleWeeklyPanel.vue`:在 scope 切換為 RESOURCE 時,計算 `boundServiceCount = services.filter(s => s.bookingMode === 'RESOURCE' && s.isActive && s.resourceIds?.includes(currentResourceId)).length`
- [x] 5.2 若 `boundServiceCount === 0` 且 `selectedScope !== 'MERCHANT'`,在 scope 切換器下方渲染 `ElAlert(type="warning")`,標題取自 `admin.schedule.unboundResource.title`;放一個 `NuxtLink` 按鈕「前往服務頁綁定」連到 `/admin/services`
- [x] 5.3 警告不影響 SchedulerWeeklyEditor 渲染與儲存流程(不 disable、不擋 ApiSave)
- [x] 5.4 切回 MERCHANT scope 警告自動消失
- [x] 5.5 確認 ScheduleWeeklyPanel 已有 `services` 來源:若 props 沒傳則 panel 自行 `$api.GetServiceList()` 一次

## 6. 資源頁「已綁服務」column

- [x] 6.1 找到資源頁 SFC(`app/pages/admin/resources/index.vue` 或 `resources.vue`),onMounted 並行 `GetResourceList` + `GetServiceList`
- [x] 6.2 計算 `boundServicesByResource = computed(() => Map<string, ServiceItem[]>)`,只計入 `bookingMode === 'RESOURCE' && isActive` 服務
- [x] 6.3 表格新增 `ElTableColumn(label="${t('admin.resources.boundServices')}")`,放在「啟用」column 之前
- [x] 6.4 column template:`v-if` 已綁 → `v-for` `ElTag(size="small" type="info")` 顯示服務名;`v-else` 顯示灰色文字「— 尚未綁定」+ `ElTooltip` 顯示 hint 文字
- [x] 6.5 點 ElTag 跳 `/admin/services`(highlight 機制可選,若服務頁不支援 query highlight 就純導向)

## 7. 測試與驗收

- [x] 7.1 `npm run lint` 通過(忽略既有的 `.vscode/demo.vue` 警告)
- [x] 7.2 `npm test` 通過
- [x] 7.3 `npm run dev`,以商家身分登入,Playwright MCP 驗收:
  - 預設 tab:有非 QUEUE 服務 → 落 weekly;只有 QUEUE 服務 → 落 queue-window;無服務 → empty state
  - Tab 名稱顯示新名稱與 emoji
  - 每個 tab 副標顯示「影響服務:服務 A, 服務 B」清單
  - 預約時段 tab 切換到「沒被綁服務」的資源 → 顯示橘色警告與按鈕
  - 預約時段 tab 切換到「已綁服務」的資源 → 不顯示警告
  - 預約時段 tab MERCHANT scope → 不顯示警告
  - 警告顯示中按「儲存」→ 仍能儲存
  - `/admin/resources` 頁表格有「已綁服務」column,未綁資源顯示「— 尚未綁定」hint
- [x] 7.4 三語 i18n 切換確認 tab、副標、警告、column 都正確翻譯
- [x] 7.5 截圖存到 `screenshots/schedule-and-resource-binding-clarify/`

## 8. OpenSpec 收尾

- [x] 8.1 `openspec validate schedule-and-resource-binding-clarify` 通過
- [ ] 8.2 提交 PR,描述列出 tab 改名對照、新增 column、新增警告(待使用者驅動)
- [ ] 8.3 merge 後執行 `/opsx:archive schedule-and-resource-binding-clarify` 歸檔(待 PR merge 後)
