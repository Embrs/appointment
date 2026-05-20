## Context

號碼牌系統在 `setup-foundation` change 落地了 `QueueWindow / QueueTicket / QueueCounter` 三張表，`queue-tickets` change 實作了領號、叫號、WebSocket 推播、cron 歸檔，但 **`QueueWindow` 的商家端 CRUD 從未實作**。Grep 結果證實：

```
server/utils/queue.ts:1            // QueueWindow 校驗 helper
server/routes/nuxt-api/public/queue/take.post.ts:74  // findMany（讀）
```

整個 codebase 沒有任何 `prisma.queueWindow.create / update / delete`、沒有任何 `merchant/queue-window` endpoint。商家無從設定，`isWithinQueueWindow` 永遠回 false，顧客必然撞到 `MSG_QUEUE_WINDOW_CLOSED`。

第二個缺口是顧客領號頁 `/m/[slug]/queue/index.vue` 沒顯示「目前叫到幾號」，使用者無從評估排隊時間。等待頁 `status.vue` 有顯示，但要先領號才能看到，反客為主。

## Goals / Non-Goals

**Goals:**
- 商家在後台能逐服務設定每週 7 天的領號時間窗（startTime / endTime / maxTickets / isActive）
- 顧客在領號前能看到每個 QUEUE 服務「目前叫到 X 號」與「等待 Y 人」
- 即時更新（叫號廣播抵達領號頁）使用既有 WS 架構，零後端新增推播邏輯
- 不破壞既有 `queue-tickets` 端到端流程

**Non-Goals:**
- QueueWindow 跨日（startTime > endTime，例如夜店 22:00–02:00）— 第一版維持「同日內」假設，已是 spec 既定
- 動態調整 maxTickets 對「當日已發出票數」的影響（若調低低於已發數，當日不再發新票即可）
- 顧客在領號頁直接顯示「預計輪到我的時間」估算（屬未來 feature）
- 重做 WS 推播架構

## Decisions

### 決策 1：QueueWindow CRUD 用「整批覆蓋」風格，與 ScheduleRules 一致

選 `PUT /merchant/queue-window` body = `{ serviceId, windows: [...] }` 整批覆蓋，**不**用 `POST + DELETE [id]` 細粒度操作。

**理由：**
- 與既有 `PUT /schedule/rules` 完全一致（[server/routes/nuxt-api/schedule/rules.put.ts]），商家後台 UX 也一致
- 「每週 7 天 × 1 服務」資料量小（≤ 7 row），整批覆蓋實作簡單、避免 race
- 事務內 `deleteMany` + `createMany`，原子

```typescript
await prisma.$transaction(async (tx) => {
  await tx.queueWindow.deleteMany({ where: { merchantId, serviceId } });
  await tx.queueWindow.createMany({ data: windows.map((w) => ({ merchantId, serviceId, ...w })) });
});
```

### 決策 2：商家設定頁路由用 `/admin/queue-window`，不擠進 `/admin/queue`

`/admin/queue` 是即時叫號控制台（高頻、戰術性），`/admin/queue-window` 是設定（低頻、結構性），分頁面避免 UI 太擠。

側邊欄入口：「號碼牌」群組下兩個子項 — 「叫號控制台」與「領號時間設定」。

### 決策 3：QueueWindow 編輯 UI 用新元件 `BizQueueWindowEditor`，不重用 `SchedulerWeeklyEditor`

`SchedulerWeeklyEditor` 是排班用，每個 weekday 支援多段時間（startTime/endTime）。QueueWindow 含額外 `maxTickets`（0=無限）欄位且每個 weekday 通常只一段（領號時間是連續的，不像營業時間可能切午休）。

設計差異大，硬塞 prop 反而難維護。新做 `BizQueueWindowEditor` 比較乾淨。

### 決策 4：顧客領號頁的初始 currentServing 用「擴充既有 `/public/m/[slug]`」而非新 endpoint

`GET /public/m/[slug]` 既有 endpoint 已回 services 陣列，每個 service 物件多加 `currentServing` 欄位最自然。

**實作：**
```typescript
// services 內每筆 QUEUE 服務，多 query 一次 today's counter
const today = getTicketDate(merchant.timezone);
const counters = await prisma.queueCounter.findMany({
  where: { merchantId: merchant.id, counterDate: today, serviceId: { in: queueServiceIds } },
  select: { serviceId: true, lastCalledNumber: true, lastTicketNumber: true }
});
const counterMap = new Map(counters.map(c => [c.serviceId, c]));
// 組裝時：currentServing = counterMap.get(service.id)?.lastCalledNumber ?? 0
//        ticketsTaken    = counterMap.get(service.id)?.lastTicketNumber ?? 0
//        waitingCount    = ticketsTaken - currentServing
```

