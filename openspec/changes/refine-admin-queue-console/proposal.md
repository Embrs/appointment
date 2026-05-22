## Why

商家叫號台 `/admin/queue` 目前有三個現場操作上的痛點：

1. **按鈕層級凌亂** — 頁首平鋪「開啟顯示頁 / 複製連結 / 連線狀態」、卡片內又平鋪「叫下一號 / 完成 / 過號 / 現場登記」共 4 顆 large 按鈕，主次混雜、視線分散。
2. **當日票數一多就難讀** — `BizQueueControlPanel` 把當日所有票（WAITING/CALLED/DONE/SKIPPED）一律 `v-for` 平鋪，無分頁、無篩選、無捲動界線；忙時超過 30 張票時卡片會無限拉長，找一張 WAITING 票要捲很久。
3. **多張 CALLED 共存時無法指定哪張完成** — `call-next` 後端不檢查既有 CALLED 是否清空，因此多工位/多員工場景下會累積多張 CALLED；但前端「完成 / 過號」按鈕固定綁到 `CalledTickets[last]`，導致只有「最後叫到那張」可被標完成，先叫到的卡死在 CALLED 狀態。

後端 `done.post.ts` / `skip.post.ts` 早已接收 `ticketId`，所以本次改造**完全聚焦前端**，無需 Prisma schema 變動。

## What Changes

### 叫號台頁面（`/admin/queue`）

- **頁首動作列重整** — 連線狀態縮為右上角小 chip；「開啟顯示頁 + 複製連結」合併為單一主按鈕 + dropdown（主動作開新分頁、副動作複製連結），減少視覺噪音。
- **每張服務卡片動作層級重組**：
  - 頂層只保留 **主動作 1 顆**（「叫下一號」）+ **次動作 1 顆**（「現場登記」）
  - **移除卡片頂層的「完成 / 過號」按鈕**（解決綁定歧義）
- **「服務中」區改為多張 CALLED 並列**：
  - 從單張 highlight 改為 **CALLED 票清單**（chip 或 stacked row），每張獨立顯示號碼 + 姓 + 稱謂
  - **每張 CALLED 票各自掛「完成 / 過號」操作**（按鈕或下拉菜單），點哪張就操作哪張 ticket，與後端 ticketId 對齊
  - 空狀態（無 CALLED）顯示提示「目前無服務中號碼」
- **WAITING 列表加狀態切換 + 搜尋**：
  - 新增 **狀態 tabs**：`等待中（預設）` / `服務中` / `歷史（DONE + SKIPPED）`，每個 tab 顯示計數
  - 新增**搜尋框**支援「號碼前綴」與「電話末 4 碼」過濾
  - 列表本體加 `max-height` + 內部捲動，避免卡片無限拉長
- **RWD 強化** — 確保 ≥ 768px 直立平板可正常觸控操作（按鈕觸控區 ≥ 44px、chip 不擠壓、搜尋框不換多行）。

### 範圍外（明確不做）

- **不動 Prisma schema**（不新增 `Service.maxConcurrentServing` 等欄位）；多張 CALLED 共存是現有行為，僅補 UI。
- **不改後端 API**（`call-next` / `done` / `skip` / `today` 介面與 payload 不動）。
- **不改 WebSocket 廣播協定**。
- **不動店面大螢幕 `/m/[slug]/display`**（與本次叫號台 UX 解耦）。

## Capabilities

### New Capabilities
（無）

### Modified Capabilities

- `queue-tickets`:
  - `商家標記完成或過號` — 適用範圍從「服務中那張票」明確擴及「同服務任一張 CALLED 票」；新增「多張 CALLED 共存時，每張可被獨立完成 / 過號」的 scenario。
  - `商家叫號頁` — 控制台呈現契約改寫：頂層動作精簡為主+次兩顆、「服務中」改為多 CALLED 並列且各自掛操作、列表加 tabs + 搜尋 + 捲動界線；新增 RWD ≥ 768px 操作場景。
  - `Admin 顯示頁入口` — 頁首動作列改為「主按鈕 + dropdown」，原本兩顆獨立按鈕收編為單一進入點；連線狀態縮為輔助 chip。

## Impact

### 受影響的程式

- `app/pages/admin/queue.vue` — 頁首動作列、連線狀態元件重整
- `app/components/biz/QueueControlPanel.vue` — 卡片內動作分區、CALLED 多張呈現、tabs / 搜尋 / 捲動容器
- `i18n/locales/{zh,en,ja}.js` — 新增 tabs 文案（等待中 / 服務中 / 歷史）、搜尋 placeholder、空狀態文案、按鈕 dropdown 文案
- `server/__tests__/` — 既有 `display-tts.test.ts` 等不受影響；本次無新 server 端測試

### 資料 / 部署 / 同步

- **無 Prisma schema 變動** → 測試站 / 正式站不需 migration、不需資料修復腳本。
- **無 API 介面變動** → 前後端可獨立部署，無相容性風險。
- 若未來決議加入「同時 CALLED 上限」這類欄位，需另開 change，並沿用既有 `prisma migrate deploy` 流程（CI 自動套用至測試站與正式站）；本 change 的 design.md 會補一節，記錄此情境的處理 SOP，避免未來踩坑。

### 驗收

- 桌機（≥ 1280px）與直立平板（768×1024）兩種斷點實機操作測試。
- 三個需求各自的成功路徑 + 邊界情境（多張 CALLED 共存、搜尋無結果、tab 切換保留搜尋、現場登記不被影響）。
- 既有 e2e 行為（叫下一號、現場登記彈窗、開啟顯示頁、WS 連線狀態）回歸不破。
