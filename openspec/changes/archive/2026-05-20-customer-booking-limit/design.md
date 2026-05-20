## Context

預約系統目前對同一顧客（手機）對同一商家可累積的 CONFIRMED 預約數沒有任何限制。一個惡意顧客可以連續預約占滿熱門 slot；一個誤操作（連點兩次「下一步」）也可能多預約一場。商家普遍希望「同一個人不要一次預約太多」，且容忍度因業態不同（小餐廳 1~2、診所 3~5、健身房 10+）需要由商家自訂。

既有 `createAppointment`（[server/utils/booking.ts:140+](server/utils/booking.ts)）已用 PG advisory transaction lock 解決 slot 容量競態。本 change 在同一事務內**多做一次 count**，是最低風險的位置：lock 已序列化、count 結果不會因外部寫入失準。

## Goals / Non-Goals

**Goals:**
- 同一手機（normalize 後）對同一商家未來 CONFIRMED 預約 ≤ `Merchant.maxActiveAppointmentsPerCustomer`
- 商家於 `/admin/settings` 自由調整上限，預設 5，範圍 1–99
- 兼容既有資料（migration 自動為現有商家補 default 5）
- 不增加額外資料表，schema 變動最小
- 友善錯誤訊息引導顧客取消舊預約

**Non-Goals:**
- 跨商家總上限（顧客在多家商店各自獨立）
- 過去（已 startAt < now）的 CONFIRMED 不計入（讓客人能長期累積消費）
- 黑名單 / 顧客信用評分（屬未來 feature）
- 商家手動代客預約是否受限：本 change **不受限**（商家代客預約略過此檢查，與既有 `byMerchant: true` 略過 cancelPolicy 一致）

## Decisions

### 決策 1：計數鍵 `merchantId + customerPhone`，不含 lastName/title

需求明確指定 phone 為鍵；考慮 `lastName` 是輸入字串易因錯字繞過上限（張 vs 张、空白），用 normalize 後 phone 較穩。

`booking.ts/normalizePhone` 已去 `\s` 與 `-`，count 查詢前同樣 normalize。

### 決策 2：只計「未來 + CONFIRMED」

`where: { merchantId, customerPhone, status: 'CONFIRMED', startAt: { gte: now() } }`

理由：
- **過去 CONFIRMED**：理應由 cron / 商家標記為 COMPLETED；但若沒及時清理，不應卡住顧客新預約
- **CANCELED / COMPLETED / NO_SHOW**：均不占用商家未來時段
- **`gte: now()`**：避免「剛開始服務但 startAt 在過去 5 分鐘」這種邊界 case 還算數

### 決策 3：上限欄位放在 `Merchant`，非 `Service`

Service-level 細粒度上限是過度設計（商家也說不出每個服務各自要幾筆），且會讓「客人對商家的總體 footprint」概念複雜。第一版用 merchant-level 一個欄位夠用。

未來若需 service-level，可加 `Service.maxActiveAppointmentsPerCustomer Int?`（nullable，nullable 時 fallback 到 Merchant 設定）。

### 決策 4：在 `createAppointment` 事務內檢查，與 slot 容量檢查同一處

放事務外 → 兩個顧客幾乎同時打 API 都通過上限檢查（race condition）。

放事務內 advisory lock 後：lock key 是 `appt:${merchantId}:${resourceId}:${startAt}`，雖然不直接序列化「同一顧客建多筆」場景（不同 slot 不同 lock key），但配合條件式 update + count 仍可正確判斷上限：

```typescript
const activeCount = await tx.appointment.count({
  where: {
    merchantId,
    customerPhone: normalizedPhone,
    status: 'CONFIRMED',
    startAt: { gte: new Date() }
  }
});
const maxLimit = merchant.maxActiveAppointmentsPerCustomer ?? 5;
if (activeCount >= maxLimit) return { limitExceeded: true };
```

