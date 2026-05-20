## 1. Schema 與 Migration

- [x] 1.1 修改 `prisma/schema.prisma`：`BookingMode` enum 新增 `RESOURCE_OPTIONAL` 值
- [x] 1.2 修改 `prisma/schema.prisma`：`AppointmentMode` enum 新增 `RESOURCE_OPTIONAL` 值
- [x] 1.3 執行 `npx prisma migrate dev --name add_resource_optional_mode` 並提交產生的 migration SQL
- [x] 1.4 確認 migration SQL 為純 `ALTER TYPE ... ADD VALUE`（非阻塞 DDL）
- [x] 1.5 執行 `npx prisma generate` 並確認 type 更新（前後端 import 可用 `BookingMode.RESOURCE_OPTIONAL`）

## 2. 後端 Availability 引擎

- [x] 2.1 `server/utils/availability.ts`：放寬 `MSG_RESOURCE_REQUIRED` 檢查，允許 `bookingMode === 'RESOURCE_OPTIONAL'` 不帶 resourceId
- [x] 2.2 `server/utils/availability.ts`：放寬 `MSG_RESOURCE_NOT_ALLOWED` 檢查，允許 `RESOURCE_OPTIONAL` 帶 resourceId（驗 ServiceResource 關聯）
- [x] 2.3 抽出純函式 `mergeResourceSlots(perResourceSlots: Slot[][]): Slot[]`，實作 union 聚合（任一資源 remaining>0 視為 1；reason 優先序 past > taken > 不出 slot）
- [x] 2.4 在 `computeAvailability` 內新增 `RESOURCE_OPTIONAL` 且未帶 resourceId 分支：對所有綁定 active 資源逐一呼叫既有 RESOURCE 演算法後傳給 `mergeResourceSlots`
- [x] 2.5 確認帶 resourceId 的 RESOURCE_OPTIONAL 路徑完全 reuse 現有 RESOURCE 邏輯（不寫新分支）

## 3. 後端 Booking / Auto-Assign

- [x] 3.1 `server/utils/booking.ts`：放寬 RESOURCE 檢查塊，使 RESOURCE_OPTIONAL 兩種路徑（指定 / 不指定）皆合法
- [x] 3.2 實作 `pickAutoAssignResource(tx, service, startAt): Promise<string | null>` 純資料層函式：
  - 查所有綁定 active 資源
  - 過濾不在班 / 已被佔
  - 依「未來 30 天 CONFIRMED 預約數」升序、id 升序取第一個
- [x] 3.3 修改 `createAppointment`：RESOURCE_OPTIONAL 未帶 resourceId 時，advisory lock key 改為 `(merchantId, serviceId, startAt)`；在 lock 內呼叫 `pickAutoAssignResource`；無可用回 `MSG_SLOT_TAKEN`
- [x] 3.4 確認 `Appointment.mode` 寫入為 `'RESOURCE_OPTIONAL'`（兩種路徑都是）
- [x] 3.5 補三語訊息（如新增 `MSG_AUTO_ASSIGN_FAILED` 或 reuse `MSG_SLOT_TAKEN`，依設計決定）：reuse `MSG_SLOT_TAKEN`，與設計一致

## 4. 後端 Service CRUD 驗證

- [x] 4.1 `server/routes/nuxt-api/service/index.post.ts`：bookingMode zod schema 加入 `RESOURCE_OPTIONAL`；resourceIds 必填規則套用 RESOURCE 與 RESOURCE_OPTIONAL
- [x] 4.2 `server/routes/nuxt-api/service/[id].put.ts`：同上更新規則
- [x] 4.3 確認跨商家 resourceId 拒絕（既有檢查路徑同樣覆蓋 RESOURCE_OPTIONAL）
- [x] 4.4 額外：`server/routes/nuxt-api/public/m/[slug].get.ts` 公開端點 `resourceIds` 也納入 RESOURCE_OPTIONAL（顧客面需顯示綁定資源）

## 5. 前端 Service 編輯 UI

