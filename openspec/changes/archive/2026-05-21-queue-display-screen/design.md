## Context

「店面大螢幕叫號顯示頁」是現場用戶改善計畫（calm-imagining-coral.md）的第四個變更，前置條件 walk-in-ticket-creation（A）與 queue-eta-display（B）皆已歸檔，與 queue-claim-token-qr（C）為平行 change，互不依賴。

現況：
- `app/stores/7.store-queue-realtime.ts` 已實作 WS + 15s 輪詢雙軌，`serviceMap[serviceId]` 內含 `currentServing / servingTicketId / avgServiceMinutes / lastEventAt`；payload 已含 `nextWaitMinutes`。
- `server/routes/nuxt-api/public/m/[slug].get.ts` 已可在無認證下回 merchant + services + queue counter 狀態（公開頁基底）。
- `app/layouts/front-desk.vue` 是顧客面 layout，含固定 header（商家名 + 語系切換），目前不支援隱藏 chrome。
- 專案無 QR Code 套件、無 TTS 用例；i18n 設定為 zh/en/ja 三語並可用 `useI18n().locale`。

限制：
- 不可變動 Prisma schema 或任何 `server/routes/nuxt-api/**` 端點（純前端 change）。
- 不可破壞 Change A/B 已交付行為；不可預設依賴 Change C 的成果。
- 大螢幕裝置可能是舊平板/瀏覽器（iPad Safari、Android WebView、舊 Chromium），需要降級設計：TTS 不支援時靜默不報錯；WS 斷線時依靠既有 fallback 輪詢繼續更新。
- 商家投影裝置常無人值守，頁面需可長時間運行不洩漏記憶體、不彈出原生對話框。

利害關係人：商家現場員工（投影設定者）、現場顧客（被動讀者）、admin 後台（入口提供者）。

## Goals / Non-Goals

**Goals:**

- 提供 `/m/{slug}/display` 全螢幕頁，遠距 3–5 公尺可清楚看到「目前叫號」與「下一位」。
- 完全複用既有 WS + ETA 廣播，不新增任何後端端點或 DB schema 變更。
- 提供可選 TTS 廣播（zh/en/ja），可由商家在頁面 toolbar 即時切換，狀態存 localStorage。
- 從 admin 後台 `app/pages/admin/queue.vue` 一鍵開新分頁進入顯示頁。
- 響應式覆蓋 1920×1080（主）、1280×720（小投影）、768×1024（直立平板）三個目標斷點。

**Non-Goals:**

- 不做多服務輪播或多商家聚合顯示（單頁鎖一個 slug，多服務同時在畫面上以分欄呈現即可，不做時間輪播）。
- 不做廣告 / banner / 行銷素材插入（保持資訊密度低、可讀性高）。
- 不做後端「目前 display 連線數」遙測（純前端、無 server 介入）。
- 不做認證或私有化（display 頁就是公開頁，使用既有 m/[slug] 的公開資料）。
- 不做 PWA / 離線模式。
- 不引入新後端依賴；QR 功能改用既有方式或退而以可複製 URL 取代（見 Decision 5）。

## Decisions

### Decision 1：Layout 採「同檔擴充 prop」而非新增 layout

- **選擇**：在 `app/layouts/front-desk.vue` 加 `displayMode` prop（或頁面用 `definePageMeta({ layout: 'front-desk', layoutProps: { displayMode: true } })`）。`displayMode=true` 時不渲染 header、不套用 60px top padding、背景改為深色高對比。
- **理由**：避免新增 `display.vue` 層級的第三個 layout、避免和顧客面（`m/[slug]/queue/*`）配置漂移；display 頁屬於 `m/[slug]/*` 公開區，邏輯上仍是 front-desk 子集（無認證、共享 slug param）。
- **替代方案**：
  - 「新增 `layout: false`，全部自繪」→ 失去 layout 一致性，未來新增公共行為（如 sentry context）需重複實作。
  - 「新增 `display.vue` layout」→ 過度切割；display 與 front-desk 共享 i18n / slug 解析邏輯。

