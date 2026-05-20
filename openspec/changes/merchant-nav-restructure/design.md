## Context

商家後台 `back-desk.vue` sidebar 目前列 11 個 NavLink:首頁、商家設定、對外連結、服務、資源、預約管理、時段、休假、叫號、領號時間設定、成員。實測中,新進商家最常卡在:
- 「時段」「休假」「領號時間設定」三者語意相近但分散,需要在 sidebar 上下掃多次才能完成排班設定
- 「特定日期覆寫」這個工程詞無法第一眼理解,常被誤以為和「休假」是同一件事的不同入口
- 沒有任何視覺分群暗示哪些是每日營運、哪些是初始設定

實作上,既有三個頁面 `/admin/schedule`、`/admin/holidays`、`/admin/queue-window` 內部沒有相依,但都已綁定對應 API(`merchant/schedule/*`、`merchant/holidays`、`merchant/queue-window`)。`queue-window-and-display` 變更目前 in-flight,引入 `/admin/queue-window` 頁面實作,本變更需在其之後或合併期協調。

## Goals / Non-Goals

**Goals:**
- 商家第一次進後台能在 5 秒內判斷該從哪個 menu 入口開始
- 把「排班」相關功能(週時段 / 單日例外 / 公休 / 領號窗)收斂到單一入口,內部 tab 切換
- 將工程詞替換為使用者語言:「覆寫」→「單日調整」、「休假」→「公休日」
- 不破壞既有書籤與外部連結(舊路由 redirect)
- 零後端改動(無 schema、無 API 變化),因此天然不需要資料遷移

**Non-Goals:**
- 不重新設計每個 tab 內部的 UI 細節(只搬位置,不改互動)
- 不動 sidebar 在 mobile breakpoint 下橫向 scroll 的 RWD 策略
- 不調整平台管理員(`isAdmin`)的 sidebar(只動商家視角)
- 不調整 `merchant-config` 與 `queue-tickets` spec 的後端行為
- 不處理 menu 圖示化(目前是純文字,加 icon 是另一個議題)

## Decisions

### Decision 1: 整合頁的路由策略 — 沿用 `/admin/schedule` + 子 tab

**選擇**:`/admin/schedule` 改為 tab 容器,內含「每週時段 / 單日調整 / 公休日 / 領號時間」四個 tab。`/admin/holidays` 與 `/admin/queue-window` 改為 redirect。

**Tab 識別**:用 query string `?tab=weekly|overrides|holidays|queue-window`,預設 `weekly`。Redirect 時帶入對應 tab。

**為什麼不選**:
- ❌ 「另開一個新路由如 `/admin/scheduling`」 — 會讓既有 `/admin/schedule` 書籤失效,而 schedule 本身意義已經符合「排班」,沒必要改名
- ❌ 「子路由 `/admin/schedule/holidays`」 — 多一層 nested route 對應 4 個 tab 比 query 重,且 tab 切換不該觸發完整頁面重新掛載
- ❌ 「保留三個頁面、只重組 menu 分組」 — 沒解決使用者反映「不知道差在哪」的根因

### Decision 2: 整合頁的組件拆分方式 — 各 tab 各一個 SFC

**選擇**:把目前 `/admin/schedule`、`/admin/holidays`、`/admin/queue-window` 三個頁面的核心 UI 抽成 `app/components/biz/` 下的三個子組件(`ScheduleWeeklyPanel.vue`、`ScheduleOverridesPanel.vue`、ScheduleHolidaysPanel.vue`、`ScheduleQueueWindowPanel.vue`),`/admin/schedule.vue` 只負責 tab 切換與 query 同步。

**為什麼**:
- 每個 tab 內部已有獨立的 store / API 呼叫,搬成子組件最低風險
- 子組件命名以 `Schedule*Panel` 為前綴,便於後續若再加 tab 時辨識
- 「每週時段」與「單日調整」目前在同一頁,但本變更要把它們切成兩個 tab — 抽出來剛好對應 panel

**為什麼不選**:
- ❌ 「全部塞進 `schedule.vue` 用 v-if 切換」 — 單一檔案會超過 1000 行,難維護
- ❌ 「用 dynamic import 各自 lazy load」 — 4 個 panel 都是商家後台核心功能,使用者會頻繁切換,lazy load 反而閃爍;優化不在此次範圍

### Decision 3: 舊路由保留為 redirect,不直接刪除

**選擇**:`app/pages/admin/holidays.vue` 與 `app/pages/admin/queue-window.vue` 改為極簡頁面,`onMounted` 時 `navigateTo('/admin/schedule?tab=holidays', { replace: true })`。

**為什麼**:
- 商家可能已把 `/admin/holidays` 加書籤、或在內部文件貼了連結
- `replace: true` 不污染瀏覽器歷史(避免上一頁回到 redirect 來源造成 loop)
- 若未來確認沒人用了,再刪 file 也容易

### Decision 4: Menu 分組視覺 — 加分隔線與 section 標籤,不做摺疊群組

**選擇**:在 `back-desk.vue` 商家視角的 nav 中,用 `<div class="navSection">` 包覆三個分組,每組上方加一行小標題(「營運」「排班」「設定」)+ 細分隔線。標題用低對比文字,避免喧賓奪主。

**為什麼**:
- 9 個項目用摺疊群組過度設計;flat 分隔已足夠
- 平台管理員視角只有 3 個項目,不需要分組,維持現狀

### Decision 5: 命名抉擇 — 「公休日」「單日調整」「領號時間」

**為什麼採用這些字**:
- 「公休日」 — 餐飲、診所、髮廊都用「公休」,顧客也容易看懂(假日名稱會公開到 `/m/[slug]` 顧客面)
- 「單日調整」 — 比「特定日期覆寫」短、直白;比「例外日」更貼近商家心智(「我那天時間調整一下」)
- 「領號時間」 — 從「領號時間設定」拿掉「設定」,在 tab 內部「設定」是隱含的

i18n 對應:
- 公休日 → `Holiday` / `公休日 (Closed Day)`
- 單日調整 → `Single-day Override` / `単日調整`
- 領號時間 → `Queue Hours` / `整理券時間`

### Decision 6: 預設 tab 邏輯

進 `/admin/schedule` 無 query → 落 `weekly` tab;若 query `?tab=` 不在白名單則 fallback 至 `weekly`;切換 tab 時用 `router.replace` 更新 query(避免每次切 tab 都堆 history)。

## Risks / Trade-offs

- **Risk: queue-window-and-display 變更尚未 archive** → Mitigation: 在 tasks.md 第一步檢查該變更狀態;若仍 in-flight,先實作其他 3 個 tab + menu,queue-window tab 在 panel 抽取時與該變更協作合併
- **Risk: 既有外部連結 / 文件提到「休假管理」「特定日期覆寫」字串** → Mitigation: 在 PR 描述列出命名變更清單;搜尋 `i18n/locales/*.js`、`.claude/knowledge/*.md`、`README` 一併更新
- **Risk: 切換 tab 時各 panel state 重置** → Mitigation: 用 `v-show` 而非 `v-if` 切換 tab,讓 panel 保持 mounted,避免使用者切回來時要重新拉 API
- **Risk: query string 改動造成既有測試或自動化失敗** → Mitigation: 搜尋 `__tests__` 與 `screenshots` 目錄確認無硬編碼路徑;Playwright 驗收用 navigate + tab click 流程
- **Trade-off: tab 容器頁同時 mount 四個 panel,首屏會多拉 1-2 個 API** → 可接受,商家後台不是流量瓶頸;若日後成為問題可改 lazy load
