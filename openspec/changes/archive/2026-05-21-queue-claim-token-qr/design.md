## Context

walk-in-ticket-creation 與 queue-eta-display 兩個 change 完工後，現場顧客已能由商家代建票（含選擇性電話），個人狀態頁也能看到 ETA。但顧客若沒留電話、或留了卻不記得，就無法在 `m/[slug]/queue/status` 用「手機末 4 碼」回查到自己的票，只能傻站在店裡等叫號。

`QueueTicket` 目前由 `internalCreateTicket`（`server/utils/queue.ts:329`）在 `Serializable` 交易內以 `SELECT ... FOR UPDATE` 鎖 `QueueCounter` 序列化自增號碼後寫入，公開端 `POST /public/queue/take` 與後台 `POST /queue/create-for-customer` 共用此核心。`POST /public/queue/take` 已有 `queue-take-ip:` / `queue-take-phone:` 兩道 RateLimit（`server/routes/nuxt-api/public/queue/take.post.ts:40-55`）。ETA 端在 `server/routes/nuxt-api/public/queue/[id].get.ts` 由 `estimateWaitMinutes(getTicketsAhead(...), effectiveAvg)` 計算後回傳。

`app/components/open/dialog/queue-walk-in.vue` 已有領號成功後的列印小單區塊（`window.print()` + `@media print`），但目前列印內容只有票號與當前叫到號，沒有任何讓顧客離場後自助回查的入口。

## Goals / Non-Goals

**Goals:**
- 讓「現場領號」的顧客拿到一張可隨身、可離場、可即時追蹤的入口（QR Code + 短碼），且能在不需要手機末 4 碼的情況下登入 status 頁。
- claim token 必須不可猜測（攻擊者不能枚舉 token 撈當日他人票）。
- 對既有手機末 4 碼登入路徑零破壞——新路徑為「附加」而非「取代」。
- ETA 計算邏輯 100% 復用 Change B 的 `estimateWaitMinutes` 純函式，不重新實作。

**Non-Goals:**
- 不引入大螢幕公開叫號頁（Change D `queue-display` 範圍）。
- 不調整 ETA 演算法或 `avgServiceMinutes` 來源（沿用 Change B）。
- 不為過期票（status=DONE/SKIPPED 或非當日）提供 token 查詢——故意失敗以縮小 token 洩漏的時間視窗。
- 不替既有票回填 claim token（無需 backfill，欄位 nullable）。
- 不導入伺服器端 QR 圖檔生成或快取，全部由前端 `qrcode` 套件即時 render。

## Decisions

### Decision 1：token 採用 nanoid 8 碼、custom alphabet 排除易混淆字元

**選擇**：在後端用 nanoid 產生 8 碼 token，alphabet 為 `'23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz'`（移除 `0/O/o/1/I/l`）。

**理由**：
- 8 碼 × ~56 字元 alphabet ≈ 2^46 組合，每日票數遠小於此，碰撞機率可忽略；萬一碰撞，`@unique` 索引會在交易內觸發 `P2002`，由呼叫端 retry 一次即可（極罕見）。
- 排除易混淆字元讓「短碼」可口頭傳達（例如顧客打電話來，店員可念給他）。
- 比 6 碼更安全（6 碼 ≈ 2^34，攻擊者一秒打幾百次也可能在數小時內撞庫）；比 12 碼更短便於 QR 解析與顯示。

**替代方案**：
- UUID v4：36 碼太長，QR 密度高、不便讀念，且 alphabet 含混淆字元。
- crypto.randomBytes(4).toString('hex')：8 碼 hex 只有 2^32，碰撞與爆破都太脆弱。
- DB sequence 或 ticketNumber：序列化容易猜測（攻擊者只要 +1 -1 就能掃到鄰票），完全不符合「不可猜測」要求。

### Decision 2：token 在 `internalCreateTicket` 交易內生成並寫入，碰撞時 retry 一次

**選擇**：在交易內呼叫 `generateClaimToken()` 一次後寫入 `QueueTicket.claimToken`；若觸發 `P2002` unique 衝突，整個交易回滾並由 `internalCreateTicket` 在外層 `try/catch` 重試一次（最多兩次嘗試）。

