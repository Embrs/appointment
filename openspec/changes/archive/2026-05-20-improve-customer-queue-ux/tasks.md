## 1. i18n 文案三語齊備

- [x] 1.1 在 `i18n/locales/zh.js` 的 `queue.page.*` 加入 recent / find / callOverlay / connReconnecting / connFallback / connOffline / progressAhead / progressNotStarted / progressPassed / doneTitle / skippedTitle 等新 key
- [x] 1.2 同步在 `i18n/locales/en.js` 補完所有新 key（含 "It's your turn"、"Please come to the counter" 等）
- [x] 1.3 同步在 `i18n/locales/ja.js` 補完所有新 key（含「あなたの番です」「カウンターへお越しください」等）
- [x] 1.4 將三語 title 模板 key 設計為含參數型（`{n}` / `{serviceName}`），確認三語語序皆能套用

## 2. 後端 `POST /public/queue/find`

- [x] 2.1 新增 `server/routes/nuxt-api/public/queue/find.post.ts`，定義 zod schema：`{ slug, serviceId, phoneLast4 (^\d{4}$) }`
- [x] 2.2 實作查詢邏輯：解析 slug → merchantId、`prisma.queueTicket.findMany` where `(merchantId, serviceId, ticketDate=今日, phone endsWith phoneLast4)`
- [x] 2.3 接 `rateLimit` 工具：bucket `queue:find:{ip}`、5/分鐘、失敗 10 次後 5 分鐘鎖
- [x] 2.4 回應分流：1 筆 → `{ ticketId }`；多筆 → 400 `MSG_QUEUE_FIND_AMBIGUOUS`；0 筆 → 404 `MSG_QUEUE_FIND_NOT_FOUND`；非數字 → 400 `MSG_QUEUE_FIND_INVALID`
- [x] 2.5 確保 response body 不含 `phone / lastName / title`；錯誤日誌不寫入 phoneLast4 內容
- [x] 2.6 在 `app/protocol/fetch-api/api/queue/index.ts` 新增 `FindQueueTicket` API 與型別
- [x] 2.7 在 `app/protocol/fetch-api/api/queue/mock.ts`（若存在）新增 mock 回應；新增 `MSG_QUEUE_FIND_*` 三組 i18n 訊息

## 3. 顧客端 localStorage recent 紀錄

- [x] 3.1 新增 `app/composables/use-customer-queue-recent.ts`：提供 `ReadRecent()`、`AppendRecent(entry)`、`PruneExpired()`、key 解析失敗時重置
- [x] 3.2 在 `app/pages/m/[slug]/queue/index.vue` 領號成功（`ApiTake`）後、`navigateTo` 前呼叫 `AppendRecent`
- [x] 3.3 在 `app/pages/m/[slug]/queue/index.vue` `onMounted` 後讀取當日同 slug entries，渲染「回到等待頁」橫幅
- [x] 3.4 橫幅含「回到等待頁」與「我不是這個」忽略按鈕；忽略後僅隱藏（保留紀錄供下次顯示）
- [x] 3.5 設定上限 20 筆與當日過期過濾邏輯，含單元層的 try/catch 保護

## 4. 顧客端找回號碼頁

- [x] 4.1 新增 `app/pages/m/[slug]/queue/find.vue`：使用 `front-desk` layout，含 `BizCustomerPageHeader`
- [x] 4.2 表單欄位：服務下拉（由 `GetPublicMerchant` 取的 QUEUE 服務）、手機末 4 碼輸入（限數字、長度 4，使用 ElInput + 限制器）
- [x] 4.3 送出時呼叫 `$api.FindQueueTicket`，成功 → `navigateTo` status 頁；失敗依錯誤碼顯示對應 ElMessage
- [x] 4.4 在 `/m/[slug]/queue/index.vue` 加入「找回我的號碼」次要入口連到 find 頁
- [x] 4.5 RWD：320–414px 寬度下表單欄位、按鈕、訊息皆不溢出

## 5. `StoreQueueRealtime` 連線狀態四態

- [x] 5.1 在 `app/stores/7.store-queue-realtime.ts` 新增 `connectionState: 'live' | 'reconnecting' | 'fallback' | 'offline'`
- [x] 5.2 新增 `reconnectIn: number` 倒數秒；由內部 `setInterval(1s)` 維護，連線成功或切到 fallback 後停掉
- [x] 5.3 用 `UseWS` 的 `onDisconnected` 切換到 `reconnecting`、`onConnected` 切回 `live`；連續失敗 3 次切到 `fallback`
- [x] 5.4 監聽 `window.online / offline`，覆蓋設定 `offline`（offline 解除後重新評估）
- [x] 5.5 對外切換 state 套用 1.5 秒 debounce（避免短瞬斷抖動）
- [x] 5.6 新增 `ForceReconnect()` 對外方法供「立即重試」按鈕呼叫

## 6. 顧客等待頁 status.vue 重構

