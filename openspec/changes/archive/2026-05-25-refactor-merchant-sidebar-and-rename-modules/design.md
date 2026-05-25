## Context

### 目前 sidebar 結構（`app/layouts/back-desk.vue:92-122`）

```
營運 (sectionOperate)
  ├── 首頁         /admin
  ├── 預約管理     /admin/appointments
  ├── 叫號         /admin/queue
  └── {providerLabel}  /admin/providers   ← 條件顯示 (providerModeEnabled=true)
排班 (sectionSchedule)
  └── 排班         /admin/schedule
設定 (sectionSettings)
  ├── 商家設定     /admin/settings        ← 條件 (merchant.settings.update)
  ├── 對外連結     /admin/share-link
  ├── 服務         /admin/services
  ├── 資源         /admin/resources
  └── 成員         /admin/staff           ← 條件 (merchant.staff.manage)
```

### i18n key 命名規則
- nav key 位於 `admin.nav.{services|resources|staff|providers}`
- 模組頁面 key 位於 `admin.{services|resources|staff}.*`（如 `listTitle`、`serviceEditCreate`、`resourcesLabel`、`scopeResource` 等）
- BookingMode 顯示文案位於 `admin.bookingMode.RESOURCE` / `RESOURCE_OPTIONAL`
- `admin.nav.services` 同時被顧客端 `app/pages/m/[slug]/index.vue:71` 引用（共用 key）

### 既有 spec 約束（merchant-platform）
`### Requirement: 商家後台配置頁面` 的描述明確列出：
> sidebar 導覽 SHALL 以三個語意分群呈現：「營運」、「排班」、「設定」… 當商家 `providerModeEnabled=true` 時，「**營運**」分群 SHALL 額外顯示「服務人員」項目連到 `/admin/providers`

→ 本 change 將把這段改為「**設定**」分群顯示「服務人員」項目，是 spec 層級的變更（MODIFIED Requirement）。

## Goals / Non-Goals

**Goals:**
- Sidebar `/admin/providers` 從「營運」分群移到「設定」分群（位置：在 `服務人員` 與「服務項目」之間，符合 providerModeEnabled=true 時的條件顯示）
- 「服務」/「資源」/「成員」三個模組在所有使用者可見字串（zh/en/ja）統一改名為「服務項目」/「場所或設備」/「成員帳號」
- BookingMode 顯示文案 RESOURCE/RESOURCE_OPTIONAL 同步重命名為「場所或設備指定」/「可選場所或設備」
- 更新 OpenSpec `merchant-platform` 主 spec 對應 requirement，避免規格漂移

**Non-Goals:**
- 不改 Prisma model、不改 URL 路徑、不改 enum 值
- 不改 OpenSpec capability 結構（仍歸 `merchant-platform`）
- 不改顧客端 `/m/*` 頁面結構（連帶因 `admin.nav.services` 文案改動而出現的「服務項目」字樣是預期副作用）
- 不抽出新的「使用者面文案 vs spec 內部術語」雙層字典；本次先以 i18n value 改寫達成目的
- 不引入 RWD 或視覺斷點調整

## Decisions

### 決策 1：只改 i18n value，不重命名 key；同時將硬編碼中文補上 i18n key

**選擇**：保留 `admin.nav.services` / `admin.services.*` / `admin.staff.*` 等所有 i18n key 名稱，只改其對應的三語 value。同時將 `app/pages/admin/services/index.vue`、`app/pages/admin/resources/index.vue`、`app/pages/admin/staff.vue`、`app/pages/admin/share-link.vue` 中的硬編碼中文字串改用 i18n key 渲染（補上對應 zh/en/ja 三語 value），讓三語切換真正生效。

**理由**：
- 改 key 會牽動所有 `t('admin.nav.services')` 呼叫點（grep 顯示至少 20 處），diff 範圍大、回歸風險高
- 保留 key 可清楚對應 Prisma model（key 是內部術語、value 是 UI 文案，分層清楚）
- Playwright 實測發現 services/resources/staff 三個列表頁面的標題、subtitle、`+ 新增…` 按鈕、ElTableColumn label、`編輯/刪除` 按鈕、`(停用)` 後綴等大量寫死中文，i18n value 重命名無法生效於這些位置 → 必須同步補 i18n key 才能達成「全面三語同步」目標

**為什麼不改 key 為 `admin.nav.serviceItems` 等更語意化的名稱**：未來若再次重命名 UI（例如不同行業），改 value 即可，不必再做大型 key 重構。

**為什麼不拆出獨立 change 處理硬編碼 → i18n**：原本 proposal 中宣告「全面重命名」涵蓋頁面標題、表格表頭、按鈕、Empty state，這些位置若不補 key 即無法達成驗收條件（三語切換）；拆出獨立 change 會讓本 change 留下「sidebar 改了但內頁仍是舊文字」的中間態，使用者已選擇方案 2（最徹底）。

### 決策 2：BookingMode 顯示文案同步改、enum 值不動

**選擇**：`admin.bookingMode.RESOURCE` 顯示文案改為「場所或設備指定」、`RESOURCE_OPTIONAL` 改為「可選場所或設備」；後端 enum 字串 `'RESOURCE'` / `'RESOURCE_OPTIONAL'` 與 Prisma BookingMode enum 不動。

**理由**：UI 一致性。若服務 booking mode 選擇器仍顯示「指定資源」，會與其他地方的「場所或設備」字樣不一致。

**為什麼不改 enum 值**：enum 值變更會觸發 schema migration、影響後端、影響既有 DB 資料、影響 API contract — 屬於 Non-Goals。

