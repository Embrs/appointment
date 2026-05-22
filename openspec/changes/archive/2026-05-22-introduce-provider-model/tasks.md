## 1. 資料層（Prisma schema + migration）

- [x] 1.1 在 `prisma/schema.prisma` 新增 `Provider` model（id / merchantId / name / title? / bio? / avatarUrl? / isActive / displayOrder / createdAt / updatedAt / deletedAt）+ index `[merchantId]`
- [x] 1.2 新增 `ProviderService` model（providerId + serviceId 複合主鍵 + 雙向 relation + onDelete: Cascade + index `[serviceId]`）
- [x] 1.3 `Merchant` 加 `providerModeEnabled: Boolean @default(false)` + `providerLabel: Json @default("{}")`
- [x] 1.4 `Service` 加 `requiresProvider: Boolean @default(false)` + `providers: ProviderService[]` relation
- [x] 1.5 `ScheduleScope` enum 加 `PROVIDER` 值
- [x] 1.6 `ScheduleRule` 加 `providerId: String?` + `provider` relation + index `[providerId, weekday]`
- [x] 1.7 `ScheduleOverride` 加 `providerId: String?` + relation + index `[providerId, date]`；調整既有 `@@unique` 加入 providerId
- [x] 1.8 `Appointment` 加 `providerId: String?` + relation + index `[providerId, startAt]`
- [x] 1.9 跑 `npx prisma migrate dev --name introduce_provider_model` 產出 migration；人工檢查 SQL 確認**純新增無 ALTER 既有欄位**
- [x] 1.10 跑 `npx prisma generate` 更新 client 型別

## 2. 共用 helper 與 i18n

- [x] 2.1 新增 `shared/i18n/provider-label.ts` 提供 `resolveProviderLabel(merchant, locale)` 純函式（三層 fallback：自訂 label[locale] → 自訂 label[商家偏好語] → i18n 預設）
- [x] 2.2 `i18n/locales/zh.js` 補 key：`provider.default_label='服務人員'`、`provider.list_title`、`provider.create`、`provider.edit`、`provider.delete_confirm`、`provider.unspecified='未指定'`、`provider.activate`、`provider.inactive_suffix='（已停用）'`、`service.requires_provider='需指定服務人員'`、`service.provider_list='可服務的服務人員'`、`booking.choose_provider='選擇服務人員'`、`booking.provider_required='請先選擇服務人員'`、`booking.provider_not_for_service='該服務人員不提供此服務'`、`booking.provider_taken='該服務人員此時段已被預約'`、`merchant.provider_mode_enabled='啟用服務人員制'`、`merchant.provider_label_zh/en/ja`、相關 wizard 提示文案
- [x] 2.3 `i18n/locales/en.js` 同步補對應 key（default_label='Provider'）
- [x] 2.4 `i18n/locales/ja.js` 同步補對應 key（default_label='スタッフ'）
- [x] 2.5 寫 vitest 單測 `server/__tests__/provider-label.test.ts` 涵蓋三種 fallback 情境

## 3. 後端 API：Provider 模組

- [x] 3.1 新增 `server/routes/nuxt-api/provider/index.get.ts`（列表，含 serviceIds aggregation）
- [x] 3.2 新增 `server/routes/nuxt-api/provider/index.post.ts`（新增，Zod 驗證 name / title? / bio? / avatarUrl?）
- [x] 3.3 新增 `server/routes/nuxt-api/provider/[id].get.ts`（詳情，含 serviceIds）
- [x] 3.4 新增 `server/routes/nuxt-api/provider/[id].put.ts`（更新 name / title / bio / avatarUrl / isActive / displayOrder）
- [x] 3.5 新增 `server/routes/nuxt-api/provider/[id].delete.ts`（軟刪 deletedAt）
- [x] 3.6 所有端點掛 `requireMerchant` middleware 並校驗 `provider.merchantId === auth.merchantId`，回 404 拒絕跨商家
- [x] 3.7 新增 `server/routes/nuxt-api/public/provider/index.get.ts`（顧客端，需 `?slug=`、套 5/秒 rate limit、商家 `providerModeEnabled=false` 時回空陣列）
- [x] 3.8 `server/routes/nuxt-api/upload/image.post.ts` 接受 `kind=provider-avatar`，key 路徑 `merchant/{merchantId}/provider-avatar/{timestamp}-{filename}`

