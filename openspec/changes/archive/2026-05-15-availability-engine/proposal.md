## Why

Change 4（`merchant-config`）已讓商家可定義服務、資源、每週時段規則、特定日期覆寫、整店休假；但顧客端要看到「某天可預約的時段與剩餘容量」之前，**完全沒有把這些配置組合起來的算法與公開 API**。

本 change 落地：
1. 純函式可預約時段算法（不耦合 H3 / Prisma 客戶端，方便單測）
2. 兩條公開（無 token）API：商家公開資訊、某日可預約時段查詢
3. 公開端點的 IP 速率限制（5/秒）以防爆破與爬蟲拖垮 DB

完成後 Change 6（`customer-booking-flow`）可直接消費 `availability` 介面在顧客端 UI 與建預約 API 的「再次容量檢查」呼叫；公開商家頁 `/m/{slug}` 也有資料來源。

## What Changes

- **後端工具**：
  - `server/utils/availability.ts`：純函式 `computeAvailability({ merchantId, serviceId, resourceId?, date })`，回 `Slot[]`
  - `server/utils/availability.ts` 中拆出可單測的 helper：`mergeIntervals / intersectIntervals / subtractIntervals / sliceIntervalIntoSlots / parseHHmmInTz`
- **公開 API**（`server/routes/nuxt-api/public/`，**不需要 token**，但套 `checkRateLimit` 5/秒/IP）：
  - `m/[slug].get.ts`：商家公開資訊 + 已啟用服務列表（過濾 `deletedAt=null` 與 `isActive=true`），不洩漏內部欄位（不回 cancelPolicy 細節以外的敏感資料；只回 `cancelPolicy.mode / hoursBeforeCannotCancel`）
  - `availability.get.ts`：query `{ slug, serviceId, resourceId?, date }`，回 `{ slots: Slot[] }`
- **Protocol 擴充**：新增 `app/protocol/fetch-api/api/availability/`（`GetPublicMerchant / GetAvailability`，無 Token 注入需求但仍走 `methods.ts` 以保 mock 切換）
- **單元測試**：
  - 安裝 `vitest`（devDep）
  - `vitest.config.ts`（root）、`package.json` 加 `"test": "vitest run"`
  - `server/__tests__/availability.test.ts` 覆蓋以下情境：
    1. 一般工作日切 slot（單一 ScheduleRule、無預約、無休假）
    2. 午休跨段（同一 weekday 兩條 ScheduleRule，中間缺口不出 slot）
    3. 整店休假日（MerchantHoliday 命中該日 → 回空陣列）
    4. 特定日期 override 取代當週規則（ScheduleOverride 該日存在時忽略 ScheduleRule）
    5. ScheduleOverride.isClosed=true（該日整體關閉，回空陣列）
    6. 容量耗盡（capacityPerSlot=2，CONFIRMED 預約=2 → remaining=0）
    7. 多資源時 resourceId 過濾正確（RESOURCE 模式只取對應 resource 的規則與該 resource 的當日預約）

### 非本 change 範圍（明確排除）

- 顧客建預約（`POST /public/appointment`）— 屬 Change 6
- 並發鎖 `pg_advisory_xact_lock` — 屬 Change 6（建預約時才會用）
- 顧客查紀錄 / 取消 — 屬 Change 6
- 號碼牌相關 `QueueWindow / QueueTicket` 算法 — 屬 Change 7（本 change 算法**僅針對 `BookingMode != QUEUE` 的服務**；對 QUEUE 服務的 `availability.get` 直接回 400）
- 顧客 OTP — 仍保預留 schema

## Capabilities

### New Capabilities

- `public-availability`：公開（無 token）的商家公開資訊與可預約時段查詢 spec，含算法行為與 rate limit 要求

## Impact

- **新增檔案**：
  - `server/utils/availability.ts`
  - `server/routes/nuxt-api/public/m/[slug].get.ts`
  - `server/routes/nuxt-api/public/availability.get.ts`
  - `server/__tests__/availability.test.ts`
  - `vitest.config.ts`
  - `app/protocol/fetch-api/api/availability/{index.ts, mock.ts, type.d.ts}`
- **修改檔案**：
  - `package.json`：加 `vitest` devDep、`"test": "vitest run"` script
  - `app/protocol/fetch-api/index.ts`：彙整 `availability` 模組
- **新依賴**：`vitest`（devDep）、`@vitest/coverage-v8` 暫不裝（MVP 不卡覆蓋率）；`dayjs` 已存在，僅啟用 `utc` / `timezone` plugin
- **時區策略**：所有時間以 `Merchant.timezone`（預設 `Asia/Taipei`）為準。`date` query 視為該 timezone 下的「當天」；算法輸出 `startAt / endAt` 為 UTC `Date`，前端可自行轉。
- **Rate limit key**：`public-availability:{ip}` 與 `public-merchant:{ip}`，5/秒、窗口 1 秒；達上限回 429 並附 `Retry-After` header。
- **下游依賴**：Change 6 會 reuse `computeAvailability`；Change 7 自行寫號碼牌時段算法（不耦合）。
