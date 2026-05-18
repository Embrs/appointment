# improve-customer-page-nav — Design

## Context

顧客面 `/m/{slug}/*` 目前頁首與返回入口分散：

- **layouts**：`front-desk.vue` 提供 sticky 頂部（品牌名 + 語系切換），不負責頁面層級的標題與返回。
- **頁面標題**：各頁自行寫 `h2`／`h3`，樣式不一。
- **返回**：`queue/index.vue` 寫 `← {name}`、`queue/status.vue` 用 `navigateTo('/m/{slug}')`、`sign-in/up/forgot` 各有手刻左欄連結；`lookup.vue`、`my-bookings.vue` 完全沒有。
- **後台**：`BizPageHeader` 已存在（後台二級頁多數有用），但沒有 `backTo` props。

OpenSpec 變更 `fix-customer-booking-ux` 已處理 ServiceCard / DatePicker / 步驟條 / 語系切換，本變更**不重疊**那組改動，僅加入返回入口與頁首一致性。

技術上這是純前端調整，無 schema、無 API 變更，主要工作是抽元件與套用。

## Goals / Non-Goals

**Goals**：
- 顧客面與公開頁有一個元件級的「統一頁首 + 返回入口」（`BizCustomerPageHeader`），所有頁面以同一寫法宣告 title 與 backTo。
- 後台 `BizPageHeader` 擴充 `backTo` props，向後相容（不傳則行為不變）。
- 「返回」用**固定父路徑**（`navigateTo(backTo)`）而非 `history.back()`，可預期、不會跳出本站。
- 預約步驟流程（PageBook）的 header 返回 = 離開預約；step 內「上一步」維持原本職責。
- 全部新返回文案統一 i18n key `common.back`，三語覆蓋。

**Non-Goals**：
- 不重做 layout 頂部結構（品牌名 / 語系切換維持原狀）。
- 不引入麵包屑、不引入 sticky 頁首欄。
- 不處理「預約流程進行中按返回是否要警示確認離開」（列入 Open Questions，本次不實作）。
- 不重構後台 sidebar 導航；後台只示範性地讓 `sys/merchants/[id]` 套 `backTo`。
- 不動 Prisma / API / Nitro 路由。

## Decisions

### D1：用「固定 `backTo` 路徑」而非 `router.back()`
- **選**：頁面 `<BizCustomerPageHeader :back-to="..." />` 宣告父路徑，元件內 `navigateTo(backTo)`。
- **不選 `router.back()`**：使用者若從外部連結（LINE、QR Code、Google）直接進入子頁，`back` 會跳出本站，UX 反而更差；且 PageBook 內部有自己的 step 退階邏輯，`history.back()` 會與 step 機制衝突。
- **後果**：每頁要明確寫出 backTo（多一點宣告），但行為穩定可測。

### D2：新增 `BizCustomerPageHeader`，後台 `BizPageHeader` 擴充 `backTo`
- **選**：兩個元件並存。
  - `BizCustomerPageHeader` 是顧客面/公開頁專用，視覺輕量（小字 title、返回是純文字「← 返回」icon），響應式行為偏手機友善。
  - `BizPageHeader` 是後台用，已有強烈視覺（左側豎條 + eyebrow + actions），擴充 `backTo` 後左上加返回箭頭，多數後台頁不需要、二級頁才打開。
- **不選「合併成一個元件」**：兩端視覺定位不同，合併會生出一個含 `variant="customer" | "admin"` 的肥元件，並沒省到。
- **後果**：兩個元件要各自維護，但職責清楚、樣式不互相干擾。

### D3：PageBook 內部「上一步」與 header「返回」職責切分
- header 的返回鈕 = **離開預約流程**（去 `/m/{slug}`），無論在哪一步都是離開。
- 頁面內的「上一步」按鈕 = **退到前一步**（step → step-1）。
- 為什麼這樣切：使用者在 step=4 想取消預約時不需要按 4 次「上一步」；同時 step 內回退仍有，不會丟失。
- 視覺上要明確區隔：header 返回放左上、step「上一步」放在 step 內容區右下（既有位置）。

