## Context

顧客端號碼牌頁面（`/m/[slug]/queue` 與 `/m/[slug]/queue/status`）為已上線 MVP。資料流是：

- 後端：QueueTicket/Window/Counter 三表 + Nitro WebSocket 廣播（`server/utils/queue.ts`）
- 前端：`StoreQueueRealtime`（`app/stores/7.store-queue-realtime.ts`）以 WS 為主、15s 輪詢兜底；`UseWS` composable 內含 `reconnectOnClose` 與心跳

本變更是純前端與一支唯讀公開 API 的強化，不改變後端核心叫號流程或 schema。涉及的關鍵限制：

- 顧客端為**公開頁**，沒有 session token；唯一身分識別是 customer triplet（lastName/title/phone）。
- WebSocket 只用 `merchantId` 訂閱，叫號蓋層必須在前端 store 內依 `myTicket.serviceId` 過濾。
- iOS Safari：自動播放需 user gesture、Notification 需 PWA、`vibrate` 不支援；這些已在 proposal 階段排除。
- localStorage 可用，但 SSR 階段必須避開（`onMounted` 後才存取）。

## Goals / Non-Goals

**Goals:**
- 讓「領完號後離開頁面」的顧客能在 3 秒內回到自己的等待頁，無論是 localStorage 還原或手機末 4 碼查回。
- 被叫到時，即使顧客把分頁丟到背景或滑去其他 app 才回來，能立刻在 1 秒內透過「全螢幕叫號 + 標題列鈴鐺」感知。
- 等待過程中顧客一眼能看出「我前面還有幾位」「畫面有沒有在更新」。
- 全部新文案三語齊備，全螢幕叫號與進度條在 320px 寬度下不溢出。

**Non-Goals:**
- 不做聲音／震動／瀏覽器原生通知（iOS 支援度與授權體驗成本太高，使用者本輪已排除）。
- 不做顧客自助取消票（範圍大，留待獨立 change）。
- 不動 QueueTicket schema（不新增 `calledAt`／`estimatedWait` 欄位；前端用既有資料推算即可）。
- 不調整商家後台叫號頁（本變更聚焦顧客面）。
- 不引入 PWA／Service Worker。

## Decisions

### 1. 顧客端「我幾號？」採雙保險：localStorage 自動還原 + 手機末 4 碼查回

**Why**：使用者同時選擇了「localStorage 自動還原」與「再加查詢頁」的雙保險。localStorage 是零成本、最直覺的主路徑；查詢頁是跨裝置／清快取後的兜底。

**localStorage 結構**：

```ts
// key: 'customerQueueRecent'
type CustomerQueueRecent = Array<{
  slug: string;
  merchantId: string;
  ticketId: string;
  ticketNumber: number;
  ticketDate: string;   // 'YYYY-MM-DD'（merchant timezone）
  serviceId: string;
  serviceName: string;
  phoneLast4: string;   // 只存末 4 碼，不存完整手機
  takenAt: number;      // Date.now()
}>;
```

- 寫入時機：`/m/[slug]/queue` 領號成功後，由 `index.vue` 在 `navigateTo` status 前寫入。
- 清理規則：每次讀取時過濾掉 `ticketDate !== 今日（以 client 端 dayjs 取得）` 的項目；最多保留 20 筆避免無限成長。
- 讀取時機：`/m/[slug]/queue` 進入時，比對當前 slug 是否有今日 ticket，顯示「回到等待頁」橫幅。
- 防呆：`try/catch` 包住所有 `localStorage` 操作；如解析失敗一律重置整個 key。

**手機末 4 碼查回**：

新增 `POST /nuxt-api/public/queue/find`，request body：

```ts
{
  slug: string;
  serviceId: string;
  phoneLast4: string;  // 4 位數字字串
}
```

