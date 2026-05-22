## Context

平台目前的「資源（Resource）」schema 註解寫「醫師、設備、包廂」，但實務上商家普遍當作「**診間 / 工位 / 床位**」在用——這是**地點**的概念。顧客真正想預約的是「**人**」（醫師 / 技師 / 師傅 / 教練 / 老師）。

本 change 引進獨立的 `Provider`（服務人員）模型，與 Resource 平行存在：

- Resource = 地點（A 診、B 診、1 號床）→ 保留現狀，schema 完全不動
- Provider = 人（王醫師、Lisa 老師）→ 新模型，本 change 引入

設計核心是「**雙軌共存、商家開關決定走哪軌**」——以 `Merchant.providerModeEnabled` 控制；預設關閉，所有既有商家行為 100% 不變。

關鍵約束：

- Prisma migration 必須**純新增**，不可破壞既有資料
- 跨產業通用稱呼：資料表用英文 `Provider`，UI 顯示用商家 `providerLabel`（三語 Json）或 i18n fallback
- 號碼牌（QueueTicket / QueueCounter）邏輯本 change **不動**，避免擴大 scope
- 必須能用 Playwright 跑兩種商家（啟用 vs 未啟用）兩條 happy path

## Goals / Non-Goals

**Goals:**

- 新增 Provider 資料層（model + 多對多關聯）與商家自訂稱呼能力
- 商家後台具備完整 Provider CRUD + 服務綁定 + 排班綁定能力
- 顧客預約流程能在啟用商家上「先選人、再選時段」
- 可用時段引擎能以 Provider 排班為基準計算（啟用 + `requiresProvider=true` 時）
- 未啟用商家行為完全不變（行為等價驗收）
- 三語 i18n 完整，含商家自訂稱呼的 fallback 鏈

**Non-Goals:**

- 不重命名 / 不刪除 Resource（避免破壞既有商家認知）
- 不動 QueueTicket / QueueCounter（號碼牌與診間 / Provider 的關聯由後續 change 處理）
- 不做 Provider 與 MerchantUser 帳號的綁定（Provider 是對外展示概念，與後台登入帳號脫鉤）
- 不重構既有 Resource 排班（既有商家如不啟用 Provider 制，沿用原本排班；啟用後需自行搬遷，由啟用精靈引導）
- 不做 Provider 級別的個別假日 / 請假（沿用商家 `MerchantHoliday`；個別 Provider 請假留待後續 change）

## Decisions

### D1：雙軌共存 vs 重構 Resource

**選擇**：雙軌共存（Resource 不動、Provider 新增）

**為什麼**：

- 既有 prod / test 商家已用 Resource 表達各種語意（診間、設備、包廂），重命名會誤導所有商家
- 號碼牌、診間綁定都已掛在 Resource 上，重構爆炸半徑大
- 雙軌讓商家自然遷移：先啟用 Provider 制管「人」，Resource 退化為純「地」

**替代方案**：將 Resource 重命名為 Room、把 Provider 概念塞進 Resource 子型別——否決，破壞既有商家與既有排班 / 號碼牌資料。

### D2：商家層級開關 `providerModeEnabled`

**選擇**：以 `Merchant.providerModeEnabled: Boolean @default(false)` 控制；服務再細分 `Service.requiresProvider: Boolean @default(false)`

**為什麼**：

- 商家層級開關確保未啟用商家行為 100% 不變（零回歸）
- 服務層級 `requiresProvider` 讓「同一商家、某些服務指定人、某些不指定」可同存
- 兩層皆 default false → migration 後既有商家自動繼承「未啟用」狀態

**Fallback 行為矩陣**：

| `providerModeEnabled` | `service.requiresProvider` | 顧客預約流程 | 可用時段引擎 |
|--|--|--|--|
| false | （忽略） | 現狀（無 Provider 步驟） | 現狀（Resource 排班） |
| true | false | 可選「指定 / 不指定」；不指定時走現狀 | 不指定 → 現狀；指定 → Provider 排班 |
| true | true | 強制選 Provider | Provider 排班 |

### D3：自訂稱呼 `providerLabel` 為三語 Json

**選擇**：`Merchant.providerLabel: Json @default("{}")`，結構 `{ zh?: string, en?: string, ja?: string }`

**為什麼**：

