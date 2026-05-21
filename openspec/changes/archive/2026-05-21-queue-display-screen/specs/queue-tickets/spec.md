## ADDED Requirements

### Requirement: 店面大螢幕公開顯示頁

The system SHALL provide a public, full-screen queue display page at `/m/{slug}/display` for in-store TV / tablet projection, showing the currently-served number, next ticket, ticket-after-next, total waiting count, and estimated wait time, without requiring authentication and without introducing new backend endpoints. The page SHALL reuse the existing public merchant snapshot endpoint (`/nuxt-api/public/m/{slug}`) for initial state and the existing `StoreQueueRealtime` WebSocket + polling stream for live updates.

#### Scenario: 公開存取顯示頁

- **GIVEN** 商家 status=ACTIVE、有至少一個 `bookingMode=QUEUE` 的服務
- **WHEN** 任何裝置（無 cookie / token）瀏覽 `/m/{slug}/display`
- **THEN** 頁面以全螢幕模式渲染，無 header 與 footer chrome；左半顯示「目前叫號」大字（字級 ≥ `clamp(160px, 18vw, 280px)`）；右半顯示「下一位 / 再下一位 / 等待人數 / 預估等待」

#### Scenario: 商家停用或暫停

- **GIVEN** 商家 status≠ACTIVE 或 slug 不存在
- **WHEN** 瀏覽 `/m/{slug}/display`
- **THEN** 沿用 `/m/{slug}` 公開頁的相同錯誤行為（404 或停用提示頁），不額外開放資料

#### Scenario: 無 QUEUE 服務

- **GIVEN** 商家所有服務皆 `bookingMode=TIME_SLOT`
- **WHEN** 瀏覽 display 頁
- **THEN** 畫面顯示 `display.noService`「目前無服務開放」訊息，不渲染叫號區塊

#### Scenario: 當日結束所有號碼

- **GIVEN** 當日 WAITING 票數=0、所有票皆 DONE/SKIPPED
- **WHEN** 瀏覽 display 頁
- **THEN** 目前叫號區顯示 `display.allDone`「今日已完成所有號碼」；等待人數=0、預估等待=0

### Requirement: 即時更新與 CALL_NEXT 動畫

The system SHALL update the display page within 1 second of a `CALL_NEXT` / `TICKET_TAKEN` / `TICKET_DONE` / `TICKET_SKIPPED` broadcast from the existing queue WebSocket, by subscribing through `StoreQueueRealtime`. When the `currentServing` number transitions to a new value, the display page SHALL play a short visual animation (CSS keyframes, ≤ 0.6 second) to draw attention.

#### Scenario: 商家叫號後即時更新

- **GIVEN** display 頁已 mounted、`StoreQueueRealtime` 已 Connect 該 merchantId
- **WHEN** 商家從另一個 tab 觸發 `POST /nuxt-api/queue/call-next` 成功
- **THEN** display 頁在 1 秒內將「目前叫號」更新為新號碼，並播放一次 ≤ 0.6 秒的縮放/顏色動畫

#### Scenario: 顧客拿號後等待人數更新

- **GIVEN** display 頁顯示等待人數=3
- **WHEN** 顧客成功 `POST /public/queue/take` 拿到新號碼
- **THEN** display 頁在 1 秒內將等待人數更新為 4，「再下一位」號碼隨之更新；不播放叫號動畫

#### Scenario: WS 斷線時 fallback 輪詢

- **GIVEN** display 頁開啟、WS 因網路抖動斷線進入 `fallback` 狀態
- **WHEN** 商家在斷線期間叫號
- **THEN** display 頁依靠 `StoreQueueRealtime` 既有 15 秒輪詢更新「目前叫號」（最差 15 秒延遲），動畫照觸發

#### Scenario: 同號碼不重複動畫

- **GIVEN** 目前叫號=5
- **WHEN** WS 因重連送來重複的 `CALL_NEXT { current: 5 }`
- **THEN** 顯示頁不重播動畫（以 currentServing 值變化而非 event 數量為觸發來源）

### Requirement: TTS 語音廣播（可選）

The system SHALL provide an optional Text-to-Speech voice announcement using `window.speechSynthesis`. The toggle SHALL be off by default and SHALL persist its state in `localStorage`. When enabled, the system SHALL announce each new `currentServing` number once, in the current i18n locale (zh → `zh-TW`, en → `en-US`, ja → `ja-JP`), using the phrase template `display.tts.callPhrase` with `{number, serviceName}` interpolation. The feature SHALL degrade gracefully when `window.speechSynthesis` is unavailable.

