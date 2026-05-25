## Why

商家後台「設定 → 商家設定」儲存時，只要表單中可空字串欄位（`contactEmail`、`contactPhone`、`description`、`logoUrl`、`coverUrl`、`address`）保持空白，前端會以 `""` 送出，後端 `UpdateSchema` 的 `z.string().trim().email()` / `.max()` 等驗證器對空字串會失敗，整個 `PUT /nuxt-api/merchant/[id]` 直接回 400 Bad Request。

這導致商家根本無法儲存任何設定變更（包括啟用「服務人員制 / Provider Mode」），整條 Provider/醫師 流程因此進不去。屬於 backend 對 nullable 欄位語意處理不一致的 bug，需要立即修正。

## What Changes

- 修正 `server/routes/nuxt-api/merchant/[id].put.ts` 的 `UpdateSchema`：對所有可空字串欄位（`contactEmail`、`contactPhone`、`description`、`logoUrl`、`coverUrl`、`address`）以 `z.preprocess` 把 `""` 視為 `null`，再走原有 trim / max / email / regex 驗證。
- 保持非空字串的驗證語意不變（合法 email 仍要通過 `.email()`、超過 max 仍 400）。
- 不修改前端表單（前端送空字串符合 HTML form 行為，後端應該寬鬆接受）。
- 不調整資料庫 schema、不新增欄位、不變動 API 路徑或響應結構。

## Capabilities

### New Capabilities

無。

### Modified Capabilities

- `merchant-platform`：`Requirement: 商家自身資訊讀寫` 的「修改自身商家」場景需要明確規範 nullable 字串欄位（`contactEmail`、`contactPhone`、`description`、`logoUrl`、`coverUrl`、`address`）接受 `""` 與 `null` 等價、皆寫入為 `null`；同時補一個負向場景明確空字串不應觸發 400。

## Impact

- **程式碼**：僅 `server/routes/nuxt-api/merchant/[id].put.ts` 一個檔案（UpdateSchema 改寫）。
- **API 行為**：`PUT /nuxt-api/merchant/[id]` 對空字串欄位的接受性放寬，不影響既有合法請求；前端不需配合改動。
- **資料庫**：`""` 與 `null` 在這六個欄位的最終寫入結果都會是 `null`（與「未填寫」語意一致）。原本可能殘留的 `""` 不會被本變更觸發 migration。
- **測試**：`server/__tests__/` 目前不涵蓋此端點，建議補一支整合測試，覆蓋「空字串 → 200 + DB 為 null」與「非法 email → 400」兩條路徑。
- **OpenSpec spec**：`merchant-platform/spec.md` 加一個明確的 nullable 字串欄位場景，避免後續類似端點重蹈覆轍。