- 跨產業通用：牙醫=醫師、美甲店=技師、補習班=老師、修車廠=師傅、健身房=教練——硬編 enum 無法窮舉
- 三語 Json 與既有 `cancelPolicy: Json` 結構一致，前端已有 helper 處理
- 預設 `{}` 不寫死任何業態，由商家自填

**Fallback 鏈**（任一渲染點）：

1. `merchant.providerLabel[currentLocale]` 非空
2. `merchant.providerLabel[merchantDefaultLocale]` 非空
3. i18n 預設 key（zh: 「服務人員」、en: 「Provider」、ja: 「スタッフ」）

實作位置：`shared/i18n/provider-label.ts`（前後端共用 helper，從 `~shared` 引入）。

### D4：排班雙綁 `providerId` + `resourceId`

**選擇**：`ScheduleRule` / `ScheduleOverride` 同時可帶 `providerId`（nullable）與 `resourceId`（nullable，語意改為「該排班預綁診間」）

**為什麼**：

- 商家啟用 Provider 制後，排班主軸應該是「人」：王醫師週一 09-12、週二 14-18
- 但同時要能描述「王醫師週一在 A 診、週二在 B 診」→ 一條規則綁兩者
- `resourceId` 維持 nullable 確保未啟用商家排班零變動

**可用時段引擎優先序**（`server/utils/availability.ts`）：

```
if (!merchant.providerModeEnabled) → 現狀邏輯（純 Resource 排班，不看 providerId）
else if (service.requiresProvider && providerId 由顧客指定):
    → 以 ScheduleRule.providerId === providerId 的規則為基準
    → 同時段佔用 = Appointment.providerId === providerId
    → resourceId 不參與計算（地點只是該規則的預綁，不限制可用性）
else:
    → 退回現狀邏輯（避免破壞 RESOURCE / TIME_SLOT / TIME_CAPACITY 既有行為）
```

**替代方案**：把 `resourceId` 從排班拿掉、改成 Appointment 動態指派——否決，會破壞既有 RESOURCE 模式商家的所有排班資料。

### D5：服務新增 `requiresProvider` + `ProviderService` 多對多

**選擇**：

- `Service.requiresProvider: Boolean @default(false)`
- 新表 `ProviderService(providerId, serviceId)` 複合主鍵（與 `ServiceResource` 對稱）

**為什麼**：

- 與既有 `ServiceResource` 結構對稱、概念清晰
- 啟用 `requiresProvider` 時必須綁至少 1 位 Provider（API 層 Zod 驗證）
- 未啟用時 `ProviderService` 可為空，不影響既有 Service 行為

**`requiresProvider` 切換的既有預約處理**：僅影響新預約。既有 Appointment 不回填 providerId、不阻止取消 / 完成。後台顯示時若 `providerId=null`，UI 顯示「未指定」。

### D6：Appointment.providerId nullable + 衝堂檢查

**選擇**：`Appointment.providerId: String?`；建立預約時若帶 `providerId`，在 `createAppointment` advisory lock 內加入「該 Provider 同時段是否有 CONFIRMED Appointment」檢查

**為什麼**：

- 同一 Provider 不能同一時段服務兩位顧客
- nullable 確保未啟用 / `requiresProvider=false` 的預約正常運作
- 衝堂檢查必須在現有 advisory lock 內（避免 race condition）

### D7：Resource 不重命名（中文 UI 改稱「診間」）

**選擇**：Schema / API / 程式碼維持 `Resource` 命名；前端 UI 文案在啟用 Provider 制商家上**對外**改顯示「診間」（i18n 層）

**為什麼**：

- 重命名爆炸半徑大、collision 風險高
- 商家對「資源」一詞本來就疑惑，藉本次 change 在 UI 層改稱「診間」是淨改善
- 未啟用商家維持原文案「資源」，不變既有體驗

### D8：啟用 Provider 制精靈

**選擇**：商家在 `/admin/settings` 切開 `providerModeEnabled` 時，前端彈出引導：

1. 提示：「啟用後，顧客預約時將先選服務人員。建議先建立至少 1 位。」
2. 一鍵跳轉 `/admin/providers/new`
3. 建立完成後提示：「請到排班頁把規則綁到服務人員。」

**為什麼**：純後端開關會讓商家啟用後排班還停留在 Resource，顧客預約時拉不到時段——體驗斷裂。精靈把這條使用者旅程做完整。

### D9：API 命名

**選擇**：

