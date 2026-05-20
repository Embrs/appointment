## Context

商家後台 `/admin/appointments` 列表頁與後端 `GET /nuxt-api/appointment` 都已存在，但兩個缺口讓商家覺得「預約管理沒做」：

1. Dashboard `/admin` 故意把「今日預約數」標記為「即將推出」（[app/pages/admin/index.vue:85-90](app/pages/admin/index.vue#L85-L90)），但實際 API 已可用
2. `AppointmentStatus` enum 雖含 `COMPLETED` 與 `NO_SHOW`，但沒有對應的 `POST /[id]/complete`、`/[id]/no-show` 端點，商家無從觸發

本 change 是補洞型改善，不引入新 capability、不動 schema、不影響顧客面。

## Goals / Non-Goals

**Goals:**
- 商家在 dashboard 一眼看到當日 CONFIRMED 預約數，並可點擊跳到列表頁
- 商家在列表頁能對「已過開始時間且狀態仍 CONFIRMED」的預約執行 `標記完成` 或 `標記未到`
- 後端對狀態流轉做嚴格守衛（角色、時間、來源狀態），錯誤一律 `return`（不 throw）
- 與既有 `cancel` 端點 API 風格一致（path、body schema、ApiResponse 結構）

**Non-Goals:**
- 改時間 / 改資源 / 改服務的「重排預約」功能（屬另一 change）
- 顧客 push 通知（NO_SHOW 等狀態變更不通知顧客）
- 後台批次操作（多選 → 一次完成 / 未到）

## Decisions

### 決策 1：用兩支獨立 endpoint，不用 PATCH 單一 status 欄位

選 `POST /appointment/[id]/complete` + `POST /appointment/[id]/no-show` 兩支端點，**不**做 `PATCH /appointment/[id] { status }`。

**理由：**
- 與既有 `POST /appointment/[id]/cancel` 命名一致（動詞型 endpoint）
- 後端可在每支端點獨立檢查時間、狀態前置條件，邏輯清晰
- 避免 PATCH 開放 status 欄位被誤填成 `CANCELED` 繞過 cancelReason 必填等業務規則

**替代方案考量：**
- PATCH `/appointment/[id] { status }`：開放面太大，易誤改其他欄位
- POST `/appointment/[id]/status { value }`：仍要寫 switch 並做狀態白名單，邏輯複雜度沒少

### 決策 2：時間檢查放在後端，前端只決定按鈕「是否顯示」

前端 `BizAppointmentTable.vue` 在 `CONFIRMED` 且 `startAt <= now()` 時顯示按鈕，但**後端必須再次驗證**，避免：
- 用戶用瀏覽器 DevTools 改前端條件
- 列表載入後過長時間才操作（client clock 與 server clock 不同步）

後端在 `complete` / `no-show` handler 內：
```typescript
if (appt.status !== 'CONFIRMED') return badRequestError(event, MSG_APPOINTMENT_NOT_CONFIRMED);
if (appt.startAt.getTime() > Date.now()) return badRequestError(event, MSG_APPOINTMENT_NOT_YET_STARTED);
```

### 決策 3：Dashboard 用「今日 CONFIRMED 預約數」而非「全狀態」

`今日預約` 顯示 `今日 startAt ∈ [today00:00, tomorrow00:00) AND status = CONFIRMED` 的 count。

**理由：**
- 「今日預約」對商家心智模型 = 「今天還要服務的客人」，已取消、已完成的沒有營運意義
- 與既有列表頁 filter 預設值一致（`status: 'CONFIRMED'`，但目前未預設）

### 決策 4：時區用商家自己的 timezone，不用瀏覽器 timezone

`今日` 由前端用 `$dayjs.tz(merchant.timezone)` 取得，避免商家在台灣時區但臨時用 VPN 連海外時 dashboard 顯示成不同日子。

`StoreSelf.merchant.timezone` 已存在，直接讀。

### 決策 5：標記完成 / 未到不可逆

第一版不提供「取消標記」（COMPLETED → CONFIRMED 或 NO_SHOW → CONFIRMED）的能力，避免狀態圖過於複雜。若商家誤標，後續迭代再加。

## Risks / Trade-offs

| Risk | Mitigation |
|------|-----------|
| 商家在「跨日邊界」操作（深夜 00:00 才把昨天的客人標完成），時間檢查可能因 `startAt > now()` 阻擋 | 不會：`now() - startAt` 一定為正（已過時段才會出現按鈕）；跨日只影響「今日卡片計數」而非操作能力 |
| 顧客取消、商家標完成、商家代客取消發生時序競態（同一 appointment 多個操作幾乎同時） | Prisma update 用 `where: { id, status: 'CONFIRMED' }` 條件式更新；`updateMany` 後檢查 `count === 1`，若 0 則回 409 `MSG_APPOINTMENT_ALREADY_CANCELED` 或新 `MSG_APPOINTMENT_NOT_CONFIRMED` |
| Dashboard 今日預約數呼叫 `GetAppointmentList` 拉全部欄位較重 | 用既有 `pageSize=1` 只取 `total` 欄位即可（前端只用 `res.data.total`）；之後優化可加 `count-only=true` query param |
| 列表頁 UI 已有「取消」按鈕，加兩個按鈕可能顯擠 | 用 `ElDropdown` 把「完成 / 未到」收進「更多」下拉，保留 `取消` 為主按鈕 |

## Migration Plan

- **無 schema 變動**：直接 PR 合併後即時生效，不需要 `prisma migrate deploy`
- **rollout**：合併 main → CI build → Railway 自動部署
- **rollback**：revert PR 即可；資料層無變動，任何已被標記為 `COMPLETED` / `NO_SHOW` 的預約在 rollback 後保留，不影響其他流程（列表 filter 仍可選這兩個狀態）

## Open Questions

無。所有設計決策已對齊使用者需求。
