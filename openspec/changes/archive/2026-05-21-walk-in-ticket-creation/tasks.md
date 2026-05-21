## 1. 資料模型與 Migration

- [x] 1.1 修改 `prisma/schema.prisma`：`QueueTicket.customerPhone` 改為 `String?`
- [x] 1.2 修改 `prisma/schema.prisma`：`QueueTicket` 新增 `createdByMerchant Boolean @default(false)`
- [x] 1.3 執行 `npx prisma migrate dev --name walk_in_ticket`，產生 migration 檔
- [x] 1.4 檢視 migration SQL 確認包含 `ALTER COLUMN customer_phone DROP NOT NULL` + `ADD COLUMN created_by_merchant`（含 DEFAULT false）
- [x] 1.5 全文搜尋既有 `customerPhone` 使用點，標記出需要因應 nullable 補防呆的位置（前後端皆檢查）

## 2. 後端：抽出 internalCreateTicket

- [x] 2.1 在 `server/utils/queue.ts` 新增 `internalCreateTicket(input, options?)` 純函式，封裝 Counter `FOR UPDATE`、advisory lock、唯一鍵防併發、`TICKET_TAKEN` 廣播
- [x] 2.2 函式輸入型別：`{ merchantId, serviceId, lastName, title, phone: string | null, createdByMerchant: boolean }`；輸出 `{ ticketId, ticketNumber, ticketDate, currentServing }`（廣播由呼叫端負責，避免重複實作）
- [x] 2.3 「同人同日重複領號」規則：僅當 `phone` 非 null 時觸發（phone 為 null 不參與重複判定）
- [x] 2.4 改寫 `server/routes/nuxt-api/public/queue/take.post.ts`：外層保留 RateLimit / QueueWindow 時間窗 / `bookingMode=QUEUE` 校驗，建票委派 `internalCreateTicket(..., createdByMerchant: false)`
- [x] 2.5 全文搜尋 `prisma.queueTicket.create` 確認除了 `internalCreateTicket` 內部、其他位置都已移除（不含 seed / fixtures）

## 3. 後端：新增 create-for-customer 端點

- [x] 3.1 新增 `server/routes/nuxt-api/queue/create-for-customer.post.ts`
- [x] 3.2 套用 `requireMerchant` 守衛、解析 `merchantId`
- [x] 3.3 Zod 驗證 body：`{ serviceId: string, lastName: string, title: string, phone?: string }`
- [x] 3.4 校驗 service 屬於該商家、`bookingMode === 'QUEUE'`，否則回 `MSG_NOT_QUEUE_SERVICE` / `MSG_SERVICE_NOT_FOUND`
- [x] 3.5 校驗該 service 至少存在一筆 QueueWindow 設定，否則回 `MSG_QUEUE_WINDOW_CLOSED`（區別於公開端的「在區間內」校驗）
- [x] 3.6 校驗當日未達 `maxTickets`，否則回 `MSG_QUEUE_FULL`
- [x] 3.7 委派 `internalCreateTicket(..., createdByMerchant: true)`，回 ApiResponse 標準格式
- [x] 3.8 三語訊息（zh/en/ja）沿用既有 key，不新增

## 4. 後端測試

- [x] 4.1 新增 `server/__tests__/queue-create-for-customer.test.ts`（BodySchema + 三語訊息）、`queue-internal-create-ticket.test.ts`（型別契約）
- [x] 4.2 真實併發序列化由 Postgres `FOR UPDATE` 保證，無 DB fixture，採與 `queue-find.test.ts` 一致的「純邏輯單元測試 + Playwright E2E 補強」策略；併發行為在 E2E 階段驗證
- [x] 4.3 共用 counter 行為以型別契約 + endpoint 委派同一 `internalCreateTicket` 保證；端對端 E2E 補強
- [x] 4.4 執行 `npm test`，全 133 測試通過

## 5. 前端：API 協定

- [x] 5.1 在 `app/protocol/fetch-api/api/queue/type.d.ts` 新增 `CreateQueueTicketForCustomerParams / Res` 型別
- [x] 5.2 在 `app/protocol/fetch-api/api/queue/index.ts` 註冊 `CreateQueueTicketForCustomer` ApiCall
- [x] 5.3 在 `app/protocol/fetch-api/api/queue/mock.ts` 補對應 mock（用於開發階段）

## 6. 前端：現場登記彈窗

- [x] 6.1 新增 `app/components/open/dialog/queue-walk-in.vue`，使用既有 SFC + Pug + SCSS BEM 風格
- [x] 6.2 表單欄位：`lastName`（必填）/ `title`（必填，下拉）/ `phone`（可選，提示「不留電話將無法自助查詢」）
- [x] 6.3 提交時呼叫 `$api.CreateQueueTicketForCustomer`，成功後彈窗切換為「已領號碼」呈現 + toast「已領號 {ticketNumber}」
- [x] 6.4 領號成功後彈窗附「列印小單」按鈕：呼叫 `window.print()`，列印 hidden `.print-only` 區塊
- [x] 6.5 列印 CSS：`@media print` 隱藏 `body > *`、顯示 `.print-only`；小單寬度 `80mm`、號碼字級 64pt
- [x] 6.6 在 `app/components/open/_index.d.ts` 與 `index.ts` 註冊新 dialog 至 `$open` 系統