- [x] 6.1 拆出 `BizQueueCallOverlay.vue`：props `{ ticketNumber, serviceName, onDismiss }`，含 dismiss 按鈕、`@keyframes` 動畫（3 循環後停止）、`@media (prefers-reduced-motion: reduce)` 降級
- [x] 6.2 拆出 `BizQueueProgress.vue`：props `{ startNumber=1, currentServing, myNumber, totalTaken, myStatus }`；四節點視覺、徽章「前面還有 N 位」、推進 transition
- [x] 6.3 拆出 `BizQueueConnectionBar.vue`：props `{ state, reconnectIn, onRetry }`；四 state 視覺對應 + 固定高度避免抖動
- [x] 6.4 在 `status.vue` 整合上述三個組件取代既有 `__bar` 與 `BizQueueDisplay`（保留 BizQueueDisplay 作為基礎；蓋層獨立浮層）
- [x] 6.5 引入 `useHead` 設定 computed title：CALLED 時加 `🔔 該你了 - ...`，其餘恢復原 title
- [x] 6.6 DONE 收尾畫面：綠勾、「服務完成」、CTA「回首頁」「重新領號」
- [x] 6.7 SKIPPED 收尾畫面：橙色提示、「您的號碼已被跳過」、CTA「重新領號」「聯絡店家」
- [x] 6.8 確保蓋層 z-index 不蓋過系統級 ElMessage / ElDialog（取 9000，低於 ElDialog 預設 2000+的全域 mask 但高於 BizCustomerPageHeader）

## 7. 領號頁 index.vue 強化

- [x] 7.1 領號成功後寫入 localStorage（與 3.2 整合）
- [x] 7.2 加入頂端橫幅顯示今日已有的 ticket（與 3.3 整合）
- [x] 7.3 加入「找回我的號碼」次要入口（與 4.4 整合）
- [x] 7.4 確認領號頁仍維持原有列服務、開啟 DialogCustomerForm、TakeQueueTicket 流程不受影響

## 8. RWD 與字寬驗證

- [x] 8.1 在 Playwright 測試或手動截圖驗證 320px / 375px / 414px / 768px 四個寬度下：領號頁、status 頁、find 頁、全螢幕叫號蓋層、進度條、連線 banner 皆不溢出（已驗 320px status 頁 + 領號頁 + find 頁；蓋層字寬靠 `clamp()` 自適應，蓋層實機字寬驗證待 8.2/10.3 商家叫號後補）
- [ ] 8.2 三語切換驗證：zh / en / ja 在 320px 寬度下全螢幕蓋層主訊息「該你了 / It's your turn / あなたの番です」與副訊息皆可顯示（蓋層需商家叫號才能渲染；待驗收）

## 9. 後端測試

- [x] 9.1 新增 `server/__tests__/queue-find.test.ts`：覆蓋單筆命中、多筆 ambiguous、無命中、phoneLast4 格式錯誤、RateLimit 觸發、失敗鎖、回應不含敏感欄位
- [x] 9.2 確認既有 queue 相關測試（若有）未受新增 endpoint 影響

## 10. 前端 UI 操作測試（驗收條件）

- [x] 10.1 用 Playwright MCP 啟動 `npm run dev`，以顧客身分跑「領號 → 關掉分頁 → 重新進入領號頁 → 點橫幅回 status」全流程，確認 localStorage 自動還原運作
- [x] 10.2 模擬清掉 localStorage 後，從 find 頁輸入手機末 4 碼成功還原到 status 頁（驗：5678 末 4 → 200、9999 末 4 → 404）
- [ ] 10.3 在 status 頁觸發商家叫號（另一 tab 模擬），驗證：全螢幕蓋層出現、document.title 加上 🔔、3 次脈動後停止、按「我知道了」可關閉（**待驗收**：需商家登入後叫號）
- [ ] 10.4 用 DevTools 切到 offline 1.5 秒再回 online，驗證連線 banner 不抖動（debounce 生效）；切到 offline > 2 秒驗證 reconnecting 倒數出現（**待驗收**：自動化跑 DevTools throttle 非平台支援；已實機驗 live state）
- [x] 10.5 模擬 currentServing 推進，驗證進度條動畫平滑、「前面還有 N 位」徽章準確（驗：myNumber=3, currentServing=1, 進度條 + 徽章「前面還有 1 位」正確顯示）
- [ ] 10.6 模擬 DONE 與 SKIPPED 狀態，驗證收尾畫面與 CTA 正確（**待驗收**：需商家叫號後標完成/跳號才能觸發；組件已單獨實作）
- [x] 10.7 在 zh / en / ja 三語切換完整跑一次上述流程，確認文案齊備、不出現 key 名稱（驗：status 頁 zh/en/ja 全文案 + Page title 三語對應）

## 11. 部署與收尾

- [x] 11.1 `npm run lint` 通過
- [x] 11.2 `npm test` 通過（含新增的 queue-find 測試）
- [x] 11.3 確認 `prisma migrate status` 為 clean（本變更不應有任何待套用 migration）
- [ ] 11.4 在 PR 描述中標註「無 schema 變動，測試站正式站均無需資料同步」
- [ ] 11.5 合併後在測試站走完一次顧客驗收流程，再 promote 到正式站
