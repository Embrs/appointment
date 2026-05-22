## Context

商家叫號台 `/admin/queue` 自 `2026-05-15-queue-tickets` 上線、`2026-05-21` walk-in/ETA/QR/大螢幕四改善後，控制台元件（[app/components/biz/QueueControlPanel.vue](../../../app/components/biz/QueueControlPanel.vue)、[app/pages/admin/queue.vue](../../../app/pages/admin/queue.vue)）功能持續疊加但**沒做過動作層級重整**，現場觀察到三個操作痛點：

| 痛點 | 現況實作 |
|------|----------|
| 按鈕凌亂 | 頁首平鋪 2 顆按鈕 + 連線 chip；卡片內平鋪 4 顆 large 按鈕（叫下一號／完成／過號／現場登記） |
| 票數一多列表難讀 | `v-for of service.tickets` 全列、無篩選、無 max-height、不分群 |
| 多張 CALLED 無法指定完成 | 完成/過號按鈕硬綁 `ServingTicket = CalledTickets[last]`；先叫的票卡死 |

後端契約：`POST /nuxt-api/queue/[id]/done`、`POST /nuxt-api/queue/[id]/skip` 早已接收 `ticketId`；`GET /nuxt-api/queue/today` 回傳完整當日票（含所有狀態）+ ETA。**所有資料前端已有，純前端改造即可達成需求**。

## Goals / Non-Goals

**Goals:**
- 卡片動作層級從 1 層平鋪 → 2 層（主+次卡片動作、ticket 自身動作）
- 多張 CALLED 共存場景下，每張票可個別「完成 / 過號」（與後端 ticketId 對齊）
- 列表加狀態 tabs + 搜尋 + 捲動界線，票數 ≤ 200 時依然可秒搜
- 桌機（≥ 1280px）與直立平板（768×1024）兩斷點皆可正常觸控

**Non-Goals:**
- 不動 Prisma schema、不動 API 介面、不動 WS 廣播協定
- 不限制「同時 CALLED 上限」（保留多工位現有自由度）
- 不重做 `/m/[slug]/display`（已於 2026-05-21 完成）
- 不導入虛擬滾動（單服務當日票常態 < 200，原生 scroll + filter 足夠）

## Decisions

### D1：多 CALLED 互動 — 每張 row 內掛動作（而非全域 selected state）

**選擇**：「服務中」區改為 CALLED 票垂直清單，**每張票 row 內**右側掛「完成 / 過號」兩顆 small button。

**替代方案**：
- (a) 選定 + 全域操作：點某張 CALLED 標為 active，再從卡片頂層動作區按完成/過號 — ❌ 多一次點擊、需處理 selected state 與 WS 推播衝突
- (b) 下拉 menu：每張 row 一顆「⋯」展開 — ❌ 隱藏主動作，現場操作需快速可見
- (c) row 內直接掛 2 顆 small button — ✅ 1 步操作、無狀態管理、視覺直接

**理由**：叫號台是「現場高頻點擊」場景，每多一步點擊都是摩擦；CALLED 票數量通常 ≤ 工位數（5 以內），垂直堆疊 + row 內掛按鈕視覺承載量沒問題。

### D2：列表 tabs + 搜尋 — 純前端 client-side 過濾

**選擇**：`GetQueueToday` 已回傳完整 day data，tabs/搜尋全在 `BizQueueControlPanel` 內部 `computed` 過濾，不打 API。

**Tabs 分群**：
- `等待中`（status=WAITING，預設 active）
- `服務中`（status=CALLED）— 與「服務中」區重複呈現，但 tabs 視角能看見 ETA 與電話末 4 碼，方便搜尋
- `歷史`（status=DONE 或 SKIPPED）

**搜尋**：
- 單一輸入框，輸入時：(1) 純數字且 ≤ 4 碼 → 同時匹配「ticketNumber 字串包含」與「customerPhone 末 4 碼」(2) 4 碼以上純數字 → 視為 phone 末 4 比對 (3) 非數字 → 匹配 `customerLastName` 包含
- 跨 tab 保留搜尋字串
- 搜尋無結果顯示「找不到符合的號碼」空狀態

**列表容器**：`max-height: min(60vh, 480px)` + `overflow-y: auto`，避免卡片無限拉長。

### D3：頁首動作收編 — 主按鈕 + dropdown

**選擇**：用 `ElDropdown` `split-button` 模式：
- 主動作（點本體）= 「開啟顯示頁」（沿用既有 `ClickOpenDisplay`）
- 下拉選項 = 「複製連結」
- 無 QUEUE 服務時整個 dropdown disabled（保留既有 tooltip）

**替代方案**：
- (a) 純 dropdown 一層選單 — ❌ 主動作要多一步點擊，違背現場操作習慣
- (b) icon-only 兩按鈕 + tooltip — ❌ 視覺輕了但需要 hover 才知道意思，平板無 hover

**連線狀態**：縮為頁首右上小 chip（既有實作已是 chip 樣式，僅調整位置與字級）。

### D4：不加「同時 CALLED 上限」schema 欄位

**選擇**：UI 直接支援任意數量 CALLED（CSS auto-flow + 列表捲動），不於後端限制。