**理由**：
- 與既有 `Serializable` 交易、`SELECT ... FOR UPDATE` 流程保持一致，避免「先寫票、後補 token」兩階段造成 race condition。
- 8 碼 nanoid 衝突期望值極低，retry 一次足以涵蓋所有實際情況。

**替代方案**：
- 在交易外生成、寫完票再 update 補 token：多一輪 DB 往返，且存在「票已建立但 token 未寫」的中間態。
- 預先批量塞入閒置 token、拿號時 pop 一個：實作複雜，回收與互斥都麻煩，收益為零。

### Decision 3：新增獨立端點 `GET /public/queue/claim/[token]`，不重用 `/public/queue/[id]`

**選擇**：新增 `server/routes/nuxt-api/public/queue/claim/[token].get.ts`，只接受 token、不接受 `ticketId`，內部以 `claimToken` 查詢並複用 `[id].get.ts` 計算 ETA 的同一段純函式。

**理由**：
- 路徑語意清晰：`[id]` 是已知 ticketId 的查詢、`claim/[token]` 是「拿著票根換資料」的兌換動作，混在同一端點會讓 Zod schema 與 RateLimit key 都變複雜。
- 不同 RateLimit 策略：token 端點需以「IP + token 前綴」做爆破防護，與 ticketId 端點的存取模式不同。
- 將 ETA 計算抽成 helper（或在 controller 內呼叫同一段 `estimateWaitMinutes`），避免邏輯漂移。

**替代方案**：
- 重用 `[id].get.ts` 並讓 `[id]` 同時接受 token：路由語意混亂，且需區分「找不到」是 id 還是 token，error code 難以對齊。

### Decision 4：claim 端點僅允許「當日 + status ∈ {WAITING, CALLED}」票，過期一律 404

**選擇**：查詢條件強制 `ticketDate = today(merchant.timezone)` 且 `status IN ('WAITING','CALLED')`；不符合一律回 `notFoundError(event)`（不洩漏 token 是否存在）。

**理由**：
- 縮小 token 有效時窗到「當日叫號期間」，即使 token 透過螢幕截圖外流也僅當日有效。
- 與現有「手機末 4 碼回查」（`spec.md:348` Requirement）保持同樣的隱私基準：不洩漏 phone/lastName/title。
- 過期票即使被查到也無實質意義（已結束），故以 404 隱藏更安全。

**替代方案**：
- 允許查 DONE/SKIPPED 票供顧客「事後回顧」：使用情境少且增加洩漏視窗。

### Decision 5：claim 端點 RateLimit 採「IP 為主、token 為輔」雙桶

**選擇**：
- `queue-claim-ip:{ip}`：每 60 秒 30 次（合理顧客最多每幾秒刷新）。
- `queue-claim-token:{token}`：每 60 秒 20 次（單張票本身也不該被高頻探測）。
- 失敗回 `tooManyRequestsError(event)` 並設 `Retry-After` header。

**理由**：
- IP 桶擋暴力枚舉；token 桶擋特定票被人惡意刷（例如知道某人票號想灌爆）。
- 數值刻意比 `queue-take` 鬆（30/60 vs 5/60），因 status 頁需要週期性 fallback 輪詢（WS 斷線時）。

### Decision 6：前端用 `qrcode` 套件、Canvas render，內容是「絕對 URL」

**選擇**：
- 新增 `qrcode@^1.5.x` runtime dependency（純前端，無 Node-only 依賴）。
- 在 `app/pages/m/[slug]/queue/index.vue` 領號成功後彈 `ElDialog`，內含 `<canvas>` 由 `QRCode.toCanvas` 渲染。
- QR 內容固定為 `${window.location.origin}/m/${slug}/queue/status?token=${claimToken}`。
- 同時用大字顯示 8 碼短碼，供顧客手寫或口頭傳達。

**理由**：
- 客戶端 render 不需後端流量、不需快取、即時生成；任何 SSR/CSR 切換都不影響。
- 用 `window.location.origin` 而非寫死 host，多商家自訂網域與 dev/prod 環境都能直通。
- `qrcode` 是業界長期維護、無 native deps、bundle 小（~70KB gzipped）的標準選擇；不需自行實作 Reed-Solomon。

