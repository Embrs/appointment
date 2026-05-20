## Context

`/admin/appointments` 目前是商家後台「看單／處理單」的主要工作頁，但實際業務直覺更靠近行事曆：商家想一眼看當週 / 當日已被填滿的時段、剩下哪些空隙、要不要幫熟客插一筆。現況把列表當預設、行事曆當次要切換頁，且行事曆與列表是兩條獨立路由（`/admin/appointments` 與 `/admin/appointments/calendar`），filter 狀態不共用，切換要重設條件。

代客預約 `DialogAppointmentCreate` 已存在於列表頁右上角，可正常建立，但時段選擇器的 disable 體驗薄弱：
- `s.remaining <= 0` 時 button 變灰、加 `is-full` class，但灰色與正常色差不夠明顯
- 「為什麼這格不能選」沒提示文字（已過？已滿？該日休息？資源停用？容量耗盡？），使用者點下去毫無回饋
- 整日無 slot（holiday / override.isClosed）會回 `[]` + 顯示「請先選服務／資源／日期」，誤導使用者以為自己沒選齊條件

本 change 重整這三件事在同一個視覺脈絡。

## Goals / Non-Goals

**Goals**:
- `/admin/appointments` 預設視圖為行事曆，列表與行事曆共用 filter，狀態不丟
- 代客預約有 3 種入口：右上角按鈕、行事曆空白格點擊、Dialog 內可預填
- 不可選時段在 Dialog 與行事曆兩處都有明確視覺標示與「為什麼不可選」說明
- 完全不動 Prisma schema，部署即生效

**Non-Goals**:
- 不引入新的「故障 / 維護中」資料模型（如 `TimeSlotBlock`、`ResourceOutage`），完全使用既有 `Holiday` + `ScheduleOverride.isClosed` + `isActive` + 容量計算
- 不改顧客面 `/m/[slug]/book` 的 slot UI（雖然 `reason` 欄位會同樣回傳，但顧客面這次不消費它）
- 不做行事曆內的拖拉移動（DnD reschedule），這是另一個 change
- 不做多週 / 月視圖（目前 calendar 只有週/日）

## Decisions

### D1：同頁 toggle vs 雙路由

**選擇**：同頁 toggle，`view` 用 query string 持久化（`?view=calendar | list`），預設 `calendar`

**理由**：
- 共用 filter 區域，切換不重設條件，符合使用者「換個角度看同一筆資料」直覺
- query string 持久化讓重整 / 分享連結保留視圖；但不污染 history（用 `router.replace`）
- 原 `/admin/appointments/calendar` 改為 client middleware redirect 到 `?view=calendar`，舊書籤不斷

**替代方案**：
- 雙路由 + Pinia 共享 filter：要新增 store 跟 watch，且重整時行為複雜 → 否決
- 用 hash（`#calendar`）：對 SSR 不友善 → 否決

### D2：「故障 = 不可選原因」用 `Slot.reason` 表示

**選擇**：在 `Slot` 型別新增 optional `reason: 'past' | 'taken' | 'capacity' | 'closed' | 'holiday' | 'inactive'`；`buildSlots` 純函式輸出時設置，整日無營業仍回 `[]`

**理由**：
- 後端純函式可單測；前端無需重複判斷「為什麼這格 remaining=0」
- `reason` 是可選欄位，既有顧客面前端不消費也不會壞
- 避免新增 schema：所有 reason 都能從既有資料（CONFIRMED appointments、isActive、isClosed、Holiday、now）推導
- `holiday` 與 `closed` 的整日情境仍回 `[]`（reason 只在「有 slot 但不可選」生效，避免把當日 X 個小時都塞進回應）

**例外情境分類**：