**替代方案**：加 `Service.maxConcurrentServing Int?` + `call-next` 校驗 → ❌ 觸發 migration、需測試/正式站同步機制、限制現有「多工位自由叫號」彈性。

**理由**：現場「多工位 = 自由叫號」是商家當下需求；若未來有「叫號間隔限制」業務情境再另開 change。

### D5：RWD 策略 — CSS grid + 媒體查詢 ≥ 768px

| 斷點 | 卡片網格 | 動作區 | CALLED 區 | 列表 row |
|------|---------|--------|-----------|----------|
| ≥ 1280px（桌機） | `repeat(auto-fill, minmax(360px, 1fr))` | 主+次橫排 | 垂直清單 | flex row |
| 768–1279px（平板） | `repeat(auto-fill, minmax(320px, 1fr))` | 主+次橫排（按鈕觸控區 ≥ 44px） | 垂直清單 | flex row（電話末 4 碼縮成 chip） |
| < 768px（手機）| 單欄 | 主動作 100% 寬、次動作換行 | 垂直清單 | 多行堆疊 |

按鈕高度：桌機沿用 Element Plus `size="default"`（≈ 32px）；平板與手機卡片內主動作 `size="large"`（≈ 40px）確保觸控區。

### D6：i18n 文案策略

新增 keys 集中在 `admin.queue.*` 命名空間：
- `admin.queue.tabs.{waiting,called,history}` + `.count`
- `admin.queue.search.placeholder` / `admin.queue.search.empty`
- `admin.queue.serving.empty`（無 CALLED）
- `admin.queue.actions.{done,skip}`（row 內按鈕簡短文案）

三語檔 `i18n/locales/{zh,en,ja}.js` 同步更新；既有 `display.*` keys 沿用不動。

## Risks / Trade-offs

| Risk | Mitigation |
|------|-----------|
| **WS 推播 race**：商家 A 標完成某張 CALLED 同時商家 B 也在操作 → 後端 done.post 已校驗 `status === 'CALLED'`，狀態不對回 400；前端 `watch(lastEventAt)` 自動 reload，UI 不會出現幽靈按鈕 | 既有保護足夠；只在 row 渲染時用 `t.status === 'CALLED'` 條件控制按鈕顯示 |
| **搜尋輸入頻繁觸發 computed**：300+ 票時可能卡頓 | 票數常態 < 200，純 in-memory filter 觸發成本可忽略；若未來真有大量，再加 debounce |
| **tabs 切換 + 搜尋字串保留可能導致空畫面**：例如在「等待中」搜了個編號，切到「歷史」找不到 → 顯示「找不到符合的號碼」並提示可清除搜尋 | 空狀態文案明確指引（D2 已涵蓋） |
| **dropdown 在 iPad Safari 觸控行為**：split-button 主按鈕 + 下拉箭頭兩區誤觸 | Element Plus `ElDropdown` 已處理；驗收階段用 Playwright MCP 在 iPad viewport 實測一次 |
| **多 CALLED 場景的 ETA 顯示**：CALLED 票 ETA 為 0/null，row 內不顯示 ETA chip（沿用既有規則） | 既有 `GetTicketEtaText` 已 `status !== 'WAITING'` 直接 return `''` |
| **快速連按完成造成多次請求**：actionLoading flag 是頁層級而非票層級，多張 CALLED 時點 A 票完成、loading 期間還能點 B 票 | 改為 row 級 loading（per ticketId）—— 但工程量小、實作時順手改 |

## Migration Plan

### 本 change 不含 migration

- **無 Prisma schema 變動** → 測試站 / 正式站不需 `prisma migrate deploy`、不需資料修復腳本。
- **無 API 介面變動** → 前後端可獨立部署。回滾策略：直接 revert commits 即可。

### 未來如需 schema 變動的同步 SOP（記錄備查）

本 repo 現有部署流程（[deploy-and-env.md](../../../.claude/knowledge/deploy-and-env.md)）：

1. **本地** — 改 `prisma/schema.prisma` → `npx prisma migrate dev --name <desc>` 產出 migration 檔。
2. **CI（測試/正式皆同）** — Dockerfile 建構階段執行 `prisma generate`；container 啟動腳本（Railway entrypoint）執行 `npx prisma migrate deploy` 自動套用待執行 migrations。
3. **資料修復** — 若涉及既有資料補欄位值，於 migration 檔內以 `UPDATE` 補；或在 `server/utils/` 增 idempotent 腳本，可重複執行。
4. **回滾** — 不可逆 migration（drop column / drop table）禁止合併；可逆變動先於測試站驗 24h 再上正式。

此 SOP 不在本 change 範圍內動工，但若後續評估要加 `Service.maxConcurrentServing` 等欄位，沿用上述流程即可，無需重造輪子。

## Open Questions

無。所有設計決策已在前文確認。

實作期間若發現以下情境需追加決策，回頭更新本檔：
- 多 CALLED row 是否需要拖曳排序？（暫不做，order=ticketNumber 已足夠）
- 搜尋是否需要記住歷史輸入？（暫不做，每次進頁面重置）
