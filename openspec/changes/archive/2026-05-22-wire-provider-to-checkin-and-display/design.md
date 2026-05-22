## Context

前一個 change `introduce-provider-model`（archive 於 2026-05-22）已把 Provider 模型、`Schedule*.providerId + resourceId` 全部落地，但**現場端三個操作介面尚未串接 Provider 資訊**。本 change 把 Provider 顯示串到報到台 / 叫號台 / 店面大螢幕。

**關鍵約束**：
- 不改 schema（特別是 `QueueTicket`、`QueueCounter`、`Resource` 三表完全不動）
- 不改號碼池規則（仍按 Resource 分群）
- 對 `providerModeEnabled=false` 商家行為 100% 不變
- 純前端 + WS payload 微調 + 後端唯讀 join

**現有相關設施**（無需新建）：
- `Schedule*.providerId + resourceId` 已存在；`scope=PROVIDER` 規則代表「該 Provider 該時段在某診間」
- `server/utils/queue.ts/internalCreateTicket` 已是票券寫入唯一入口、廣播由呼叫端負責
- `QueueControlPanel.vue` 已支援多 resource 子卡並列（從 [add-queue-multi-resource-admin-ui](openspec/changes/) 落地）
- `m/[slug]/display.vue` 已支援動畫、TTS、輪詢 fallback、`StoreQueueRealtime` WS

## Goals / Non-Goals

**Goals:**
- 報到台：在 admin/queue.vue 提供「待報到」清單卡片，每張票自動顯示 Provider 名稱與預綁診間，並支援「確認 / 改派」
- 叫號台：所有 ticket 卡片（WAITING 清單、NOW_CALLING 卡、QueueCallOverlay）一致地多顯示 Provider 副標
- 大螢幕：版型從「單服務單欄」改為「多診間多欄 + Provider 副標」，配合 RWD 三檔
- WS payload 與 `GET /queue/today` / `GET /public/m/[slug]` 回應補 `providerId` / `providerName` 等欄位（純 join，不存任何新欄位）
- 未啟用 Provider 制商家：所有新欄位回 null、所有 Provider 副標 / 報到卡片整段不渲染、版型行為與現狀完全一致

**Non-Goals:**
- 不在 QueueTicket / QueueCounter / Resource 加任何欄位
- 不改號碼分配演算法（仍按 resourceId 分群、advisory lock、Counter 序列化）
- 不改 take / call-next / done / skip / walk-in 既有端點與廣播類型
- 不新增「Provider 當日簽到診間」這類新模型
- 不處理「Provider 與 MerchantUser 帳號綁定」（與 `introduce-provider-model` 一致）
- 不改顧客端領號 / 候位 / claim QR 流程（顧客端 Provider 顯示由前一個 change 處理）

## Decisions

### D1：Provider 推導採「resourceId + 當下時間 → Schedule 反查」策略

**決策**：給定 ticket 的 `resourceId` 與當下商家時區下的 `now`，後端按以下優先序反查 Provider：

1. **ScheduleOverride 優先**：`WHERE merchantId=M AND date=今日 AND resourceId=R AND providerId IS NOT NULL AND scope=PROVIDER AND isClosed=false AND startTime <= now < endTime`
2. **ScheduleRule fallback**：`WHERE merchantId=M AND weekday=今日 weekday AND resourceId=R AND providerId IS NOT NULL AND scope=PROVIDER AND isActive=true AND startTime <= now < endTime`
3. **多匹配 / 零匹配 → providerId 一律回 null**（畫面不渲染副標、報到卡片顯示「未指派服務人員」）

**Rationale**：
- 不需要新增任何欄位；現有 `Schedule*.providerId + resourceId` 已足以表達「該 Provider 該時段在某診間」
- ScheduleOverride 表達「特例日當天的調動」，理應優先於 Rule
- 多匹配（同一診間同時排兩位 Provider）是排班錯誤，UX 端寧可不顯示也不可猜錯

**Alternatives considered**：
- (A) 在 `QueueTicket` 加 `providerId` 欄位：需要 migration + 改 take API，且 walk-in 場景下這欄位的來源不明確（顧客可能根本沒選 Provider）。違反「不改 schema」。
- (B) 新增「Provider 當日簽到診間」表（admin 手動指定）：增加新表 + 新 UX + 新 cron 清理；overkill。
- (C) 在 take API 接收 `providerId` 寫到 `QueueTicket`：仍需要 schema 加欄位；且顧客在拿號頁選 Provider 在「按 Resource 分號池」前提下會造成 UI 混淆（你要先選 Provider 還是先選診間？）。

### D2：批量 join — `GetQueueToday` 與 `GetPublicMerchant` 各做一次 schedule 預載

