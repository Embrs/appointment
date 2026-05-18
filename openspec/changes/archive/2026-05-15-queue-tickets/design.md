# Design：queue-tickets

## Context

- 既有 schema：
  - `QueueWindow(merchantId, serviceId, weekday, startTime, endTime, maxTickets, isActive)` — 每週領號時間窗（已由 Change 4 在 settings 設定）
  - `QueueTicket(merchantId, serviceId, ticketDate, ticketNumber, status, customer 三元組, takenAt, calledAt, doneAt)` — 號碼牌
  - `QueueCounter(merchantId, serviceId, counterDate, lastTicketNumber, lastCalledNumber)` — 叫號游標
  - `unique(merchantId, serviceId, ticketDate, ticketNumber)`、`unique(merchantId, serviceId, counterDate)`
- 既有工具：`UseWS` composable（含心跳/重連/被動等待），`server/utils/{prisma, response, auth, rate-limit, booking}.ts`
- 既有結構：appointment protocol 採 `index.ts + mock.ts + type.d.ts` 三件套，server API 採 `defineEventHandler` + Zod 驗證 + 三語錯誤訊息

## Goals / Non-Goals

**Goals**：
- 拿號並發安全（同一 counter 同時 N 個 request，不重複編號）
- 叫號並發安全（兩員工同按，只能成功一個或指向同號）
- 顧客等待頁即時更新（WS 推播）；WS 斷線時靠 15 秒輪詢兜底
- 跨日重置（每天第一張票自動建當日 counter，前一日 counter 不影響）

**Non-Goals**：
- WebSocket scale-out（單實例 Map 即可，未來 Redis pub/sub）
- 顧客主動取消號碼牌（MVP 不做，超時讓商家 skip）
- 預估等候時間精算（MVP 顯示「您前面還有 N 人」即可）

## Decisions

### 1. 並發控制：`prisma.$transaction` + `$queryRaw SELECT ... FOR UPDATE`

Prisma 沒有原生的 row lock 語法，需以 `$queryRaw` 在交易內手動鎖 `QueueCounter` 該列。

```ts
await prisma.$transaction(async (tx) => {
  // 確保有 counter（事務外可能 race，但 unique 約束兜底）
  await tx.queueCounter.upsert({
    where: { merchantId_serviceId_counterDate: { merchantId, serviceId, counterDate } },
    update: {},
    create: { merchantId, serviceId, counterDate, lastTicketNumber: 0, lastCalledNumber: 0 }
  });
  // 鎖該列
  const locked = await tx.$queryRaw<Array<{ id: string; lastTicketNumber: number }>>`
    SELECT id, "lastTicketNumber" FROM "QueueCounter"
    WHERE "merchantId" = ${merchantId}
      AND "serviceId" = ${serviceId}
      AND "counterDate" = ${counterDate}
    FOR UPDATE
  `;
  const counter = locked[0];
  const nextNumber = counter.lastTicketNumber + 1;
  await tx.queueCounter.update({
    where: { id: counter.id },
    data: { lastTicketNumber: nextNumber }
  });
  await tx.queueTicket.create({ data: { /* nextNumber, ticketDate, ... */ } });
}, { isolationLevel: 'Serializable' });
```

叫號同模式：FOR UPDATE 鎖 counter → 找最小 WAITING ticket → 升 CALLED → 更新 counter.lastCalledNumber。

### 2. ticketDate 計算：以 Merchant timezone 為準

`Merchant.timezone` 預設 `Asia/Taipei`。`ticketDate` 是商家本地日期（DateOnly）。

統一用：
```ts
import { formatInTimeZone } from 'date-fns-tz';
// or 自己用 Intl.DateTimeFormat
const dateStr = new Intl.DateTimeFormat('en-CA', {
  timeZone: merchant.timezone,
  year: 'numeric', month: '2-digit', day: '2-digit'
}).format(new Date()); // 'YYYY-MM-DD'
const ticketDate = new Date(`${dateStr}T00:00:00Z`); // 存 UTC 0 點，PG @db.Date 只看日期
```

