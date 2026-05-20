# queue-window-editor-ui-fix — Design

## Context

`BizQueueWindowEditor`（`app/components/biz/QueueWindowEditor.vue`）是商家後台 `/admin/queue-window` 頁的核心編輯器，由前一個 change `queue-window-and-display` 引入。它以 `v-model: QueueWindowItem[]` 與父頁面溝通，內部把 model 攤平成 7 列 weekday（缺的列用預設值補），父頁面按下「儲存」時呼叫 `PUT /nuxt-api/merchant/queue-window`。

目前實作有兩個前端缺陷：

1. **i18n 取陣列失敗**：`const WEEKDAY_NAMES = computed(() => t('common.weekdayLong') as unknown as string[])`。vue-i18n v9 / v10 的 `t()` 簽章保證回傳 `string`，遇到陣列翻譯實際行為是回傳 key 本身（`"common.weekdayLong"`），再被字串索引取 0–6 字元，剛好就是 `c, o, m, m, o, n, .`。正確 API 是 `tm()`（translate message — 取原始 message resource）。
2. **每列各填一次的高摩擦**：典型商家設定是「平日 09:00–18:00 共同上限、週末關閉」，目前要點七次開關 + 填七次時段。

本次只處理這兩點，不擴張到「假日例外」、「不同時段切多段窗」等更大設計，留給未來變更。

## Goals / Non-Goals

**Goals:**
- 修復 i18n bug，並對相同 pattern 有防呆，避免下次再壞。
- 提供「以已啟用列為來源」的批次套用按鈕，覆蓋 80% 商家設定情境。
- 平日 / 週末視覺區分，降低誤填到週六、週日的機率。
- 三語（zh / en / ja）皆完整。

**Non-Goals:**
- 不調整 `QueueWindowItem` 型別、不動 `v-model` 對外契約。
- 不調整後端 API（既有 `GET/PUT /nuxt-api/merchant/queue-window` 保持不變）。
- 不引入「同一天多段窗」、「日期範圍例外（國定假日）」、「跨服務複製」等延伸功能。
- 不重寫 `QueueWindowEditor` 為其他 UI 範式（grid heatmap、Element Plus Calendar 等）。

## Decisions

### Decision 1：用 `tm()` 而非 `t()` 取 weekday 陣列

**選擇**：`const messages = tm('common.weekdayLong'); const WEEKDAY_NAMES = isStringArrayOfLen7(messages) ? messages : FALLBACK;`

**為何**：
- `tm()` 回傳 message resource 原型（可能是 array / object），是 vue-i18n 官方建議用於陣列翻譯的 API。
- 配 type guard 解決將來 i18n key 漂移、locale 檔缺失、`messages` 變成 `LocaleMessageValue` 時的 TS 寬鬆型別問題。
- 同檔內若還有其他陣列翻譯使用 `t()`，本變更不處理（範圍限定本元件），但 fallback 寫法可作為示範。

**替代方案**：
- (A) 在 zh.js 把 `weekdayLong` 改成 `'週日,週一,...'` 字串再 split — 三語都要改、其他組件可能依賴陣列形式，污染太大，否決。
- (B) 直接硬編碼週名 — 違反 i18n 三語規範（en / ja 必須翻譯），否決。

### Decision 2：批次套用採「source-row」模式

**選擇**：以使用者「已啟用的某列」為來源（`startTime / endTime / maxTickets`），點「套用到所有平日」或「套用到所有日」時，把該值複製到目標範圍並開啟。

**規則**：
- 若沒有任何 active 列 → 兩按鈕 disabled，顯示提示「請先啟用任一列做為來源」。
- 若有多個 active 列 → 取**第一個** active 列（按 weekday 0–6 順序）作為來源；UI 不需提示哪一列被選，因為複製後值都一致。
- 「套用到所有平日」目標 = weekday 1–5；不動週日、週六的 `isActive`。
- 「套用到所有日」目標 = weekday 0–6 全部啟用。