**決策**：為避免「每張票一次 schedule 查詢」的 N+1，後端在 `GET /queue/today` 與 `GET /public/m/[slug]` 處理時：

1. 一次性查當日相關的 `ScheduleOverride` + `ScheduleRule`（按 `merchantId` 過濾，Override 加 `date=今日`、Rule 加 `weekday=今日 weekday`，皆要求 `providerId IS NOT NULL AND scope=PROVIDER`）
2. 在記憶體建構 `Map<resourceId, { providerId, providerName, source: 'override' | 'rule', startTime, endTime }>`，遇衝突按 D1 優先序保留
3. 用 `now` 過濾出當下命中的 entry，再對每張票 / 每個 resource 查表填欄位
4. 同時 join `Provider` 拿 `name`（單一 in 查詢）

**Rationale**：典型商家當日 schedule 不會超過幾十條，全部撈回來 in-memory 處理遠快於 per-ticket query。

**新增 helper**：`server/utils/queue.ts/resolveProviderByResourceMap(merchantId, now)` 回 `Map<resourceId | '__null__', { providerId, providerName } | null>`，由 `getQueueTodayForMerchant` / `getPublicMerchantSnapshot` / WS 廣播時呼叫。

### D3：WS 廣播 payload 補 `providerId` / `providerName`（向後相容）

**決策**：擴充 `TICKET_TAKEN` / `CALL_NEXT` / `TICKET_DONE` / `TICKET_SKIPPED` payload，**加** 兩個欄位（不刪不改現有欄位）：

```ts
type QueueWsEvent = {
  type: 'TICKET_TAKEN' | 'CALL_NEXT' | 'TICKET_DONE' | 'TICKET_SKIPPED' | 'HELLO';
  serviceId: string;
  resourceId?: string | null;
  current?: number;
  servingTicketId?: string;
  ticketNumber?: number;
  /** 新增：該票對應 Provider id（未啟用或無命中為 null） */
  providerId?: string | null;
  /** 新增：該票對應 Provider 顯示名（前端可直接渲染，免二次查表） */
  providerName?: string | null;
  timestamp: number;
};
```

**廣播時機**：在呼叫端（`take.post.ts`、`call-next.post.ts`、`[id]/done.post.ts`、`[id]/skip.post.ts`、`[id]/assign-resource.post.ts`）廣播前，用 D2 helper 查出該 resource 當下的 Provider，附在 payload。`internalCreateTicket` 不改回傳簽名（仍只回 ticket），由呼叫端決定是否廣播 Provider。

**Rationale**：
- 前端收到 WS 後可直接 patch `serviceMap` 並渲染，免再打一次 API
- 舊版前端忽略新欄位即可，後端可單方面先上

### D4：報到「改派」用新端點 `POST /nuxt-api/queue/[id]/assign-resource`

**決策**：報到台「確認報到」分兩個情境：

- **情境 A（不改派）**：員工點「確認報到」但 resource 下拉維持預帶值 → **完全不打後端**，前端直接把該票從「待報到」清單移除（純 UI 狀態）。理由：票本就有 resourceId、本就是 WAITING、不需要任何 DB 寫入。
- **情境 B（改派）**：員工把 resource 下拉改成其他診間 → 呼叫新端點 `POST /nuxt-api/queue/[id]/assign-resource` body: `{ resourceId: string }`，後端：
  1. `requireMerchant` 守衛
  2. 驗 ticket 屬於該商家、status ∈ WAITING（不允許改派已 CALLED / DONE / SKIPPED 票）
  3. 驗目標 `resourceId` 為該 service 已綁的 active Resource
  4. **重要**：因為號碼池按 resource，改派後該票會「插入」新 resource 的等待序列尾端 — 不重新分號（保留原 `ticketNumber`），但廣播 `TICKET_TAKEN`（新 resource）+ `TICKET_SKIPPED`（舊 resource，僅用作 UI 移除提示）
  5. 寫 `UPDATE QueueTicket SET resourceId=新值, updatedAt=NOW() WHERE id=ticketId`

**Rationale**：
- 報到台多數情境是「確認」非「改派」，避免無謂後端打擾
- 改派場景下保留原號碼是商家直覺（顧客拿了 5 號就是 5 號，不會跨診間重編）
- 用既有廣播類型 `TICKET_TAKEN` / `TICKET_SKIPPED` 表達「票離開 A 診加入 B 診」，前端 patch 邏輯不需新增類型

**Alternatives considered**：
- (A) 直接 `PUT /queue/[id]` 用統一 patch 端點：太通用、權限與校驗散；不採。
- (B) 改派時重新分號（取目標 resource Counter.lastTicketNumber+1）：商家流程混亂、顧客困惑；不採。

### D5：大螢幕版型 — 多診間多欄

