## Context

現有號碼牌資料模型對「每個 service 一條號池」做了強假設：

- `QueueCounter` 唯一鍵 `(merchantId, serviceId, counterDate)`
- `QueueTicket` 唯一鍵 `(merchantId, serviceId, ticketDate, ticketNumber)`
- `internalCreateTicket` 在交易內 `SELECT ... FOR UPDATE` 鎖該單一 counter
- `call-next` 同樣 `FOR UPDATE` 鎖單一 counter、找最小 WAITING 票
- `POST /service` / `PUT /service/[id]` 只在 `bookingMode IN (RESOURCE, RESOURCE_OPTIONAL)` 時寫入 `ServiceResource`，QUEUE 模式的 `resourceIds` 被丟棄

診所場景需要 A 診間／B 診間各自一條號池：A 從 A1 起、B 從 B1 起。本提案的關鍵設計是「把 `resourceId` 提升為 `QueueTicket / QueueCounter` 的一級分群維度」並維持 NULL 路徑的單號池行為（向後相容）。

階段 1 純後端：schema + utils + API + Vitest，不動前端、不需 Playwright（前端在階段 2/3 提案）。

## Goals / Non-Goals

**Goals:**

- 同一 service 在不同 `resourceId` 下擁有獨立號池（counter + ticket 序號）
- 商家在 `bookingMode=QUEUE` service 可透過 `ServiceResource` 綁多個 Resource（schema 早就允許，只是 API 擋下）
- 既有資料（`resourceId IS NULL`）以單號池行為運作，零迴歸
- WS 廣播 payload 帶上 `resourceId/resourceName`，讓後續階段 2/3 客戶端可分群匹配
- 所有 ETA 計算按 `(resourceId)` 分群（每間獨立計算 next-wait）
- 三語錯誤訊息齊全；錯誤一律 `return ApiResponse`（不 `throw`）

**Non-Goals:**

- 任何前端／store／widget 變更（階段 2、3）
- 每資源獨立的 `QueueWindow`（仍 service-level；`maxTickets` 仍解釋為 service 當日總上限）
- 店員權限的 resource 細粒度（已確認不做）
- 跨資源報表、prod 資料 backfill（NULL 路徑直接沿用）
- 移除舊「QUEUE 不接受 resourceIds」限制以外的 service 編輯邏輯變動

## Decisions

### D1：`resourceId String?`（nullable）而非新表

**選擇**：直接在 `QueueTicket` 與 `QueueCounter` 加 nullable `resourceId`，唯一鍵改為 `(..., resourceId, ...)`。

**為什麼**：
- PostgreSQL 唯一鍵中**多個 NULL 不互相衝突**，舊資料（`resourceId=NULL`）以單號池運作完全相容
- 不引入新表（如 `ResourceCounter`）→ 查詢路徑、advisory/FOR UPDATE 邏輯只需在 where 子句加一個欄位
- Resource 反向關係 `onDelete: Restrict`：避免商家不小心把有正在叫號的診間刪掉造成 ticket 孤兒

**替代方案（否決）**：
- 新建 `QueueResourceCounter` 表：徒增 join 與兩階段查詢，且 `internalCreateTicket` 的 advisory lock 邏輯要重寫
- 把 `resourceId` 設為 NOT NULL + 預設 `'__default__'`：強制 backfill 既有資料，破壞向後相容

### D2：`internalCreateTicket` 簽名擴充 + Counter 維度同步擴

**選擇**：`InternalCreateTicketInput` 加 `resourceId: string | null`（明確 type 而非 optional `?` 預設 undefined）。所有 counter upsert、`SELECT ... FOR UPDATE`、ticket create 的 where/data 都帶上 `resourceId`。

**為什麼**：
- 把 `null` 顯式作為「未綁資源的單號池」表達，避免 caller 忘記傳就誤入單號池路徑
- 唯一鍵需用複合 key（Prisma 會自動生成 `merchantId_serviceId_resourceId_counterDate`），upsert 與 `findUnique` 都改用該複合 key
- 「同人同日重複領號」精檢：where 加 `resourceId`，讓同一顧客可在不同診間各自領一張票（A1 + B1）— 這符合「兩條完全獨立號池」語意

### D3：advisory lock key 改為含 `resourceId`

**選擇**：`call-next` 仍走 `Serializable` 交易 + `SELECT ... FOR UPDATE`。FOR UPDATE 鎖的 row key 就是該 service+resource 的 counter，因此不需另外加 `pg_advisory_lock` —— **counter row 本身就是 lock**。把 where 與 unique key 都帶上 `resourceId`，鎖粒度自動降到 `(s, r)`。