### D4：i18n 文案統一 `common.back`
- 既有手刻文案（`← 回首頁`、`返回登入`、`← {merchantName}`）回收，全部走 `t('common.back')`。
- 個別頁面若要客製化（例如 `forgot-password` 想顯示「返回登入」而非「返回」），用 `backLabel` props 覆蓋：
  ```vue
  <BizCustomerPageHeader :back-to="'/sign-in'" :back-label="t('common.backToSignIn')" />
  ```
- i18n keys：
  - **新增** `common.back` — 「返回」/ 「Back」/ 「戻る」（PageHeader 預設 label）
  - **沿用既有** `common.backToSignIn` — 「返回登入」/「Back to sign-in」/「ログインに戻る」（forgot-password 透過 `backLabel` 注入；不另立 `auth.backToSignIn`）

### D5：響應式行為
- 桌機 ≥ 768px：返回鈕在左上，文字「← 返回」並列；title 在中央或左對齊。
- 手機 < 768px：返回鈕保留為左上 icon「←」+ 文字（48×44 觸控區），title 換行到下方。
- 不固定 sticky；隨頁面滾動。

### D6：無資料結構變更，跳過自動同步機制
- 使用者提醒「資料結構變化要自動同步到測試／正式」條款本次**不觸發**：本變更純前端。
- tasks.md 會在收尾段明確標註「無 prisma migration」，PR description 同步聲明。

## Risks / Trade-offs

- **R1**：兩個 PageHeader 元件可能逐漸長出不一致樣式 → **Mitigation**：兩元件共用 SCSS 變數（`$primary`、`$white` 等）；後續若發現重複度高再合併。
- **R2**：固定 `backTo` 在動態流程下不夠彈性（例如 `queue/status` 可能來自首頁、也可能來自領號後跳轉，固定父路徑 = `/m/{slug}/queue` 對「領號後」順、但對「直接書籤回訪」也合理） → **Mitigation**：本次先固定到 design 中表列的父路徑；若使用者回報問題再評估改 hybrid。
- **R3**：PageBook header 返回 = 離開可能讓使用者在 step=4 不小心點到、丟失填寫 → **Mitigation**：本次不加防離脫對話框（Non-Goal），但 design 中標記為 Open Question；未來若需要再用 `useEventListener` + `beforeunload` 或 Vue Router `beforeRouteLeave` 補。
- **R4**：i18n 三語覆蓋若漏 key 會出現原 key 字串 → **Mitigation**：tasks 6.x 跑 lint + dev server 啟動觀察 i18n 警告；Playwright 驗收要切三語各跑一次。

## Migration Plan

1. **PR 內部執行順序**：
   1. 先加 i18n keys（`common.back`、`auth.backToSignIn`）三語檔。
   2. 新增 `BizCustomerPageHeader`。
   3. 擴充 `BizPageHeader` 加 `backTo`。
   4. 依 proposal 表格逐頁套用。
   5. Playwright 驗收 + 截圖。
2. **部署**：走既有 Docker / Railway 流程；**不需**資料庫遷移、**不需**測試／正式自動同步動作。
3. **回滾**：純前端改動，回滾 = revert PR，無資料殘留。

## Open Questions

- **OQ1**：PageBook 在 step≥2 點 header 返回是否要彈出「確定離開？已填寫資料將遺失」對話框？
  - 預設：**不彈**（本次 Non-Goal）。如使用者驗收後反饋常誤觸再做。
- **OQ2**：`my-bookings.vue` 的「切換身份」按鈕擺在 header `#actions` 還是頁面內？
  - 預設：**`#actions` slot**（與其他頁面 actions 一致）。
- **OQ3**：landing `pages/index.vue` 是否該套 `BizCustomerPageHeader` 但不顯示返回？
  - 預設：**不套**。landing 有自己的 hero，套 PageHeader 會打架；只在 sign-in/up/forgot 套。
