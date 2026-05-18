# fix-customer-booking-ux — Design

## Context

顧客面 `/m/{slug}/*` 是首版 SaaS 對外的唯一公開介面。實機檢視四項 UX 缺陷的成因都已盤點清楚（見 proposal.md），全部位於 `app/` 前端，與後端／資料模型完全脫鉤。

現況關鍵碼位：

| 區塊 | 位置 | 問題 |
|------|------|------|
| 號碼牌按鈕 | `app/components/biz/ServiceCard.vue:46` | `:disabled="bookingMode === 'QUEUE'"` |
| 卡片底部 | `app/components/biz/ServiceCard.vue:104` | `.__footer` 缺 `margin-top: auto` |
| 日期 strip | `app/components/biz/DatePickerStrip.vue` | 14 天橫向、無跨月 |
| 步驟條手機 | `app/pages/m/[slug]/book.vue:441` | `.stepLabel { display: none }` |
| 步驟圓圈字 | `app/pages/m/[slug]/book.vue:358-367` | 純文字節點繼承 `currentColor` |
| 語系按鈕 | `app/layouts/front-desk.vue:6` | `ClickSwitchLocale` 為空 TODO |
| 語系 icon | `app/layouts/front-desk.vue:20` | 怪字符 `⌐` |

i18n 模組已在 `nuxt.config.ts` 配妥（zh/en/ja，cookie key `i18n_redirected`，`redirectOn: 'root'`）；缺的只是頁面 UI 接線。

## Goals / Non-Goals

**Goals:**
- 顧客首頁所有服務卡片按鈕**對齊到卡片底部**、QUEUE 服務點擊**可進入領號頁**。
- 預約步驟「日期」改成**月曆 grid**，支援跨月切換、明確標示 today/disabled。
- 預約步驟條**手機版**可看到目前進度（圓圈內數字 + 簡短 label）。
- 語系切換**可運作**、外觀符合 Element Plus 風格、icon 不再是怪字符。
- 所有改動可由 Playwright MCP 在 1024 與 375 寬度雙重驗證。

**Non-Goals:**
- 不重畫整個顧客面視覺、不換配色、不改 hero 卡。
- 不動 Prisma schema、不增 API、不改後端 availability 演算法。
- 不引入新 UI library（純用既有 Element Plus + Nuxt Icon）。
- 不解決使用者另提的「部署時資料庫自動同步」議題（本次無 schema 變更，該議題建議獨立 change 處理）。

## Decisions

### D1：QUEUE 服務按鈕走「分流 emit」而非「同 click-book 走父頁判斷」

`BizServiceCard` 新增 `click-queue` event：

```vue
<ElButton
  v-if="service.bookingMode === 'QUEUE'"
  type="primary"
  @click="emit('click-queue', service.id)"
>{{ $t('booking.nav.takeNumber') }}</ElButton>
<ElButton
  v-else
  type="primary"
  @click="emit('click-book', service.id)"
>{{ $t('booking.nav.bookNow') }}</ElButton>
```

父頁 `m/[slug]/index.vue`：

```ts
const ClickQueue = (serviceId: string) =>
  navigateTo(`/m/${slug.value}/queue?serviceId=${serviceId}`);
```

**為何不用同一 event 在父頁分流**：保持元件層的語意清晰，父頁不需要再讀 `service.bookingMode`。元件僅消費 props 並 emit 對應動作。

**備案**：保留單一 `click-book` event、父頁讀 `services.find(...).bookingMode` 再分流。劣勢是父頁要重複維護枚舉判斷，且預約步驟頁（`book.vue`）裡也用此元件，需要再做一次過濾，容易漏。

### D2：卡片排版用 `flex column` + `margin-top: auto` 將 footer 釘底

```scss
.BizServiceCard {
  display: flex;
  flex-direction: column;
  gap: 8px;
  height: 100%; // 撐滿 grid 給的高度
}
.BizServiceCard__footer {
  margin-top: auto;
}
```

父層 grid (`PageMerchantHome__grid`) 已是 `repeat(auto-fill, minmax(260px, 1fr))`，子卡片預設會被同列拉到相同高度；只要卡片自身是 `flex-column` + `footer margin-top:auto`，footer 就會對齊。

