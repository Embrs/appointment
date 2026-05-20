## Why

`merchant-nav-restructure` 把排班四項收進單一頁面後,使用者測試發現兩個殘留困惑:

1. **「每週時段」與「領號時間」這兩個 tab 名稱看不出對應哪種服務** — 不熟業務的商家不知道自己有 TIME_SLOT 或 RESOURCE 服務時該設哪邊,結果經常 (a) 漏設預約時段、(b) 設錯邊
2. **新增資源(醫師/設備)後,顧客面與後台代客預約都選不到該資源** — 根因是商家忘了到「服務頁」把該資源「綁進」對應的 RESOURCE 服務,但目前沒有任何提示告訴他少了這一步;debug 路徑長(資源頁 ↔ 服務頁 ↔ 排班頁三邊互看才能找出)

兩個問題都是純前端 IA / hint UX 問題,後端資料模型(`ServiceResource` 多對多)是對的,不需要改 schema 或 API。本變更收尾本輪 UX 整修。

## What Changes

- **排班 tab 改名與圖示**:
  - 「每週時段」→ **「📅 預約時段」**(對應 TIME_SLOT / TIME_CAPACITY / RESOURCE 服務)
  - 「領號時間」→ **「🎟 現場領號時段」**(對應 QUEUE 服務)
  - 「單日調整」「公休日」維持名稱,加圖示 🔧 / 🚫
- **Tab 副標標出影響範圍**:每個 tab 進入後,副標補充「影響哪些服務:服務 A / 服務 B / ...」(動態列服務名);無服務時顯示提示
- **Tab 依服務存在性自動隱藏**:
  - 商家沒有任何 QUEUE 服務 → 隱藏「現場領號時段」tab
  - 商家沒有任何非 QUEUE 服務 → 隱藏「預約時段」「單日調整」tab
  - 四個 tab 全部隱藏的情況下,顯示中央 empty state:「請先到『服務』頁建立服務」
- **排班頁警告未綁定資源**:在「預約時段」tab 選某個 RESOURCE scope 時,若該資源沒被任何 RESOURCE 服務的 `ServiceResource` 綁定,顯示橘色警告 banner + 一鍵「前往服務頁綁定」按鈕
- **資源頁加「已綁服務」column**:在 `/admin/resources` 表格新增 column,以 ElTag 列出該資源被哪些 RESOURCE 服務綁定;未綁定顯示「— 尚未綁定」+ 連到服務頁的 hint
- **i18n 三語同步**:zh/en/ja 更新 tab 名稱、警告文案、column 標題與 hint

## Capabilities

### New Capabilities

(無)

### Modified Capabilities

- `merchant-platform`: 排班整合頁的 tab 命名、副標、條件顯示規則;`/admin/resources` 表格新增「已綁服務」column;排班頁未綁定資源警告

## Impact

- **前端**
  - `app/pages/admin/schedule/index.vue` — tab 名稱 + 圖示 + 依 service 條件隱藏
  - `app/components/biz/ScheduleWeeklyPanel.vue` — 副標補影響服務、scope 切到資源時偵測未綁定並顯示警告
  - `app/components/biz/ScheduleOverridesPanel.vue` — 副標補影響服務
  - `app/components/biz/ScheduleHolidaysPanel.vue` — 副標補影響服務(整店適用)
  - `app/components/biz/ScheduleQueueWindowPanel.vue` — 副標補影響服務
  - `app/pages/admin/resources/index.vue`(若該頁是該檔名) — 表格新增「已綁服務」column,讀 `GetServiceList()` 計算反向綁定
- **i18n**:`i18n/locales/{zh,en,ja}.js` 補新 key
- **API / 資料庫**:不動(讀取既有 `GetServiceList()` 即可拿到 `bookingMode` 與 `resourceIds`)
- **規格**:`openspec/specs/merchant-platform/spec.md` 透過 delta 更新「商家後台配置頁面」requirement,以及資源管理相關 requirement(若有獨立 requirement 則一併更新)
- **相依變更**:依賴 `merchant-nav-restructure` 已建立的四 tab 結構與 panel 組件;`merchant-nav-restructure` 尚未 archive 不影響本變更實作(實作對象是該變更建立的檔案,可在同一分支或之後分支接續)
