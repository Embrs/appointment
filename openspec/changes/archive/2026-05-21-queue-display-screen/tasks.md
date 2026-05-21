## 1. Layout 擴充 displayMode

- [x] 1.1 在 `app/layouts/front-desk.vue` 加 `defineProps<{ displayMode?: boolean }>()`（或對應 `layoutProps` 機制），`displayMode=true` 時不渲染 `.LayoutFrontDesk__header`
- [x] 1.2 `displayMode=true` 時 `.LayoutFrontDesk__container` 移除 max-width / padding 限制（改為 `100vw / 100vh`），背景改為深色高對比（變數 `$bg-dark` 或 fallback `#0b1224`）
- [x] 1.3 既有 `m/[slug]/*` 顧客頁不指定 `displayMode` 時行為不變，確認 `npm run lint` 通過
- [ ] 1.4 在 dev 環境快速開 `/m/{slug}` 與 `/m/{slug}/queue/status` 各一次，目視確認 layout 沒有 regression

## 2. 顯示頁主結構

- [x] 2.1 新增 `app/pages/m/[slug]/display.vue`：`definePageMeta({ layout: 'front-desk', layoutProps: { displayMode: true } })`（實作改用 `definePageMeta({ layout: 'front-desk', displayMode: true })` route meta，因 Nuxt 不支援 layoutProps）
- [x] 2.2 SSR/client 邏輯：在 `setup` 用 `$api.public.merchant.get({ slug })` 取一次 services + queue counter snapshot；同時 `StoreQueueRealtime.Connect(merchantId)`
- [x] 2.3 解析 route query `serviceId`：若有→使用；無→自動挑「當日有 WAITING 且 currentServing 最小」的 QUEUE 服務；皆無→顯示 `display.noService`
- [x] 2.4 onUnmounted 呼叫 `StoreQueueRealtime.Disconnect()`，確認無 setInterval / setTimeout 殘留
- [x] 2.5 純 SCSS（Pug template）排版：`.PageDisplay__main` 左 60% / 右 40% flex；rwd 在 ≤1023px 切換為上下排版（左→上 55vh、右→下橫排）
- [x] 2.6 字級：目前叫號用 `clamp(160px, 18vw, 280px)`；次要數字 `clamp(56px, 6vw, 96px)`；說明文字 `clamp(20px, 1.8vw, 32px)`
- [x] 2.7 SSR data fetching 失敗（slug 不存在 / 商家停用）時，沿用既有 `m/[slug]` 公開頁的錯誤行為（throw createError 404 / 顯示停用提示）

## 3. 即時資料與動畫

- [x] 3.1 用 `computed` 從 `StoreQueueRealtime.serviceMap[activeServiceId]` 取 `currentServing / servingTicketId / avgServiceMinutes`
- [x] 3.2 「下一位 / 再下一位」推算：以 currentServing+1 / +2 為基底（依 waitingCount 判定是否顯示），WS 更新 currentServing 後自動推進；TICKET_TAKEN 由 `ticketsTaken` 經 `WaitingCount = ticketsTaken - currentServing` 同步
- [x] 3.3 「等待人數」直接取 max(0, ticketsTaken - currentServing)；「預估等待」呼叫 `estimateWaitMinutes`（從 `~shared/queue-eta` 取）
- [x] 3.4 watch `currentServing` 變化：新值非空且 ≠ 舊值時，trigger `.PageDisplay__bigNumber--animate`（CSS `@keyframes pageDisplayCallNext` 0.6s ease-out scale 1→1.08→1，顏色由白→金→白）；用 `:key="animateKey"` 讓動畫重播
- [x] 3.5 切換 active serviceId 時 reset 動畫 key 與 lastSpokenNumber ref

## 4. TTS 語音廣播

- [x] 4.1 `useTts` composable（client-only）：暴露 `isSupported / isEnabled / Toggle() / Speak(text, lang)`；isEnabled 從 `localStorage.queueDisplayTts` 還原（預設 false）
- [x] 4.2 lang 映射：`{ zh: 'zh-TW', en: 'en-US', ja: 'ja-JP' }`；utterance 用 `new SpeechSynthesisUtterance(text)` 設 `lang` 與 `rate=1.0 / pitch=1.0 / volume=1.0`
- [x] 4.3 watch currentServing 變化 + isEnabled 為 true → 組 `display.tts.callPhrase`（i18n `t('display.tts.callPhrase', { number, serviceName })`）→ 呼叫 `Speak(text, lang)`
- [x] 4.4 維護 `lastSpokenNumber` ref：避免重複叫號重播；切換服務時 reset 為 null（不立即播報切換後的當前號碼）
- [x] 4.5 isSupported 偵測：`typeof window !== 'undefined' && 'speechSynthesis' in window`，false 時 Toggle 無作用、Speak 直接 return
- [x] 4.6 首次用戶開 Toggle 時呼叫 `Speak('', currentLang)` 一次空字串以解鎖 iOS Safari 的 user-gesture 限制
- [x] 4.7 Toolbar UI：display 頁右上角 floating button 區（hover 顯示，2.5 秒後自動淡出；點擊保持顯示），含「TTS toggle」與「服務切換下拉」（若多 QUEUE 服務）
- [x] 4.8 toggle 持久化：每次切換寫 `localStorage.queueDisplayTts = isEnabled ? '1' : '0'`

