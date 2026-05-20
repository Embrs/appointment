## Why

顧客面服務列表與預約流程目前存在兩個 UX 摩擦：(1) 服務卡片底部的「立即預約 / 號碼牌」按鈕是唯一可點區，造成可命中區過小、視覺上也比卡片本身更搶眼；(2) 預約流程把 `date` 與 `slot` 拆成兩步，使用者必須選日期 → 按下一步 → 才能看到時段，多一次點擊且讓「日期選錯了想換」的回退成本變高。本次調整把整張卡片變成入口、把日期＋時段合併到同一畫面，讓顧客在桌機與手機上都能用更短的路徑完成預約。

## What Changes

- 服務卡片 `BizServiceCard` 改為整張可點擊容器：移除底部 ElButton，hover 時加上漂浮 + 陰影回饋，並在卡片右下加上箭頭視覺提示。非號碼牌服務點擊導向 `/m/[slug]/book?serviceId=xxx`、號碼牌服務導向 `/m/[slug]/queue`（emit 行為與既有 `click-book` / `click-queue` 不變）。
- 顧客預約頁 `app/pages/m/[slug]/book.vue` 將 `date`、`slot` 兩個步驟合併成單一 `datetime` 步驟：
  - 步驟條改為 `service → (resource?) → datetime → info`（移除 `slot`，將 `date` 重新命名／取代為 `datetime`）。
  - 畫面採左右分欄：左側 `BizDatePickerCalendar`、右側 `BizSlotPicker`（含 loading／empty 狀態）；< 768px 自動切上下堆疊。
  - 互動：選日期立即觸發 `ApiLoadSlots`、右側時段即時更新；選時段直接推進到 `info` 步（移除原本的「下一步」按鈕與 `ClickNextFromDate`）。
- i18n（zh / en / ja）新增 `booking.steps.datetime` 鍵，移除或停用 `booking.steps.date` / `booking.steps.slot`。
- **無資料結構變動**：不動 Prisma schema、不新增 migration，因此測試站 / 正式站的 DB 無需自動同步流程；部署只是前端編譯產物的更新。

## Capabilities

### New Capabilities

無。

### Modified Capabilities

- `customer-booking`：修改既有「步驟式預約流程」需求 — 步驟序列從 `Service → Resource? → Date → Slot → Triplet → Confirm` 改為 `Service → Resource? → DateTime → Triplet → Confirm`，並補充服務卡片可整張點擊、選日期立即載入時段、選時段直接進到資訊步等新行為。

## Impact

- 受影響檔案
  - `app/components/biz/ServiceCard.vue`（樣式與點擊區改造）
  - `app/pages/m/[slug]/book.vue`（步驟合併、版面、邏輯）
  - `app/pages/m/[slug]/index.vue`（顧客入口的服務卡片呼叫處，確認整張可點仍正確導流）
  - `i18n/locales/zh.js` / `en.js` / `ja.js`（新增 `booking.steps.datetime`）
- 不影響：後端 API（`/public/availability`、`/public/appointment`）、Prisma schema、cron、其他 spec
- 部署：純前端調整 → 走既有 Docker / Railway build pipeline 即可，無需 DB migration
- 驗收：以 Playwright MCP 對顧客面 `/m/[slug]` 與 `/m/[slug]/book` 做實際畫面操作測試（含 mobile viewport），覆蓋三種非 QUEUE 模式與 QUEUE 模式的卡片導流