### D3：新增 `BizDatePickerCalendar` 元件，**不**沿用 Element `ElCalendar`

```
┌───────────────────────────────┐
│   ◀  2026 年 5 月  ▶          │  ← month header
├───┬───┬───┬───┬───┬───┬───────┤
│日 │一 │二 │三 │四 │五 │六     │  ← weekday labels
├───┼───┼───┼───┼───┼───┼───────┤
│   │   │   │   │   │ 1 │ 2     │  ← grid 7×N
│ 3 │ 4 │ 5 │ 6 │ 7 │ 8 │ 9     │
│...│...│...│...│...│...│...    │
└───┴───┴───┴───┴───┴───┴───────┘
```

**Props 介面**（與 `BizDatePickerStrip` 對齊以利平滑替換）：

```ts
interface DatePickerCalendarProps {
  modelValue: string;             // YYYY-MM-DD
  minDate?: string;               // 預設 = 今天
  maxDate?: string;               // 預設 = 今天 + 60 天
  disabledDates?: string[];
}
type Emit = { 'update:modelValue': [date: string] };
```

行為：
- 預設顯示 `modelValue` 所在月份（無值則顯示當月）。
- 跨月格子用低透明度灰階（`opacity: 0.35`），點擊會切到該月並選日。
- `today` 加角標「今」（與 strip 一致）。
- `disabled`（不在 `[minDate, maxDate]` 區間或在 `disabledDates`）：不可點。
- 手機版（≤ 640px）：格子縮為正方形，最小寬 38px；月份切換鈕加大觸控區。

**為何不用 ElCalendar**：
- ElCalendar 是「整月固定 31 格＋顯示廣告位」風格，外觀不易調整到我們的卡片設計、文案在地化要 override slot，反而比自寫複雜。
- 自寫 < 200 行，可用 `@@/utils/availability` 同樣的純函式 + 純前端 dayjs 邏輯（已是專案標準）。

**備案 1（保留 strip）**：兩個元件並存，PageBook 用 Calendar、其他可能需要橫條的地方繼續用 strip。**採用**。
**備案 2（刪 strip）**：直接刪掉 `BizDatePickerStrip`。**不採用**，避免動到本次需求外的呼叫者（之後若無人用再刪）。

### D4：PageBook 步驟「date」與「slot」的 UI 編排

```
step=date：           step=slot：
┌───────────┐         ┌───────────┐
│ 月曆 grid │         │ 月曆 grid │ ← 同元件、modelValue 共享
└───────────┘         ├───────────┤
                      │ 時段網格   │
                      └───────────┘
```

- 兩個 step 都使用同一個 `BizDatePickerCalendar` 實例（`v-model="form.date"`），watch `form.date` 重新拉 slot（既有邏輯不動）。
- 不再把日期選擇與時段網格擠在一起；step=date 階段純選日，按「下一步」進 step=slot 再顯示 slot grid（沿用既有邏輯，僅替換內層日期元件）。

### D5：步驟條 CSS 修正

問題：`.PageBook__stepNum` 用 `background-color: currentColor`，內部純文字節點繼承 `color: currentColor` → 字與底同色。`> * { color: $white }` 只對 element 子節點生效，純文字節點選不到。

修法（簡單直接）：

```scss
.PageBook__stepNum {
  width: 22px;
  height: 22px;
  background-color: currentColor;
  color: $white;        // ✅ 直接指定字色
  // 不要 > * { color: $white }
}
.PageBook__stepNum::after { /* 不需要 */ }
```

手機版 label 不全部隱藏：

```scss
@media (max-width: 640px) {
  .PageBook__step {
    min-width: 0;
    padding: 6px 8px;
  }
  .PageBook__stepLabel {
    font-size: 11px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 64px;
  }
  // 進階：只顯示 active step 的 label
  .PageBook__step:not(.PageBook__step--active) .PageBook__stepLabel {
    display: none;
  }
}
```

採「只顯示 active 的 label」策略：手機版視覺上看到「① ② ③ ④」+ active 的中文字，省空間又有資訊量。

### D6：語系切換改 ElDropdown + `useI18n().setLocale`