- 後端查 `QueueTicket` 當日記錄：`phone LIKE '%' || phoneLast4`、`merchantId` 對應 slug、`serviceId` 對應、`ticketDate=今日`。
- 若多筆命中（同手機末 4 碼撞號，理論上機率極低但要處理）→ 回 400 `MSG_QUEUE_FIND_AMBIGUOUS`，提示輸入完整手機（或聯絡店家）。
- 若 0 筆 → 回 404 `MSG_QUEUE_FIND_NOT_FOUND`。
- 若 1 筆 → 回 `{ ticketId }`，前端直接導向 status 頁。
- RateLimit：比照 `/queue/take`，IP 每分鐘 5 次（用既有 `rateLimit` 工具，bucket key 為 `queue:find:{ip}`）。
- 為什麼用 POST 而非 GET：避免手機末 4 碼出現在伺服器存取記錄與 URL 歷史。

**Alternatives considered**：
- 只用 localStorage：跨裝置／清快取後完全救不回，駁回。
- 只用查詢頁：日常 90% 顧客不會清快取，自動還原節省一次操作體感更好；只做查詢會被嫌「為什麼不記得我」。

### 2. 全螢幕叫號蓋層用「條件渲染」而非路由切換

**Why**：保持單頁 URL 不變、無 page transition 卡頓；叫號狀態切換不需要瀏覽器歷史紀錄；維持 store 連線。

**實作**：
- 新增 `BizQueueCallOverlay.vue`：fixed 全螢幕覆蓋（`z-index: 9000`，蓋過 BizCustomerPageHeader 但不蓋系統級彈窗）。
- 觸發條件（computed in `status.vue`）：`MyTicket?.ticket.status === 'CALLED'` 且 `ticket.id === currentMyTicketId`。
- 視覺：
  - 背景：`linear-gradient(135deg, var(--ep-color-warning) 0%, #ff6b35 100%)`
  - 主訊息：`$t('queue.page.callOverlayTitle')` → 「該你了 / It's your turn / あなたの番です」
  - 號碼字級：`min(60vmin, 360px)`，font-weight 900
  - 副訊息：`$t('queue.page.callOverlaySubtitle')` → 「請至櫃台 / Please come to the counter / カウンターへお越しください」
  - 動畫：`@keyframes callOverlayPulse`，3 個循環後停止（用 `animation-iteration-count: 3`），避免長時間刺激。
- 退出：使用者按「我知道了」按鈕、或 status 變為 DONE/SKIPPED 時自動退出。
- 「我知道了」按鈕點擊後仍保留蓋層下方資訊（不會清掉 myTicket），但隱藏滿版蓋層；下次重新打開頁面又被 CALLED 則再次出現。

**document.title 切換**：
- 進入 CALLED 狀態：title = `🔔 該你了 - {ServiceName} - 您的號碼 N`（i18n key 形式）
- 離開 CALLED 狀態：恢復原 title
- 用 `useHead({ title: computed(...) })` 而非直接操作 `document.title`，符合 Nuxt 規範。

**Alternatives considered**：
- 用 `ElDialog`：失去全螢幕沉浸感、Element Plus dialog 的 padding 與 z-index 在手機上會被 BizCustomerPageHeader 蓋到。
- 路由 `/queue/called`：URL 跳動破壞 WS 連線與 store 狀態，且使用者按返回會困惑。

### 3. 連線狀態用四態 enum，UI 對應四種視覺

**Why**：現況只有「即時 / 兜底」二態，無法表達「斷線中正在重連」這個關鍵中間態，導致顧客在斷線當下沒有反饋。

**新增 store 對外狀態**：

```ts
// store-queue-realtime.ts
type ConnectionState = 'live' | 'reconnecting' | 'fallback' | 'offline';

// live: WS 已連線
// reconnecting: WS 剛斷、正在等 UseWS 重連（顯示倒數）
// fallback: WS 連續失敗超過 N 次、純靠 15s 輪詢
// offline: navigator.onLine === false
```

