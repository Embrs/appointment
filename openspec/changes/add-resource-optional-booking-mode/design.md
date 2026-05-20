## Context

現有 `BookingMode` enum 為 `TIME_SLOT / TIME_CAPACITY / RESOURCE / QUEUE`，其中 `RESOURCE` 行為是「服務必須綁定 1 個以上資源，預約時必須指定其中一個」。實務上常見三類資源綁定情境：

1. **完全不需要資源**（TIME_SLOT / TIME_CAPACITY）：例如理髮店通用洗剪、瑜伽團體課。
2. **必須指定特定資源**（RESOURCE）：例如健身房 1v1 教練、KTV 包廂——顧客必須選定哪一個。
3. **可選擇指定資源**（缺失情境）：例如牙科診所「拔牙」——顧客通常不在乎哪位醫師，但若有偏好希望能指定。

牙科診所的需求觸發本變更：當服務模式為「指定資源」時系統強制要綁、強制要選，無法表達「可選但非必要」這個中間態。需要新增 `RESOURCE_OPTIONAL` 模式補上這個情境。

技術現況：
- `prisma/schema.prisma`：`BookingMode` 與 `AppointmentMode` 為 enum；`Appointment.resourceId` 本就 nullable（為 non-RESOURCE 模式使用）。
- `server/utils/availability.ts:272-293`：RESOURCE 模式硬性要求 `resourceId`，scope=RESOURCE 查 ScheduleRule，依 `resourceId` 過濾 occupancy。
- `server/utils/booking.ts:266-272`：RESOURCE 模式硬性要求 `resourceId` 並驗 ServiceResource 關聯；非 RESOURCE 模式則禁止帶 `resourceId`。advisory lock key 為 `(merchantId, resourceId|null, startAt)`，已支援 null。
- 前端 `m/[slug]/book.vue` step 流程：service → (resource if RESOURCE) → datetime → info → confirm。

## Goals / Non-Goals

**Goals:**

- 新增第五種 BookingMode `RESOURCE_OPTIONAL`，承載「可選資源」語義，且能落到資料庫、API、UI 三層完整貫通。
- 後端 availability 與 booking 流程對 `RESOURCE_OPTIONAL` 支援兩種輸入路徑（帶 / 不帶 `resourceId`）。
- 顧客預約 UI 在 RESOURCE_OPTIONAL 流程提供「不指定（自動分配）」與具名資源的混合列表。
- 自動分配於下單 advisory lock 內執行，保證不會把同一 slot 的資源重複分給兩個顧客。
- 部署時無需手動資料修補：靠 `prisma migrate deploy` 自動套用 enum 新值；既有資料零修改。

**Non-Goals:**

- **不**改造現有 `RESOURCE` 模式語義（避免遷移風險與商家行為突變）。
- **不**改造 `Appointment.resourceId` 欄位（保持 nullable，由 application 層決定何時可空）。
- **不**實作「自動分配的演算法可商家配置」（如負載均衡 / 輪流 / 偏好醫師）；MVP 採固定策略（見下方 Decision 3）。
- **不**新增「未分配（resourceId=null）的 RESOURCE_OPTIONAL Appointment」狀態；本變更 auto-assign 必定在下單當下完成。
- **不**改 QUEUE 模式行為。

## Decisions

### Decision 1：新增獨立 enum 值 `RESOURCE_OPTIONAL`，而非在 `RESOURCE` 上加 flag

**選擇**：新增 `BookingMode.RESOURCE_OPTIONAL`（與 `AppointmentMode.RESOURCE_OPTIONAL`）。

**理由**：
- 語義明確，前後端條件分支單純（switch / if 即可），不需在每個 RESOURCE 邏輯點再讀 `service.allowOptional` flag。
- 既有 `RESOURCE` 行為一個字節都不改，迴歸風險為零。
- Spec 與測試易於描述（明確的 mode 值，而不是兩維配置）。
- 前端 UI 動態欄位（資源綁定區塊）只需把 `mode === 'RESOURCE'` 改為 `['RESOURCE', 'RESOURCE_OPTIONAL'].includes(mode)`。

**替代方案**：在 `Service` 加 `allowOptionalResource: boolean` 欄位，配 `RESOURCE` 模式使用。
- 缺點：每個處理 RESOURCE 的位置都要重新分支；spec 描述變模糊；資料庫多一個布林但只對特定 mode 有意義（容易誤填）。

### Decision 2：可用時段查詢的 union 聚合演算法

**選擇**：當 `RESOURCE_OPTIONAL` 且 `resourceId` 未提供時：

