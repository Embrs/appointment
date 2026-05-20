# queue-window-editor-ui-fix — Tasks

## 1. i18n bug 修復

- [x] 1.1 `app/components/biz/QueueWindowEditor.vue`：把 `useI18n()` 解構新增 `tm`；將 `WEEKDAY_NAMES` 改為 `computed(() => { const m = tm('common.weekdayLong'); return isWeekdayArray(m) ? m : FALLBACK_WEEKDAYS; })`
- [x] 1.2 在元件內加 type guard `isWeekdayArray(v: unknown): v is string[]`：判斷 `Array.isArray(v) && v.length === 7 && v.every(s => typeof s === 'string' && s.length > 0)`
- [x] 1.3 加 `FALLBACK_WEEKDAYS = ['週日', '週一', '週二', '週三', '週四', '週五', '週六']` 常數
- [x] 1.4 確認 `i18n/locales/zh.js`、`en.js`、`ja.js` 三檔皆有正確的 `common.weekdayLong` 長度 7 陣列；如有遺漏補上

## 2. UI 視覺與週名顯示

- [x] 2.1 模板中星期欄寬度由 `64px` 拉至能容納兩字「週日」的寬度（約 56–72px，依字體實測）
- [x] 2.2 SCSS 新增 `.BizQueueWindowEditor__row--weekend` modifier：背景色 `#f4f6fa`、日期欄文字色 `#909399`；在 `v-for` row 上以 `:class="{ 'BizQueueWindowEditor__row--weekend': row.weekday === 0 || row.weekday === 6 }"` 套用
- [x] 2.3 手機 viewport（≤ 760px）保留現有 1-column fallback，weekend modifier 仍生效

## 3. 批次工具列

- [x] 3.1 模板於 7 列 weekday 之上新增 `.BizQueueWindowEditor__toolbar` 區塊，含兩顆 `ElButton`（「套用到所有平日」、「套用到所有日」）與一段提示文字
- [x] 3.2 `script` 區增 `firstActiveRow = computed(() => rows.value.find(r => r.isActive))`
- [x] 3.3 `script` 區增 `ApplyToWeekdays()`：若 `firstActiveRow.value` 為 null 則 return；否則組 7 列新陣列：weekday 1..5 取來源列 `startTime/endTime/maxTickets/isActive=true`；weekday 0 與 6 保留原值；emit `update:modelValue`
- [x] 3.4 `script` 區增 `ApplyToAllDays()`：先 `await ElMessageBox.confirm(t('admin.queueWindow.applyAllDaysConfirm'), …)`，cancel 則 return；確認後 7 列全套用來源列值並 `isActive=true`；emit `update:modelValue`
- [x] 3.5 兩顆按鈕 `:disabled="!firstActiveRow"`，並用 `ElTooltip` 在 disabled 時顯示 `$t('admin.queueWindow.needSourceRow')`
- [x] 3.6 工具列加 `data-testid="queue-window-apply-weekdays"` / `queue-window-apply-all-days` 方便 Playwright 驗收

## 4. i18n key 補齊

- [x] 4.1 `i18n/locales/zh.js` 於 `admin.queueWindow` 下新增 `applyWeekdays: '套用到所有平日'`、`applyAllDays: '套用到所有日'`、`applyAllDaysConfirm: '此操作會覆蓋週六、週日的設定，是否繼續？'`、`needSourceRow: '請先啟用任一列做為來源'`
- [x] 4.2 `i18n/locales/en.js` 同 path：`applyWeekdays: 'Apply to weekdays'`、`applyAllDays: 'Apply to all days'`、`applyAllDaysConfirm: 'This will overwrite Saturday & Sunday. Continue?'`、`needSourceRow: 'Enable a row first as source'`
- [x] 4.3 `i18n/locales/ja.js` 同 path：`applyWeekdays: '平日に適用'`、`applyAllDays: '全曜日に適用'`、`applyAllDaysConfirm: 'この操作は土・日の設定を上書きします。続行しますか？'`、`needSourceRow: '適用元となる曜日を先に有効化してください'`

## 5. 驗收（Playwright MCP）

- [x] 5.1 啟動 `npm run dev`，登入測試商家、進 `/admin/queue-window`
- [x] 5.2 截圖 1：選一個 QUEUE 服務，確認 7 列分別顯示「週日 / 週一 / … / 週六」、且週日週六列底色與平日有別
- [x] 5.3 啟用週一、填 10:00–17:00、上限 30，點「套用到所有平日」→ 截圖 2 確認週二～五同步啟用同值、週六日仍關閉
- [x] 5.4 點「套用到所有日」→ 確認跳出 `ElMessageBox.confirm`、點確認後截圖 3 顯示 7 列同步啟用同值
- [x] 5.5 全關閉 7 列 → 確認兩顆批次按鈕 disabled、tooltip 顯示「請先啟用任一列做為來源」，截圖 4
- [x] 5.6 切換 locale 至 en、ja 各重整一次，截圖 5、6 確認週名與按鈕文案翻譯正確
- [x] 5.7 截圖全部存到 `screenshots/queue-window-editor-ui-fix/`

## 6. 收尾

- [x] 6.1 `npm run lint:fix` 通過
- [x] 6.2 `npm test`（Vitest）保持綠燈（本變更不涉及 server，但確保沒誤改）
- [x] 6.3 `openspec verify --change queue-window-editor-ui-fix` 通過
- [ ] 6.4 Git commit（繁中、Conventional Commits 格式）
