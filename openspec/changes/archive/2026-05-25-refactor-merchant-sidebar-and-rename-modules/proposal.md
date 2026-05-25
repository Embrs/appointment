## Why

商家後台 sidebar 目前的分群不夠精確：`服務人員（/admin/providers）` 被歸在「營運」分群，但它本質上屬於「設定」一類的店家基礎設定資料（與服務/資源/成員為同一管理性質）。同時「服務」「資源」「成員」三個名稱對商家而言語意過於抽象，難以快速理解管理對象：
- 「服務」實際指可預約的「項目」（看診、剪髮、課程…）
- 「資源」實際指可分配的「場所或設備」（診間、座位、機台…）
- 「成員」實際指可登入後台的「人員帳號」

統一改名能降低商家上手的認知成本，並把 sidebar 結構調整到符合語意層級。

## What Changes

### Sidebar 結構
- 將 `/admin/providers` 從「營運」分群**移到**「設定」分群（與服務／資源／成員同列）
- 「營運」分群 SHALL 保留：首頁、預約管理、叫號
- 「設定」分群 SHALL 包含：商家設定、對外連結、（providerModeEnabled=true 時）服務人員、服務項目、場所或設備、成員帳號（merchant.staff.manage 權限）

### 模組文案重命名（i18n 三語同步）
| 原中文 | 新中文 | 原英文 | 新英文 | 原日文 | 新日文 |
|---|---|---|---|---|---|
| 服務 | 服務項目 | Services | Service Items | サービス | サービス項目 |
| 資源 | 場所或設備 | Resources | Venue or Equipment | リソース | 場所・設備 |
| 成員 | 成員帳號 | Staff | Member Accounts | メンバー | メンバーアカウント |

範圍涵蓋：sidebar、頁面標題（listTitle）、新增/編輯彈窗標題（serviceEditCreate/Edit 等）、表格表頭、按鈕、Empty state、相關 hint 文字、跨頁互引文案（如服務頁的「綁定資源」→「綁定場所或設備」、排班頁的「scopeResource」label、BookingMode.RESOURCE 顯示文案）。

### 範圍限制（重要）
- **不改** Prisma model 名稱：`Service` / `Resource` / `StaffMember` / `Provider` 保持不變
- **不改** URL 路徑：`/admin/services` / `/admin/resources` / `/admin/staff` / `/admin/providers` 保持不變
- **不改** API 端點與 enum 字串值：`BookingMode.RESOURCE` 等 enum 仍為 `RESOURCE`，僅 i18n 顯示文案重命名為「場所或設備指定」
- **不改** 任何資料庫資料

## Capabilities

### New Capabilities
<!-- 無新 capability -->

### Modified Capabilities
- `merchant-platform`: 商家後台 sidebar 分群結構與三個模組名稱（services / resources / staff）顯示文案

## Impact

### 受影響檔案
- `app/layouts/back-desk.vue`：sidebar template 中 `/admin/providers` 連結從 sectionOperate 區塊移到 sectionSettings 區塊
- `i18n/locales/zh.js` / `i18n/locales/en.js` / `i18n/locales/ja.js`：約 40+ 個 i18n value 字串改寫（key 不變）
- 商家後台相關頁面繼續使用既有 i18n key 即可，**不需動模版**：
  - `app/pages/admin/services/index.vue`
  - `app/pages/admin/resources/index.vue`
  - `app/pages/admin/staff/index.vue`
  - `app/pages/admin/schedule/*.vue`（scopeResource、boundServices 等引用點）
  - `app/components/open/dialog/service-edit.vue` 等彈窗

### 副作用評估
- 顧客端 `/m/[slug]/index.vue:71` 引用 `admin.nav.services`，會連帶改成「服務項目」— 視為**可接受的同步**，對顧客來說「項目」也合適
- BookingMode.RESOURCE 顯示文案重命名為「場所或設備指定」會影響服務管理頁中 booking mode 選擇器與顯示徽章
- OpenSpec 既有 spec `merchant-platform` 已有「sidebar 三分群」requirement，本 change 將以 MODIFIED 操作更新

### 不影響
- 任何 API 行為、Prisma schema、enum 值
- 顧客預約流程、號碼牌、可用時段計算
- 後端任何邏輯