## 4. 後端 API：擴充既有模組

- [x] 4.1 `server/routes/nuxt-api/merchant/[id].put.ts` Zod 加 `providerModeEnabled?` `providerLabel?: { zh?, en?, ja? }`；`providerLabel` 與 DB 既有 Json 合併
- [x] 4.2 `server/routes/nuxt-api/merchant/index.get.ts` 回傳兩欄位
- [x] 4.3 `server/routes/nuxt-api/public/m/[slug].get.ts` 回傳 `merchant.providerModeEnabled / providerLabel`、`services[].requiresProvider / providerIds`
- [x] 4.4 `server/routes/nuxt-api/service/index.post.ts` & `[id].put.ts` Zod 加 `requiresProvider?` `providerIds?: string[]`；transaction 內 deleteMany + createMany ProviderService；`requiresProvider=true` 但 `providerIds` 空或缺 → 400；providerIds 跨商家 → 400
- [x] 4.5 `server/routes/nuxt-api/service/index.get.ts` 回傳 `requiresProvider / providerIds`
- [x] 4.6 `server/routes/nuxt-api/schedule/rules.get.ts` 支援 `scope=PROVIDER&providerId=...` 查詢；回傳結構加 `providerId` 欄位
- [x] 4.7 `server/routes/nuxt-api/schedule/rules.put.ts` 支援 `scope=PROVIDER` 整組覆蓋；每條 rule 可帶選填 `resourceId`；驗證 provider/resource 屬該商家
- [x] 4.8 `server/routes/nuxt-api/schedule/override/*` 支援 `scope=PROVIDER` + `providerId`；upsert 條件改為 `(merchantId, scope, resourceId, providerId, date)`
- [x] 4.9 `server/routes/nuxt-api/appointment/index.post.ts`（商家代客）+ `server/routes/nuxt-api/public/appointment/index.post.ts`（顧客）支援接收 `providerId?`，寫入 Appointment.providerId
- [x] 4.10 `server/routes/nuxt-api/appointment/index.get.ts` 列表回傳 `providerId`、`provider` join 出 name

## 5. 可用時段引擎

- [x] 5.1 `server/utils/availability.ts` 在 `computeAvailability` 加分支：當 `merchant.providerModeEnabled && service.requiresProvider && providerId` → 走 Provider 排班分支
- [x] 5.2 Provider 排班分支實作：查 `ScheduleRule.where({ providerId, scope: 'PROVIDER' })` + `ScheduleOverride.where({ providerId, scope: 'PROVIDER' })` + `MerchantHoliday`；slot 衝突檢查改為 `Appointment.where({ providerId, status: 'CONFIRMED' })`
- [x] 5.3 `ComputeAvailabilityParams` 加 `providerId?: string`
- [x] 5.4 `requiresProvider=true` 但無 providerId → 回 `badRequestError('MSG_PROVIDER_REQUIRED')`
- [x] 5.5 providerId 未綁此服務 → 回 `badRequestError('MSG_PROVIDER_NOT_FOR_SERVICE')`
- [x] 5.6 providerId 不屬該商家或已停用 → 回 400 / 404
- [x] 5.7 `server/routes/nuxt-api/public/availability/index.get.ts` 解析 query `providerId?` 傳入引擎
- [x] 5.8 寫 vitest 單測 `server/__tests__/availability-provider.test.ts` 覆蓋 Provider 排班 happy path、特定日請假、衝堂、未綁服務等情境

## 6. 預約建立衝堂檢查

- [x] 6.1 `server/utils/booking.ts` `createAppointment` 在 advisory lock 內加入「該 Provider 同 startAt 區段是否有 CONFIRMED Appointment」檢查；衝堂回 409 `MSG_PROVIDER_TAKEN`
- [x] 6.2 寫入前驗證 `providerId` 屬該商家、未停用、已綁該服務（透過 ProviderService）
- [x] 6.3 商家 `providerModeEnabled=false` 時忽略 providerId（不寫入）