### Decision 2：頁面區塊與資料來源

- **左半（≈60% 寬）**：目前叫號號碼，字級 ≥ `clamp(160px, 18vw, 280px)`，下方顯示服務名稱。資料來源 `StoreQueueRealtime.serviceMap[activeServiceId]`。
- **右半（≈40% 寬）**：垂直三欄堆疊
  - 「下一位」：取 `WAITING` 票最小號碼（透過 `useFetch` 對 `public/m/[slug]` 取一次 services snapshot，之後仰賴 WS 推 `TICKET_TAKEN/CALL_NEXT` 更新本地推算值）。
  - 「再下一位」：第二小 WAITING 號碼。
  - 「等待人數 / 預估等待」：合併卡片，等待人數=WAITING 票數、預估等待=`waitingAhead * avgServiceMinutes`（用既有 `estimateWaitMinutes`，store 已 re-export）。
- **多服務處理**：若該商家當日多服務同時開放 QUEUE，display 頁用 query string `?serviceId=xxx` 鎖一個服務；無 query 則自動選「當日有 WAITING 且 currentServing 最小」者。Toolbar（懸停才顯示，2s 後自動隱藏）提供服務切換下拉。
- **理由**：避免在大螢幕上塞多欄輪播導致長者看不懂；query 顯式鎖定服務、商家可同時開多個 tab 分別投影不同服務。

### Decision 3：CALL_NEXT 動畫

- **觸發**：StoreQueueRealtime 已有 `lastEventAt`；在 display 頁 watch `serviceMap[activeServiceId].currentServing` 變化，新值非空且大於舊值時播一次動畫（CSS `@keyframes` 0.6s ease-out：scale 1→1.08→1 + 顏色由白→主題色→白）。
- **理由**：純 CSS 不引入額外 lib；watch 而非訂閱 WS event 可以保證 WS / 輪詢兩條路徑都會觸發（避免重複處理）。
- **替代方案**：「訂閱 store 內 raw WS message」→ 需要 store 額外暴露 event bus、且 fallback 輪詢路徑不會觸發。

### Decision 4：TTS 語音廣播

- **API**：`window.speechSynthesis.speak(new SpeechSynthesisUtterance(text))`，lang 跟隨 `useI18n().locale`（zh-TW / en / ja）。
- **觸發**：與 Decision 3 動畫同源（watch currentServing 變化）；text 由 i18n `display.tts.callPhrase` 帶 `{ number, serviceName }` 渲染。
- **開關**：toolbar 一個 toggle，狀態存 `localStorage.queueDisplayTts = '1' | '0'`；預設關閉（避免商家初次打開頁面被嚇到）。
- **降級**：偵測 `typeof window.speechSynthesis === 'undefined'` 時 toggle 變灰、tooltip 顯示「此瀏覽器不支援 TTS」。
- **節流**：同一 currentServing 不重複念（用 ref 記上一次播報的號碼）；切換服務時清空狀態。
- **理由**：完全 client-only、零 server 成本、三語通用；瀏覽器 voices 不在我們可控範圍，但 lang attribute 已足夠讓系統挑預設 voice。
- **替代方案**：「預錄音檔」→ 需要 R2 + 動態號碼合成、複雜度遠超本 change 範圍。

### Decision 5：QR Code 入口為 P2（不阻擋本 change 完成）

- **必做**：admin queue 頁 toolbar「開啟顯示頁」按鈕（新分頁 `window.open(/m/{slug}/display)`）。
- **可選（P2）**：QR Code 彈窗。若 Change C（queue-claim-token-qr）已引入 QR Code 元件/套件，display 頁的 admin 入口會在按鈕旁加一個「掃描」icon 開彈窗顯示 QR；若 Change C 未引入，則改用「複製連結」按鈕（`navigator.clipboard.writeText`）+ 顯示完整 URL 文字。
- **理由**：保持本 change 不依賴 Change C，並避免為了一個小功能新增 QR 套件。
- **驗收**：tasks 標 P2，verify 階段以「複製連結」為 baseline 接受。