**決策**：`/m/[slug]/display.vue` 渲染策略改為「以 resource 為單位的多欄」：

- 主資料源仍是 `serviceMap[serviceId].resources[]`（既有結構），每個 resource 渲染一欄
- 每欄結構：
  - **頂部 header**（深底白字大字）：resource.name（如「A 診間」）+ 副標 `provider.name`（前綴用 `Merchant.providerLabel[locale]` fallback i18n 預設）
  - **中段**（最大字級）：`currentServing` 號碼 + 顧客姓名（取自 NOW_CALLING ticket）
  - **下段**（中字級）：`nextNumber` 預告號碼 + `waitingCount` 等待人數
- **service 切換**：保留現有 toolbar `ElSelect`（只在 ≥ 2 個 QUEUE 服務時顯示）
- **單一 resource 場景**：當 service 未綁 resource 或只綁一個，渲染單欄（保留現有「大字號 + 動畫」版型）
- **未啟用 Provider 制**：副標整段不渲染，多欄按 resource 渲染（即 add-queue-multi-resource-customer-ui 落地後的現狀），其餘行為不變

**RWD 三檔**（CSS Grid + `clamp()` 字級）：
| 視口 | 行為 |
|------|------|
| ≥ 1440px | 一次顯示 N 欄（最多 4 欄；超過時自動分頁，每 8 秒切頁） |
| 768 ~ 1440px（平板橫向） | 一次 2 欄，水平 scroll |
| < 768px（手機橫向） | 一次 1 欄，水平 swipe（CSS `scroll-snap`） |

**動畫**：原有 `pageDisplayCallNext` keyframes 改成「每欄獨立 animate」— 只對 `currentServing` 變化的那欄播一次，避免全螢幕齊閃。

### D6：報到卡片 UX 細節（admin/queue.vue 內嵌）

**決策**：報到清單作為 `app/components/biz/QueueCheckInPanel.vue` 新組件，掛在 admin/queue.vue 頁面頂部（在現有 QueueControlPanel 之上）：

- **資料源**：篩選 `serviceMap[*].tickets` 中 `status=WAITING` 的票，按 takenAt 升序，每張票一張卡
- **卡片內容**：
  ```
  ┌─────────────────────────────────────────────┐
  │ #5  陳先生           內科 / 王醫師             │
  │ ────────────────────────────────────────── │
  │ 指派診間：[ A 診間 ▼ ]   [ 確認報到 ]        │
  └─────────────────────────────────────────────┘
  ```
- **預帶值**：`resource` 下拉 default = ticket 當前的 `resourceId`（也就是 take 時就決定的診間，多數情況等同於該 Provider 的預綁診間）
- **下拉選項**：該 service 已綁的 active resource 全部列出，每個 option 顯示「A 診間 - 王醫師」（join Provider）
- **確認報到** → 觸發 D4 情境 A / B 分支
- **空狀態**：當日無 WAITING 票時，整個 panel 顯示「目前無待報到顧客」（不留空白卡片）
- **未啟用 Provider 制**：卡片不顯示 Provider 列、下拉 option 不顯示 Provider 名（只顯示 resource name）；其他 UX 不變

**Rationale**：用獨立組件而非塞進現有 QueueControlPanel，因為報到與叫號是兩個語意層級不同的操作（前者「分流」、後者「呼叫」）；分開維護更清晰，未啟用 Provider 制商家可整段隱藏。

### D7：i18n key 與 Provider label fallback

**決策**：新 i18n key 集中在 `queue.checkIn.*` 與 `display.provider.*` 命名空間：

```
queue.checkIn.title = 待報到 / Check-in / 受付待ち
queue.checkIn.empty = 目前無待報到顧客 / No customers waiting for check-in / 受付待ちのお客様はいません
queue.checkIn.assignedRoom = 指派診間 / Assigned room / 部屋を指定
queue.checkIn.confirm = 確認報到 / Confirm check-in / 受付を確定
queue.checkIn.reassigned = 已改派 {from} → {to} / Reassigned {from} → {to} / {from} から {to} に変更
display.provider.subtitle = {label} / {label} / {label}  # 直接呈現商家自訂稱呼
queue.providerPrefix.default = 服務人員 / Provider / 担当者
```

**Provider 顯示文案 fallback 鏈**：
1. `Merchant.providerLabel[locale]` 非空 → 用商家自訂稱呼當前綴（「王醫師」「李技師」）
2. fallback 到 `Merchant.providerLabel[merchant.preferredLocale]`（如商家偏好繁中、瀏覽器是日文）
3. fallback 到 i18n `queue.providerPrefix.default`

helper 放在 `app/composables/app/use-provider-label.ts`，前端統一呼叫；後端只回原始 `provider.name`，組合稱呼由前端負責（避免後端在三語間 switch）。

