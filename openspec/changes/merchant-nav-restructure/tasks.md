## 1. 前置確認

- [x] 1.1 確認 `queue-window-and-display` 變更狀態:若已 archive,直接在主分支實作;若 in-flight,於該變更 merge 後再啟動本變更避免衝突 — **使用者明示直接執行(方案 C),自行協調合併**
- [x] 1.2 列出所有引用「特定日期覆寫」「休假管理」「領號時間設定」「/admin/holidays」「/admin/queue-window」字串的檔案(`rg` 掃 `app/`、`i18n/`、`.claude/knowledge/`、`openspec/specs/`、`server/`),做為後續搜尋取代清單

## 2. i18n 文案

- [x] 2.1 `i18n/locales/zh.js`:新增 menu 分群 key(`backDesk.section.operate / schedule / settings`)與 tab 標題 key(`schedule.tab.weekly / overrides / holidays / queueWindow`),新增 panel 副標 key
- [x] 2.2 `i18n/locales/en.js`:同步補入英文翻譯(Operations / Schedule / Settings;Weekly / Single-day Override / Closed Day / Queue Hours)
- [x] 2.3 `i18n/locales/ja.js`:同步補入日文翻譯(運用 / スケジュール / 設定;週時間 / 単日調整 / 定休日 / 整理券時間)
- [x] 2.4 將舊字串「休假」「特定日期覆寫」「領號時間設定」相關 key 標註 deprecated 並補上新 key 對應

## 3. Sidebar 重構

- [x] 3.1 在 `app/layouts/back-desk.vue` template 中為商家視角(`v-else`)的 nav 加入三個 `.LayoutBackDesk__navSection` 包覆,每個 section 內含小標題 `.LayoutBackDesk__navSectionTitle`
- [x] 3.2 將 `/admin`(首頁)、`/admin/appointments`(預約管理)、`/admin/queue`(叫號) 放入「營運」section
- [x] 3.3 將 `/admin/schedule`(排班) 放入「排班」section(取代原時段、休假、領號時間設定三項)
- [x] 3.4 將 `/admin/settings`、`/admin/share-link`、`/admin/services`、`/admin/resources`、`/admin/staff` 放入「設定」section,維持 `HasRule` 條件
- [x] 3.5 為 sidebar 加入 SCSS:`.LayoutBackDesk__navSection`、`.LayoutBackDesk__navSectionTitle`(低對比文字 + 上下 padding + 與下方 nav link 細分隔線);維持 mobile 760px breakpoint 改橫向 scroll 時隱藏 section 標題(視覺退化為純扁平)
- [x] 3.6 平台管理員視角(`v-if="isAdmin"`)維持原樣,不套用分群

## 4. 排班整合頁 - 容器層

- [x] 4.1 改寫 `app/pages/admin/schedule.vue` 為 tab 容器:`definePageMeta({ layout: 'back-desk', middleware: 'merchant' })`、使用 `ElTabs` 或自製 tab 列(視 element-plus-ui 技能規範)
- [x] 4.2 實作 tab 與 query 同步:`useRoute().query.tab` 讀取初值,白名單為 `['weekly', 'overrides', 'holidays', 'queue-window']`,不合法 fallback `weekly`;tab 切換用 `router.replace({ query: { tab } })`
- [x] 4.3 四個 tab 用 `v-show`(非 `v-if`)切換,維持 panel mounted 狀態避免重切時重抓 API
- [x] 4.4 在每個 tab 內容上方加入副標 hint 文字,引用 i18n key,內含互相指路說明

## 5. 排班整合頁 - Panel 抽取