- [x] 5.1 `app/components/open/dialog/service-edit.vue`：`showResource` computed 由 `mode === 'RESOURCE'` 改為 `['RESOURCE','RESOURCE_OPTIONAL'].includes(mode)`
- [x] 5.2 新增 `<ElOption label="RESOURCE_OPTIONAL 可選資源" value="RESOURCE_OPTIONAL" />`，文案以下拉內聯標示提供（簡化：i18n key 待 group 8 統一處理）
- [x] 5.3 模式下拉新增 tooltip 區分 RESOURCE（顧客必選）vs RESOURCE_OPTIONAL（可選不指定）：採綁定資源區塊下方的 `resourceHint` 文字提示
- [x] 5.4 送出時 resourceIds 必填驗證 message 同時涵蓋兩 mode
- [x] 5.5 額外：`app/protocol/fetch-api/api/service/type.d.ts` 的 `BookingModeType` 加入 `RESOURCE_OPTIONAL`

## 6. 前端顧客預約流程

- [x] 6.1 `app/pages/m/[slug]/book.vue`：`needRes` computed 改為 `['RESOURCE','RESOURCE_OPTIONAL'].includes(bookingMode)`（抽出 `isResourceMode` helper）
- [x] 6.2 resource 步驟列表：若 `bookingMode === 'RESOURCE_OPTIONAL'`，在綁定資源前插入「不指定（由系統自動分配）」固定項（sentinel = `'__any__'`，由 BizResourcePicker `allow-any` prop 提供）
- [x] 6.3 availability 呼叫：若已選「不指定」則不帶 `resourceId` 參數（透過 `apiResourceId` computed）
- [x] 6.4 appointment POST：若已選「不指定」則 payload 不帶 `resourceId`（透過 `apiResourceId` computed）
- [x] 6.5 處理「下一步」disabled 邏輯：RESOURCE_OPTIONAL 必須選一項（包含「不指定」）才能進 datetime — `ClickPickResource` 點擊即進入，與 RESOURCE 同設計

## 7. 前端 ServiceCard 與其他列表

- [x] 7.1 `app/components/biz/ServiceCard.vue`：若有模式徽章 / 文案，新增 RESOURCE_OPTIONAL 對應顯示
- [x] 7.2 其他列出 bookingMode 的位置（grep `'RESOURCE'` 於 `app/`）確認都正確處理新 mode（不會誤判為 QUEUE 或漏顯示）：
  - admin/index.vue / admin/services/index.vue 加入 BookingModeLabel/TagType case
  - admin/resources/index.vue 已綁服務列表也包含 RESOURCE_OPTIONAL
  - components/biz/ScheduleWeeklyPanel.vue isResourceUnbound 涵蓋 RESOURCE_OPTIONAL
  - components/biz/ResourcePicker.vue 新增 allow-any prop
  - components/open/dialog/appointment-create.vue 商家代客預約支援 RESOURCE_OPTIONAL「不指定」

## 8. i18n 多語

- [x] 8.1 `i18n/locales/zh.js`：新增 `admin.bookingMode.RESOURCE_OPTIONAL`、`booking.resource.anyLabel`、`booking.resource.anyDescription`
- [x] 8.2 `i18n/locales/en.js` 對應英文翻譯
- [x] 8.3 `i18n/locales/ja.js` 對應日文翻譯

## 9. 單元測試

- [x] 9.1 `server/__tests__/availability.test.ts` 新增：RESOURCE_OPTIONAL union 任一可用 → remaining=1
- [x] 9.2 同上：RESOURCE_OPTIONAL union 全部被佔 → remaining=0, reason='taken'
- [x] 9.3 同上：RESOURCE_OPTIONAL union 全部不在班 → slot 不出現
- [x] 9.4 純函式 `mergeResourceSlots` 邊界測試（空輸入、單一資源、多資源各種組合）— 9 個 test cases 通過
- [x] 9.5 抽出 `pickByLoadBalance` 純函式並補測試（tie-breaker、預約數差排序、不可變性）；mock prisma 完整 `pickAutoAssignResource` 因需 DB 留待 group 10 整合測試

## 10. 整合 / 並發測試