#### Scenario: TTS 預設關閉

- **GIVEN** 商家第一次開啟 display 頁、localStorage 無 `queueDisplayTts` 鍵
- **WHEN** 商家叫號
- **THEN** display 頁播放視覺動畫但不發聲；toolbar TTS toggle 呈現「關」狀態

#### Scenario: 開啟 TTS 後叫號廣播（zh-TW）

- **GIVEN** locale=zh、TTS toggle=on、localStorage.queueDisplayTts='1'
- **WHEN** 商家叫號到 5 號、服務名稱="洗髮"
- **THEN** 瀏覽器執行 `speechSynthesis.speak(...)`，utterance.lang='zh-TW'、文字為「請 5 號到 洗髮」（template `display.tts.callPhrase`）

#### Scenario: 切換語系後 TTS 跟隨

- **GIVEN** TTS 開啟、目前叫號=7
- **WHEN** 商家於 toolbar 切換 locale 為 ja
- **THEN** 下次叫號（號碼=8）廣播時 utterance.lang='ja-JP'、文字使用日文 `display.tts.callPhrase`

#### Scenario: 瀏覽器不支援 TTS 時降級

- **GIVEN** 裝置瀏覽器 `typeof window.speechSynthesis === 'undefined'`
- **WHEN** 商家開啟 display 頁
- **THEN** TTS toggle 顯示為禁用、tooltip 顯示 `display.tts.unsupported`；頁面其他功能（顯示、動畫）正常運作，不拋例外

#### Scenario: 同號碼不重複廣播

- **GIVEN** TTS 開啟、目前叫號=5、已廣播過 5 號
- **WHEN** WS 因重連再次送出 `CALL_NEXT { current: 5 }`
- **THEN** display 頁不重複呼叫 `speechSynthesis.speak`

#### Scenario: 切換服務時清空 TTS 狀態

- **GIVEN** TTS 開啟、active serviceId=A、最後廣播號碼=5
- **WHEN** 使用者透過 query string 或 toolbar 切換到 serviceId=B（當前叫號=3）
- **THEN** display 頁不立即廣播 B 的 3 號（避免切換瞬間突發語音）；待 B 服務下次 currentServing 變化時才廣播

### Requirement: Admin 顯示頁入口

The system SHALL provide a button in the admin queue page (`/admin/queue`) toolbar that opens `/m/{slug}/display` in a new browser tab. The admin entry SHALL be visible to authenticated merchants and SHALL NOT require any new permission or RBAC rule beyond the existing admin queue page guard.

#### Scenario: Admin toolbar 出現「開啟顯示頁」按鈕

- **GIVEN** 商家已登入、進入 `/admin/queue`
- **WHEN** 頁面渲染
- **THEN** toolbar 顯示一個 `display.openDisplay`「開啟顯示頁」按鈕

#### Scenario: 點擊按鈕開新分頁

- **GIVEN** 商家在 `/admin/queue`、slug=acme
- **WHEN** 點擊「開啟顯示頁」按鈕
- **THEN** 瀏覽器執行 `window.open('/m/acme/display', '_blank')`，原頁面不導航

#### Scenario: 複製顯示頁連結

- **GIVEN** 商家在 `/admin/queue`
- **WHEN** 點擊「開啟顯示頁」按鈕旁的「複製連結」icon
- **THEN** `navigator.clipboard.writeText(displayUrl)` 執行成功、出現 `display.linkCopied` toast

### Requirement: 響應式顯示

The system SHALL render the display page legibly on 1920×1080 (primary target), 1280×720 (small projector), and 768×1024 (portrait tablet) resolutions, without horizontal scroll and without content clipping. Font sizes SHALL scale via `vw / clamp()` rather than fixed pixels.

#### Scenario: 1920×1080 橫向標準大螢幕

- **GIVEN** viewport=1920×1080
- **WHEN** 渲染 display 頁
- **THEN** 目前叫號字級 ≥ 240px、左右兩欄並排（≈60/40 分配），無水平捲軸

#### Scenario: 1280×720 小投影機

- **GIVEN** viewport=1280×720
- **WHEN** 渲染 display 頁
- **THEN** 目前叫號字級自動縮小至 ≥ 160px、左右兩欄仍並排，無內容裁切

#### Scenario: 768×1024 直立平板

- **GIVEN** viewport=768×1024
- **WHEN** 渲染 display 頁
- **THEN** 切換為「上下兩欄」排版（目前叫號在上佔約 55vh、其餘卡片在下橫排），字級自動調整、無水平捲軸
