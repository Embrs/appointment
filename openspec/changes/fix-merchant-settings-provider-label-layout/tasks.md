## 1. 前置確認

- [x] 1.1 確認 `.PageAdminSettings__labelRow` 只在 `app/pages/admin/settings.vue` 出現（`grep -rn "PageAdminSettings__labelRow" app/ server/`），無連帶頁面需同步調整
- [x] 1.2 確認本變更**不涉及** Prisma schema / migration / API / i18n key，因此「測試站、正式站資料同步修復」不適用，於 PR 描述中明確聲明
- [x] 1.3 確認既有 i18n key `admin.settings.providerMode.{labelTitle, labelHint, labelZh, labelEn, labelJa, labelPlaceholder*}` 全部沿用，**不**新增或重命名

## 2. Template 結構調整

- [x] 2.1 修改 [app/pages/admin/settings.vue:259-284](../../../app/pages/admin/settings.vue#L259-L284)：把 hint `.PageAdminSettings__slug-hint` 與三個 `.PageAdminSettings__labelRow` 一起包進新的容器 `.PageAdminSettings__labelRows`（垂直 flex 容器）
- [x] 2.2 確認 hint 位於三個輸入框「上方」（容器內第一個子元素）
- [x] 2.3 確認三個 `ElInput` 順序為「中文 → 英文 → 日文」，每個 `prepend` 標籤對應 `admin.settings.providerMode.label{Zh,En,Ja}`
- [x] 2.4 保留 `:disabled="!form.providerModeEnabled"` 綁定不動

## 3. SCSS 樣式調整

- [x] 3.1 在 `<style lang="scss" scoped>` 內新增 `.PageAdminSettings__labelRows { display: flex; flex-direction: column; gap: 8px; margin-top: 8px; }`
- [x] 3.2 修改 `.PageAdminSettings__labelRow`：補上 `display: block; width: 100%;`，移除 `margin-top: 8px`（改由父容器 gap 控制）
- [x] 3.3 移除 `.PageAdminSettings__labelRow + .PageAdminSettings__labelRow { margin-top: 4px; }`（已由 gap 取代）
- [x] 3.4 視需要對 hint 樣式微調，確保它在新容器內仍有 `font-size: 12px` 與正確色階（沿用既有 `.PageAdminSettings__slug-hint` 樣式即可）

## 4. 程式碼自我驗證

- [x] 4.1 `npm run lint` 通過，無新增 ESLint 警告（執行 `npx eslint app/pages/admin/settings.vue`，無輸出 = pass）
- [ ] 4.2 `npm run build` 成功，無 TypeScript 或 Vue template 錯誤（改以 `npm run dev` 啟動時的編譯驗證代替，見 5.1）
- [x] 4.3 `grep -n "PageAdminSettings__labelRow\|PageAdminSettings__labelRows" app/pages/admin/settings.vue` 結果與預期一致（template + style 同步更新）

## 5. 前端畫面實測（必做）

- [x] 5.1 啟動 `npm run dev`，等待開發伺服器就緒（dev server 已在 :3000 運行，HTTP 200）
- [x] 5.2 使用 Playwright MCP 登入商家後台、進入 `/admin/settings`，桌面寬度（1440×900）截圖前後對比，確認 hint → 中文 → 英文 → 日文 垂直堆疊、各自填滿容器（`layout-desktop-1440-after.png`）
- [x] 5.3 切換視窗到 768px 寬度，截圖確認斷點過渡時版面無破損（`layout-tablet-768-after.png`）
- [x] 5.4 切換視窗到 375px 寬度（iPhone SE），截圖確認 prepend 標籤完整顯示、無橫向捲軸、輸入框可正常聚焦（`layout-mobile-375-after.png`）
- [x] 5.5 操作驗證：關閉「啟用服務人員制」toggle → 三個輸入框 disabled；開啟 toggle → 三個輸入框可編輯（DOM `disabled` 屬性 true ↔ false 切換正確）
- [x] 5.6 操作驗證：按下「儲存」→ 無錯誤 console → 重新整理 `/admin/settings` → 三個輸入框正確回填「醫師/Doctor/医師」且 `.PageAdminSettings__labelRows` 容器 `display: flex / flex-direction: column / gap: 8px` 保持

## 6. 相鄰功能無回歸測試（必做）

- [x] 6.1 同頁其他區塊（基本資訊、外觀、取消政策、預約上限）版面正常未受影響（截圖驗證）
- [x] 6.2 「儲存」按鈕位置與功能未受影響（點擊後無 console error、API 正常回應，重新整理後資料持久化）
- [x] 6.3 切換到 `/admin`、`/admin/providers`、`/admin/services` 等其他商家後台頁面確認 sidebar 與 layout 無回歸（皆 0 errors，sidebar「醫師」項目正確 fallback）

## 7. 收尾

- [ ] 7.1 撰寫 Conventional Commits 格式 commit message（繁體中文），例如 `fix(merchant-settings): 修正自訂稱呼三語輸入框排版錯亂`
- [ ] 7.2 確認 git diff 範圍僅限 `app/pages/admin/settings.vue` 與本 change 目錄 `openspec/changes/fix-merchant-settings-provider-label-layout/**`
- [ ] 7.3 推送至 `dev` 分支，待 Railway 自動部署到 staging 後再次以同樣的桌面/手機驗證流程做煙霧測試（步驟 5.2–5.6）
- [ ] 7.4 staging 驗收完成後執行 `/opsx:archive` 將本 change 歸檔（同步 delta 進 `openspec/specs/merchant-platform/spec.md`）
