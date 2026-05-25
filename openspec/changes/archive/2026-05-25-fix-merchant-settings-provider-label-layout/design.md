## Context

商家後台 `/admin/settings` 「啟用服務人員制 → 自訂稱呼」區塊位於 [app/pages/admin/settings.vue:259-284](../../../app/pages/admin/settings.vue#L259-L284)。目前 template 結構：

```pug
ElFormItem(:label="$t('admin.settings.providerMode.labelTitle')")
  .PageAdminSettings__slug-hint {{ $t('admin.settings.providerMode.labelHint') }}
  .PageAdminSettings__labelRow
    ElInput(... template(#prepend) 中文稱呼)
  .PageAdminSettings__labelRow
    ElInput(... template(#prepend) 英文稱呼)
  .PageAdminSettings__labelRow
    ElInput(... template(#prepend) 日文稱呼)
```

對應 SCSS：
```scss
.PageAdminSettings__labelRow { margin-top: 8px; }
.PageAdminSettings__labelRow + .PageAdminSettings__labelRow { margin-top: 4px; }
```

ElFormItem 的 `el-form-item__content` 預設是 `display: flex; flex-wrap: wrap`，導致：
1. `.PageAdminSettings__slug-hint` 與第一個 `.PageAdminSettings__labelRow` 被當成 flex item 並排
2. `.PageAdminSettings__labelRow` 沒設 `width: 100%`，被 flex 自由配寬，撐不滿一行
3. 三個輸入框尺寸與 hint 文字共同決定殘餘空間，產生「中文擠到右上、英日並排到第二行」的錯亂

設定頁的其他區塊（如 `Provider 制開關` 配 hint）都沒有「同 form-item 內塞多個並列輸入框」的結構，沒有相同問題。

## Goals / Non-Goals

**Goals:**
- 視覺上：桌面與手機皆呈現「Hint → 中文輸入框 → 英文輸入框 → 日文輸入框」垂直堆疊
- 每個輸入框（含 prepend 標籤）都填滿 ElFormItem content 區的可用寬度
- 維持 `:disabled="!form.providerModeEnabled"` 連動行為
- 維持與其他設定區塊（`PageAdminSettings__section`）的視覺節奏一致（gap、字級、border）
- RWD 沿用 768px 既有斷點，避免引入新斷點維護負擔

**Non-Goals:**
- 不改 API、Prisma schema、i18n key、Pinia store
- 不重命名 `.PageAdminSettings__labelRow` 或調整其他無關 class
- 不引入新的 UI 套件、不替換 ElInput
- 不調整「啟用服務人員制」toggle 上方的其他 form item

## Decisions

### 決策 1：以 scoped SCSS 補強 `.PageAdminSettings__labelRow`，不換語意標籤

**選擇**：保留 `<div class="PageAdminSettings__labelRow">` 包覆每個 ElInput，補上以下樣式：
```scss
.PageAdminSettings__labelRow {
  display: block;
  width: 100%;
  margin-top: 8px;
}
.PageAdminSettings__labelRow + .PageAdminSettings__labelRow {
  margin-top: 4px;
}
```
另外為了讓 hint 與三個 row 都呈現「垂直流」，將三個 row 包進一個 `.PageAdminSettings__labelRows` 容器並設 `display: flex; flex-direction: column; gap: 8px`，把 ElFormItem 內部 flex-wrap 的影響隔絕在這層之內。

**為什麼不用 grid**：grid 對單欄垂直堆疊沒帶來額外好處，但會增加 RWD 時的維護成本（須同步調整 grid-template-columns 與 fallback）。flex column 更直覺、與專案其他垂直堆疊區塊一致。

**為什麼不用 `el-row` / `el-col`**：Element Plus 的 row/col grid 適合需要欄位橫向並排 + 斷點切換的場景；本案需求是「永遠垂直三列」，引入 row/col 反而過度設計。

### 決策 2：將 hint 移到三個輸入框「上方」

**選擇**：把 `.PageAdminSettings__slug-hint` 從 ElFormItem label 之下、輸入框之上的位置保留（與使用者確認），並讓它與三個輸入框同屬同一個垂直 flex 容器，自然位於最上方。

**理由**：使用者選擇「Hint 在上方」（閱讀順序：說明 → 操作），與「啟用服務人員制」toggle 的 hint 位置一致（toggle 上方有 label、下方有 hint，但 toggle 是單一控制；本案有三個輸入框，hint 放最上更清楚對應到整組）。

### 決策 3：RWD 策略沿用 768px 斷點，行為差異最小化

**選擇**：桌面（≥768px）與手機（<768px）皆採「垂直三列各占滿寬」。差異僅在於：
- `.PageAdminSettings__form` 既有 `padding: 24px` 在手機可酌情收斂至 16px（與專案其他頁面慣例對齊；若已對齊則不動）
- prepend 標籤的最小寬度需確保中/英/日三組標籤在手機螢幕（375px 寬）不被切斷

實作上交給 Element Plus 預設行為 + ElInput 預設 100% 寬度即可達成，無需新增 media query。

**為什麼不用「桌面三欄並排、手機垂直」**：使用者已選擇「垂直三列各占滿寬（推薦）」，避免並排造成輸入框過窄、prepend label 不易閱讀。

### 決策 4：不抽出共用元件

本次只有此一處有此問題（已 grep 確認 `.PageAdminSettings__labelRow` 僅在 settings.vue），不抽 `<MultiLangInputGroup>` 之類元件，遵循 CLAUDE.md「不為假設性未來需求設計」原則。若日後其他頁面也需要三語輸入組，再評估抽離。

## Risks / Trade-offs

- **[風險] Element Plus 版本升級可能改變 `el-form-item__content` 內部布局** → 緩解：我們在 `.PageAdminSettings__labelRows` 用 flex column 自主控制堆疊方向，不依賴 form-item 內部 flex 行為，升級時影響可控
- **[風險] scoped 樣式無法直接覆蓋 ElInput prepend 的內部寬度** → 緩解：ElInput 預設寬度即為父容器寬度（即 100%），prepend 為 inline 元素不會破壞此行為，無需深層選擇器
- **[風險] 手機極窄寬度（<320px）下 prepend「中文稱呼」可能與輸入內容擠壓** → 緩解：以 i18n key 既有 placeholder 為視覺對照，375px（iPhone SE）下仍能顯示「中文稱呼」+ 至少 6 字輸入空間；<375px 屬非正式支援範圍

## Migration Plan

**部署：**
- 純前端 CSS/template 變更，無需 DB migration、無需後端部署協調
- 合併到 `dev` 分支後依照專案標準流程（Railway 自動部署 dev → staging → main）
- 無 feature flag 需求，無灰度切換

**回滾：**
- 若發現視覺退化，直接 revert commit 即可（無資料庫副作用）

## Open Questions

無。使用者已確認：
- 排版：垂直三列各占滿寬
- Hint 位置：三個輸入框上方
- RWD：沿用 768px 斷點
- OpenSpec 粒度：使用 `/opsx:propose` 一次產出 artifact