**reconnect 倒數**：
- 由 store 暴露 `reconnectIn: number`（秒），由內部 `setInterval(1s)` 倒數。
- 重連間隔取 `UseWS` 的設定（預設 3s，後續可調）；UI 顯示 `$t('queue.page.connReconnecting', { n })`。
- 連續重連失敗 3 次後切到 `fallback`，停止倒數。

**UI 視覺對應**：

| state | 視覺 | 高度 |
|-------|------|------|
| live | 細條綠色（既有樣式縮高） | 28px |
| reconnecting | 橙色 banner + 倒數 + 手動重試按鈕 | 56px |
| fallback | 灰色 banner「即時連線不穩，仍會自動更新」 | 48px |
| offline | 紅色 banner「裝置目前離線」 | 48px |

**Debounce**：state 切換時 debounce 1.5 秒（避免極短斷連造成 UI 抖動）。實作用 `useDebounceFn` 或自寫的 `setTimeout`。

### 4. 「前面還有 N 位」進度條：四段視覺，純前端計算

**Why**：完全用既有資料（`myNumber` / `currentServing` / `ticketsTaken`）即可推算，不動 schema。

**邏輯**：

```ts
// QueueProgress.vue inputs
{
  startNumber: number;       // 一律從 1 起算（or counter 第一張票，但 MVP 用 1）
  currentServing: number;    // 0 表示尚未開始叫
  myNumber: number;
  totalTaken: number;        // ticketsTaken
}

// 視覺四段
[1 …起點] -- [currentServing 目前叫號] -- [myNumber 你] -- [totalTaken 隊尾]
```

- 進度條長度按比例：`(currentServing - 1) / (totalTaken - 1)` 為「已過進度」、`(myNumber - currentServing) / (totalTaken - currentServing)` 為「我距離還剩」。
- 邊界情況：`currentServing === 0`（尚未叫第一號）→ 顯示「尚未開始叫號」；`myNumber < currentServing`（已過號）→ 對齊到「已過號」樣式。
- 「前面還有 N 位」徽章貼在「你」這個節點上方：`N = max(0, myNumber - currentServing - 1)`。
- 動畫：每次 `currentServing` 推進時，當前指示器 transition 0.6s ease-out（用 `transform: translateX(%)`）。

### 5. find.post.ts 的安全性：避免猜手機末 4 碼

**Why**：手機末 4 碼只有 10000 種組合，搭配當日票號數量有限，理論上有猜中其他顧客票號的風險。

**緩解**：
1. RateLimit：IP 每分鐘 5 次（同 take）。同 IP 連續錯誤 10 次後 5 分鐘鎖死（用既有 `rateLimit` 的 burst 機制）。
2. 必須提供 `slug` + `serviceId` + `phoneLast4` 三項齊全；單獨末 4 碼無法查。
3. 回應只給 `ticketId`，不洩漏完整 phone、lastName、title。
4. 多筆命中 → 回 ambiguous 而非任選一筆，避免攻擊者得到任何資訊。
5. 日誌：失敗查詢只記 IP 與 slug，不記 phoneLast4 內容。

**仍然存在的殘餘風險**：
- 已知某商家某服務當日票較少時（< 100 筆），暴力猜中機率仍有 1%。但 RateLimit 5/分 + 失敗鎖 → 攻擊成本明顯高於收益（拿到一個 ticketId 也只能看到「服務中號碼」與「自己排第幾」公開資訊）。
- 接受此風險，未來若有顧客敏感資訊上 ticket 再行強化。

### 6. i18n 鍵命名與三語驗證

**鍵命名**：所有新文案放 `queue.page.*` 命名空間，與既有對齊。範例：
- `queue.page.recentBanner`（回到等待頁橫幅）
- `queue.page.findTitle` / `queue.page.findPhonePlaceholder` / `queue.page.findSubmit`
- `queue.page.callOverlayTitle` / `queue.page.callOverlaySubtitle`
- `queue.page.connReconnecting` / `queue.page.connFallback` / `queue.page.connOffline`
- `queue.page.progressAhead` / `queue.page.progressNotStarted` / `queue.page.progressPassed`
- `queue.page.doneTitle` / `queue.page.skippedTitle`