1. 取 service 的所有綁定資源 id 陣列 `R = [r1, r2, ...]`。
2. 對每個 `r ∈ R` 套用既有 RESOURCE 演算法（用 RESOURCE scope ScheduleRule、ScheduleOverride、Holiday、該資源當日 CONFIRMED Appointment）算出該資源當日的 `slots[]`。
3. 對所有資源的 slots 做 union（key = startAt）：
   - `capacity` 固定為 1（與 RESOURCE 一致）。
   - `remaining = 1` if 任一資源在該 slot `remaining > 0`，否則 `remaining = 0`。
   - `reason`：若 `remaining = 0`，取所有資源中「最寬鬆」的拒絕原因——優先序 `past < taken < closed/holiday/none`。實作上：所有資源都 past → past；至少一個 taken → taken；全部沒排班 → 不出 slot（同既有行為）。

**理由**：
- 對顧客體驗最自然：「只要這個時段有醫師能看，就讓我選」。
- 與既有 buildSlots 高度復用（呼叫 N 次後 union），不需另寫純函式。
- 若三位醫師中一位 09:00 不上班、兩位上班且其中一位被預約，09:00 仍應顯示「可預約」（剩下那位空著），這正是 union 想表達的。

**替代方案 A**：intersection（所有資源都可用才算可用）。
- 完全不符合「不指定」的語義——顧客本來就不在乎哪一位，沒理由要求全部都空。

**替代方案 B**：以「資源 capacity 加總」呈現多 remaining。
- 違反 RESOURCE_OPTIONAL 的「每筆預約只佔一個資源 slot」契約；顧客看到 remaining=3 會誤以為可以同時下 3 筆。

### Decision 3：自動分配策略——「最少未來預約」優先 + id 升序為 tie-breaker

**選擇**：`createAppointment` 在 advisory lock 內：

1. 對 service 的所有綁定 active 資源 `R`，重新查每個資源在該 startAt 的 CONFIRMED 占用數（capacity=1 → 0 表示可用）。
2. 過濾掉「在該 startAt 沒有有效排班 / 整店休假」的資源（reuse availability 內的 schedule check）。
3. 對剩餘可用資源 `R'`，計算各自「未來 CONFIRMED 預約數」（時間範圍：`[now, now + 30d]` 內）。
4. 取 `min(futureCount)` 的資源；如有多個，取 `id` 升序最小者。
5. 將該 `resourceId` 寫入 `Appointment.resourceId` 與 `mode = 'RESOURCE_OPTIONAL'`。

**理由**：
- 「最少未來預約優先」自然分散負載，避免顧客集中到第一位醫師。
- `id` 升序 tie-breaker 是確定性的（相對「隨機」），方便寫單元測試與重現問題。
- 30 天視窗避免歷史巨量資料影響選擇且查詢效率可預期。

**替代方案 A**：純隨機。
- 測試難寫；商家投訴「為什麼總是分到某位」時難解釋。

**替代方案 B**：round-robin（記錄上次分到誰）。
- 需要新增狀態欄位或表，超出本變更範疇；下次 iteration 再考慮。

**替代方案 C**：保留 `resourceId=null`，由商家後台手動分配。
- 使用者明確拒絕（前置 AskUserQuestion 第二題）；增加後台流程複雜度。

### Decision 4：Advisory lock 鍵的設計

**選擇**：
- 帶 `resourceId`（顧客指定具名醫師）：鍵 = `(merchantId, resourceId, startAt)`，與 RESOURCE 一致。
- 不帶 `resourceId`（auto-assign）：鍵 = `(merchantId, serviceId, startAt)`——以 service 為鎖粒度。

**理由**：
- auto-assign 需要在鎖內遍歷該 service 所有資源占用情況，鎖必須涵蓋整個資源池；用 serviceId 為鍵恰好序列化「同一服務、同一時段、不指定資源」的並發請求。
- 同 service 同 startAt 但其中一位顧客指定醫師 A、另一位 auto-assign：兩鎖不同（`(m, A, t)` vs `(m, s, t)`），無法互斥——但內部 occupancy 重檢時都會看到對方的 CONFIRMED 紀錄，後者重檢時若選到 A 會看到 A 已被佔而跳過、改選別人。**最壞情況**：兩個並發 auto-assign 都選了 A → 第二個重檢時發現 A 已佔 → 順序選下一個 B → 成功。鎖只保證「同 auto-assign 請求」之間互斥；指定 vs auto 的衝突靠 occupancy 重檢防護。

**驗證**：在 design 階段標記為「需在 task 階段補一個並發測試」。

### Decision 5：Migration 策略——純 enum value addition

**選擇**：標準 `prisma migrate`：
```bash
npx prisma migrate dev --name add_resource_optional_mode
```
產生的 SQL 預期為：
```sql
ALTER TYPE "BookingMode" ADD VALUE 'RESOURCE_OPTIONAL';
ALTER TYPE "AppointmentMode" ADD VALUE 'RESOURCE_OPTIONAL';
```

**理由**：
- PostgreSQL `ALTER TYPE ... ADD VALUE` 在 v9.1+ 是非阻塞 DDL，可線上執行，不需停機。
- Dockerfile commit 4281433 已將啟動指令改為 `node ... prisma migrate deploy && nuxt start`，測試站 / 正式站重新部署即自動套用。
- 既有資料零影響（沒有任何 row 會被改）。

