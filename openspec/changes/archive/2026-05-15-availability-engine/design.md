## Context

可預約時段算法是預約平台的「事實來源」：顧客在 UI 看到的格子、建預約時的容量檢查、商家行事曆的格子色塊，背後都來自這個函式。Change 4 已把規則放進 DB（ScheduleRule 整週、ScheduleOverride 特定日、MerchantHoliday 整店休假），Change 5 把它們組合起來。

關鍵需求：
1. **純函式可單測** — 把 DB 查詢與算法切開，算法本體吃「已查好的資料 + 服務參數 + 目標日」回 Slot[]，不依賴 Prisma；DB 查詢由 `computeAvailability` 外殼包辦
2. **時區一致** — 客戶在台灣早上 9 點看到的格子，必須對應 Merchant.timezone 的 09:00；不能因 Server 時區漂掉
3. **公開但安全** — 不需 token 但要 rate limit，回傳資料嚴格挑欄位避免洩內部 schema
4. **效能可接受** — 單日 slot 最多約 100 個（24h / 15min），可預期；查預約用 `(merchantId, startAt range)` index 即可

## Goals / Non-Goals

### Goals
- 給 `(merchantId, serviceId, resourceId?, date)`，回傳該商家時區下該日所有 slot 與剩餘容量
- 算法支援 4 種 bookingMode 中的 3 種（TIME_SLOT / TIME_CAPACITY / RESOURCE）；QUEUE 不走 slot 概念，本 change 不處理（回 400）
- 切 slot 規則：以 `slotIntervalMinutes` 為步長產生 slot 起點，每個 slot 長度為 `durationMinutes`；slot 結束時間必須 ≤ 規則 endTime（不允許溢出規則範圍）
- 邊界覆蓋完整：休假日、override 取代、容量耗盡、午休跨段
- 兩條公開 API 不需 token、套 5/秒 IP rate limit

### Non-Goals
- 不做跨日 slot（例如夜間 22:00–02:00 跨午夜）— MVP ScheduleRule 用 `HH:mm` 字串無法表達；商家若需 24h 服務，建兩條規則（22:00–23:59 + 00:00–02:00）
- 不做容量類型混合（同 slot 既支援個人預約又支援團體）— Service.bookingMode 是單選
- 不做動態定價 / 服務組合
- 不做 server-side 翻頁 — 單日 slot 量級小，整批回
- 不做時段衝突避免（Change 6 建預約時才鎖）

## Architectural Decisions

### Decision 1：算法分兩層 — 純函式 `buildSlots` + 外殼 `computeAvailability`

**選擇**：
```typescript
// 內層純函式：吃結構化資料，無 IO
buildSlots(input: BuildSlotsInput): Slot[]
  // input: { service, rules, override, isHoliday, appointmentsByStart, timezone, date }

// 外層：查 DB + 呼叫純函式 + 過濾錯誤
computeAvailability(params): Promise<Slot[] | ApiError>
```

**理由**：純函式可在 vitest 構造各種 input 直接驗證輸出，不必 mock Prisma。外層只負責「拼資料、呼叫、回應」，邏輯薄到不需特別測。

**替代方案**：寫成單一 async 函式內外混用 — 單測必須 mock Prisma client，成本高且脆弱。

### Decision 2：時區處理用 dayjs + utc + timezone plugin

**選擇**：
- 入口：`date` query 為 `YYYY-MM-DD` 字串，視為 Merchant.timezone 當天
- `startAt / endAt` 內部運算用 dayjs.tz(date + 'T' + startTime, tz) 構造，輸出 `.toDate()`（UTC）
- 不依賴 Server 進程時區

**理由**：dayjs 已在專案內，啟用 plugin 成本零；JS Date 對時區操作極脆弱（受 OS / 進程影響）

**替代方案**：用 `Temporal` polyfill — 太新、Node 24 仍 experimental；用原生 `Intl.DateTimeFormat` 反向解析 — 程式碼冗長。

### Decision 3：切 slot 規則

對單一規則 `(startTime, endTime)`：
```
slotStart = startTime, startTime + step, startTime + 2*step, ...
slotEnd   = slotStart + durationMinutes
條件：slotEnd <= endTime
```
其中 `step = service.slotIntervalMinutes`，`duration = service.durationMinutes`。

對 TIME_CAPACITY：`capacityPerSlot = service.capacityPerSlot`；TIME_SLOT / RESOURCE：`capacityPerSlot = 1`。