**為什麼**：
- 既有實作就靠 counter row 作為 serialization point，加 `resourceId` 後天然不互鎖（A 診間鎖 A counter row、B 鎖 B counter row）
- 計畫檔提到的「advisory lock key `queue-call:{m}:{s}:{r}`」是概念表達；實作上 row-level lock 已足夠，不需 `pg_advisory_lock`
- 同 service 不同 resource 並發呼叫 `call-next` 不再彼此阻塞

### D4：ETA 按 `(resourceId)` 分群

**選擇**：
- 既有純函式 `getTicketsAhead(ticket, counter)` 簽名不變（資源粒度由 caller 負責提供對應 counter）
- 所有 caller（`public/queue/[id]`、`queue/today`、`public/m/[slug]`、WS 廣播）查 counter 時都加 `resourceId` 條件，廣播 payload 的 `nextWaitMinutes` 計算範圍也限縮到該 resource 的 WAITING 票
- `public/m/[slug]` 對 QUEUE service 從「單筆 currentServing/...」改成 `resources: [...]` 陣列（陣列裡每筆是一間獨立的計數）

**為什麼**：
- 兩條完全獨立的號池就要兩條獨立的 ETA — 用 service 級平均會嚴重誤導顧客
- 純函式本身與 resourceId 無關，把 caller 的查詢分群就足夠，不擴大純函式 surface

### D5：未綁 resource 的 service 走 fallback「單元素陣列 `[{ id: null, ... }]`」

**選擇**：在 `queue/today` 與 `public/m/[slug]` 回應裡，未綁 resource 的 service 也回 `resources: [{ id: null, name: null, counter, tickets/...}]`（單元素，id 為 null）。

**為什麼**：
- 對未來階段 2、3 的客戶端，schema 固定為「每 service 有 `resources` 陣列」，前端不需根據是否綁 resource 切兩條 render 路徑
- `id: null` 同時是「資料庫實際 `resourceId IS NULL`」的鏡像，前端 lookup 用 `?? null` 就能匹配廣播 payload

**替代方案（否決）**：未綁時不回 `resources`，由前端自行判斷 — 多兩條前端分支、易漏寫測試。

### D6：service create/update 解除 QUEUE 不能綁 resources 限制

**選擇**：把 `isResourceMode = bookingMode IN (RESOURCE, RESOURCE_OPTIONAL)` 改成 `acceptsResources = bookingMode IN (RESOURCE, RESOURCE_OPTIONAL, QUEUE)`；QUEUE 模式下 `resourceIds` 為**選填**（可留空表示單號池）；驗證 resource 屬該商家、active 不變。

**為什麼**：
- QUEUE 模式綁 resources 就是本提案的核心使能 — 不解除這個守門員，前面所有改動都無從觸發
- QUEUE 留空 `resourceIds` ⇒ 寫入 0 筆 `ServiceResource` ⇒ 後續 API 走 NULL 路徑（單號池）⇒ 向後相容

### D7：take / call-next required 規則

**選擇**：
- public/queue/take、queue/create-for-customer、queue/call-next 的 body 一律加 `resourceId?: string`（可選）
- 後端動態判斷：service 已綁定任一 active resource ⇒ `resourceId` 必填、且必須屬於該 service 的 `ServiceResource` 集合且 resource active；未綁定 ⇒ 必須為 undefined（傳了就回 400 `MSG_QUEUE_RESOURCE_INVALID`，避免前後端不同步造成髒資料）

**為什麼**：
- 不在 zod schema 階段固定 required，因為「是否必填」依 service 狀態動態決定（執行期讀 DB 才知道）
- 嚴格擋下「未綁卻傳了 resourceId」可在階段 2 前端整合期及早暴露 bug

### D8：廣播 payload 含 `resourceId/resourceName`，前端可先忽略

**選擇**：`QueueBroadcastPayload` 新增兩個可選欄位 `resourceId?: string | null` / `resourceName?: string`，本階段所有呼叫 `broadcastQueue` 處都帶上。

**為什麼**：
- 階段 2/3 前端就靠這個欄位分群 UI；現在加上，前端尚未接入時 client 忽略 unknown 欄位即可
- 廣播 payload 是純 JSON、向後相容

### D9：Migration 不 backfill、無迴歸

**選擇**：單一 migration 加 nullable column + 改 unique index + index 加 column。不寫 backfill SQL — 既有 row 的 `resourceId` 預設 NULL，與「未綁 resource」語意一致。

**為什麼**：
- prod 既有資料百分百屬於「單號池模式」（因為過去 QUEUE 不允許綁 resource），所以 NULL 是正確的；backfill 反而破壞語意
- migration 只需 `ALTER TABLE ... ADD COLUMN` + drop old unique index + add new unique index + add new partial index，皆為 PG online 安全操作

### D10：Vitest 用真 DB 還是 mock？

