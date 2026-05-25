## Context

`server/routes/nuxt-api/merchant/[id].put.ts` 的 `UpdateSchema` 把 nullable 字串欄位寫成：

```ts
contactEmail: z.string().trim().email().max(120).optional().nullable(),
contactPhone: z.string().trim().max(40).optional().nullable(),
description:  z.string().trim().max(1000).optional().nullable(),
logoUrl:      z.string().trim().max(500).optional().nullable(),
coverUrl:     z.string().trim().max(500).optional().nullable(),
address:      z.string().trim().max(200).optional().nullable(),
```

Zod 的 `.optional()` 接受 `undefined`、`.nullable()` 接受 `null`，但 `""` 既非 undefined 也非 null，會直接走 `.string().trim().email()` 流程──`.email()` 對空字串回 fail，最終整個 body 走 `badRequestError(event)` 回 400。

商家後台「商家設定」表單（[app/pages/admin/settings.vue](app/pages/admin/settings.vue)）對未填寫的選填欄位採 HTML form 預設行為，送出 `""`。`logoUrl` / `coverUrl` 因為走檔案上傳元件偶爾會送 `""`，`contactEmail` / `contactPhone` / `description` / `address` 也是。**只要任何一個是 `""`，整支 PUT 失敗**，連帶把「啟用 Provider Mode」這種跟 email 無關的儲存操作也擋掉。

DB schema（`prisma/schema.prisma` 的 `Merchant` model）這六個欄位本來就是 nullable，語意上「空字串」與「未填寫」對使用者來說無差別，後端應該寬鬆接受。

## Goals / Non-Goals

**Goals:**
- 讓 `""` 在這六個 nullable 字串欄位被當作「清空 / null」對待，請求順利通過。
- 維持原有合法字串的驗證（trim、max、email、regex 全部保留）。
- 修改範圍極小：只動 `UpdateSchema`，不動其它檔案。
- 規格化此行為到 `merchant-platform` spec，避免未來類似端點重蹈覆轍。

**Non-Goals:**
- 不修改前端表單行為（前端送 `""` 是合理的 HTML 預設）。
- 不變更 DB schema、不寫資料 backfill（既存 `""` 不會被本變更觸發 migration）。
- 不擴及其它端點的 schema（如 `POST /sys/merchant`、staff CRUD 等），若日後發現相同問題再另開 change。
- 不引入全域 Zod helper module（先在本檔內 local helper，避免過早抽象）。

## Decisions

### 決策 1：用 `z.preprocess` 把 `""` 視為 `null`

採用：

```ts
const nullableString = <T extends z.ZodTypeAny>(inner: T) =>
  z.preprocess((v) => (typeof v === 'string' && v.trim() === '' ? null : v), inner.nullable().optional());

contactEmail: nullableString(z.string().trim().email().max(120)),
contactPhone: nullableString(z.string().trim().max(40)),
description:  nullableString(z.string().trim().max(1000)),
logoUrl:      nullableString(z.string().trim().max(500)),
coverUrl:     nullableString(z.string().trim().max(500)),
address:      nullableString(z.string().trim().max(200)),
```

**為什麼**：
- `preprocess` 在 Zod 的驗證 pipeline 前段執行，把 `""`（含只有空白的字串）統一轉成 `null`，後續就走 `inner.nullable()` 分支，跳過 email/max 等規則。
- 非空字串原封不動進入 `inner`，所有既有驗證照舊。
- helper 區域宣告，影響面最小、易於閱讀。

**替代方案**：
- `z.literal('').transform(() => null).or(z.string()...)` — 可讀性差、與 max/email 組合時型別推斷較亂。
- 端點 handler 內手動 `if (data.x === '') data.x = null` — 重複、容易漏；且 schema 自身仍會在驗證階段擋掉 `""`。
- 全域 helper（放 `@@/utils/zod.ts`）— 範圍超出本 change，先 local 解決。

### 決策 2：移除 handler 主體的 `?? undefined`，直接傳遞 `data.x`

handler 原本寫：

```ts
description: data.description ?? undefined,
contactEmail: data.contactEmail ?? undefined,
...
```

**改為**：

```ts
description: data.description,
contactEmail: data.contactEmail,
...
```

**為什麼**：`??`（nullish coalescing）對 `null` 與 `undefined` 一視同仁——`null ?? undefined` 會回 `undefined`，導致清空語意（`""` → preprocess → `null`）被吞掉，Prisma 跳過更新、欄位仍是原值。直接傳 `data.x` 才能達成下表語意：

| 來源 body | preprocess 後 `data.x` | Prisma 行為 |
|-----------|---------------------|-------------|
| 未帶 key | `undefined` | 不更新該欄位 |
| `""` 或純空白 | `null` | 寫入 NULL |
| `"abc"` | `"abc"` | 寫入 "abc" |
| 顯式 `null` | `null` | 寫入 NULL |

原本的 `?? undefined` 屬於先前未被測試覆蓋到的潛在 bug（只是因為 `""` 進不了 schema 驗證、`null` 也很少有人手動送，所以一直沒爆）。本 change 順手修掉。

**Prisma 型別相容性**：對 nullable 欄位（schema 中 `String?`），Prisma 的 update input 型別為 `string | null | undefined`，與 `z.infer` 推導的 `data.x: string | null | undefined` 完全相容，不需任何斷言。

### 決策 3：補一支整合測試覆蓋此行為

於 `server/__tests__/` 新增 `merchant-update.test.ts`（或併入既有 availability 測試套件的 setup pattern），最少覆蓋：

1. `""` → 200 + DB 為 null（六個欄位至少抽 2–3 個代表）
2. `"not-an-email"` 仍 400
3. 啟用 Provider Mode 與空字串欄位混合送 → 200

**為什麼**：本 bug 沒被測到就是因為缺整合測試；補測試避免回歸。如果 setup 複雜度過高、需要 DB mock，視 setup 規模可降級為 Zod schema 單元測試（直接呼叫 `UpdateSchema.safeParse`），仍能覆蓋核心邏輯。

## Risks / Trade-offs

- **[Risk] 某些表單欄位實際上不希望「空字串=清空」（例如未來如果要區分「填過但清掉」vs「沒填過」）** → Mitigation：目前 UX 沒此需求；若日後需要區分，前端應送 `null` 而非 `""`，後端語意仍保持。
- **[Risk] preprocess 改變 schema 推斷型別** → Mitigation：`z.infer<typeof UpdateSchema>` 對應欄位變成 `string | null | undefined`，與既有 handler 用法（`data.x ?? undefined`）相容；不影響呼叫端。
- **[Trade-off] 對「使用者真的想送純空白字串」的情況也視為清空** → 可接受：六個欄位語意上都是可選資訊，純空白沒意義。
- **[Risk] 其它端點可能有同樣 bug 但本 change 不處理** → Mitigation：spec 規範到 merchant-platform；其它 spec 端點若被回報同類問題，另開 change 套用相同 helper 模式。

## Migration Plan

- 純 schema 行為調整，無 DB migration、無資料 backfill。
- 部署順序：直接合併、走既有 Railway 部署流程即可；不需 feature flag。
- 回滾：revert 該檔即可，前後相容（既有合法請求不受影響，回滾後只是回到「空字串 400」的舊行為）。

## Open Questions

無。Helper 命名（`nullableString`）若日後抽到全域可再改名，本 change 範圍內不必過早決定。