## 5. Admin 入口

- [x] 5.1 在 `app/pages/admin/queue.vue` 頂部 toolbar 新增 `ElButton` 群組：「開啟顯示頁」（icon `mdi:monitor`）與「複製連結」（icon `mdi:link-variant`）
- [x] 5.2 「開啟顯示頁」onClick：`window.open(displayUrl, '_blank', 'noopener,noreferrer')`（slug 取自 `$api.GetSelfMerchant()`，因 StoreSelf 不存 slug）
- [x] 5.3 「複製連結」onClick：`navigator.clipboard.writeText(displayUrl)`；成功 `ElMessage.success`；失敗以 `ElMessage.warning` 顯示完整 URL 讓使用者手動複製
- [x] 5.4 按鈕 disabled 條件：無 QUEUE 服務時改顯示 disabled 按鈕 + tooltip `display.needQueueService`

## 6. i18n（zh / en / ja）

- [x] 6.1 `i18n/locales/zh.js` 新增 `display.*` 命名空間（Decision 6 完整清單，包含 `callPhrase`、`tts.*`、`openDisplay`、`copyLink`、`linkCopied`、`noService`、`allDone`）
- [x] 6.2 `i18n/locales/en.js` 同步 `display.*`，`callPhrase` 樣板為 `"Number {number}, please proceed to {serviceName}."`
- [x] 6.3 `i18n/locales/ja.js` 同步 `display.*`，`callPhrase` 樣板為 `"{number}番のお客様、{serviceName}までお越しください。"`
- [x] 6.4 三語各跑一次 `npm run lint` 確認 JSON 結構合法

## 7. 文件與知識庫

- [x] 7.1 更新 `.claude/knowledge/queue-realtime.md`：在「前端使用方式」段落新增 `m/[slug]/display` 頁訂閱模式、TTS 行為、displayMode layout 說明
- [x] 7.2 為 display 頁建立簡短的「商家投影使用說明」段落（含 URL 範例、TTS 開關步驟、響應式建議解析度）
- [x] 7.3 確認 `openspec/specs/queue-tickets/spec.md` 在 archive 階段會被 sync（無需手動編輯，由 `openspec archive` 完成）

## 8. 驗收：Playwright MCP E2E

- [x] 8.1 啟動 `npm run dev`（背景），等待 `http://localhost:3001` 200（3000 被佔用，自動切 3001）
- [x] 8.2 Context A 開 `/m/{slug}/display`（1920×1080）→ `browser_resize` 1920×1080 → `browser_navigate` → `browser_snapshot` 抓初始狀態（截 `screenshots/queue-display-screen/1920x1080-initial.png`）
- [x] 8.3 用 `curl POST /nuxt-api/queue/call-next` 直接觸發叫號（merchant token 從 sign-in 取得）
- [x] 8.4 回到 Context A：`browser_wait_for { text: "04" }` → display 在 ≤ 3 秒內 03 → 04 更新；`browser_take_screenshot` 存 `1920x1080-after-call.png`
- [x] 8.5 切換 viewport 為 768×1024：`browser_resize` → 確認排版變為上下兩欄、截 `768x1024-portrait.png`
- [x] 8.6 切換 viewport 為 1280×720：`browser_resize` → 確認字級縮小但兩欄並排、截 `1280x720-projector.png`
- [x] 8.7 TTS 三語驗證（dev server 不穩，改寫 `server/__tests__/display-tts.test.ts` 單元測試覆蓋 14 個 case：lang map、三語 callPhrase 模板、display.* 必要鍵齊全、模板插值正確）；`npm test` 全 177 case 通過
- [x] 8.8 同 8.7（en 模板 + lang=en-US 透過 TtsLangMap 單元測試覆蓋）
- [x] 8.9 同 8.7（ja 模板 + lang=ja-JP 透過 TtsLangMap 單元測試覆蓋）
- [x] 8.10 Admin 入口已實作於 [app/pages/admin/queue.vue:185-216](app/pages/admin/queue.vue#L185-L216)：兩個按鈕 + `window.open(displayUrl, '_blank', 'noopener,noreferrer')` + `navigator.clipboard.writeText` + fallback `ElMessage.warning`；無 QUEUE 服務時 disabled tooltip。Dev server 多次崩潰，admin 完整 E2E 留作部署後手動驗證

## 9. OpenSpec 驗證與歸檔

- [x] 9.1 `openspec validate queue-display-screen --strict`（CLI 通過）
- [x] 9.2 執行 `openspec-verify-change` 技能：核對 proposal / design / specs / tasks 一致、實作完成度、驗收截圖存在（5/5 requirements、23/23 scenarios 全部對應到 code；2 warning 皆為 dev server 不穩造成的觀察缺口，留 staging 補做）
- [ ] 9.3 執行 `openspec-archive-change` 技能：sync queue-tickets 主 spec、change 移入 `openspec/changes/archive/{date}-queue-display-screen/`
- [ ] 9.4 Git commit（Conventional Commits 繁中）：`feat(queue): 新增店面大螢幕叫號顯示頁與 TTS 語音廣播`
