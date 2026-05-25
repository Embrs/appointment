## 1. 後端 Schema 修正

- [x] 1.1 在 `server/routes/nuxt-api/merchant/[id].put.ts` 內新增 local helper `nullableString(inner)`，使用 `z.preprocess` 把 `""`（含純空白字串）轉為 `null`，並包成 `inner.nullable().optional()`
- [x] 1.2 將 `UpdateSchema` 的 `contactEmail` / `contactPhone` / `description` / `logoUrl` / `coverUrl` / `address` 六個欄位改用 `nullableString(...)` 包裹，保留原有 trim / max / email / regex 規則
- [x] 1.3 修改 handler 主體：將 `description` / `logoUrl` / `coverUrl` / `contactPhone` / `contactEmail` / `address` 六個欄位的 `data.x ?? undefined` 改成直接傳 `data.x`（`null ?? undefined` 會把 null 吞掉，導致清空語意失效）
- [x] 1.4 跑 `npm run lint` 與 `npx tsc --noEmit`（或專案實際的型別檢查指令），確認 `z.infer<typeof UpdateSchema>` 推導後沒影響呼叫端

## 2. 測試覆蓋

- [x] 2.1 在 `server/__tests__/` 新增 `merchant-update-schema.test.ts`，直接 import `UpdateSchema` 並用 `safeParse` 覆蓋：(a) 六個 nullable 欄位皆送 `""` → success 且解析後值為 `null`；(b) `contactEmail='not-an-email'` → failure；(c) `description` 長度 > 1000 → failure；(d) `contactEmail='admin@demo.com'` → success 且值為 `'admin@demo.com'`
- [x] 2.2 跑 `npm test` 確認新測試通過、既有 availability 測試不受影響
- [~] 2.3（選用）跳過：本專案 server handler 整合測試需要 mock h3 event + Prisma + auth，setup 過重；核心邏輯已由 schema 單元測試（14 個 cases）涵蓋，剩餘端到端驗證走任務 3.x 手動驗收

## 3. 手動驗收（Playwright MCP 已自動完成）

- [x] 3.1 本地 `npm run dev`，登入測試商家後台（owner@demo.test / Password123），進「設定 → 商家設定」
- [x] 3.2 不填任何選填欄位，僅勾選「啟用服務人員制」與填三語 providerLabel，按儲存 → **回 200 OK**（request #740 PUT /nuxt-api/merchant/cmpgl4wlq0001t5z3vvppnpyj），跳出「啟用醫師制」精靈彈窗，重新整理後 menu 在「營運」分群出現「醫師」項連到 /admin/providers
- [~] 3.3 跳過：與 3.2 同條代碼路徑，且 3.5 DB 查詢已確認寫入正確
- [~] 3.4 跳過：前端 ElForm 對 contactEmail 欄位有客戶端 email 規則，「Email 格式錯誤」紅字提示直接攔下，PUT 不會送出（防禦更早一層）；後端拒絕邏輯已由單元測試 `it('非法 email 拒絕', ...)` 覆蓋
- [x] 3.5 DB 直接查詢 `merchant cmpgl4wlq0001t5z3vvppnpyj` 結果：`providerModeEnabled=true`、`providerLabel={zh:'醫師', en:'Doctor', ja:'医師'}`、`logoUrl/coverUrl/contactPhone/contactEmail/address` 全為 `null`、`description` 保留既有值、`updatedAt` 對應儲存時刻

## 4. Spec 同步與收尾

- [x] 4.1 確認 `openspec/changes/fix-merchant-update-empty-string/specs/merchant-platform/spec.md` 的 MODIFIED 內容能在 archive 時正確 merge 回 `openspec/specs/merchant-platform/spec.md`（執行 `openspec validate fix-merchant-update-empty-string` 或同等命令）
- [x] 4.2 跑 `/opsx:verify` 驗證 implementation ↔ specs 一致性
- [ ] 4.3 撰寫 commit message（繁中、Conventional Commits 格式，建議：`fix: 商家設定 PUT 接受空字串視為清空避免 400`）
- [ ] 4.4 推上 dev 分支驗證部署環境（Railway）儲存設定 OK 後，視情況執行 `/opsx:archive`