- `server/routes/nuxt-api/provider/index.get.ts`（列表）
- `server/routes/nuxt-api/provider/index.post.ts`（新增）
- `server/routes/nuxt-api/provider/[id].get.ts`（詳情）
- `server/routes/nuxt-api/provider/[id].put.ts`（更新）
- `server/routes/nuxt-api/provider/[id].delete.ts`（軟刪）
- `server/routes/nuxt-api/public/provider/index.get.ts`（顧客端列出該商家 Provider，需 `?slug=`）
- 其他模組（schedule / appointment / service / merchant / availability）**就地擴充欄位**，不新增端點

**為什麼**：與既有 `resource/`、`service/` 結構對稱；公開端與後台端分離（公開端不需登入、欄位最小化）。

### D10：i18n key 命名

**選擇**：

- `provider.default_label`（fallback 預設稱呼）
- `provider.list_title` / `provider.create` / `provider.edit` …
- `service.requires_provider` / `service.provider_list`
- `booking.choose_provider` / `booking.any_provider`
- `merchant.provider_mode_enabled` / `merchant.provider_label_zh|en|ja`

**為什麼**：與既有 i18n 命名空間（`service.`、`booking.`、`merchant.`）對齊。動態稱呼透過 helper 渲染、不直接寫死 key。

## Risks / Trade-offs

- **排班雙軌混淆** → 啟用精靈 + admin/schedule 頁顯示 banner「目前以 Provider 為主軸，舊資源排班僅供未指定 Provider 的服務使用」；availability 引擎優先序明確（見 D4）
- **i18n fallback 三層查找** → 抽到 `shared/i18n/provider-label.ts` 純函式，附 vitest 單測涵蓋三種 fallback 情境
- **既有 Appointment 的 providerId=null** → UI 一律顯示 i18n key `provider.unspecified`（zh:「未指定」），不阻擋任何操作
- **Service.requiresProvider 切換** → 僅影響新預約；後台切換時跳確認 dialog「將僅影響此服務之後的新預約，既有預約不會回填」
- **Provider 軟刪除** → 軟刪後 `isActive` 視為 false；新預約步驟過濾掉；既有 Appointment 仍保留 providerId（外鍵不 cascade、API 層回查時 join 顯示「（已停用）」）
- **多對多空集合** → `requiresProvider=true` 但 `providerIds=[]` → API 層 Zod 拒絕（400）；UI 端按鈕 disabled
- **跨商家 providerId 注入** → API 寫入 Appointment / ScheduleRule 時校驗 `provider.merchantId === auth.merchantId`；公開預約端校驗 `provider.merchantId === merchant.id`
- **availability 效能** → Provider 排班查詢加 index `(providerId, weekday)`；單日範圍下增加的 join cost 可忽略
- **migration 部署** → 純新增、無 ALTER，prod / test 可隨主分支自動跑；rollback 僅需 `prisma migrate resolve` + drop 新表（不影響既有資料）

## Migration Plan

1. **Schema migration**：新增 Provider / ProviderService 表 + 既有 5 表加欄位（全 nullable / default false）
2. **後端**：API 模組 + availability 引擎分支 + booking 衝堂檢查（feature-flagged by `providerModeEnabled`）
3. **前端**：admin/providers 頁、設定頁開關、服務 / 排班 / 預約流程擴充
4. **i18n**：三語補完
5. **驗收**：Playwright 跑兩種商家（啟用 vs 未啟用）兩條 happy path
6. **歸檔**：archive 本 change，更新主 spec

**Rollback 策略**：

- 程式碼回滾：revert PR
- DB 回滾：`prisma migrate resolve --rolled-back <migration>` + 手動 drop 新表 / 新欄位（純新增 → 安全）
- 已啟用商家：回滾後 `providerModeEnabled` 欄位消失，前端讀不到該旗標 → 自動退回 false 行為

## Open Questions

- ~~Provider 是否需要與 MerchantUser 綁定？~~ → **No**（D5 已排除，留待後續 change）
- ~~Provider 級別假日 / 請假？~~ → **No**（沿用 MerchantHoliday；後續 change 補）
- 商家 `providerLabel` 是否需要支援更多語言？→ 目前三語對齊既有 i18n，未來新增語言時兩處同步擴充即可
- 啟用精靈是否需 onboarding 旗標避免重複觸發？→ 一次性 dialog，不寫旗標；商家如不小心關閉，可在設定頁手動進 provider 列表