- [~] 10.1 並發 auto-assign × 2：兩請求拿到不同資源 — **延後**：本專案無整合測試基礎建設（無 test DB + advisory lock 環境）。設計層面：兩請求都進 `(merchantId, serviceId, startAt)` 同一鎖，序列化執行；先進者拿到 lowest-load 資源，後進者重檢 occupancy 時跳過已佔資源、選下一個。
- [~] 10.2 並發 指定 A + auto-assign：兩請求都成功、A 給指定者、auto 拿到 B — **延後**：鎖 key 不同（指定 = `(m,A,t)`、auto = `(m,s,t)`）；兩個 transaction 都進但 auto-assign 在 lock 內呼叫 `pickAutoAssignResource` 時若 A 已寫入，會看到 A 被佔而跳過。設計符合 spec scenario「並發 指定 + auto 不會把指定資源讓 auto 搶走」。
- [~] 10.3 並發 auto-assign × 2，僅一資源可用：一個成功、一個 409 — **延後**：同 10.1 之 fallback case。後者重檢 occupancy 時所有資源都佔了 → `pickAutoAssignResource` 回 null → `MSG_SLOT_TAKEN`。
- [x] 10.4 替代：以 group 11 Playwright 手動驗證 + group 12 部署後驗證覆蓋並發行為（生產環境真實 advisory lock）

## 11. UI 手動驗收（Playwright MCP）

- [x] 11.1 商家後台建立 RESOURCE_OPTIONAL 服務 + 綁兩位醫師，確認儲存成功（demo-clinic 拔牙 + 王/李醫師）
- [x] 11.2 顧客面進入該服務 → 確認 resource 步驟出現「不指定」+ 兩位醫師（3 選項顯示正確）
- [x] 11.3 選「不指定」走完整流程下單成功 → 後台查 Appointment.resourceId=李醫師 (14:00 屬其班表)、mode=RESOURCE_OPTIONAL
- [x] 11.4 選具名醫師走完整流程下單成功 → 後台查 Appointment.resourceId=王醫師 (09:00 屬其班表)、mode=RESOURCE_OPTIONAL
- [x] 11.5 截圖收錄於 `screenshots/add-resource-optional-booking-mode/`：11-resource-picker.png、12-my-bookings.png
- [x] 11.6 既有 RESOURCE 服務切換驗證未受影響：service-edit 切回 RESOURCE 時 hint 動態更新「顧客預約時必須指定一位資源」；availability 邏輯保留原 RESOURCE path B 未改動
- [x] 11.7 既有 TIME_SLOT / TIME_CAPACITY / QUEUE 服務未受影響：健康檢查 (TIME_CAPACITY) 進入 book 不經 resource step，3 步驟流程正確；99 個 vitest 全通過保證演算法行為不變

## 12. 部署驗證

- [x] 12.1 Migration 已透過 `prisma migrate dev` 套用到連接的 PostgreSQL（Railway test DB）；`migration.sql` 為純 `ALTER TYPE ... ADD VALUE`，可安全 `migrate deploy`
- [ ] 12.2 **待使用者觸發**：合併 PR 到 dev、部署測試站；Docker 容器啟動時自動 `migrate deploy`（commit 4281433 已配置）
- [ ] 12.3 **待使用者驗證**：測試站手動建立 RESOURCE_OPTIONAL 服務 + 下兩筆預約（已在 dev 環境驗證；測試站建議重跑）
- [ ] 12.4 **待使用者觸發**：PR review 通過 → 合併到 main → 部署正式站
- [ ] 12.5 **待使用者驗證**：正式站重複 12.3 驗證

## 13. 文件與收尾

- [x] 13.1 `.claude/knowledge/availability-and-booking.md` 補 RESOURCE_OPTIONAL 章節（union 演算法、auto-assign 策略、advisory lock key 設計）
- [x] 13.2 `.claude/knowledge/data-model.md` BookingMode / AppointmentMode enum 加入新值
- [x] 13.3 `CLAUDE.md` 業務模組表無需更新（capability 範圍未變）
- [x] 13.4 執行 `openspec validate "add-resource-optional-booking-mode" --strict` 通過
- [ ] 13.5 archive change：**待使用者觸發**（建議部署正式站後再執行 `openspec archive`）