**替代方案**：
- 後端用 `qrcode-svg` 直接回 SVG：多一輪請求、需處理 caching headers、SSR/CSR 同構成本高。
- `vue-qrcode-component`：抽象多一層、不易客製樣式，且本身就是 wrap `qrcode`。

### Decision 7：status 頁以 `?token=` 為「最高優先」進入路徑，與手機末 4 碼互斥

**選擇**：`app/pages/m/[slug]/queue/status.vue` 載入時先讀 `route.query.token`：
- 有 token：呼叫 `/public/queue/claim/[token]` 載入，跳過電話表單與 `/public/queue/lookup` 流程，token 失敗時顯示「票券已過期或不存在，請改用手機末 4 碼回查」並回退到舊流程。
- 無 token：完全沿用 Change B 的手機末 4 碼登入流程，零行為變化。

**理由**：
- 兩條路徑分流清楚，無需在同一表單裡塞 token 欄位（顧客也不會手動輸入 token，那是 QR 用途）。
- token 失敗 fallback 是「降級」而非「拒絕」，保留顧客手動找回的能力。

### Decision 8：walk-in 列印小單透過「事件溝通」載入 QR Code

**選擇**：`queue-walk-in.vue` 列印區塊在 `issued.value.claimToken` 存在時插入：
- 一個由 `qrcode` render 的 `<canvas>` 區域。
- 大字短碼。
- 中文／英／日三語說明「掃碼即可在手機追蹤叫號」。
- 列印 CSS（`@media print`）確保 QR 區塊不被裁切、字體足夠大。

**理由**：與顧客 self-take 共用同一個 `claimToken` 來源（API 回應即內含），無需額外請求。

## Risks / Trade-offs

- **[Risk] token 透過畫面截圖或社群分享外流** → Mitigation：限「當日 + 非終止狀態 + 雙桶 RateLimit + nanoid 不可枚舉」四層；查得到也只能看到自己票的 ETA，不含 phone/lastName/title，洩漏代價最小化。
- **[Risk] token 碰撞造成領號失敗** → Mitigation：8 碼 nanoid 衝突期望值極低；`internalCreateTicket` 偵測 `P2002` 後 retry 一次；retry 兩次仍失敗才回 5xx（實務上幾乎不可能）。
- **[Risk] `qrcode` 套件體積或載入失敗影響領號頁** → Mitigation：用動態 `import('qrcode')` 在 dialog 打開時才載入，領號主流程不受 bundle 體積影響；載入失敗顯示「請使用短碼 + URL」fallback。
- **[Risk] 商家以為 token 永久有效，事後客訴查不到票** → Mitigation：列印小單明確標示「本日有效」字樣（i18n key `queue.claim.todayOnly`）。
- **[Trade-off] 不為舊票 backfill claim token** → 對既有顧客零影響，但歷史票不能享受 QR 功能；接受此 trade-off，因 nuxt-api 路徑現場顧客生命週期就是「當日」。

## Migration Plan

1. **Schema migration**（單一 PR，先合）：
   - `prisma migrate dev --name add_queue_ticket_claim_token` 產生 migration。
   - 內容：`ALTER TABLE "QueueTicket" ADD COLUMN "claimToken" TEXT;`、`CREATE UNIQUE INDEX "QueueTicket_claimToken_key" ON "QueueTicket"("claimToken") WHERE "claimToken" IS NOT NULL;`（partial unique index 避免歷史 null 互相衝突）。
   - 套用後既有 row 保持 `null`，不影響任何查詢。
2. **後端上線**：`internalCreateTicket` 開始為新票寫入 token；公開 take 與後台 create-for-customer 端點 response 加 `claimToken`。
3. **新端點上線**：`GET /public/queue/claim/[token]` 同 PR 部署，但前端先不打。
4. **前端切換**：領號 dialog 顯示 QR、status 頁支援 `?token=`、walk-in 列印小單加 QR。

**Rollback**：
- 前端可單獨 revert（後端保留欄位無副作用）。
- 後端 revert：保留 column（避免動 schema），只把 `internalCreateTicket` 生成 token 的邏輯與新端點移除，前端隨後 revert。
- 不需要刪 column；保留為 dead column 直到下一次 schema 清理。