**範例**：規則 `09:00-12:00`、duration=60、step=30 → slot 起點 09:00 / 09:30 / 10:00 / 10:30 / 11:00；11:30 起點 + 60 = 12:30 > 12:00 故捨棄。

### Decision 4：ScheduleOverride 取代當週規則的語意

當該日存在對應 scope 的 ScheduleOverride：
- `isClosed=true` → 該 scope 該日空陣列
- `startTime + endTime` 都有值 → 取代當週同 weekday 同 scope 的 ScheduleRule（**整組替換**，不合併）
- 其他組合（只有 startTime 沒 endTime 等）→ 由 Change 4 寫入時即禁止（zod 驗證）；算法層假設輸入合法
- 多筆 override 同 `(merchantId, scope, resourceId, date)` 不可能（Change 4 用 upsert / unique 約束）；本 change 算法防禦性取第一筆

**理由**：商家直覺是「我那天臨時不照常營業」；增量修補語意難解釋。

### Decision 5：scope 選擇邏輯

依 `service.bookingMode`：
- `TIME_SLOT / TIME_CAPACITY`：永遠用 `scope=MERCHANT` 的規則（resourceId 應為 null；若帶了 resourceId 回 400）
- `RESOURCE`：必須帶 `resourceId`，用 `scope=RESOURCE` 且 `resourceId=<x>` 的規則；同時驗證 `(serviceId, resourceId)` 在 `ServiceResource` 中有關聯，否則 400

**理由**：模式與規則 scope 一一對應，避免歧義。

### Decision 6：當日預約計數查詢

```typescript
prisma.appointment.findMany({
  where: {
    merchantId, serviceId,
    resourceId: resourceId ?? undefined,  // RESOURCE 模式才過濾
    status: 'CONFIRMED',
    startAt: { gte: dayStartUtc, lt: dayEndUtc }
  },
  select: { startAt: true }
})
```

然後按 `startAt.toISOString()` 分組計數，輸出 `Map<isoString, count>`。算法以 slot.startAt.toISOString() 查 Map 得佔用數，`remaining = capacityPerSlot - occupied`。

**理由**：CONFIRMED 才算佔用；CANCELED / NO_SHOW / COMPLETED 視 service 怎麼處理 — MVP 對齊「CONFIRMED 才佔位」，COMPLETED 通常代表已過去也無關。

**索引**：已有 `@@index([merchantId, startAt])` 支援。

### Decision 7：rate limit 用既有 `checkRateLimit`

`server/utils/rate-limit.ts` 提供固定窗口算法。本 change 兩條 API 都用：
```typescript
const ip = getRequestIP(event, { xForwardedFor: true }) ?? 'unknown';
const r = await checkRateLimit(`public-availability:${ip}`, 5, 1);
if (!r.ok) {
  setResponseHeader(event, 'Retry-After', String(r.retryAfterSeconds));
  return tooManyRequestsError(event);
}
```

**理由**：不引入額外中介軟體；RateLimitBucket 表已存在。

**替代方案**：Nitro middleware — 全域注入但需條件判斷 path，本 change 範圍小、寫在 handler 內更清楚。

### Decision 8：QUEUE 模式 fall through

當 `service.bookingMode === 'QUEUE'`：直接 400 `'QUEUE 服務請使用號碼牌介面'`（Change 7 提供）。算法不嘗試組 slot。

### Decision 9：時間正規化

slot 的 `startAt / endAt` 一律輸出 UTC `Date`。前端 i18n 顯示時用 `dayjs(slot.startAt).tz(merchant.timezone).format('HH:mm')`。

公開 API 也回 `merchant.timezone` 字串，前端不必再查。

## 資料模型（不新增 schema）

本 change 不動 Prisma schema。僅讀取 Change 1 已建：
- `Merchant`（slug, timezone, status, deletedAt）
- `Service`（bookingMode, durationMinutes, slotIntervalMinutes, capacityPerSlot, isActive, deletedAt）
- `Resource`（isActive, deletedAt）
- `ServiceResource`（多對多檢查）
- `ScheduleRule`（scope, resourceId, weekday, startTime, endTime, isActive）
- `ScheduleOverride`（scope, resourceId, date, startTime, endTime, isClosed）
- `MerchantHoliday`（date）
- `Appointment`（status=CONFIRMED, startAt 範圍）
- `RateLimitBucket`（既有）

