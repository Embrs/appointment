## Context

`merchant-nav-restructure` 完成後排班頁有四個 tab(每週時段 / 單日調整 / 公休日 / 領號時間),四個 panel 元件各自獨立載入資料。使用者測試發現兩個高頻困惑:

1. tab 名稱沒透露「適用哪種服務」,商家不確定該設哪邊
2. 新增資源後沒提示要回服務頁綁定,顧客面與代客預約 dialog 都看不到資源

兩處共通的資料來源是 `service.bookingMode` + `service.resourceIds`,這在 `GetServiceList()` 已經帶回。本變更只需在前端做派生與 hint,不改 schema/API。

## Goals / Non-Goals

**Goals:**
- 商家進排班頁時,第一眼就能判斷該用哪個 tab(透過名稱、圖示、副標)
- 商家設定資源時段時,如果該資源「永遠不會被顧客看到」(未綁服務),系統主動告知
- 商家進資源頁時,能一覽哪些資源是孤兒(未被任何服務綁)
- 三個改進都讀既有資料,**零後端改動**

**Non-Goals:**
- 不重新設計資源/服務的資料關聯(`ServiceResource` 模型保持不變)
- 不自動代商家做綁定(只警告與導引,動作仍需商家確認)
- 不改其他 panel 的內部互動邏輯
- 不為「沒有任何服務」的全新商家設計 onboarding wizard(中央 empty state 提示即可)
- 不動 i18n 之外的文案系統

## Decisions

### Decision 1: Tab 條件顯示的判斷時機 — onMounted 拉一次 `GetServiceList`

排班頁 `schedule/index.vue` 容器層 mount 時 fetch 一次服務清單,計算:
- `hasNonQueueService = services.some(s => s.bookingMode !== 'QUEUE')`
- `hasQueueService = services.some(s => s.bookingMode === 'QUEUE')`

四 tab 的顯示邏輯:
- 「📅 預約時段」「🔧 單日調整」「🚫 公休日」 → `v-if="hasNonQueueService"`
- 「🎟 現場領號時段」 → `v-if="hasQueueService"`
- 若兩者皆無,顯示 empty state,提示去服務頁建立

**為什麼不選**:
- ❌ 「每次切 tab 重新算」 — 服務清單變動頻率低,沒必要重複請求
- ❌ 「依 panel mount 內部各自計算」 — tab 容器層需要這個資訊決定要不要顯示 tab,責任放在容器最自然

### Decision 2: 預設 tab 的後備邏輯

`merchant-nav-restructure` 原本預設 `weekly`(即「預約時段」)。本變更追加:
- 商家**只有** QUEUE 服務 → 預設 `queue-window` tab
- 否則維持預設 `weekly`
- 若 URL 帶不合法 tab → fallback 至**目前可見的第一個 tab**(`weekly` → `overrides` → `holidays` → `queue-window`)

避免商家進來看到「預設 tab 是空的、唯一可用的 tab 反而沒被選」。

### Decision 3: Tab 副標的「影響服務」呈現方式

每個 panel 內最上方副標下,加一行 `.affectsServices`,內含:
- 預約時段 / 單日調整 → 列出所有 `bookingMode !== 'QUEUE' && isActive` 的服務名,以 `,` 分隔
- 公休日 → 顯示「整店」(套用所有服務)
- 現場領號時段 → 列出 `bookingMode === 'QUEUE' && isActive` 的服務名

服務數 > 5 時顯示前 3 + 「等 N 個」摺疊;手機 viewport 直接顯示「影響 N 個服務」+ 可展開查看。

**為什麼**:具象連結比抽象命名更易懂,商家不用反向回想「我有哪些服務是 RESOURCE」。

### Decision 4: 未綁定資源警告的偵測規則