**選擇**：沿用本 repo 既有測試模式 — `server/__tests__/` 內測試以「對純函式 + 引擎邏輯」為主、避免引入真 DB；新測試三支也沿襲：
- `queue-internal-create-resource.test.ts`：用既有 prisma mock 框架（或 in-memory adapter；以 repo 慣例為準）驗 internalCreateTicket 在帶 `resourceId` 時 upsert/lock 對應 row、回對應號碼
- `queue-call-next-resource.test.ts`：模擬同 service 兩 resource 各自 WAITING 票，分別 call-next 推進、不互鎖
- `queue-eta-resource.test.ts`：驗 ETA helper 在分群場景下對每 resource 各自計算

**為什麼**：與既有 `availability.test.ts` 等測試風格一致，CI 速度可控；真 DB 場景由 Playwright 階段 2、3 覆蓋。

> 實作時若發現既有 utils 測試是用 prisma mock 還是 in-memory，依實際 stack 對齊；不為了測試動 utils API。

## Risks / Trade-offs

- [既有 `internalCreateTicket` caller 漏改 `resourceId` 參數，誤入單號池] → TypeScript 把 `resourceId` 設成**必填**屬性（值可為 `string | null`），編譯期擋下；review 時逐處檢查
- [`call-next` 在多 resource 並發時 deadlock 風險] → 不會：每 resource 只鎖自己的 counter row，鎖粒度更細，不會互相等待
- [public/m/[slug] response schema 變動可能讓 cache / 既有公開頁壞掉] → 階段 1 不動公開頁前端，但廣播 payload 與 response schema 對未來相容；既有 `currentServing/...` 同層欄位**保留**（與 resources 陣列共存）作為 fallback，避免階段 2 前 release window 內舊版前端壞掉。實作時：未綁 resource 時頂層欄位填單號池值；綁多 resource 時頂層欄位填**「該 service 所有 resource 合計」**（總 ticketsTaken / 最小 currentServing / 加總 waitingCount）以維持「不會 worse than 既有」的語意。
- [migration 改 unique key 在 prod 已有資料時的 locking] → `ALTER TABLE ... ADD COLUMN ... NULL` 是 metadata-only；`DROP CONSTRAINT old_unique` + `ADD CONSTRAINT new_unique INCLUDE (resourceId)` 對小表（QueueCounter / QueueTicket 都是當日 + 短期歷史）秒級完成；prod 跑 dry-run 確認 lock 時間 < 1s
- [unique key 多 NULL 不衝突的潛在誤解] → 在 spec 明寫「未綁 resource 的 service 不應同日多次 upsert 出多筆 NULL counter」— application 層 upsert 已用複合 unique key 守住

## Migration Plan

1. 修改 `prisma/schema.prisma`：
   - `QueueTicket` 加 `resourceId String?` + `resource Resource? @relation(...)`，改 `@@unique`、加新 `@@index`
   - `QueueCounter` 加 `resourceId String?` + `resource Resource? @relation(...)`，改 `@@unique`
   - `Resource` 加 `queueTickets QueueTicket[]` + `queueCounters QueueCounter[]`
2. `npx prisma migrate dev --name queue_multi_resource`：產生單一 migration
3. local + CI 跑 `npm test` 全綠（既有測試零迴歸 + 三支新 Vitest 通過）
4. `npm run lint` 無新增警告
5. deploy 到 prod 後跑 dry-run check：
   - `SELECT COUNT(*) FROM "QueueTicket" WHERE "resourceId" IS NOT NULL` → 預期為 0（migration 後尚無新功能寫入）
   - `SELECT COUNT(*) FROM "QueueCounter" WHERE "resourceId" IS NOT NULL` → 0
6. 階段 2 前端 release 前可隨時 rollback 本 migration（drop columns）— 因為沒有 row 用到新欄位

**回滾策略**：階段 2 release 前若發現問題：drop 新增的 column / index / constraint，schema 回到舊版，prod 既有資料零受影響。階段 2 release 後（前端已寫 `resourceId`）就不能直接 drop column，需先導出 / 清空綁定 resource 的資料。

## Open Questions

- **service 編輯把已綁 resources 從「綁 A、B」改為「只綁 A」時，B 上的當日 WAITING 票怎麼辦？**：本提案不處理（屬商家行為決策）。建議在階段 2 UI 加 warning「該 resource 上仍有等待中的票，移除前請先標記完成或過號」。後端不擋。
- **`getResourcesForQueueService` 的回傳是否要包含 inactive resource？**：建議**不**包含（前端拿號時只列 active）。但 `queue/today` 為了讓商家看到歷史 ticket 對應的 resource 仍能顯示名稱，應**從 ticket 反查**而非從這個 helper 拿。階段 2 確認。
- **WS 廣播 payload 帶 `resourceName` 還是只帶 id 讓客戶端自查？**：本提案選擇帶 `resourceName` 以降低客戶端往返成本（diff < 100 bytes / event，可接受）。