剩餘 race：「同一顧客同時在不同瀏覽器分頁建兩筆」會兩個事務都 count=5 通過、commit 後變 7。**接受此 race**，因為：
- 罕見（同一顧客同時點兩次下一步是常見，但建立成功後有 toast、跳轉，第二筆通常不會發出）
- 損害有限（最多多 1 筆）
- 若要完美序列化需 `pg_advisory_xact_lock(merchantId + phone)` 額外鎖，反而會降低同時段不同顧客的並發效能

### 決策 5：欄位驗證範圍 1–99

下限 1：商家若想完全禁止重複預約（每人最多 1 筆未來預約）合理
上限 99：超過 99 等於沒限制；如果真的有需要 100+，直接放大 max 即可。第一版收緊避免誤填造成 abuse

Zod schema：`z.number().int().min(1).max(99)`

### 決策 6：商家代客預約不檢查上限

`createAppointment(input.byMerchant)` 為 true 時略過。商家代客預約已是「人工判斷後行為」，已是上限例外的合法授權路徑（與既有 cancelPolicy 略過邏輯一致）。

需求未明確說，但與既有設計一致較合理。

### 決策 7：前端 UX

`/admin/settings` 加 `ElInputNumber` 並顯示 helper 文字：「同一手機在本店未來預約的最大筆數（1–99）」

顧客面 `/m/[slug]/book.vue` 收到 409 `MSG_BOOKING_LIMIT_EXCEEDED` 時：
- `ElMessage.error(message.zh_tw)`
- 額外顯示 `ElAlert`「您可在『我的預約』中取消不需要的預約」並提供連結至 `/m/{slug}/my-bookings`

## Risks / Trade-offs

| Risk | Mitigation |
|------|-----------|
| 既有商家現有 row 沒有 `maxActiveAppointmentsPerCustomer` 欄位 | DB default 5，migration 不需要 backfill 腳本，PostgreSQL `ADD COLUMN ... DEFAULT 5` 對 nullable=false int 會自動填入 |
| 商家剛改設定（5→1），現有顧客已有 3 筆未來預約怎麼辦？ | 上限是建立新預約時檢查，**不溯及既往**：3 筆現有不會被自動取消，但顧客不能再加新預約直到舊的低於 1 筆 |
| 顧客被卡住但找不到「我的預約」入口 | 顧客面 my-bookings 已存在（[app/pages/m/\[slug\]/my-bookings.vue](app/pages/m/[slug]/my-bookings.vue)），錯誤提示 ElAlert 提供連結 |
| 並發 race 多 1 筆 | 接受（見 決策 4） |
| 商家設定面板新欄位影響既有「設定」表單 layout | 用 `ElDivider` 分區「預約上限」與既有區塊隔開 |
| 部署期間，老 server 還沒拿到新 schema，新 client 已送 `maxActiveAppointmentsPerCustomer` | Nitro Server 與 Schema 同部署無此問題（Docker image 同一個）；Zod `.optional()` 容錯 |

## Migration Plan

1. **Local dev**：
   ```bash
   npx prisma migrate dev --name add_merchant_booking_limit
   ```
   生成 `prisma/migrations/<timestamp>_add_merchant_booking_limit/migration.sql`，內容類似 `ALTER TABLE "Merchant" ADD COLUMN "maxActiveAppointmentsPerCustomer" INTEGER NOT NULL DEFAULT 5;`

2. **CI 驗證**：`prisma migrate diff` 確認與 schema 一致

3. **測試環境部署**：合併 PR → Railway 拉新 image → Dockerfile CMD 自動跑 `prisma migrate deploy` → 套用 migration

4. **正式環境部署**：同上自動流程

5. **Rollback**：
   - 若需 rollback：手動建立 `ALTER TABLE "Merchant" DROP COLUMN "maxActiveAppointmentsPerCustomer";` migration，commit 後 deploy
   - 但 column 新增是低風險操作（無資料遺失），建議 rollback 應用層程式碼即可，欄位保留也無害

## Open Questions

無。需求已明確（merchantId+phone、只計未來 CONFIRMED、預設 5、每家獨立）。
