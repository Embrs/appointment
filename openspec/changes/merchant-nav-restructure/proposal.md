## Why

商家後台 sidebar 目前是 11 個項目平鋪、無分組,新進商家難以判斷該從哪開始;而 `/admin/schedule`(時段)、`/admin/holidays`(休假)、`/admin/queue-window`(領號時間設定)三者本質都是「排班相關」,卻散在三個 menu 入口,且「特定日期覆寫」「休假」兩個概念在使用者測試中經常被混淆 — 「覆寫」是工程術語、「休假」會被誤解為個人請假。本變更收斂導覽資訊架構與命名,讓商家第一次進後台就能找到方向。

## What Changes

- **BREAKING(UI)** 商家後台 sidebar 從 11 個平鋪項目重組為 3 個語意分群 + 縮減為 9 個項目:
  - 營運(每日使用):首頁 / 預約管理 / 叫號
  - 排班(週期調整):**排班**(合併原 時段+休假+領號時間)
  - 設定(初始設定):商家設定 / 對外連結 / 服務 / 資源 / 成員
- **新增整合頁** `/admin/schedule`(沿用既有路徑)改為四 tab 容器:
  - Tab 1「每週時段」— 原 `/admin/schedule` 的週規則與 scope 切換
  - Tab 2「單日調整」— 原「特定日期覆寫」,改名為更直觀的「單日調整」
  - Tab 3「公休日」— 原 `/admin/holidays` 整店休假日,改名為「公休日」
  - Tab 4「領號時間」— 原 `/admin/queue-window` 內容
- **路由相容**:`/admin/holidays` 與 `/admin/queue-window` 保留作為 redirect → `/admin/schedule?tab=holidays` / `?tab=queue-window`,避免外部書籤失效;`?tab=` query 決定預設 tab
- **頁面副標互相指路**:每個 tab 內加一句說明文字,告訴使用者「整店休 → 看公休日 tab;單資源請假或臨時改時間 → 看單日調整 tab」
- **i18n 三語同步**:zh / en / ja 三份 locale 同步更新 menu 標籤與 tab 標題
- **無資料結構變動**:不動 Prisma schema 與 API,純前端 IA 重構

## Capabilities

### New Capabilities

(無)

### Modified Capabilities

- `merchant-platform`: 「商家後台配置頁面」需求中的時段 / 休假 / 領號時間設定三個 scenario 整合為單一「排班 /admin/schedule」scenario,並補上 tab 內部行為、舊路由 redirect、tab query 規格

## Impact

- **前端**
  - `app/layouts/back-desk.vue` — sidebar 結構與分組標題
  - `app/pages/admin/schedule.vue` — 改為 tab 容器,內含四個 tab 子組件
  - `app/pages/admin/holidays.vue` — 改為 redirect 至 `/admin/schedule?tab=holidays`
  - `app/pages/admin/queue-window.vue` — 改為 redirect 至 `/admin/schedule?tab=queue-window`
  - 既有「時段管理」「公休日」「領號時間設定」UI 抽成可重用子組件放入 tab
- **i18n**:`i18n/locales/{zh,en,ja}.js` 同步新增 menu 分組與 tab 標題
- **API / 資料庫**:不動
- **規格**:`openspec/specs/merchant-platform/spec.md` 透過 delta 更新「商家後台配置頁面」requirement
- **相依變更**:`queue-window-and-display` 引入 `/admin/queue-window` 頁;本變更在其之後或合併時把它收進 tab。實作時若 `queue-window-and-display` 尚未 archive,需協調順序
