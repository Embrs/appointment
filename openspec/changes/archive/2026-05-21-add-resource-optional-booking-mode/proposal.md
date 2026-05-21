## Why

現有 `RESOURCE` 預約模式強制顧客必須指定資源（例：牙科診所「拔牙」必選某位醫師），但實務上常見「顧客可選擇指定醫師，也可不指定由診所安排」的彈性需求。目前系統強制兩種極端：要嘛 `RESOURCE` 必選資源、要嘛 `TIME_SLOT` 完全沒有資源概念，缺少中間態。本變更新增 `RESOURCE_OPTIONAL` 模式，讓顧客自行決定要「指定資源」或「交給系統自動分配」，補上這個常見業務情境。

## What Changes

- **新增 BookingMode enum 值** `RESOURCE_OPTIONAL`（同時對 `AppointmentMode` 新增 `RESOURCE_OPTIONAL`，作為 Appointment 紀錄）。
- **服務管理（商家後台）**：「預約模式」下拉新增「RESOURCE_OPTIONAL 可選資源」選項；綁定資源 UI 行為與 `RESOURCE` 相同（至少綁一個）。
- **可用時段引擎 `computeAvailability`**：當 `bookingMode === RESOURCE_OPTIONAL` 時：
  - 若 query 帶 `resourceId` → 行為等同 `RESOURCE`（驗綁定、用 RESOURCE scope 排班、檢查該資源預約數）。
  - 若未帶 `resourceId`（聚合視圖）→ 對所有綁定資源做 union：某 slot 只要「至少一個資源」此刻可用，即視為 `available`；`taken` 條件改為「全部綁定資源都被佔/不在班」。
- **顧客預約頁 `m/[slug]/book.vue`**：`RESOURCE_OPTIONAL` 模式下新增資源選擇步驟，第一個選項固定為「不指定（由系統自動分配）」+ 後續列出綁定資源；選「不指定」時下單 payload 不帶 `resourceId`。
- **下單服務 `createAppointment`（auto-assign）**：當 service 為 `RESOURCE_OPTIONAL` 且未帶 `resourceId` 時，於 advisory lock 後重新查所有綁定資源在該 startAt 的占用情況，挑出第一個未被佔且符合排班/休假的資源寫入 `appointment.resourceId`；若無任何資源可用回 `MSG_SLOT_TAKEN`。
- **資料模型**：`Appointment.resourceId` 維持 nullable，但 `RESOURCE_OPTIONAL` 寫入時必須是已分配後的具體 id（資料一致性靠 application 層保證，schema 不變欄位可空性）。
- **資料同步**：使用標準 `prisma migrate` 流程，新增單純 enum value 的 migration；Dockerfile 啟動指令已含 `prisma migrate deploy`（commit 4281433），測試站與正式站重啟即自動套用、無需資料回填。
- **i18n / 三語訊息**：新增模式描述字串與資源選擇提示（zh_tw/en/ja）。

## Capabilities

### New Capabilities

無（不引入新 capability 域，所有變更落在三個既有 capability 內）。

### Modified Capabilities

- `merchant-platform`：服務 CRUD 接受並驗證 `bookingMode=RESOURCE_OPTIONAL`（綁定資源規則同 RESOURCE）；服務管理 UI 新增此模式選項與動態欄位顯示。
- `public-availability`：`GET /nuxt-api/public/availability` 與 `computeAvailability` 接受 `RESOURCE_OPTIONAL`；未帶 `resourceId` 時走「綁定資源 union」聚合演算法；帶 `resourceId` 時行為等同 `RESOURCE`。
- `customer-booking`：顧客端服務卡 / 預約頁支援 `RESOURCE_OPTIONAL` 模式（新增「不指定」資源選項）；`createAppointment` 對 `RESOURCE_OPTIONAL` 在 advisory lock 內執行 auto-assign，並將實際分配到的 `resourceId` 寫入 `Appointment`。

## Impact

- **Prisma schema**：`BookingMode` 與 `AppointmentMode` enum 各新增一個值；產生 1 個 migration 檔（純 enum value addition，PostgreSQL 線上加值安全）。
- **後端**：
  - `server/utils/availability.ts`：放寬 RESOURCE_REQUIRED 檢查、新增 union 聚合分支、調整 `scope` 與 occupancy 查詢。
  - `server/utils/booking.ts`：放寬 RESOURCE_REQUIRED 檢查、新增 auto-assign 邏輯（在 advisory lock 內查所有資源占用，挑可用者寫入）。
  - `server/routes/nuxt-api/service/*.ts`：CREATE/UPDATE 驗證接受新 mode、要求至少一個綁定資源。
  - `server/__tests__/availability.spec.ts`：新增 RESOURCE_OPTIONAL 聚合 / 指定 / auto-assign 三組案例。
- **前端**：
  - `app/components/open/dialog/service-edit.vue`：新增模式選項、`showResource` 條件擴充。
  - `app/pages/m/[slug]/book.vue`：`RESOURCE_OPTIONAL` 流程新增資源步驟（含「不指定」）；availability 呼叫切換是否帶 `resourceId`。
  - `app/components/biz/ServiceCard.vue`：模式徽章 / 文案新增 RESOURCE_OPTIONAL 對應。
- **i18n**：`i18n/locales/{zh,en,ja}.json` 新增模式名稱與「不指定」字串。
- **既有資料**：不影響任何現有 `RESOURCE` / `TIME_SLOT` / `TIME_CAPACITY` / `QUEUE` 服務的行為；現有 Appointment 全部不需回填。
- **部署**：測試站 / 正式站重新部署即套用 migration；無需停機（enum value addition 為非阻塞 DDL）。