```vue
<script setup lang="ts">
const { locale, locales, setLocale } = useI18n();
const localeOptions = computed(() => (locales.value as Array<{ code: string; name: string }>));
const CurrentLocaleName = computed(() =>
  localeOptions.value.find((l) => l.code === locale.value)?.name ?? locale.value
);
const ClickSetLocale = (code: string) => setLocale(code as 'zh' | 'en' | 'ja');
</script>

<template lang="pug">
ElDropdown(trigger="click" @command="ClickSetLocale")
  button.LayoutFrontDesk__localeBtn(type="button")
    NuxtIcon(name="mdi:translate")
    span {{ CurrentLocaleName }}
  template(#dropdown)
    ElDropdownMenu
      ElDropdownItem(
        v-for="l in localeOptions"
        :key="l.code"
        :command="l.code"
        :disabled="l.code === locale"
      ) {{ l.name }}
</template>
```

- `setLocale` 由 `@nuxtjs/i18n` 自動寫入 cookie（`detectBrowserLanguage.cookieKey = 'i18n_redirected'`），SSR/CSR 切換不需自行管理。
- icon 用 `mdi:translate`（Nuxt Icon 已配 `componentName: 'NuxtIcon'`）。若無此 icon collection，退到 emoji `🌐` 也可，但首選 mdi。

### D7：可重複使用測試流（Playwright MCP）

- 測試入口：先 dev server `npm run dev`（讀 `.env.dev`，port 3000）→ 用 Playwright MCP 開 `/m/playwright-test-clinic`（或實際 seed 的 demo merchant slug）。
- 桌機 viewport：1024×768；手機 viewport：375×812。
- 截圖留存命名：`screenshots/fix-customer-booking-ux/{viewport}/{step}.png`。

## Risks / Trade-offs

- **[i18n 切換可能觸發 SSR 路由跳轉]** → Mitigation：先以 `redirectOn: 'root'` 預設配置實測，若切換後 URL 跳到 `/zh/...` 影響體驗，再評估改 `differentDomains` 或關閉自動 redirect；本次 change 內僅做 UI 接線，不動 i18n route 策略。
- **[ElCalendar 與自寫 Calendar 差異]** → Mitigation：自寫元件介面與 `BizDatePickerStrip` 完全對齊，未來若想換 ElCalendar，替換只需動 PageBook 三行。
- **[QUEUE 服務在 `/m/{slug}/queue` 領號頁的入口尚未支援 `?serviceId`]** → Mitigation：先檢查 queue 頁 query 參數行為，若未支援 serviceId，仍可導向不帶 query 的 `/m/{slug}/queue`（領號頁應已支援所有 QUEUE 服務）。實作時讀 `queue/index.vue` 確認。
- **[手機版 label 縮短可能 ellipsis 截到看不懂]** → Mitigation：策略改為「僅 active step 顯示 label」，這樣 label 有完整空間呈現完整文字（如「資訊」「日期」），其他 step 只剩數字，視覺上仍清楚。

## Migration Plan

純前端 UI 變更，無 DB migration、無 API 契約變更。部署流程：

1. 本機 `npm run lint && npm test` 通過。
2. 本機 `npm run dev` + Playwright MCP 跑驗收 E2E（桌機 + 手機）。
3. PR → main → Railway 測試站自動部署。
4. 測試站 smoke：開首頁、點任一服務、預約日期 step、切語系，全部正常。
5. promote 到正式站。

**回滾**：若上線後發現問題，直接 revert PR 即可，無資料層副作用。

## Open Questions

- **Q1**：QUEUE 服務點擊後是否需要把 `serviceId` 帶到 `/m/{slug}/queue`？讀 `queue/index.vue` 後決定。**先在 tasks.md 第一步確認。**
- **Q2**：語系切換後是否要 reload 頁面以重新拉 SSR 翻譯？`@nuxtjs/i18n` 預設應該不用，但如果發現步驟條/按鈕 label 沒跟著切，需要在 setLocale 後 `await nextTick()` 或 `reloadNuxtApp()`。**實作時驗證。**
- **Q3**：日曆元件的 `maxDate` 預設值該設多遠？目前 strip 預設 14 天。建議放寬到 **60 天**，與 availability 引擎 `MAX_FUTURE_DAYS`（如有）對齊；若未設限制，先用 60 天硬編碼，未來再做成可配置。