**回滾**：PostgreSQL 不支援 `ALTER TYPE ... REMOVE VALUE`，但實務上「移除一個沒人用的 enum 值」可透過先 `UPDATE` 確認無 row 使用後直接從 schema 移除（migrate 會 noop）。若上線後發現嚴重 bug 需回滾，採用「停用新模式 UI 入口 + 商家不得選擇新模式」的軟回滾即可，無需 DDL。

### Decision 6：Appointment 寫入時的 `mode` 對應

**選擇**：`Appointment.mode = 'RESOURCE_OPTIONAL'`（不論顧客是指定還是 auto-assign）。

**理由**：
- 維持「mode 反映 service 的當下行為」的語義，與既有 RESOURCE 一致。
- 報表 / 列表可區分「這筆預約來自 RESOURCE_OPTIONAL 模式」，便於商家分析「自動分配 vs 指定」比例（未來如要新增此功能）。
- 若 mode 寫成 `RESOURCE`，會混淆「強制指定」與「可選指定」兩種來源，違反資料可追溯性。

## Risks / Trade-offs

- **[並發鎖跨指定/自動的潛在 race]** 顧客 A 指定醫師 1、顧客 B auto-assign 同時 → 兩鎖不同。  
  → **Mitigation**：所有寫入都在 transaction 內最後重檢 occupancy（既有 capacity 重檢機制延伸到 auto-assign 的「逐一試資源」迴圈）；極端情況下 B 失敗回 `MSG_SLOT_TAKEN`，顧客重試即可。

- **[union 聚合查詢成本]** 服務綁定 N 個資源時，availability 端點查詢量約為原本的 N 倍（每個資源都要查 rules / overrides / appointments）。  
  → **Mitigation**：實務上 N 通常 ≤ 10（一個小診所最多 10 位醫師）；先觀察生產延遲，必要時改為單一 query + memory aggregation。

- **[商家誤選新模式]** 不熟悉的商家可能在 `RESOURCE` 與 `RESOURCE_OPTIONAL` 間搖擺。  
  → **Mitigation**：service-edit 彈窗的下拉文案明確標註「⚠ 顧客必須指定」vs「✓ 顧客可選不指定」；提供 tooltip 簡述差異。

- **[既有 spec 中對 RESOURCE 的描述]** 部分 scenario 寫 `bookingMode !== 'RESOURCE'` 隱含「RESOURCE 是唯一需要 resourceId 的模式」。  
  → **Mitigation**：MODIFIED 條款明確列出受影響 scenarios，將「RESOURCE」字串改為「RESOURCE 或 RESOURCE_OPTIONAL」；對應前端 type narrowing 也同步調整。

- **[自動分配 fairness]** 「最少未來預約」初期可能讓新加入的醫師被分超量。  
  → **Mitigation**：MVP 接受此行為；商家後台日後可加「暫停接受新預約」按鈕（已在 schema 層由 `Resource.isActive=false` 支援）。

## Migration Plan

1. **schema 變更**：`prisma/schema.prisma` 兩處 enum 各加一行 `RESOURCE_OPTIONAL`。
2. **產生 migration**：本地執行 `npx prisma migrate dev --name add_resource_optional_mode`，提交 `prisma/migrations/<timestamp>_add_resource_optional_mode/migration.sql`。
3. **後端實作**：availability.ts、booking.ts、service POST/PUT handler；補三語訊息。
4. **前端實作**：service-edit dialog、book.vue 流程、ServiceCard 模式徽章；i18n。
5. **測試**：vitest 補 RESOURCE_OPTIONAL 三組案例 + auto-assign 並發測試；Playwright MCP 跑商家建服務 / 顧客指定 / 顧客不指定三條流程。
6. **部署**：合併到 dev → 部署測試站（Docker 重啟自動 migrate）→ QA 驗收 → 合併到 main → 部署正式站。
7. **驗證**：部署後手動建立一個 `RESOURCE_OPTIONAL` 服務 → 顧客面下兩筆預約（一筆指定、一筆不指定）→ 確認 DB 中 `appointment.mode` 與 `resourceId` 正確。

**回滾**：若發現嚴重 bug，第一線採「商家後台隱藏 RESOURCE_OPTIONAL 選項」（前端 feature flag），DB 不需動；保留現有 RESOURCE_OPTIONAL 資料以利調查。

## Open Questions

- **UI 文案決定**：「不指定（由系統自動分配）」是否要進一步呈現「將從 N 位醫師中為您挑選」？此屬於 UX polish，先以最簡文案上線，後續看顧客回饋調整。
- **報表需求**：商家是否需要「auto-assign vs 指定」的比例統計？本變更不實作，但 `Appointment.mode='RESOURCE_OPTIONAL'` + `resourceId` 已能事後分析「分配是否來自 auto-assign」需要額外 flag（待商家提需求）。