公開 endpoint 暴露 `currentServing` + `waitingCount` 沒有隱私問題（這正是店家想公開的資訊）。

### 決策 5：顧客領號頁的即時更新用既有 WebSocket，不用 SSE / 5 秒輪詢

評估三種機制：

| 方案 | 後端新增 | 前端新增 | 流量負擔 |
|------|---------|---------|---------|
| **WebSocket（既有）** | 0 行 | 重用 `StoreQueueRealtime.Connect()` | 已連線常駐，與 status.vue 一致 |
| SSE | 新 endpoint + nitro handler + 心跳機制 | 新 EventSource | 比 WS 略低，但要實作 reconnect |
| 5 秒輪詢 | 0 行（重用 `/public/m/[slug]`） | setInterval | 每訪客 12 次/分鐘 DB query；店面螢幕常駐放大成本 |

選 WebSocket：`StoreQueueRealtime` 已是 **WS + 15 秒 HTTP 輪詢自動降級**雙軌制，新做反而是 regression。

但有顧客連線量考量：領號頁可能被「店面公告螢幕」長開，10 家店 × 1 螢幕 = 10 個常駐連線；對 Nitro WS 來說微不足道（peerMap 是 `Map<string, Set<Peer>>`，記憶體成本可忽略）。

### 決策 6：領號頁進場立刻 Connect，離開立刻 Disconnect

```typescript
onMounted(async () => {
  await ApiLoad();
  if (merchant.value) queueStore.Connect(merchant.value.id);
});
onBeforeUnmount(() => queueStore.Disconnect());
```

`StoreQueueRealtime` 已支援 Connect/Disconnect 生命週期、自動心跳、自動重連。

### 決策 7：UI 顯示文案

每個 QUEUE service 卡片在原有「領號」按鈕上方加一行：
```
目前叫到 12 號  ·  等待 3 人
```

若 `lastTicketNumber === 0`（當日尚未發號）顯示「尚未開始服務」。

若 `lastCalledNumber === 0` 但 `lastTicketNumber > 0`（已發號未叫號）顯示「目前叫到 — 號  ·  等待 N 人」。

### 決策 8：商家 QueueWindow PUT 不檢查時間衝突

允許商家設定重疊或不合理的時間段（例如 startTime > endTime），由 UI helper text 警告，後端只做格式 + 範圍驗證（HH:mm 格式、0-23/0-59、weekday 0-6、maxTickets >= 0）。

理由：商家可能有特殊需求（例如「11:00-12:00 + 14:00-18:00」分兩段），第一版簡化為「每 weekday 一段」，未來如需多段可擴成 array。

## Risks / Trade-offs

| Risk | Mitigation |
|------|-----------|
| QueueWindow PUT 整批覆蓋若交易 commit 後某併發 take 抓到舊 cache，看起來像 race | findMany 不快取，每次 take 重新查；無 cache 問題 |
| 顧客領號頁長期常駐 WS 連線，伺服器累積 peer | `peerMap` 對 close event 自動清理；無 leak 風險 |
| 領號頁顯示舊 currentServing（WS 還沒推就有人開頁面） | 初始載入用 `/public/m/[slug]` 帶當下值，WS 接手後續；最差 case = 連線前的瞬間顯示初始值，1 秒內 WS 接管 |
| 商家設定 maxTickets 太低，當日已發超過 | 既有 take.post.ts 用「事務內 count 與 maxTickets 比」處理；改 maxTickets 後新發票會卡上限，已發票不受影響 |
| 顧客 i18n key 缺漏導致顯示 raw key | task 包含三語 key 一致性檢查 |

## Migration Plan

- **無 schema 變動**：直接 PR 合併後即時生效
- **既有商家**：合併後沒有 QueueWindow row 的商家，領號仍會回 `MSG_QUEUE_WINDOW_CLOSED`（原本就是這樣）；需引導商家進設定頁建立 QueueWindow
- **rollout**：合併 main → CI build → Railway 自動部署
- **rollback**：revert PR；無資料破壞風險

## Open Questions

無。問機制方案使用者已採納建議（WebSocket）。