不裝額外 timezone 套件，用 Intl 即可。

### 3. WebSocket 模組：peer Map 與 broadcast

```ts
// server/utils/queue.ts
const peerMap = new Map<string, Set<any>>(); // 簡化型別，h3 Peer 結構
export const addPeer = (merchantId: string, peer: any) => { ... };
export const removePeer = (merchantId: string, peer: any) => { ... };
export const broadcastQueue = (merchantId: string, payload: object) => {
  const set = peerMap.get(merchantId);
  if (!set) return;
  const json = JSON.stringify(payload);
  for (const p of set) {
    try { p.send(json); } catch { /* ignore */ }
  }
};
```

WS handler 用 nitro 的 `defineWebSocketHandler`（需在 `nuxt.config.ts` 啟用 `nitro.experimental.websocket = true`）。

### 4. broadcast payload

統一格式：
```ts
{
  type: 'CALL_NEXT' | 'TICKET_DONE' | 'TICKET_SKIPPED' | 'TICKET_TAKEN',
  serviceId: string,
  current: number,           // 服務中號碼（CALL_NEXT 時）
  servingTicketId: string,   // 服務中票 id
  timestamp: number          // Date.now()
}
```

`TICKET_TAKEN` 由 take.post 觸發，讓商家面板即時看到新號碼（不必輪詢）。

### 5. WS 鑑權

顧客頁不需要 token；商家頁雖然有 token 但 WS 升級時瀏覽器 fetch API 不易帶 Authorization header。

**MVP 決策**：WS 不做鑑權，只接受 query `merchantId`；任何人都可連線聽該商家的 broadcast。
- 號碼牌資訊本來就會顯示在店裡公開螢幕，並非機密
- 寫入動作（call-next / done / skip）仍需 merchant token（走 HTTP），WS 純廣播只讀
- 未來想收緊可改用短期 ws-ticket：HTTP 換一次性 ticket，WS 開啟時送 ticket

### 6. 等待頁兜底輪詢

`UseWS` 已有自動重連，但極端情況下（雲端 WS 完全失效）需 HTTP fallback。

`StoreQueueRealtime` 維護 `pollIntervalId`：
- WS 連線中：不輪詢
- WS 斷線且 `myTicket` 存在：每 15 秒呼叫 `GetQueueTicket({ id })` 重抓狀態
- 拿到資料後 patch 本地 state（與 WS 收到的內容一致）

### 7. ticketDate 跨日

每天第一張票進來時 counter 不存在 → `upsert` 建立 → 鎖 → 自增。
昨日 counter 留在表中（lastTicketNumber=N），不會干擾今天的 counter（unique 鍵含 counterDate）。

每日營業開始第一張票自動建 counter，無須 cron 預建。

### 8. QueueWindow 校驗

拿號時校驗：
- 服務 `bookingMode === 'QUEUE'`
- 商家當日有對應 weekday 的 QueueWindow（isActive=true），且當前時間在 startTime~endTime 範圍內
- 若 `maxTickets > 0` 且當日票數已達上限，拒絕（`MSG_QUEUE_FULL`）

### 9. 防重複領號

同 `(merchantId, serviceId, ticketDate, customerPhone)` 已有 status='WAITING' 或 'CALLED' 的票時，回 409 `MSG_QUEUE_ALREADY_TAKEN`，附帶現有票 id 讓前端可直接導去 status 頁。

## Risks

- **Prisma + raw SQL 維護成本**：用 `$queryRaw` 寫表名 `"QueueCounter"` 屬於 schema 強耦合；schema 變更時需同步改 raw SQL。風險可控因為 schema 已固定（Change 1）。
- **Nitro WebSocket experimental flag**：穩定性視 nitropack 版本；MVP 接受此風險，未來可換 socket.io。
- **單實例廣播**：多 replica 部署時 broadcast 不會跨機。MVP 部署單機；scale-out 加 Redis pub/sub。
- **顧客在後台叫號前關閉等待頁**：再次開啟時靠 `GET /public/queue/[id]` 重建 currentServing 狀態。
