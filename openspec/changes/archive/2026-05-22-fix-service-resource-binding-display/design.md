## Context

兩個 admin 列表頁面的 join 邏輯固化在 `bookingMode === 'RESOURCE'`（後來補上 `RESOURCE_OPTIONAL`），原因是這個 spec / 程式碼最早寫於只有 RESOURCE 模式可綁資源的階段。`add-queue-multi-resource-admin-ui` change 把 QUEUE 模式從「最多 1 個 resourceId」升級為「多個 resourceIds + 每資源獨立號碼池」後，後端 `GetServiceList` 已正確回傳 QUEUE 服務的 `resourceIds: string[]`，但兩個列表頁的客戶端 join 條件沒改 → QUEUE 模式綁定隱形。

現況：
- `app/pages/admin/resources/index.vue:16-30` `boundServicesByResource` 算 `Map<resourceId, ServiceItem[]>`，只 push `bookingMode in ['RESOURCE', 'RESOURCE_OPTIONAL']` 的 service
- `app/pages/admin/services/index.vue:110-120` 「資源」column 用 `v-if="(row.bookingMode === 'RESOURCE' || row.bookingMode === 'RESOURCE_OPTIONAL') && row.resourceIds.length"` 控顯隱
- `i18n` 三語 `admin.resources.boundServicesHint` 都寫死「RESOURCE 模式」字眼
- `merchant-platform` spec L853 Requirement「資源頁顯示綁定服務」與 4 個 scenario 都寫死 `bookingMode === 'RESOURCE'`

約束：
- 不動 schema、不動後端 API（後端 join 早已正確）
- 不動 protocol 型別（`ServiceItem.resourceIds: string[]` 已涵蓋）
- 純前端 + i18n + spec 文字

## Goals / Non-Goals

**Goals**:
- 任何 `resourceIds.length > 0` 的 service 都要在兩個列表頁正確 join 顯示，含 RESOURCE / RESOURCE_OPTIONAL / QUEUE
- spec Requirement 與 scenario 文字同步移除 `bookingMode === 'RESOURCE'` 過濾
- i18n 三語提示改為中性描述，不限定模式

**Non-Goals**:
- 不重構抽出共用 composable（兩處邏輯太簡單，抽出反而增加閱讀成本）
- 不改後端 API 形狀（不加 `boundResources` 反向 join、不改 `GetServiceList` 回傳結構）
- 不顯示 service 的 `bookingMode` 在「已綁服務」tag 上（保持原 tag 純名字，避免 UI 變動）
- 不處理「已停用 service 是否計入」的政策變更（保持原 `isActive` 過濾）

## Decisions

### Decision 1：過濾條件改為「資料驅動」而非「模式驅動」

**做法**：判斷 `resourceIds.length > 0`（資料驅動），不再列舉特定 bookingMode。

**Why**：
- 後端是「ServiceResource 表存在綁定就把 resourceId 塞進 `resourceIds[]`」——這已經是真實的綁定狀態
- 將來如果再多一個模式（例如 hypothetical `RESOURCE_GROUP`）也支援多資源綁定，前端不必再改
- 邏輯一致：「有綁就顯示，沒綁就不顯示」比「在白名單內的模式才顯示」更直觀

**Alternatives 考慮過**：
- (A) 維持白名單，加入 `'QUEUE'`：能修當前 bug，但下次新模式還要再改一次
- (B) 後端 API 多回一個 `hasResources: boolean`：過度設計，前端已有 `resourceIds: string[]`
- (C) 後端反向 join 給 resource 回傳 `boundServices`：違反「不動後端」約束，且把 join 邏輯從前端搬到後端反而失去靈活性

採用「**資料驅動 / 不依 bookingMode**」。

### Decision 2：resources 頁仍保留 `isActive` 過濾

**做法**：`boundServicesByResource` 仍只 push `s.isActive === true` 的 service；停用的 service 不顯示在「已綁服務」column。

**Why**：
- 商家停用 service 後仍能在資源頁看到「綁定關係還在」是有用的——但目前 spec 與既有 UX 都是「停用 = 不顯示」
- 本 change 範圍是修「QUEUE 模式不顯示」這個 bug，**不擴大為「停用服務是否該顯示」**這個獨立 UX 問題
- 維持既有行為 → 較低風險、較少 UI 變動