| reason | 觸發條件 | 後端設置時機 |
|--------|---------|------------|
| `past` | `startAt < now()` | `buildSlots` 收到 `now` 比較 |
| `taken` | `bookingMode=TIME_SLOT` 或 `RESOURCE`，occupied=1 | `computeAvailability` 帶入 occupiedMap |
| `capacity` | `bookingMode=TIME_CAPACITY`，occupied>=capacityPerSlot | 同上 |
| `closed` | override 部分日時段但該 slot 落在 override 外的營業時段（罕見邊界，多半已被 `[]` 處理） | `buildSlots` 內 |
| `holiday` / `inactive` | 整日不營業或資源停用 | 整日回 `[]`，不在此使用 |

實際上常用的就是 `past / taken / capacity` 三種；`closed` 保留為邊界 reason。

**替代方案**：
- 純前端從 `remaining + startAt + now` 推 reason：邏輯重複、無單測 → 否決
- 新增 `TimeSlotBlock` model：改 schema、需要 migration、需要前後台 UI 維護「故障時段」清單，遠超出本 change 範圍 → 否決

### D3：行事曆空白格點擊建立 — Dialog 預填策略

**選擇**：點空白格 emit `click-empty-cell({ date, startAt? })`；Dialog 接受 `prefillDate / prefillStartAt / prefillServiceId / prefillResourceId`，但**不**預選 service —— service 是必選且影響 slot 計算，預選反而誤導

**理由**：
- 日視圖能精確到「某 hour」，週視圖只能到「某日」 → 用 optional `startAt`
- 預填 date 後使用者仍需手動選 service / resource（service 決定了 slot 切割規則）；選完後 `ApiLoadSlots` 自動跑、回的 slots 內若有對應 `startAt` 就高亮為 active
- 若 `prefillStartAt` 對應的 slot 因任何 reason 不可選，Dialog 顯示為一般不可選樣式 + 在頂部加一條提示「您點選的 14:00 時段目前不可用，原因：已預約」

**替代方案**：
- 點空白格直接 `POST /nuxt-api/appointment`：完全沒選 service 怎麼建？→ 否決
- 預選 service（用最近一次的）：邏輯複雜且容易出錯 → 否決

### D4：Dialog 內是否內嵌行事曆視圖選時段

**選擇**：**暫不採用**「Dialog 內嵌行事曆」這個選項，改用「強化現有 slot 按鈕牆」+ 行事曆空白格點擊預填 + Dialog 仍是 slot 列表

**理由**：
- 雖然使用者勾選了這選項，但工程權衡：
  - 行事曆視圖選 slot UX 在 Dialog 這種小空間（520px width）會擠，視覺品質掉
  - 既有 `BizAppointmentCalendar` 拉進 Dialog 需要顯著重構（current 是頁面尺寸佈局）
  - 「點空白格預填 + 強化 slot reason 提示」已能覆蓋 80% 體驗痛點
- 折衷做法：日期欄改為 `ElDatePicker` + 「在行事曆中選日期」連結（一鍵切換到行事曆視圖）

**這點需要回頭與使用者確認**（見 Open Questions）

### D5：行事曆空白格 vs 不可營業時段視覺區分

**選擇**：
- **可建立空檔**（營業中、無預約、無 reason）：淺白底 + hover 高亮 + 游標 pointer，點擊 emit
- **不可營業時段**（holiday / closed / 排班外）：斜紋背景（`repeating-linear-gradient`）+ 游標 default + 不 emit
- **被占用時段**：原本就有 BizAppointmentCalendar 卡片渲染，維持現狀
- **資源停用**：在週/日視圖頂部顯示橫幅「此資源已停用，僅供查看歷史」（若使用者用 filter 選了 inactive 資源）

### D6：reason 的 i18n 文字統一存放

**選擇**：放在 `i18n/locales/{zh,en,ja}.js` 的 `slot.reason` namespace 下：

```js
slot: {
  reason: {
    past: '已過時段',
    taken: '已被預約',
    capacity: '已額滿',
    closed: '本時段休息',
    holiday: '本日休假',
    inactive: '資源停用'
  }
}
```

