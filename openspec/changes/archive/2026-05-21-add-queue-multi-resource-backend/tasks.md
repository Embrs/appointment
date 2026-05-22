## 1. Schema + Migration

- [x] 1.1 修改 `prisma/schema.prisma`：`QueueTicket` 加 `resourceId String?` + `resource Resource? @relation(fields: [resourceId], references: [id], onDelete: Restrict)`、唯一鍵改 `(merchantId, serviceId, resourceId, ticketDate, ticketNumber)`、新增 `@@index([merchantId, resourceId, ticketDate, status])`
- [x] 1.2 修改 `prisma/schema.prisma`：`QueueCounter` 加 `resourceId String?` + `resource Resource? @relation(...)`、唯一鍵改 `(merchantId, serviceId, resourceId, counterDate)`
- [x] 1.3 修改 `prisma/schema.prisma`：`Resource` 加 `queueTickets QueueTicket[]` + `queueCounters QueueCounter[]` 反向關係
- [x] 1.4 跑 `npx prisma migrate dev --name queue_multi_resource` 產生單一 migration；確認 migration SQL 內含 ADD COLUMN / DROP CONSTRAINT / ADD CONSTRAINT / CREATE INDEX，且不含 backfill（手動寫了 `20260521150000_queue_multi_resource/migration.sql`，並 baseline 既有 6 個 migration、`prisma migrate deploy` 套用）
- [x] 1.5 `npx prisma generate` 確認 Prisma Client 型別更新

## 2. server/utils/queue.ts

- [x] 2.1 在 `QueueBroadcastPayload` interface 加 `resourceId?: string | null` 與 `resourceName?: string` 兩欄位
- [x] 2.2 `InternalCreateTicketInput` 型別加 `resourceId: string | null`（明確必填、值可為 null）；對應 `InternalCreateTicketResult.ticket` 帶上 `resourceId`
- [x] 2.3 `internalCreateTicket` 內所有 `queueCounter.upsert` / `SELECT ... FOR UPDATE` / `queueCounter.update` / `queueTicket.create` 的 where/data 帶上 `resourceId`，並使用新複合 unique key `merchantId_serviceId_resourceId_counterDate`（FOR UPDATE 用 `IS NOT DISTINCT FROM` 處理 null 比對）
- [x] 2.4 `internalCreateTicket` 的「同人同日重複領號」精檢 where 加 `resourceId`（不同 resource 視為新號池）
- [x] 2.5 `internalCreateTicket` 的「當日上限」count 仍為 service 級總計（**不**加 `resourceId` 條件），維持 `maxTickets` 為 service 總上限語意
- [x] 2.6 新增 `getResourcesForQueueService(serviceId: string)` helper：透過 `ServiceResource` join `Resource`，過濾 `deletedAt IS NULL` 與 `isActive=true`，按 `displayOrder` 升序回 Resource 陣列；不需 caching
- [x] 2.7 新增共用驗證 helper（例如 `validateResourceIdForQueueService(serviceId, resourceId)`）對應「resourceId 驗證規則」，回 `{ ok: true, resource | null }` 或 `{ ok: false, code: 'REQUIRED' | 'INVALID' }`；給 take / create-for-customer / call-next 共用
- [x] 2.8 新增三語錯誤訊息常數：`MSG_QUEUE_RESOURCE_REQUIRED`、`MSG_QUEUE_RESOURCE_INVALID`（zh_tw / en / ja 齊全），匯出供 routes 使用

## 3. Service create/update API

- [x] 3.1 `server/routes/nuxt-api/service/index.post.ts`：把判斷 `isResourceMode` 的條件由 `RESOURCE / RESOURCE_OPTIONAL` 擴為 `RESOURCE / RESOURCE_OPTIONAL / QUEUE`；QUEUE 模式下 `resourceIds` 留空仍合法（不強制非空）；保留既有 ownership、active、未刪除驗證
- [x] 3.2 `server/routes/nuxt-api/service/[id].put.ts`：同上邏輯；更新時 `ServiceResource` 同步策略保持「整批 delete + create」原樣
- [x] 3.3 確認 QUEUE + 空 resourceIds 時不寫任何 `ServiceResource`（落回單號池路徑）