**為何**：
- Source-row 對使用者最直觀：「我先設好一個樣本，再說『其他也都這樣』」。
- 不需要在工具列另開三個 input 重複輸入。
- 「取第一個 active」規則明確、易測試、避免複雜的多 source 衝突 UX。

**替代方案**：
- (A) 工具列上獨立 inputs（start / end / max）+ apply — 多三個欄位、與下方七列重複，視覺累贅，否決。
- (B) 「複製自週一到所有平日」固定來源 — 太死板，週一沒啟用時就用不了，否決。

### Decision 3：平日 / 週末視覺區分

**選擇**：列背景色用兩段：
- 平日（weekday 1–5）：保持目前 `#fafbfc`。
- 週末（weekday 0、6）：改為 `#f4f6fa`（再深一階灰），日期欄文字色 `#909399`。

不加額外 icon、不加 badge，避免增加視覺噪音。

**為何**：
- 純色塊區分成本最低、辨識度足夠。
- 不引入新 design token，與既有 `.BizQueueWindowEditor__row` 樣式語彙一致。

### Decision 4：批次工具列放在編輯器頂部、儲存按鈕之下

**選擇**：工具列出現在 7 列 weekday 列表的**上方**，與服務選擇器（父頁面）之間。佈局：

```
[服務選擇器]（父頁面控制）
─────────────────────────
[批次工具列]              ← 本變更新增
  ＜套用到所有平日＞ ＜套用到所有日＞   提示文字
─────────────────────────
[週日列] [週一列] … [週六列]
─────────────────────────
[儲存按鈕]（父頁面控制）
```

**為何**：
- 放頂部讓使用者「先設樣本、再批次」的心智流順向。
- 與儲存按鈕（在編輯器外、父頁面右下）分離，不會被誤點為「儲存」。

### Decision 5：i18n key 命名

新增 key 掛在 `admin.queueWindow.*` 底下，與既有 `admin.queueWindow.maxTicketsHint` 同層：

- `admin.queueWindow.applyWeekdays` — 「套用到所有平日 / Apply to weekdays / 平日に適用」
- `admin.queueWindow.applyAllDays` — 「套用到所有日 / Apply to all days / 全曜日に適用」
- `admin.queueWindow.needSourceRow` — 「請先啟用任一列做為來源 / Enable a row first as source / 適用元となる曜日を先に有効化してください」

## Risks / Trade-offs

- **[Risk] `tm()` 在某些 vue-i18n legacy mode / 設定下回傳型別不穩** → Mitigation：type guard `Array.isArray(x) && x.length === 7 && x.every(s => typeof s === 'string')`，失敗 fallback 到硬編碼，至少不會再壞給使用者看。
- **[Risk] 「取第一個 active」可能與商家直覺不符**（例如商家啟用了週三、按「套用到所有平日」） → Mitigation：批次按鈕 hover 提示帶上來源列名稱（如「以週三的時段套用到所有平日」），讓行為可預期；若不滿意可在 design 第二輪迭代再調整。
- **[Risk] 批次套用後，原本商家手動關閉的週末被「套用到所有日」覆蓋啟用** → Mitigation：「套用到所有日」按鈕走確認彈窗（`ElMessageBox.confirm`）；「套用到所有平日」因為不動週末，無需確認。
- **[Trade-off]** 不重寫為更現代的 grid / heatmap UI，犧牲視覺新鮮感換取本變更範圍可控；若未來商家需要多段窗或日期例外，會再開新 change 整體重構。

## Migration Plan

- **無資料遷移**：不改 schema、不改 API。
- **無部署阻塞**：純前端變更，rollback 只需 revert 該 commit。
- **i18n key 新增**：三語檔同步補 key；若任一語系遺漏，fallback 走 vue-i18n 預設行為（顯示 key 字串）— 本變更會明確檢查三語檔都有對應 key。

## Open Questions

- 暫無；如後續發現「取第一個 active 列」對商家不直覺，再開 follow-up 調整為「最後啟用的列」。
