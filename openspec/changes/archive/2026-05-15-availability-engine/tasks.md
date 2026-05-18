## 1. 安裝與工具

- [x] 1.1 `npm install -D vitest`（不裝 coverage，避免 native 編譯）
- [x] 1.2 新增 `vitest.config.ts`：root 在專案根、`test.environment='node'`、`test.include=['server/__tests__/**/*.test.ts']`、設 path alias `@@` → `./server`
- [x] 1.3 `package.json` 加 script `"test": "vitest run"`

## 2. 後端工具：算法

- [x] 2.1 `server/utils/availability.ts`：定義 type
  - `Slot`、`BuildSlotsInput`、`ComputeAvailabilityParams`、`ComputeAvailabilityOk`、`ComputeAvailabilityFail`
- [x] 2.2 helper：`hhmmToMinutes(hhmm: string): number`、`composeUtc(date: string, minutes: number, tz: string): Date`、`getWeekdayInTz(date: string, tz: string): number`、`getDayRangeUtc`
- [x] 2.3 `buildSlots(input: BuildSlotsInput): Slot[]` 純函式
  - 整店休假 → 空
  - override.isClosed → 空
  - override 有時段 → 取代當週規則
  - 無 override 用 rules（過濾 isActive、排序）
  - 切 slot：`slotEnd <= intervalEnd`
  - 用 occupiedMap 計算 remaining
- [x] 2.4 `computeAvailability(params)`：外殼，查 DB 拼資料、呼叫 buildSlots、回 `ComputeAvailabilityOk | ComputeAvailabilityFail`
  - 載 dayjs + utc + timezone plugin（在檔頂統一）
  - 取 Merchant（含 timezone、status、deletedAt），不存在或非 ACTIVE → 404
  - 取 Service（驗 belongs to merchant、isActive、deletedAt=null）→ 404
  - bookingMode=QUEUE → 400
  - bookingMode=RESOURCE：必填 resourceId、驗 ServiceResource 關聯與 Resource 啟用；否則 400
  - bookingMode!=RESOURCE 且帶 resourceId → 400
  - 算 weekday（依 merchant.timezone）
  - 查 ScheduleRule（按 scope、resourceId、weekday）
  - 查 ScheduleOverride（按 scope、resourceId、date）— 取第一筆
  - 查 MerchantHoliday（merchantId, date）— 任一存在 → 整店休假
  - 算 dayStartUtc / dayEndUtc（merchant.timezone 當天 00:00 → 隔日 00:00）
  - 查 CONFIRMED Appointment（merchantId, serviceId, optional resourceId, startAt range）
  - 構造 occupiedMap（startAt.toISOString → count）
  - 呼叫 buildSlots
  - 回 `{ slots, timezone, date }`

## 3. 後端 API

- [x] 3.1 `server/routes/nuxt-api/public/m/[slug].get.ts`
  - 取 `slug` from route param、zod 驗（非空、合法）
  - IP rate limit `public-merchant:{ip}` 5/秒；超限回 429 + Retry-After header
  - 查 Merchant（slug、status=ACTIVE、deletedAt=null）→ 404
  - 查 Services（merchantId、isActive、deletedAt=null），include `resources: { select: { resourceId: true } }`
  - 查 Resources（merchantId、isActive、deletedAt=null）
  - 序列化：只回上面 design 列的欄位；cancelPolicy 過濾為 `{ mode, hoursBeforeCannotCancel? }`（其他內部 key 不洩漏）
  - 響應 `successResponse({ merchant, services, resources })`
- [x] 3.2 `server/routes/nuxt-api/public/availability.get.ts`
  - zod 驗 query `{ slug: string, serviceId: string, resourceId?: string, date: /^\d{4}-\d{2}-\d{2}$/ }`
  - IP rate limit `public-availability:{ip}` 5/秒
  - 用 `slug` 找 merchant → 拿 merchantId、timezone
  - 呼叫 `computeAvailability({ slug, serviceId, resourceId, date })`
  - 算法回 fail → 直接 return `result.response`；回 ok → `successResponse({ timezone, date, slots })`