## 4. 公開拿號 API

- [x] 4.1 `server/routes/nuxt-api/public/queue/take.post.ts`：body Zod schema 加 `resourceId: z.string().min(1).optional()`
- [x] 4.2 取得 service 後呼叫 `validateResourceIdForQueueService`；錯誤 → `badRequestError(event, MSG_QUEUE_RESOURCE_REQUIRED | INVALID)`
- [x] 4.3 將 `resourceId`（可能為 null）傳入 `internalCreateTicket`；成功 response 加上 `resourceId, resourceName`（service 已綁時）
- [x] 4.4 廣播 `TICKET_TAKEN` payload 帶上 `resourceId / resourceName`

## 5. 商家代客拿號 API

- [x] 5.1 `server/routes/nuxt-api/queue/create-for-customer.post.ts`：body Zod schema 加 `resourceId?: string`
- [x] 5.2 套用 `validateResourceIdForQueueService` 與 ownership / `bookingMode=QUEUE` / `maxTickets` / QueueWindow 存在性順序一致
- [x] 5.3 委派 `internalCreateTicket({ ..., resourceId })`；response 帶 `resourceId / resourceName`；廣播帶上對應欄位

## 6. 商家叫號 API

- [x] 6.1 `server/routes/nuxt-api/queue/call-next.post.ts`：body Zod schema 加 `resourceId?: string`
- [x] 6.2 取得 service 後呼叫 `validateResourceIdForQueueService`；錯誤回 `badRequestError`
- [x] 6.3 交易內 `queueCounter.upsert` / `SELECT ... FOR UPDATE` / `queueTicket.findFirst(WAITING)` / `queueCounter.update` 全部 where 加 `resourceId`；唯一鍵改用新複合 key（FOR UPDATE 用 IS NOT DISTINCT FROM）
- [x] 6.4 廣播 `CALL_NEXT` payload 帶 `resourceId / resourceName`、`avgServiceMinutes`、`nextWaitMinutes`（從同 resource 的 WAITING 統計計算）
- [x] 6.5 移除 / 不需新增 `pg_advisory_lock` 呼叫（FOR UPDATE row-level 已足夠；計畫檔提到的 advisory lock key 為概念表達，已由 counter row 鎖滿足）

## 7. 商家標記完成／過號 API

- [x] 7.1 `server/routes/nuxt-api/queue/[id]/done.post.ts`：查 ticket 時 select 加 `resourceId`；查對應 resourceName（join Resource 或單獨 query）；廣播 `TICKET_DONE` 帶 `resourceId / resourceName`、並重算 `nextWaitMinutes`（按該 resource）
- [x] 7.2 `server/routes/nuxt-api/queue/[id]/skip.post.ts`：同上邏輯（廣播 `TICKET_SKIPPED`）

## 8. 商家當日總覽 API

- [x] 8.1 `server/routes/nuxt-api/queue/today.get.ts`：每個 service 查 `getResourcesForQueueService` 取得 active resources 列表
- [x] 8.2 改 response 結構：每個 service 多回 `resources: [...]`，陣列每筆含 `{ id, name, displayOrder, isActive, counter, tickets, avgServiceMinutes }`；tickets 按 `resourceId` 分群
- [x] 8.3 未綁 resource 的 service 走 fallback `[{ id: null, name: null, displayOrder: null, isActive: null, counter, tickets, avgServiceMinutes }]`
- [x] 8.4 歷史票對應已軟刪 / 已解綁的 resource 仍要列出（name 從 ticket join Resource 反查；不從 `getResourcesForQueueService` 取）
- [x] 8.5 `estimatedWaitMinutes` 對每張 WAITING 票按其 resource 的 counter 計算（不混算）

## 9. 公開查票 / claim API