**Alternatives**：
- 改成顯示停用服務但加「停用」標籤：屬於新 UX 政策，需另開 change

### Decision 3：services 頁「資源」column 完全不依 bookingMode 過濾

**做法**：
```pug
template(v-if="row.resourceIds.length")
  ElTag(v-for="rid in row.resourceIds" ...)
span(v-else) —
```

**Why**：
- TIME_SLOT / TIME_CAPACITY 服務的 `resourceIds` 在後端就是 `[]`（不會有綁定），所以「依資料判斷」與「依模式判斷」結果一致，但前者更穩健
- 即使將來有人手動在 DB 寫入髒資料（例如 TIME_SLOT 服務綁了 ServiceResource），這邊也會誠實顯示出來——方便除錯

### Decision 4：i18n hint 文案改為「中性 + 操作指引」

**做法**：
- zh: `「請在『服務』頁編輯服務時勾選此資源,顧客才看得到他」`（移除「RESOURCE 模式」）
- en: `"Edit a service and check this resource so customers can select it."`（移除 `RESOURCE-mode`）
- ja: `「サービスを編集してこのリソースを選択すると、お客様が指定できるようになります。」`（移除 `RESOURCE モード`）

**Why**：
- 商家點開「服務」頁編輯時，UI 會根據選的 bookingMode 自動顯示/隱藏「資源」欄位，使用者不需要在 hint 上被告知模式名稱
- 三語平行修改，避免單語遺漏

### Decision 5：spec 同步修，新增「服務頁顯示綁定資源」Requirement

**做法**：
- 修現有 `merchant-platform` Requirement「資源頁顯示綁定服務」：把 `bookingMode === 'RESOURCE'` 字面條件改為「`resourceIds` 不為空的 service（含 RESOURCE / RESOURCE_OPTIONAL / QUEUE）」；4 個 scenario 對應修字
- 新增 Requirement「服務頁顯示綁定資源」：補上原 spec 沒明確規範的 `/admin/services` 列表「資源」column 行為，避免後續再次回歸 RESOURCE 寫死

**Why**：
- spec 文字若不修，未來工程師讀 spec 還是會以為「只有 RESOURCE 要顯示」→ 下次又回歸
- 新增 services 頁的 Requirement 是補洞——原本只 spec 了 resources 頁，沒明確規範 services 頁的「資源」column

## Risks / Trade-offs

| 風險 | 緩解 |
|------|------|
| QUEUE 服務通常綁多個資源，若服務名很長，resource 頁的「已綁服務」column 會擠 | 既有 `ElTag` 已支援換行，且這欄位 min-width 在 spec 沒限定；若實測太擠再開 follow-up |
| services 頁顯示 TIME_SLOT 服務的 `resourceIds`（理論上應為 `[]`）若 DB 髒資料會顯示 | 屬於除錯特性而非 bug——後端 join 都帶上了，前端誠實顯示反而方便發現 |
| Spec 的 scenario「非 RESOURCE 服務不計入綁定」與本 change 方向衝突 | 該 scenario 將被本 change 的 delta 移除/改寫 |
| i18n 改文案會影響舊翻譯記憶 | 三語同時改，沒有單語落後問題；且這是 hint 等級文案不影響核心流程 |

## Migration Plan

純前端 + i18n + spec 文字，**不需要資料遷移**。

部署順序：
1. 合併 PR → 觸發 Railway 重新部署
2. 部署完後立即可見效（不需要清快取，因為 Nuxt build 會產出新 hash）
3. Rollback：直接 revert commit + 重新部署

驗收（在 dev 環境）：
1. 建立 QUEUE 服務「看診」，bookingMode=QUEUE，綁定 A 診 / B 診
2. 進 `/admin/resources` → A 診 / B 診 兩列「已綁服務」都顯示「看診」tag
3. 進 `/admin/services` → 「看診」那列「資源」column 顯示 A 診 / B 診 兩個 tag
4. 同時建立 RESOURCE 模式服務測試不退化
5. 切換三語 i18n 看 hint 沒「RESOURCE」字眼
6. 用 Playwright MCP 截圖驗收

## Open Questions

無。所有設計決策已明確，可直接進 specs。