## 4. Protocol

- [x] 4.1 `app/protocol/fetch-api/api/availability/type.d.ts`：
  - `PublicMerchantItem`、`PublicServiceItem`、`PublicResourceItem`
  - `GetPublicMerchantParams { slug: string }`、`GetPublicMerchantRes`
  - `AvailabilitySlot { startAt, endAt, capacity, remaining }`
  - `GetAvailabilityParams { slug, serviceId, resourceId?, date }`、`GetAvailabilityRes { timezone, date, slots }`
- [x] 4.2 `app/protocol/fetch-api/api/availability/index.ts`：`GetPublicMerchant`、`GetAvailability` 走 `methods.get`，不需 token
- [x] 4.3 `app/protocol/fetch-api/api/availability/mock.ts`：mock 兩個 API 各回一個示意結構
- [x] 4.4 `app/protocol/fetch-api/index.ts`：加 `import * as availability from './api/availability'` 與 spread

## 5. 單元測試

- [x] 5.1 `server/__tests__/availability.test.ts` 載 `buildSlots`（純函式）與小工具，**不**直接呼叫 Prisma
- [x] 5.2 測試案例（22 個 test 全綠）：
  - 5.2.1 「一般工作日切 slot」TIME_SLOT、單一規則 09:00–17:00、duration=60、step=60 → 8 個 slot；每個 capacity=1、remaining=1
  - 5.2.2 「午休跨段」兩條規則 09:00–12:00、14:00–18:00；duration=30、step=30 → 6+8=14 個 slot；中間 12:00–14:00 無 slot
  - 5.2.3 「整店休假」`isHoliday=true` → []
  - 5.2.4 「特定日期 override 取代」rules 09:00–17:00；override 13:00–15:00 → slot 只在 13:00–15:00 範圍
  - 5.2.5 「override.isClosed」→ []
  - 5.2.6 「容量耗盡」TIME_CAPACITY、capacity=2，occupiedMap 帶 1 個 slot 起點對應 count=2 → remaining=0
  - 5.2.7 「多資源 resourceId 過濾」RESOURCE 模式餵入 resource A 的 rules 與 A 的 occupiedMap、餵 B 自己的 rules 與空 map 驗證 buildSlots 不混
  - 額外：hhmmToMinutes 邊界、composeUtc 跨時區、weekday 0/1/6、isActive=false 跳過、duration=0/step=0 防禦、endTime<=startTime 跳過
- [x] 5.3 跑 `npx vitest run server/__tests__/availability.test.ts` 全綠（22 passed）

## 6. 驗證

- [x] 6.1 `npm run lint` 通過（既有兩個 pre-existing 錯誤 [.vscode/demo.vue, use-ws.ts] 與本 change 無關，本 change 新增檔案無 lint 錯）
- [x] 6.2 `npm run dev` 起伺服器，curl `/nuxt-api/public/m/demo-clinic-kbpw` 回 200 + 商家公開資訊
- [x] 6.3 curl `/nuxt-api/public/availability?slug=demo-clinic-kbpw&serviceId=cmp6pc6no0009t5ch466ahaxa&resourceId=cmp6pc5nk0001t5chr5hs6fz8&date=2026-05-18` 回 200 + 28 個 slot（12 個上午 + 16 個下午、午休空缺）
- [x] 6.4 同秒並發 10 次同 IP，前 5 個 200、後 5 個 429 含 `Retry-After: 1` header
- [x] 6.5 curl 帶 QUEUE serviceId → 400 三語訊息「QUEUE 服務請使用號碼牌介面」
- [x] 6.6 curl 帶 RESOURCE serviceId 但無 resourceId → 400 三語訊息
- [x] 6.7 curl 帶不存在 slug → 404
- [x] 6.8 額外驗證：休假日 2026-02-17 → slots=[]、override.isClosed 2026-05-22 → slots=[]、TIME_SLOT 帶 resourceId → 400、date 格式錯誤 → 400
- [x] 6.9 `npx openspec validate availability-engine --strict` 通過