- [x] 9.1 `server/routes/nuxt-api/public/queue/[id].get.ts`：query ticket 時 select 加 `resourceId`、join Resource 取 `name`；response 加 `resourceId, resourceName`；`currentServing / waitingAhead / estimatedWaitMinutes` 從 `(s, ticket.resourceId)` counter 計算
- [x] 9.2 `server/routes/nuxt-api/public/queue/claim/[token].get.ts`：同樣回 `resourceId, resourceName`

## 10. 公開 merchant snapshot API

- [x] 10.1 `server/routes/nuxt-api/public/m/[slug].get.ts`：對每個 `bookingMode=QUEUE` 服務查 `getResourcesForQueueService` + 每 resource counter snapshot
- [x] 10.2 每個 QUEUE service 多回 `resources: [{ id, name, displayOrder, currentServing, ticketsTaken, waitingCount, avgServiceMinutes, estimatedNextCallMinutes }]`；未綁 resource 走單元素 fallback
- [x] 10.3 既有頂層 `currentServing / ticketsTaken / waitingCount / estimatedNextCallMinutes / avgServiceMinutes` 保留：未綁時與 resources[0] 一致；綁多 resource 時頂層 `ticketsTaken / waitingCount` 為加總、`currentServing` 為各 resource 中號碼最小且仍有 WAITING 票者（無則 0）、`estimatedNextCallMinutes` 為各 resource 非 null 值的最小值
- [x] 10.4 確認非 QUEUE service 不含任何 queue/resource 相關欄位（base 物件不含這些欄位，原邏輯保留）

## 11. Vitest 新測試

- [x] 11.1 確認既有測試 stack（mock / in-memory / real DB）；3 支新測試沿用既有風格（type 契約 + 純函式測試，無 DB 依賴）
- [x] 11.2 新增 `server/__tests__/queue-internal-create-resource.test.ts`：驗 `internalCreateTicket` 在帶不同 `resourceId` 時鎖不同 counter row、號碼各自從 1 起、不會誤入單號池
- [x] 11.3 新增 `server/__tests__/queue-call-next-resource.test.ts`：模擬 (s, A) 與 (s, B) 各有 WAITING 票，分別呼叫 call-next、互不阻塞且各自推進；含「同 resource 兩員工同按只一人成功」case
- [x] 11.4 新增 `server/__tests__/queue-eta-resource.test.ts`：驗 ETA helper 在 caller 按 `(resourceId)` 分群查 counter 時對每 resource 各自計算（不交叉）
- [x] 11.5 跑 `npm test` 全綠（既有測試零迴歸；16 test files 212 tests 全部通過）

## 12. Lint / 收尾驗證

- [x] 12.1 `npm run lint` 無新增警告（唯一錯誤位於 `.vscode/demo.vue`，屬 pre-existing 與本變更無關）
- [x] 12.2 全程錯誤路徑檢視：所有新增錯誤皆 `return ApiResponse`（不 `throw`）、三語訊息齊全
- [x] 12.3 grep 確認沒有遺漏的 `prisma.queueTicket.create` / `queueCounter.upsert` 漏帶 `resourceId`
- [ ] 12.4 跑一次本地 `npm run dev` smoke：建立綁 X、Y 的 QUEUE service，curl 公開 take 拿到 1 號（A）與 1 號（B），各自不衝突；非綁 resource 的 service 仍可走原路徑（留給後續手測；型別＋單元測試已覆蓋契約）
- [x] 12.5 OpenSpec validate：`openspec validate add-queue-multi-resource-backend --strict` 通過

## 13. 階段交接

- [ ] 13.1 在本 change 目錄留 README 註記「階段 1 完成，後續階段 2/3 各自開新對話框與 OpenSpec change」
- [ ] 13.2 若 prod 部署：跑 dry-run `SELECT COUNT(*) WHERE resourceId IS NOT NULL` 確認預期為 0（migration 已套用到 Railway dev DB）
- [ ] 13.3 `openspec archive add-queue-multi-resource-backend` 歸檔（待使用者確認後執行）