### 決策 3：「成員」改名範圍包含 staffEditCreate/Edit、admin.staff.*，但 i18n key `admin.staff` 路徑名仍叫 staff

**選擇**：所有 zh/en/ja value 中「成員」/「Staff」/「メンバー」→「成員帳號」/「Member Accounts」/「メンバーアカウント」；i18n key path（`admin.staff.listTitle` 等）不動。

**為什麼**：與決策 1 同理。「成員帳號」是 UI 文案、「staff」是內部術語。

### 決策 4a：新增 i18n key 命名規則

- **共用 column header**：`common.col.name`、`common.col.actions` —— 多個列表頁共用
- **模組獨有 column header**：`admin.{services|resources|staff}.columns.<key>` —— 例如 `admin.services.columns.mode`、`admin.staff.columns.role`
- **列表頁副標**：`admin.{services|resources|staff}.subtitle`
- **新增按鈕**：`admin.{services|resources|staff}.newButton`（內含「+ 」前綴，避免拼接複雜化）
- **停用後綴標籤**：`common.tagInactive` 三語共用「 (停用) / (inactive) / （停止中）」
- **權限封鎖訊息**：`admin.staff.noPermission`
- **空狀態行動引導**：`admin.shareLink.empty` / `admin.shareLink.goSettings`

避免在 `common` 命名空間下加會跟既有動詞混淆的詞（`common.cancel` 是「取消」動詞，不適合再放 `common.name` 名詞），故用 `common.col.*` 子物件分組。

### 決策 4：sidebar template 採「整段移動」而非新增條件邏輯

**選擇**：直接把 `app/layouts/back-desk.vue:103-106` 的 `NuxtLinkLocale` 整段從 sectionOperate 區塊剪下、貼到 sectionSettings 區塊中（位於 share-link 之後、services 之前）。`v-if="providerModeEnabled"` 條件保留不動。

**為什麼**：最小改動原則，不引入新的 layout 條件分支或新的 nav-section 結構。

### 決策 5：i18n value 譯名統一定案

| 原中文 | 新中文 | 原英文 | 新英文 | 原日文 | 新日文 |
|---|---|---|---|---|---|
| 服務 / 服務管理 | 服務項目 / 服務項目管理 | Services | Service Items | サービス | サービス項目 |
| 服務名稱 | 項目名稱 | Service name | Item name | サービス名 | 項目名 |
| 新增服務 / 編輯服務 | 新增項目 / 編輯項目 | Add Service / Edit Service | Add Item / Edit Item | サービス追加 / 編集 | 項目追加 / 編集 |
| 資源 / 資源管理 | 場所或設備 / 場所或設備管理 | Resources | Venue or Equipment | リソース | 場所・設備 |
| 資源名稱 | 場所或設備名稱 | Resource name | Venue/Equipment name | リソース名 | 場所・設備名 |
| 綁定資源 | 綁定場所或設備 | Bound Services* | (英文側保留 "Bound Services" 表「已綁服務」方向) | 紐付けリソース | 紐付けの場所・設備 |
| 指定資源 (BookingMode) | 場所或設備指定 | RESOURCE | Venue/Equipment Required | リソース指定 | 場所・設備の指定 |
| 可選資源 (BookingMode) | 可選場所或設備 | RESOURCE_OPTIONAL | Venue/Equipment Optional | リソース選択（任意） | 場所・設備（任意） |
| 成員 / 成員管理 | 成員帳號 / 成員帳號管理 | Staff | Member Accounts | メンバー / スタッフ | メンバーアカウント |
| 新增成員 / 編輯成員 | 新增成員帳號 / 編輯成員帳號 | Add Staff Member | Add Member Account | メンバー追加 | メンバーアカウント追加 |

*註：英文側「Bound Services」方向（資源頁→已綁的服務）譯為 "Bound Service Items"；中文「綁定資源」（服務頁→已綁的資源）譯為「綁定場所或設備」。兩者方向不同，需個別處理。

## Risks / Trade-offs

- **[風險] `admin.nav.services` 在顧客端 `/m/[slug]/index.vue` 共用** → 顧客端會看到「服務項目」標題 → **緩解**：視為可接受的同步副作用（已在 proposal 聲明）；若使用者驗收時不接受，再評估是否拆出獨立的顧客端 key
- **[風險] 文案中「資源」與「場所或設備」字數差異大（2 字 → 5 字）** → 表格表頭、按鈕、breadcrumb 可能換行或截斷 → **緩解**：Playwright 桌面 / 768px / 375px 三檔位實測確認，必要時調整文案至「場所/設備」（4 字）作為 fallback
- **[風險] 已歸檔的 OpenSpec changes（如 `2026-05-22-introduce-provider-model`）中有「sidebar 三分群」描述未動** → **緩解**：archives 為歷史記錄不修改，僅同步活 spec
- **[風險] 跨模組互引文案（如資源頁「請至『服務』頁建立…」）忘記改** → **緩解**：tasks.md 將窮舉所有 i18n value 中包含「服務」「資源」「成員」字樣的 key，逐一審視

## Migration Plan

**部署：**
- 純前端 i18n value 與 layout template 變更，無 DB migration、無 schema 變動
- 合併到 `dev` 分支後依專案標準流程自動部署到 staging
- 無 feature flag 需求

**回滾：**
- 若視覺/語意效果不佳，可直接 revert commit（無資料影響）

## Open Questions

- 顧客端 `/m/[slug]/*` 是否要看到「服務項目」標題？目前 design 假設「可接受」；若驗收不接受，新 change 處理拆 key
- 英文 "Bound Service Items" / "Service Item" 在表格表頭可能略長；驗收時若發現截斷，design 允許 fallback 至「Items」單字
