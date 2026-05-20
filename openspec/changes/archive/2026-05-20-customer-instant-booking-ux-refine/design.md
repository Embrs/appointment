## Context

顧客面是這個 SaaS 對外的第一個觸點，目前 `/m/[slug]` 首頁與 `/m/[slug]/book` 預約頁同步使用 `BizServiceCard` 列出服務。卡片底部的 `ElButton`（「立即預約」或「號碼牌」）是唯一可點區域，導致：

- 命中區小（特別在手機）、按鈕視覺重量比卡片本體還高。
- 預約頁的步驟條 `service → (resource?) → date → slot → info` 需要多次點擊「下一步」，且 `date` 步驟其實只是日曆，看不到時段；換日期還得回退一步。
- `BizDatePickerCalendar` 與 `BizSlotPicker` 都已是獨立 SFC，組合到同一畫面沒有額外耦合成本。

需求方希望把卡片整體變成可點擊入口、把日期與時段合併到單一步驟，減少操作次數並改善視覺。

## Goals / Non-Goals

**Goals:**

- 服務卡片整張可點擊，hover 有明確互動回饋；保留模式 chip、時長、價格、說明等資訊。
- 預約頁日期＋時段同畫面呈現，選日後即時載入時段；選時段即推進。
- 步驟條從 4–5 步縮短為 3–4 步（依是否需 resource）。
- 桌機左右分欄、手機自動上下堆疊，沿用既有 SCSS 變數與 BEM 命名。
- 不動後端、不動 DB schema，純前端 UX。
- 透過 Playwright MCP 完成實機驗收（含 mobile viewport）。

**Non-Goals:**

- 不改 `availability` API 行為、不改 `appointment` 建立流程。
- 不變動 `BookingMode` enum、Prisma schema、migration。
- 不調整 `info` 步表單欄位與三元組 session 行為。
- 不重寫 `BizDatePickerCalendar` / `BizSlotPicker` 內部結構（最多補 prop / style hook）。

## Decisions

### Decision 1：服務卡片整張可點擊（移除底部按鈕）

**選項**

- A. 移除按鈕，整張卡片 `@click` 觸發 emit `click-book` / `click-queue`（採用）。
- B. 保留按鈕，同時把卡片 `@click` 加上來；按鈕內 `@click.stop` 防冒泡。
- C. 維持原狀。

**選擇 A 的理由**

- 卡片右上已有「固定時段 / 時段+人數 / 號碼牌」chip 表達用途，按鈕的文字重複。
- 卡片底部清空後，可以把箭頭 chevron 放在右下作為「可進入」的視覺符號，整體更乾淨。
- A 不需要 `@click.stop` 邏輯，少一處心智負擔。

**Hover 效果**

- 桌機：`transform: translateY(-2px)` + `box-shadow` 加深，cursor: pointer。
- 鍵盤：卡片要 `tabindex="0"` + `role="button"` + `@keydown.enter/space`，符合可及性。

### Decision 2：合併 date + slot 為單一 `datetime` 步驟

**步驟序列**

- 無 resource：`service → datetime → info`（3 步）。
- 需 resource：`service → resource → datetime → info`（4 步）。

**互動規則**

- 進入 `datetime` 時若 `form.date` 為空，預設 `TodayStr(1)`（沿用現邏輯）。
- `watch(() => form.date)` 觸發 `ApiLoadSlots`（沿用現邏輯，但現在 currentStep 是 `datetime` 而非 `date | slot`）。
- 選時段 → `ClickPickSlot` 立即把 `currentStep` 切到 `info`（與原本一樣）。
- 不再需要 `ClickNextFromDate` 與「下一步」按鈕，整步只剩「上一步」回到 service / resource。

**版面結構**（pug 偽碼）

```pug
template(v-else-if="currentStep === 'datetime'")
  h3.PageBook__panelTitle 選擇日期與時段
  .PageBook__datetime
    .PageBook__datetimeCalendar
      BizDatePickerCalendar(v-model="form.date")
    .PageBook__datetimeSlots
      BizSlotPicker(:model-value="form.startAt" :slots="slots" :timezone :loading="slotsLoading" @update:model-value="onPickSlotISO")
  .PageBook__nav
    ElButton(@click="ClickBack") 上一步
```

**RWD 切換**

- 採 CSS Grid：`grid-template-columns: minmax(0, 320px) minmax(0, 1fr); gap: 24px;`
- `@media (max-width: 768px)` → `grid-template-columns: 1fr;`，時段區自動接到日曆下方；不需要 JS 切換。

### Decision 3：i18n key 命名

- 新增 `booking.steps.datetime = '日期與時段' / 'Date & Time' / '日付と時間帯'`。
- `booking.steps.date` 與 `booking.steps.slot` 不再被 `stepOrder` 使用 — 但因為其他語系檔可能還在他處使用，採取保留鍵但加註 `@deprecated` 註解的策略，等下一輪一併清理；spec 不要求移除。

### Decision 4：服務卡片可及性與右下視覺提示

- 加上 `role="button"`、`tabindex="0"`、`aria-label="預約 {service.name}" | "抽號碼牌 {service.name}"`。
- 右下角放一個 `→` chevron（用既有 `el-icon-arrow-right` 或純 SVG），低調但提示有後續動作。

### Decision 5：無 DB schema 變動 → 部署同步無新風險

使用者在需求中提到「如果有資料結構的變化，對於更新到測試站，正式站，要做自動同步與修復」。本變更：

- 不新增 Prisma migration。
- 不變動 enum / 表欄位。
- 部署只是 Nuxt 前端 bundle 變更，沿用既有 Docker / Railway build pipeline 即可。

`tasks.md` 會把「確認無 schema 變化」列為驗收項，作為對需求方的明確回應。

## Risks / Trade-offs

- [整張卡片可點擊可能誤觸] → 透過 hover 明確、focus ring、`role="button"` 與右下 chevron 提示讓行為可預期；點擊 cooldown 不必要（路由切換本身就有 navigation lock）。
- [選日期立即觸發 API 可能在快速切日時併發] → `ApiLoadSlots` 內部清空 `slots` 並依序 await；已存在的行為，最後一次 response 覆寫即可，併發誤差使用者體感不明顯。若日後出現可用 race token 或 AbortController 收尾，本次先沿用現邏輯不過度設計。
- [手機螢幕高度有限，日曆+時段堆疊後需要捲動] → 接受；上下堆疊比左右擠壓更符合手機慣例；時段區用 grid 自動換行，不需 sticky。
- [移除 `booking.steps.date` / `booking.steps.slot` 可能還有他處引用] → 保留 i18n 鍵但停用，避免破壞。

## Migration Plan

1. 前端改動合併到 main 後，build → push image → 測試站滾動更新；確認顧客面操作後再推正式站。
2. 沒有 DB 步驟、不需要 `prisma migrate deploy`、不需要 down migration。
3. Rollback：直接 redeploy 前一個 image 即可。

## Open Questions

- 是否要把箭頭視覺提示替換成國際化的「Open →」label？目前只用 icon、無 label，依設計師判斷後續再決定，本次不在 spec 中強制。