**三語驗證**：
- 日文字符寬度比中文略寬，全螢幕「あなたの番です」要在 320px 螢幕測試不換行（fallback 用 `flex-wrap` + `text-align: center`）。
- 英文 `It's your turn` 比中日都長，主標題字級加上 `clamp(28px, 8vw, 56px)` 自適應。

### 7. RWD 斷點

採用既有專案斷點：
- 320–480px（小手機）：全螢幕叫號號碼字級降至 `40vmin`，進度條垂直堆疊。
- 480–768px（標準手機）：主流佈局。
- ≥768px（平板與桌面）：等待頁卡片寬度上限 600px 置中。

## Risks / Trade-offs

- **[localStorage 跨瀏覽器不同步]** → 「找回我的號碼」頁兜底；橫幅文案明確說明「此裝置的紀錄」。
- **[手機末 4 碼撞號]** → 多筆命中回 ambiguous，要求改用完整手機（但暫不實作完整手機查詢，先觀察是否真有發生）；同時 RateLimit 阻止暴力猜測。
- **[全螢幕蓋層干擾既有功能]** → 蓋層僅在 `status=CALLED` 期間出現；提供「我知道了」可手動關閉；DONE/SKIPPED 自動退出；不蓋系統級彈窗（z-index 控制）。
- **[document.title 切換被 useHead 覆蓋]** → 統一在 status.vue 用一個 computed title 餵 useHead，避免多處競寫。
- **[reconnect 倒數造成 UI 抖動]** → state 切換 1.5s debounce、倒數 1s tick 但 banner 不重排版（固定高度）。
- **[i18n 字寬溢出]** → 主要訊息用 `clamp()` 動態字級；測試 case 涵蓋三語在 320px 寬度。
- **[CSS 動畫長時間刺激敏感族群]** → 閃光動畫限制 3 次循環後停止；提供「我知道了」立即停止；考慮加 `@media (prefers-reduced-motion)` 降級為靜態高對比。

## Migration Plan

**部署步驟**：
1. PR 合併到 main → Railway 自動部署。
2. **無 prisma migrate**（schema 未變）；release 階段照常執行 `npx prisma migrate deploy`（noop）。
3. 顧客端瀏覽器下次載入即生效，無需強制 reload。
4. 既有 ticket（localStorage 為空的舊用戶）首次進入新版仍可正常領號；只是看不到「回到等待頁」橫幅，下次領號後才開始記錄。

**回滾**：
- 若全螢幕叫號或進度條造成顧客困擾 → revert 對應的 `.vue` 檔案即可，後端無關。
- `find` endpoint 若被濫用 → 可在 nuxt-api/public/queue/find.post.ts 內提早 `return 503`，前端 catch 後顯示「暫時無法使用，請聯絡店家」。

**正式站與測試站同步**：
- 兩站皆走相同 Railway pipeline；測試站先合併、人員驗證後再 promote 到正式。
- 無資料層改動 → 無需資料庫對齊腳本。

## Open Questions

- 全螢幕叫號蓋層按「我知道了」後，若使用者離開又回來且 ticket 仍是 CALLED，是否要再次跳出？建議：**是**（再次跳出），因為使用者可能是不小心點到。實作上 store 不記憶 dismissed 狀態，僅在當次 status 為 CALLED 期間維持顯示。等實作時若體感不好再調。
- 進度條起點要從 `1` 還是「該服務當日第一張票號」？MVP 一律從 `1` 簡單明瞭；未來若有部分商家從非 1 起號再評估。
- `prefers-reduced-motion` 是否要在 MVP 就支援？建議納入（CSS-only 成本低），列入 tasks。