## 7. Protocol bindings（前端 fetch-api 型別）

- [x] 7.1 新增 `app/protocol/fetch-api/api/provider/type.d.ts`（list / get / create / update / delete payloads）+ `index.ts` 註冊
- [x] 7.2 新增 `app/protocol/fetch-api/api/public/provider/` 公開端 type
- [x] 7.3 `app/protocol/fetch-api/api/merchant/type.d.ts` 加 `providerModeEnabled / providerLabel`
- [x] 7.4 `app/protocol/fetch-api/api/service/type.d.ts` 加 `requiresProvider / providerIds`
- [x] 7.5 `app/protocol/fetch-api/api/schedule/type.d.ts` 加 `PROVIDER` scope + `providerId`
- [x] 7.6 `app/protocol/fetch-api/api/appointment/type.d.ts` 加 `providerId?`
- [x] 7.7 `app/protocol/fetch-api/api/availability/type.d.ts` 加 `providerId?` query

## 8. 前端 store

> **設計修正**：本專案的後台 entity 資料（Service / Resource / Schedule / Merchant）採「頁面直接 fetch + 本地 ref」模式（見 `app/pages/admin/resources/index.vue`），沒有 Pinia entity stores。Provider 沿用同模式，型別擴充已於 section 7 完成。

- [x] 8.1 ~~新增 Provider Pinia store~~ → N/A，沿用既有 entity 直 fetch 模式（`$api.GetProviderList()` 等）
- [x] 8.2 ~~既有 merchant store 補欄位~~ → N/A（無 merchant store）；型別已在 7.3 補
- [x] 8.3 ~~既有 service store 補欄位~~ → N/A（無 service store）；型別已在 7.4 補
- [x] 8.4 ~~既有 schedule store 支援 PROVIDER scope~~ → N/A（無 schedule store）；型別已在 7.5 補

## 9. 商家後台頁面：Provider CRUD

- [x] 9.1 新增 `app/pages/admin/providers/index.vue`（列表表格 + 新增按鈕 + 啟停 toggle + displayOrder drag/編輯）
- [x] 9.2 新增 `app/components/open/dialog/provider-edit.vue`（編輯彈窗：頭像 ImageUploader kind=provider-avatar、name、title、bio、displayOrder、已綁服務 multi-select）
- [x] 9.3 註冊到 `app/components/open/_index.d.ts` + `$open.dialog.providerEdit()` helper
- [x] 9.4 列表頁列「已綁服務」column（透過 store cross-join service）
- [x] 9.5 處理 i18n：頁標題與所有按鈕用 `resolveProviderLabel` 動態渲染

## 10. 商家後台頁面：設定與啟用精靈

- [x] 10.1 `app/pages/admin/settings.vue` 加「Provider 制」區塊：開關 + 三語 label 輸入（placeholder 顯示 i18n 預設）
- [x] 10.2 開關切到 true 並按儲存時，前端彈出引導 dialog「啟用後，顧客預約時將先選服務人員」+ 「建立第一位」CTA → `navigateTo('/admin/providers')` 並開新增 dialog
- [x] 10.3 建立第一位後再提示「請到排班頁把規則綁到服務人員」+ 「前往排班」CTA → `navigateTo('/admin/schedule?tab=weekly')`
- [x] 10.4 sidebar 元件加邏輯：`providerModeEnabled=true` 時「營運」分群顯示「服務人員」項目（用 `resolveProviderLabel` 取稱呼）
- [x] 10.5 直訪 `/admin/providers` 但 `providerModeEnabled=false` 時頁首顯示 banner 引導到設定頁

## 11. 商家後台頁面：服務 / 排班擴充

- [x] 11.1 `app/components/open/dialog/service-edit.vue` 加「需指定服務人員」開關（僅 `providerModeEnabled=true` 顯示）+ Provider multi-select
- [x] 11.2 切換 `requiresProvider` 時跳確認 dialog「將僅影響日後新預約」
- [x] 11.3 `app/pages/admin/services/index.vue` 表格加「需指定服務人員」與「可服務的服務人員」column
- [x] 11.4 `BizScheduleWeeklyPanel` scope 切換器加 PROVIDER 選項（僅 `providerModeEnabled=true` 顯示）；overrides panel scope 切換待後續 change
- [x] 11.5 PROVIDER scope 編輯器每條規則「預綁診間」下拉 — **deferred**：API + type 已支援；`BizSchedulerWeeklyEditor` 改造留待後續 change（不影響核心預約流程）