### Decision 6：i18n 命名空間

```
display.calling          # "現在叫號"
display.next             # "下一位"
display.nextAfter        # "再下一位"
display.waiting          # "等待中"
display.waitingPeople    # "{count} 人"
display.estimate         # "預估等待"
display.minutes          # "{n} 分鐘"
display.noService        # "目前無服務開放"
display.allDone          # "今日已完成所有號碼"
display.tts.toggle       # "語音廣播"
display.tts.on           # "語音廣播：開"
display.tts.off          # "語音廣播：關"
display.tts.unsupported  # "此瀏覽器不支援語音"
display.tts.callPhrase   # "請 {number} 號到 {serviceName}"  (en: "Number {number} to {serviceName}, please." / ja: "{number}番、{serviceName}へお越しください")
display.openDisplay      # "開啟顯示頁"
display.copyLink         # "複製顯示頁連結"
display.linkCopied       # "已複製"
```

### Decision 7：響應式策略

- 主要尺寸用 `vw / vh / clamp()` 字級；不用 media query 做大改版，僅在 ≤ 1023px 寬時改為「上下兩欄」（目前叫號在上佔 55vh、其餘卡片在下橫排）。
- 1920×1080 設計基準；1280×720 用 `clamp(120px, 18vw, 280px)` 自動縮小數字；768×1024 觸發直立排版。

## Risks / Trade-offs

- **Risk: TTS 在 iOS Safari 需要 user gesture 才能首次發聲** → Mitigation：toolbar toggle 預設關，使用者點開 toggle 的當下立刻 `speak('')` 一次空字串完成「解鎖」；之後自動 watch 觸發即可。
- **Risk: 長時間運行的 SPA 記憶體洩漏** → Mitigation：display 頁 unmount 時呼叫 `StoreQueueRealtime.Disconnect()`；不用 setInterval 自寫輪詢（沿用 store 既有節流邏輯）。
- **Risk: 多服務同時叫號時 TTS 互相覆蓋** → Mitigation：display 頁鎖單一 serviceId（Decision 2）；TTS 廣播只針對 active 服務。
- **Risk: 大螢幕投影設備可能無音訊輸出** → Mitigation：TTS 預設關閉、商家需主動開啟（避免靜音時誤以為 TTS 故障）。
- **Risk: i18n locale 與 TTS lang 對應錯誤（zh 對應 zh-TW vs zh-CN）** → Mitigation：寫死映射表 `{ zh: 'zh-TW', en: 'en-US', ja: 'ja-JP' }`，不依賴瀏覽器自動猜測。
- **Risk: query 切換 serviceId 時動畫殘留** → Mitigation：watch serviceId 變化時 reset 動畫 ref 與 lastSpokenNumber。
- **Trade-off**：不做服務輪播 → 多服務商家需要開多個 tab 投影。決定優先「單頁高可讀」勝過「單頁多服務輪播」，因為長者讀取輪播內容更困難。

## Migration Plan

- 純前端、無 DB / API / cron 變更，**不需 migration**。
- 部署順序：
  1. Merge change → CI 跑 lint + vitest（純函式 / store 邏輯）。
  2. 部署 dev / staging，商家內測。
  3. 部署 production。
- Rollback：直接 revert PR；無資料殘留、無破壞性 schema 變更。
- 既有 `/m/{slug}/*` 顧客頁不受影響，front-desk layout 的 `displayMode` 預設 false，向下相容。

## Open Questions

- Q1: 服務切換下拉是否需要「全部服務輪播」選項？（暫定不做，見 Non-Goals；若內測強烈要求再加）
- Q2: TTS 文案是否需要「叫號 3 次」（叫到沒人應的常見場景）？暫定只播一次；後續若商家回報「沒聽到」可加重播按鈕。
- Q3: 是否要在 display 頁底部加「等待中號碼清單」橫排（如機場叫號板）？目前 Decision 2 只顯示「下一位 / 再下一位」，若內測覺得資訊不足可在後續 change 擴增。