## 公開 API 響應結構

### `GET /nuxt-api/public/m/[slug]`

```typescript
{
  data: {
    merchant: {
      slug, name, description, logoUrl, coverUrl, timezone, address,
      contactPhone, contactEmail,
      cancelPolicy: { mode: 'free' | 'cutoff', hoursBeforeCannotCancel?: number }
    },
    services: Array<{
      id, name, description, bookingMode,
      durationMinutes, slotIntervalMinutes, capacityPerSlot,
      priceCents,
      resourceIds: string[]   // RESOURCE 模式才有意義；其他模式給空陣列
    }>,
    resources: Array<{ id, name, description }>
  },
  status: { code: 200, message: { zh_tw, en, ja } }
}
```

過濾條件：
- Merchant.status === 'ACTIVE' 且 deletedAt=null；不符 → 404
- Service.isActive=true 且 deletedAt=null
- Resource.isActive=true 且 deletedAt=null

### `GET /nuxt-api/public/availability?slug=&serviceId=&resourceId=&date=`

```typescript
{
  data: {
    timezone: string,
    date: 'YYYY-MM-DD',
    slots: Array<{
      startAt: string,    // ISO UTC
      endAt: string,      // ISO UTC
      capacity: number,
      remaining: number
    }>
  },
  status: { code: 200, message: { zh_tw, en, ja } }
}
```

錯誤情境：
- slug 不存在或 status!=ACTIVE → 404
- service 不存在 / 不屬該商家 / inactive → 404
- bookingMode=QUEUE → 400
- bookingMode=RESOURCE 但無 resourceId → 400
- bookingMode=RESOURCE 但 resourceId 與 service 無關聯 → 400
- bookingMode=TIME_SLOT/TIME_CAPACITY 但帶了 resourceId → 400
- date 格式不對 → 400
- 速率超限 → 429（含 Retry-After header）

## Slot 算法詳細偽碼

```typescript
function buildSlots(input: BuildSlotsInput): Slot[] {
  const { service, rules, override, isHoliday, occupiedMap, timezone, date } = input;

  // 1. 整店休假 → 空
  if (isHoliday) return [];

  // 2. override 處理
  let activeIntervals: Array<{ start: string; end: string }>;
  if (override) {
    if (override.isClosed) return [];
    activeIntervals = [{ start: override.startTime!, end: override.endTime! }];
  } else {
    activeIntervals = rules
      .filter(r => r.isActive)
      .map(r => ({ start: r.startTime, end: r.endTime }))
      .sort((a, b) => a.start.localeCompare(b.start));
  }

  if (activeIntervals.length === 0) return [];

  // 3. 切 slot
  const step = service.slotIntervalMinutes;
  const duration = service.durationMinutes;
  const capacity = service.bookingMode === 'TIME_CAPACITY' ? service.capacityPerSlot : 1;

  const slots: Slot[] = [];
  for (const interval of activeIntervals) {
    const intervalStartMin = hhmmToMinutes(interval.start);
    const intervalEndMin = hhmmToMinutes(interval.end);
    for (let m = intervalStartMin; m + duration <= intervalEndMin; m += step) {
      const startAt = composeUtc(date, m, timezone);
      const endAt = composeUtc(date, m + duration, timezone);
      const occupied = occupiedMap.get(startAt.toISOString()) ?? 0;
      slots.push({
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
        capacity,
        remaining: Math.max(0, capacity - occupied)
      });
    }
  }
  return slots;
}
```

## 風險與緩解

| 風險 | 緩解 |
|---|---|
| Server 進程時區漂掉 | 算法不讀 Server 時區；用 dayjs.tz(date+time, merchant.timezone) |
| ScheduleRule weekday 計算錯 | `dayjs.tz(date, tz).day()` 為 0–6，與 schema 對齊；單測覆蓋週日（=0）與週六（=6） |
| 預約計數遺漏 CANCELED → 仍被計入 | where 嚴格 `status: 'CONFIRMED'` |
| 公開端點被爬蟲拖垮 | 5/秒 IP rate limit；DB 已有對應 index |
| 跨夏令時 | Asia/Taipei 無 DST；其他 timezone 由 dayjs.tz 處理；MVP 假設商家不會在 DST 邊界改規則 |
| QUEUE 服務誤呼叫 | 算法早期 return 400 並三語訊息 |