前端 `useReasonLabel(reason)` composable 包一層 `useI18n`，Dialog 和行事曆共用。

### D7：測試策略

**後端**：擴充 `server/__tests__/availability.test.ts`
- `buildSlots` 純函式 + `now` 參數 → 對應 `past` reason
- `buildSlots` 帶 `occupiedMap` → `taken` / `capacity` reason

**前端**：用 Playwright MCP 實際操作（驗收條件要求）
- 進入 `/admin/appointments` 預設停在行事曆
- 切到列表後重整，view 應記住
- 點空白格開 Dialog 並驗證 `prefillDate`
- 製造「已滿」情境（手動建一筆預約），確認 Dialog 內該 slot 顯示「已被預約」badge + tooltip + 不可點

## Risks / Trade-offs

| Risk | Mitigation |
|------|-----------|
| `Slot.reason` 是新增欄位，TypeScript 型別在前後端不同步可能引發 build error | `app/protocol/.../availability/type.d.ts` 與 `server/utils/availability.ts` 統一從 shared 型別匯入；新欄位設 optional 不影響舊呼叫端 |
| 同頁 toggle 後 URL 變 `?view=calendar`，舊書籤 `/admin/appointments/calendar` 失效 | `app/pages/admin/appointments/calendar.vue` 改寫為 `<script setup>` 內 `useRouter().replace('/admin/appointments?view=calendar')`，舊連結自動 redirect |
| 行事曆預設後，過去快速翻列表的使用者會抱怨多一步切換 | toggle 在 header 右上、預設高亮 calendar 但保留快速切換；query 持久化下次造訪會記得使用者選擇（若手動切過就停在 list） |
| `reason` 翻譯字串新增可能漏 ja/en | 既有 i18n 結構強制三語對齊（i18n loader 會 warn 缺 key）；PR review 時對照三檔 |
| Dialog 在點空白格場景因 prefill 自動載 slot 但使用者還沒選 service → 不會載 | Dialog 邏輯保持「service 必選才載 slot」，prefillDate 在 service 選定後才生效；UI 上加引導文字「請先選服務」 |
| 後端 `reason` 計算多走一輪 `occupied` 對照可能影響效能 | 既有 `computeAvailability` 已經有 occupiedMap，reason 只是順手帶出；無新查詢 |

## Migration Plan

**本 change 不涉及 Prisma migration**。部署順序：

1. 後端先部署：`Slot.reason` 為 optional，舊版前端不消費即可
2. 前端後部署：同時利用 `reason` 顯示新 UI
3. 部署中即使前後端版本錯位也不會 break：
   - 舊前端 + 新後端：`reason` 欄位被忽略，UI 表現同舊版
   - 新前端 + 舊後端：`reason` 為 undefined，前端 fallback 為「已滿」通用提示

**Rollback**：revert commit 即可，無 DB schema 變更。

**測試站 / 正式站同步**：純程式碼部署 → CI/CD 既有流程直接覆蓋，不需要額外資料同步腳本或修復程式。

## Open Questions

1. **D4 折衷與使用者期待落差**：使用者勾選了「Dialog 內直接顯示行事曆視圖選時段」，但本 design 暫緩此項以控制範圍。需要確認是否接受用「點空白格預填 + slot 牆強化」替代？若必須做 Dialog 內嵌行事曆，預估多 2~3 個工作天且需要重構 `BizAppointmentCalendar` 為可嵌入元件 → **建議先做本 change 範圍，Dialog 內嵌行事曆獨立另開 change**
2. **行事曆是否要新增「月視圖」？** 目前只有週/日；商家若想看整月，仍只能切日期前後翻。本次不做，列為後續增強
3. **`reason='closed'` 是否真的會在實作中觸發？** 邊界條件分析下幾乎不會（整日 closed 已回 `[]`），但保留 enum 值為未來「半日休」做準備
