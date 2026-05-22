## 1. 前端 — resources 頁

- [x] 1.1 修改 `app/pages/admin/resources/index.vue:16-30` `boundServicesByResource` 計算屬性：把過濾條件 `s.bookingMode !== 'RESOURCE' && s.bookingMode !== 'RESOURCE_OPTIONAL'` 改為「只判斷 `!s.isActive`」即 `continue`（不再過濾 bookingMode，純依 `resourceIds` join）
- [x] 1.2 同步更新檔頭註解（line 2-3），把「RESOURCE / RESOURCE_OPTIONAL 服務綁定」改為「所有有資源綁定的啟用服務（不限模式）」

## 2. 前端 — services 頁

- [x] 2.1 修改 `app/pages/admin/services/index.vue:110-120` 「資源」column 的 `v-if`：從 `(row.bookingMode === 'RESOURCE' || row.bookingMode === 'RESOURCE_OPTIONAL') && row.resourceIds.length` 改為 `row.resourceIds.length`
- [x] 2.2 確認 `resourceMap[rid] || rid` fallback 仍存在（已符合 spec scenario「resourceId 對應不到 resource 時 fallback 顯示 id」）

## 3. i18n 三語

- [x] 3.1 `i18n/locales/zh.js:191` `admin.resources.boundServicesHint` 改為「請在『服務』頁編輯服務時勾選此資源,顧客才看得到他」（移除「RESOURCE 模式」）
- [x] 3.2 `i18n/locales/en.js:191` `boundServicesHint` 改為 `"Edit a service and check this resource so customers can select it."`（移除 `RESOURCE-mode`）
- [x] 3.3 `i18n/locales/ja.js:191` `boundServicesHint` 改為「サービスを編集してこのリソースを選択すると、お客様が指定できるようになります。」（移除 `RESOURCE モード`）
- [x] 3.4 全域 grep 三語檔 + 兩個頁面，確認沒有其他寫死「RESOURCE 模式 / RESOURCE-mode / RESOURCE モード」殘留

## 4. Lint & Build

- [x] 4.1 執行 `npm run lint` 確認無 ESLint 錯誤
- [x] 4.2 執行 `npm run build` 確認生產構建通過

## 5. Playwright MCP 驗收 — QUEUE 模式（核心）

- [x] 5.1 啟動 `npm run dev`、登入商家後台
- [x] 5.2 在 `/admin/resources` 建立兩個資源「A 診」、「B 診」（若已存在則跳過）
- [x] 5.3 在 `/admin/services` 建立 QUEUE 模式服務「看診」並綁定「A 診」、「B 診」
- [x] 5.4 截圖 `/admin/services` → 確認「看診」那列「資源」column 顯示兩個 ElTag「A 診」、「B 診」（不是「—」）
- [x] 5.5 截圖 `/admin/resources` → 確認「A 診」、「B 診」兩列「已綁服務」都顯示 ElTag「看診」
- [x] 5.6 把「看診」停用 → 重新整理兩個列表 → 確認「資源」column 仍顯示 tag（純粹資料 join），「已綁服務」column 顯示「— 尚未綁定」（停用過濾仍生效）

## 6. Playwright MCP 驗收 — RESOURCE / RESOURCE_OPTIONAL 不退化

- [x] 6.1 確認 RESOURCE 模式既有服務在 `/admin/services` 的「資源」column 仍正常顯示 tag
- [x] 6.2 確認 RESOURCE_OPTIONAL 模式既有服務在 `/admin/services` 的「資源」column 仍正常顯示 tag
- [x] 6.3 確認 `/admin/resources` 對 RESOURCE / RESOURCE_OPTIONAL 服務的綁定關係仍正確顯示

## 7. i18n 驗收

- [x] 7.1 在 `/admin/resources` 切到「尚未綁定」資源那列，hover/查看 hint → 文案不含「RESOURCE 模式」
- [x] 7.2 切換 i18n 到英文，確認 hint 文案改為新版本
- [x] 7.3 切換 i18n 到日文，確認 hint 文案改為新版本

## 8. OpenSpec 收尾

- [x] 8.1 執行 `openspec validate fix-service-resource-binding-display --strict` 確認 spec delta 合法
- [x] 8.2 用 `/opsx:verify` 確認實作完全對齊 design + specs，無遺漏
- [ ] 8.3 提交 commit（繁中 + Conventional Commits 格式）
- [x] 8.4 用 `/opsx:archive` 歸檔本 change（自動 sync 到 `openspec/specs/merchant-platform/spec.md`）