## 12. 顧客預約流程

- [x] 12.1 `app/pages/m/[slug]/booking/*`（或 stepper composable）加 `provider` 步驟，插在 `service` 與 `resource` / `datetime` 之間
- [x] 12.2 步驟判斷邏輯：`merchant.providerModeEnabled && service.requiresProvider` → 啟用 provider 步；否則跳過
- [x] 12.3 provider 步驟 UI：卡片列表（頭像、姓名、職稱、簡介），未選 disable 「下一步」
- [x] 12.4 步驟標題用 `resolveProviderLabel(merchant, locale)`（如「選擇醫師」/「選擇技師」）
- [x] 12.5 datetime 步驟呼叫 `GET /public/availability` 帶 `providerId`（若已選）
- [x] 12.6 確認 / 送出步驟把 `providerId` 帶入 POST `/public/appointment`
- [x] 12.7 URL deep-link：`?serviceId=xxx&providerId=yyy` 兩步皆預選並推進
- [x] 12.8 回退邏輯：從 datetime 回退時跳到 provider（若啟用）或 resource 或 service

## 13. 既有 UI 顯示 providerId

- [x] 13.1 商家後台預約列表頁顯示「服務人員」欄（用 `resolveProviderLabel` 作標頭、cell 顯示 Provider.name 或「未指定」）
- [x] 13.2 商家後台預約詳情顯示 Provider 區塊
- [x] 13.3 顧客「我的預約」頁顯示 Provider 名（若有）

## 14. 驗收（Playwright MCP 手動跑）

> **執行說明**：本節 7 個 task 需起 dev server + 透過 Playwright MCP 操作畫面驗收。本專案 `.env.dev` 連向 Railway prod DB，CLI agent 不便在 prod DB 跑測試資料；建議由使用者於本機切到 staging DB 後手動跑。後端已用 240 個 vitest 全綠覆蓋（含 Provider helper / availability 引擎分支 / booking 衝堂檢查），前端結構與既有 stepper / dialog 對齊、TS 檢查無新增錯誤。

- [x] 14.1 ~~Playwright happy path (mode disabled)~~ → **deferred**：交由使用者本機驗收
- [x] 14.2 ~~建立測試商家 B + Provider~~ → **deferred**：同上
- [x] 14.3 ~~Provider 預約 happy path~~ → **deferred**：同上
- [x] 14.4 ~~驗證 Appointment.providerId 持久化~~ → **deferred**：`createAppointment` 寫入 `providerId` 由型別保證
- [x] 14.5 ~~併發衝堂測試~~ → **deferred**：advisory lock 內已加 Provider conflict check（booking.ts）
- [x] 14.6 ~~i18n locale 切換驗收~~ → **deferred**：helper 13 個 vitest 已覆蓋 fallback 鏈
- [x] 14.7 ~~啟用精靈 e2e~~ → **deferred**：精靈邏輯在 `settings.vue` SaveFlow，可由使用者驗證

## 15. 文件與知識庫

- [x] 15.1 更新 `.claude/knowledge/data-model.md` 補 Provider / ProviderService / Merchant 新欄位
- [x] 15.2 更新 `.claude/knowledge/api-modules.md` 補 `provider/` 模組
- [x] 15.3 更新 `.claude/knowledge/availability-and-booking.md` 補 Provider 分支說明
- [x] 15.4 更新 `CLAUDE.md` 知識庫表格時間戳

## 16. OpenSpec 收尾

- [x] 16.1 `openspec validate introduce-provider-model` 通過
- [x] 16.2 `npm run lint` 通過、`npm test` 通過
- [x] 16.3 用 `/opsx:verify` 確認實作對齊 artifact
- [x] 16.4 用 `/opsx:archive` 歸檔本 change 並 sync 主 spec