### D8：「未啟用 Provider 制」零渲染策略

**決策**：所有 Provider 相關 UI 區塊（報到卡片、副標、display 副標）統一由前端 computed 條件控制：

```ts
const IsProviderModeEnabled = computed(() => StoreSelf.merchant?.providerModeEnabled ?? false);
```

- 報到卡片：`v-if="IsProviderModeEnabled || hasWaitingTickets"` — Provider 制未啟用時仍可呈現「待報到」概念，只是不顯示 Provider 欄；或乾脆整段 `v-if="IsProviderModeEnabled"` 隱藏，由 design phase user feedback 定（傾向後者，未啟用商家就保持完全現狀）
- 叫號台副標：`v-if="ticket.providerId"`（null safe，不依賴 merchant flag）
- display 副標：同上

**最終採用**：傾向「未啟用 Provider 制商家完全不顯示報到卡片」（保持與前一個 change 一致：未啟用 = 100% 不變）。Provider 制未啟用商家若想「報到」概念，由後續 change 補。

## Risks / Trade-offs

| Risk | Mitigation |
|------|-----------|
| 後端 join schedule 增加 query 成本 | D2 批量預載：當日整批查 + in-memory map；典型商家當日 < 50 條 schedule，記憶體成本可忽略 |
| 多 Provider 同診間排班造成歧義 | D1 明確「多匹配回 null」；前端 fallback 不顯示副標而非猜錯 |
| ScheduleRule / Override 跨日邊界處理 | helper 內部用商家時區下的 weekday + HH:mm 字串比較（與 `isWithinQueueWindow` 一致），避免 UTC 偏移 bug |
| `assign-resource` 改派後號碼可能在新 resource 已被使用 | unique 鍵 `(merchantId, serviceId, resourceId, ticketDate, ticketNumber)`：撞號時回 409 `MSG_QUEUE_NUMBER_TAKEN`，UI 提示員工選別的診間或人工溝通；極罕見場景 |
| 多欄 display 在低解析度大螢幕（1280×720）字級壓縮 | RWD 三檔 + `clamp()`；單欄場景退化為大字版型 |
| TTS 多欄並發叫號時播音爆衝 | 沿用既有「同號碼不重播」+ 改為「同欄獨立佇列、跨欄串行」；可選 fallback：TTS 只播當前頁可見的最新一欄 |
| i18n fallback 在商家未填三語時 | D7 fallback 鏈三層保底；e2e 驗收涵蓋空 `providerLabel` 場景 |

## Migration Plan

無資料遷移。部署順序：

1. **後端先上**（向後相容，舊前端不受影響）：
   - 新 helper `resolveProviderByResourceMap`
   - `GET /queue/today` / `GET /public/m/[slug]` 回應補欄位
   - WS 廣播 payload 補欄位
   - 新端點 `POST /queue/[id]/assign-resource`
2. **前端後上**：
   - 報到卡片 / 叫號副標 / display 多欄版型 + Provider 副標
   - StoreQueueRealtime 解析新欄位
3. **i18n + 知識庫**：
   - i18n key 寫入三語
   - 更新 `.claude/knowledge/queue-realtime.md`
4. **驗收**：用 Playwright MCP 跑兩個 case：
   - case A：啟用 Provider 制商家 → 預約 → 領號 → 報到（含改派）→ 叫號（看到 Provider 副標）→ 大螢幕（多欄按診間 + Provider 副標）
   - case B：未啟用 Provider 制商家 → 同樣全流程，三個介面行為與現狀完全一致（無 Provider 相關 UI）
5. **回滾**：純前端 + 唯讀後端擴充 + 一個新端點，無 migration、無破壞性；回滾即還原 4 個檔案的程式碼變更即可。

## Open Questions

- **Q1：報到卡片是否要支援「批次確認」？** 目前設計是逐張卡片確認；若報到尖峰商家想一鍵全部確認可能需要批次按鈕。預設**先不做**，看實際使用回饋。
- **Q2：display 多欄分頁切換是否要可關閉？** D5 採「> 4 欄自動分頁，每 8 秒切」；某些大螢幕（≥ 2160px）一次顯示更多欄反而清楚。預設**不做設定**，看驗收反饋。
- **Q3：改派後是否要在原 resource 子卡留「灰色已改派」殘影？** 目前設計直接從原 resource 清單移除。若商家想看到「這號去哪了」的歷史可能需要殘影 UX。預設**不做**，但 ticket history 仍可追溯（updatedAt 變更）。
- **Q4：未啟用 Provider 制商家是否也要顯示報到卡片？** D8 採「整段隱藏」；若用戶反饋「我們沒用 Provider 但也想要報到流程」，可後續 change 補。本 change **不處理**。