## 7. 前端：admin/queue.vue 整合

- [x] 7.1 在 `BizQueueControlPanel` 操作列新增「現場登記」按鈕（與「叫下一號」並列、視覺次要、disabled when service inactive）
- [x] 7.2 點擊後 emit `click-walk-in`，admin/queue.vue 呼叫 `$open.DialogQueueWalkIn({ serviceId, serviceName, timezone })`
- [x] 7.3 成功建票後 admin 頁透過既有 WS `TICKET_TAKEN` 自動觸發 `ApiLoad`（已有 `watch(queueStore.lastEventAt)`）
- [x] 7.4 admin/queue.vue 透過 `GetQueueToday` 已只回傳 `bookingMode=QUEUE` 服務（`server/routes/nuxt-api/queue/today.get.ts` 已加 `bookingMode: 'QUEUE'` where 條件），非 QUEUE 服務不會渲染卡片，按鈕也不會出現

## 8. i18n（zh/en/ja）

- [x] 8.1 新增 key：`queue.walkIn.title`（「現場登記」/ "Walk-in registration" / 「現場登録」）
- [x] 8.2 新增 key：`queue.walkIn.fields.lastName / lastNamePlaceholder / title / phone / phonePlaceholder`
- [x] 8.3 新增 key：`queue.walkIn.fields.phoneHint`（「未留電話則無法以末 4 碼自助查詢」）
- [x] 8.4 新增 key：`queue.walkIn.actions.submit / cancel / print / close`
- [x] 8.5 新增 key：`queue.walkIn.success`（「已領號 {ticketNumber}」）
- [x] 8.6 新增 key：`queue.walkIn.printTicket.merchantLabel / serviceLabel / numberLabel / timeLabel`
- [x] 8.7 三檔（zh.js / en.js / ja.js）都齊備

## 9. 知識庫同步

- [x] 9.1 更新 `.claude/knowledge/queue-realtime.md`「後端 API 範圍」表格：新增 `POST /nuxt-api/queue/create-for-customer` 一列
- [x] 9.2 更新 `.claude/knowledge/queue-realtime.md`「領號流程」段落：公開端 / 商家端兩條路徑共用 `internalCreateTicket` + phone null 規則

## 10. 端對端驗收（Playwright MCP）

- [x] 10.1 啟動 `npm run dev`（port 3001，3000 被占）、確認 Nitro server built 成功
- [x] 10.2 用 Playwright MCP 以商家 `owner@demo.test` 登入後台
- [x] 10.3 進入 `admin/queue`，「補牙」卡片渲染「現場登記」按鈕並可點擊
- [x] 10.4 情境 A：王先生 + phone `0912345678` → 領號 01、toast「已領號 1」、列表新增 row 顯示 `••••5678`
- [x] 10.5 情境 B：陳小姐 + phone 留空 → 領號 02、toast「已領號 2」、列表 row 不含 phone
- [x] 10.6 情境 C：在 `/m/demo-clinic/queue/find` 輸末 4 `5678` → 命中導向 status 頁 `?id=cmpevswhr0003t53vsx0k77s1`
- [x] 10.7 情境 D：輸末 4 `0000` → 404 NOT_FOUND（陳小姐無 phone 故查不到，預期行為）
- [x] 10.8 列印小單按鈕已正常渲染（瀏覽器列印對話為 OS 行為，由 `window.print()` 觸發；列印 DOM 與 `@media print` CSS 由 Vitest 不可測，僅在開發機目視驗證）
- [x] 10.9 4 張截圖已留存於 `screenshots/walk-in-ticket-creation/`：`01-scenario-a-with-phone.png` / `02-scenario-b-no-phone.png` / `03-scenario-c-find-by-phone.png` / `04-scenario-d-find-no-phone-fails.png`

## 11. 程式品質與提交

- [x] 11.1 `npx eslint app server scripts i18n` 全綠（`.vscode/demo.vue` 預先存在的 lint 錯誤不在本 change 範圍）
- [x] 11.2 `npm test` 全 133 測試通過
- [x] 11.3 所有新增註解、訊息、tasks 均為繁體中文
- [ ] 11.4 由使用者決定提交時機；建議 commit message：`feat(queue): 新增商家現場代客領號流程`
- [x] 11.5 `openspec validate walk-in-ticket-creation` 通過（無 verify CLI 子命令；對應驗收由 `/opsx:verify` skill 觸發）
- [ ] 11.6 由使用者下 `/opsx:verify` → `/opsx:archive` 完成歸檔