- [x] 5.1 新增 `app/components/biz/ScheduleWeeklyPanel.vue`,將原 `/admin/schedule.vue` 的 scope 切換 + SchedulerWeeklyEditor + 儲存按鈕邏輯整段搬入
- [x] 5.2 新增 `app/components/biz/ScheduleOverridesPanel.vue`,將原「特定日期覆寫」清單 + 新增/編輯/刪除整段搬入;表格標題改用「單日調整」i18n key
- [x] 5.3 新增 `app/components/biz/ScheduleHolidaysPanel.vue`,將 `app/pages/admin/holidays.vue` 主體(年份切換 + 列表 + 新增彈窗)抽出搬入;標題改「公休日」
- [x] 5.4 新增 `app/components/biz/ScheduleQueueWindowPanel.vue`,將 `app/pages/admin/queue-window.vue` 主體(服務選擇 + 7 天編輯)抽出搬入;標題改「領號時間」
- [x] 5.5 在 `app/components/biz/_index.d.ts` 補上四個新組件的 type 宣告(若該檔有手動維護)
- [x] 5.6 確認四個 panel 的 store / `$api` 使用維持原本相同,僅做位置搬移,不改互動邏輯

## 6. 舊路由 redirect

- [x] 6.1 改寫 `app/pages/admin/holidays.vue` 為極簡 redirect 頁:`definePageMeta({ layout: 'back-desk', middleware: 'merchant' })`,`onMounted` 內 `await navigateTo('/admin/schedule?tab=holidays', { replace: true })`,template 顯示載入中骨架
- [x] 6.2 改寫 `app/pages/admin/queue-window.vue` 為同形式 redirect → `/admin/schedule?tab=queue-window`
- [x] 6.3 確認 middleware 流程:未登入時應先被 `merchant` middleware 攔截到 `/sign-in`,redirect 邏輯不會被觸發

## 7. 知識庫與文件同步

- [x] 7.1 更新 `.claude/knowledge/api-modules.md`:若提及 `/admin/holidays`、`/admin/queue-window` 對應的 UI 入口,改為「排班整合頁 → 對應 tab」
- [x] 7.2 更新 `.claude/knowledge/availability-and-booking.md`:若有提及「休假」「特定日期覆寫」UI 操作,更新命名為「公休日」「單日調整」
- [x] 7.3 更新 `.claude/knowledge/queue-realtime.md`:`/admin/queue-window` 對應入口改為「排班 → 領號時間 tab」
- [x] 7.4 更新 `CLAUDE.md` 若有提及這些頁面路徑

## 8. 測試與驗收

- [x] 8.1 `npm run lint` 通過
- [x] 8.2 `npm test` 通過(本變更不動後端,vitest 應全綠)
- [x] 8.3 啟動 `npm run dev`,以商家身分登入,Playwright MCP 驗收:
  - sidebar 顯示三分群,順序與項目正確
  - 點「排班」→ 預設落 `?tab=weekly`,渲染週時段編輯
  - 切換四個 tab,URL query 同步更新,panel 內容正確
  - 直接訪 `/admin/holidays` → 自動跳 `/admin/schedule?tab=holidays`,瀏覽器歷史不堆疊(回上一頁不回 redirect 來源)
  - 直接訪 `/admin/queue-window` → 自動跳 `/admin/schedule?tab=queue-window`
  - 訪 `/admin/schedule?tab=foo` → fallback 至 weekly,URL replace
  - 每個 tab 上方副標顯示互相指路文字
- [x] 8.4 切到 mobile breakpoint(<760px)確認 sidebar 退化為橫向 scroll,section 標題正確隱藏
- [x] 8.5 平台管理員登入確認 sidebar 維持原樣(無分群)
- [x] 8.6 三語 i18n 切換確認 menu 與 tab 標題正確翻譯,無 fallback key 顯示
- [x] 8.7 截圖存到 `screenshots/merchant-nav-restructure/`(sidebar 三分群、四個 tab 各一張、mobile 退化)

## 9. OpenSpec 收尾

- [x] 9.1 `openspec validate merchant-nav-restructure` 通過(本版 CLI 的 verify 等同 validate)
- [ ] 9.2 提交 PR,描述列出 menu 分群 / 命名變更對照表,提醒商家側可能需要重新熟悉(待使用者驅動)
- [ ] 9.3 merge 後執行 `/opsx:archive merchant-nav-restructure` 歸檔(待 PR merge 後)