`ScheduleWeeklyPanel` 內,當 `selectedScope !== 'MERCHANT'`(選了某個資源 scope):
- 計算 `boundServiceCount = services.filter(s => s.bookingMode === 'RESOURCE' && s.resourceIds.includes(currentResourceId)).length`
- 若 `boundServiceCount === 0` → 顯示橘色 ElAlert,標題 + 按鈕「前往服務頁綁定」(`<NuxtLink to="/admin/services">`)

警告**不阻擋**操作:商家仍可設定排班(資料會正確存入 DB),只是提醒「目前這些設定對顧客不可見」。

**為什麼不阻擋**:
- 商家可能正在批次設定,先把所有資源時段建好,最後再回服務頁一次綁完
- 強制流程會打斷工作節奏

### Decision 5: 「已綁服務」column 的計算與顯示

`/admin/resources` 表格進 mount 時並行 `GetResourceList` + `GetServiceList`,在客戶端組:
```ts
const boundServicesByResource = computed(() => {
  const map = new Map<string, ServiceItem[]>();
  for (const r of resources.value) map.set(r.id, []);
  for (const s of services.value) {
    if (s.bookingMode !== 'RESOURCE') continue;
    for (const rid of s.resourceIds) {
      const arr = map.get(rid);
      if (arr) arr.push(s);
    }
  }
  return map;
});
```

顯示:
- 有綁:用 `ElTag` 列出服務名,點 tag 跳到 `/admin/services?highlight=<serviceId>`(若 services 頁支援);沒實作 highlight 就只 link 到 `/admin/services`
- 未綁:顯示文字 `— 尚未綁定` + 小 hint「在『服務』頁編輯 RESOURCE 服務時可勾選此資源」

**為什麼客戶端 join**:資料量小(資源 / 服務都通常 <50 筆),省一支後端 endpoint;唯一缺點是若服務數很大會多傳一些 payload,但本場景不會發生。

### Decision 6: i18n key 命名

- `admin.schedule.tab.weekly` 顯示文字改為「預約時段」(zh)/「Booking Hours」(en)/「予約時間」(ja)
- 新增 `admin.schedule.tab.queueWindowFull` = 「現場領號時段」/「On-site Queue Hours」/「来店受付時間」
- 新增 `admin.schedule.affects` 模板:「影響 {n} 個服務:{names}」
- 新增 `admin.schedule.unboundResourceWarning.title / action`
- 新增 `admin.resources.boundServices / boundServicesEmpty`

圖示 emoji 寫在文案中,不獨立 key(emoji 本身是 unicode,跨語系一致)。

## Risks / Trade-offs

- **Risk: emoji 在某些舊瀏覽器/字型下渲染為彩色 vs 黑白不一致** → Mitigation: 用通用 emoji(📅 🔧 🚫 🎟),避免新或複合 emoji;若有用戶反饋可後續換 Element Plus icon
- **Risk: 「影響服務」副標在服務名很長時擠出 layout** → Mitigation: 副標容器 `overflow: hidden; text-overflow: ellipsis`;服務 >5 時摺疊
- **Risk: tab 自動隱藏導致使用者預期「為什麼少一個 tab」** → Mitigation: empty state 文案要明確;切 tab query 帶不合法值時 fallback 第一個可見 tab,不要白屏
- **Risk: `merchant-nav-restructure` 未 archive,specs delta 衝突** → Mitigation: 本變更的 delta 以「ADDED Requirements」為主(新增警告、新增 column、新增 tab 條件規則),需 MODIFIED 既有的「排班 /admin/schedule 預設 tab」「每週時段 tab 內容」「領號時間 tab 內容」三個 scenarios。實作合併時若 `merchant-nav-restructure` 已 sync,直接基於主 spec 加 delta;若還沒,本變更要在 merge 時先確保前者順序在前
- **Trade-off: 客戶端 join services × resources,前端多一次 GetServiceList 請求** → 可接受(資源頁本來就應該知道有哪些服務)
- **Trade-off: 警告不阻擋操作** → 商家可能仍漏綁;接受「告知不強制」的設計
