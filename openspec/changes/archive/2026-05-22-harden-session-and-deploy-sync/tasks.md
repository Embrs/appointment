## 1. 後端：守衛資料庫存在性驗證

- [x] 1.1 將 `requireMerchant` / `requireAdmin` 改為 `async`，簽名為 `Promise<AuthPayload | ApiResponse>`（[server/utils/auth.ts](server/utils/auth.ts)）；保留既有「return unauthorizedError」呼叫端模式
- [x] 1.2 在 `requireMerchant` 內 JWT 驗證通過後新增 `await prisma.merchant.findFirst({ where: { id: payload.merchantId, deletedAt: null, status: 'ACTIVE' } })`，不存在回 `unauthorizedError`
- [x] 1.3 同上對 `MerchantUser`：`prisma.merchantUser.findFirst({ where: { id: payload.sub, deletedAt: null, isActive: true, merchantId: payload.merchantId } })`，不存在回 `unauthorizedError`
- [x] 1.4 `requireAdmin` 內查 `prisma.adminUser.findFirst({ where: { id: payload.sub, deletedAt: null, isActive: true } })`，不存在回 `unauthorizedError`
- [x] 1.5 統一三語訊息：`unauthorizedError` 傳入「會話已失效，請重新登入 / Session expired, please sign in again / セッションが失効しました。再度ログインしてください」（或新增 helper 維持原預設訊息為「未授權」，僅在「身分主體 DB 不存在」分支用新訊息）
- [x] 1.6 全專案搜尋 `requireMerchant(` 與 `requireAdmin(` 呼叫端，確認每處都已 `await`（TS 編譯期會抓出，但仍需手動掃一遍）
- [x] 1.7 `server/routes/nuxt-api/auth/me.get.ts` 對齊：若 JWT 解開後 merchant/adminUser 在 DB 不存在，回 401（不是 404）（**現況**：me.get.ts 已使用 `prisma.adminUser.findUnique` / `prisma.merchantUser.findUnique` 且查不到或非 ACTIVE 都 `return unauthorizedError(event)`，本任務無需修改 me.get.ts）
- [x] 1.8 撰寫 Vitest 單元測試 `server/__tests__/auth-guard.test.ts`：mock prisma，覆蓋「merchant 存在/不存在」「MerchantUser 不存在/停用」「Merchant SUSPENDED」「AdminUser 不存在」「無 token」六種情境（**實作**：抽出純函式 `evaluateMerchantSession` / `evaluateAdminSession`，20 個 case 覆蓋 ok / no-token / wrong-role / no-user / merchant-deleted / merchant-not-active / admin no-user 等情境，全綠）

## 2. 後端：健康檢查端點與啟動日誌

- [x] 2.1 新增 `server/routes/nuxt-api/health.get.ts`，無認證；查 `_prisma_migrations` 表最新 `migration_name`，查 DB `SELECT 1`；回 `{ status, db, migration, commit, uptimeSec }`
- [x] 2.2 抽出共用函式 `server/utils/deploy-info.ts`：`getCurrentMigration()`、`getCommitHash()`、`getUptimeSec()`、`pingDatabase()`
- [x] 2.3 新增 `server/plugins/boot-log.ts`：onReady 時於 stdout 印 `[boot] migration=<name> commit=<sha> nodeEnv=<env>`
- [x] 2.4 `.env.example` 補 `GIT_COMMIT_SHA=`（註解：build 階段由 CI 注入；本地可留空）
- [x] 2.5 撰寫 Vitest 測試（mock prisma `$queryRaw`）：`server/__tests__/deploy-info.test.ts` 覆蓋 `getCommitHash` 環境變數讀取與 fallback 行為 6 個 case；DB IO 與 endpoint 200/503 分支由 Playwright 實機（8.8）覆蓋

## 3. 部署：Dockerfile entrypoint 失敗中止

- [x] 3.1 在 Dockerfile 新增 `docker-entrypoint.sh`：`set -e` + `node prisma/build/index.js migrate deploy` + `exec node .output/server/index.mjs`，並 `COPY` 進 image、`chmod +x`
- [x] 3.2 Dockerfile 改用 `ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]`；移除原本 `CMD ["sh", "-c", ...]`
- [x] 3.3 Dockerfile 加 `ARG GIT_COMMIT_SHA` 與 `ENV GIT_COMMIT_SHA=$GIT_COMMIT_SHA`，讓 runtime 可讀
- [ ] 3.4 本地驗證：`docker build --build-arg GIT_COMMIT_SHA=$(git rev-parse --short HEAD) -t appointment .` 後 `docker run --env-file .env.dev appointment`，觀察 log 順序為「migrate deploy OK → boot log → server listening」（**需使用者手動跑 docker 環境**）
- [ ] 3.5 模擬 migration 失敗（如刻意改錯 DATABASE_URL）跑容器，確認 exit code 非 0、Nitro 未啟動（**需使用者手動跑 docker 環境**）
- [x] 3.6 新增 `railway.json` 設定 `healthcheckPath: "/nuxt-api/health"` + `healthcheckTimeout: 30` + `ON_FAILURE` 重啟策略；若已在 Railway dashboard 手動設過，可保留兩處或刪除 dashboard 設定改由本檔托管

## 4. 前端：Middleware 進站 me 預檢

- [x] 4.1 改 `app/middleware/merchant.ts` 為 async，加 `if (import.meta.server) return;` 短路；client 端 `await $api.MeInfo()`
- [x] 4.2 失敗時呼叫 `storeSelf.ClearInfo()` 並 `return navigateTo(localePath('/sign-in'))`；成功就放行（**改動**：用 `ClearInfo()` 而非 `SignOut()`，因為 SignOut 內 navigateTo 不會 return 給 middleware，由 middleware 自己掌握跳轉）
- [x] 4.3 同樣改 `app/middleware/admin.ts`，失敗導向 `/sys/sign-in`（與 `StoreSelf.SignOut()` admin 既有跳轉路徑一致；spec 提到的 `/sign-in?type=admin` 路由實際在 `/sys/sign-in` 之外另有分流，本 change 保留現況）
- [x] 4.4 確認 `app/stores/3.store-self.ts` 的 `Logout` / `SignOut` 確實清 `ss_t`、`ss_mid`、`ss_type` 三個 cookie；缺則補上（**現況**：`ClearInfo()` 已清 ss_t/ss_type/ss_role/ss_mid/ss_name/ss_email 全部 6 個 cookie，無需補上）
- [x] 4.5 處理「進站時並發多個 layout-level fetch」的去重 — middleware 模組 scope 放 `let pendingMe: Promise | null`，多個 hook 共享同一 in-flight；microtask 後重置避免下一次進站抓到 stale

## 5. 前端：fetch 401 redirect lock

- [x] 5.1 在 `app/protocol/fetch-api/methods.ts` 的 `HandleUnauthorized` 加 lock：第一次 401 觸發 `SignOut()` 並設 `isRedirecting=true`，後續 401 直接 return；5 秒後重置
- [x] 5.2 確認 `xhrFileUpload` 401 分支也走同一 `HandleUnauthorized`（既有架構已是；lock 隨之生效）
- [x] 5.3 4xx 非 401（400/403/404/409）路徑保持不變，確保業務層 ElMessage 仍能顯示錯誤（無更動）

## 6. 知識庫同步

- [x] 6.1 更新 `.claude/knowledge/auth-and-rbac.md`：補「DB 存在性驗證」「middleware me 預檢」「401 redirect lock」三段
- [x] 6.2 更新 `.claude/knowledge/deploy-and-env.md`：補「entrypoint shell + set -e」「/nuxt-api/health 規格」「啟動日誌格式」「GIT_COMMIT_SHA 注入方式」「Railway healthcheck 設定」
- [x] 6.3 知識庫尾部「最後更新時間」改為 2026-05-22（含 session 失效偵測與部署同步章節）
- [x] 6.4 更新 `CLAUDE.md` 知識庫對照表的內容欄與建議閱讀時機，反映 auth-and-rbac、deploy-and-env 兩份新增章節

## 7. 驗收：Vitest 單元

- [x] 7.1 `npm test` 全綠（23 個檔案 296 個 case，含新增 auth-guard 20 case + deploy-info 6 case）
- [x] 7.2 `npm run lint` 全綠（`.vscode/demo.vue` 的 lint 錯誤為 pre-existing，與本變更無關）
- [x] 7.3 `npm run build` 全綠（守衛 async 化後型別檢查通過，57 個受保護端點呼叫端皆已 await）

## 8. 驗收：Playwright MCP 實機

- [x] 8.1 啟動 `npm run dev`，瀏覽器登入示範老闆 → 進 `/admin` → 看到歡迎卡與服務/資源/今日預約三張小卡 API 全部 200（merchant/service/resource/appointment 皆 200）
- [x] 8.2 切換各子頁（appointments、services、resources、queue、schedule、settings、staff）每頁 API 200、頁面渲染正常
- [x] 8.3 觀察 `document.cookie` 含 `ss_t/ss_type/ss_role/ss_mid/ss_name/ss_email` 6 個身分 cookie，符合預期
- [x] 8.4 改以 `prisma.merchant.update status=SUSPENDED` 模擬「身分主體在 DB 失效」情境（語義等同 reseed 後 merchantId 失效），不登出
- [x] 8.5 在原分頁重整 `/admin` → middleware 預檢 me 收到 **401** → 自動 redirect 至 `/sign-in`，**network 只一支 me 401，無任何業務 API 被呼叫，不出現滿屏 404**
- [x] 8.6 還原 merchant=ACTIVE，重新登入 → 進 `/admin` merchant/service/resource/appointment 全部 200
- [x] 8.7 平台管理員流程：`/sign-in?type=admin` 登入 → 進 `/sys` `/sys/merchant?status=...` 等 API 200；接著 `adminUser.update isActive=false` 後重整 `/sys` → 自動 redirect 至 `/sign-in?type=admin`，網路僅一支 me 401
- [x] 8.8 健康檢查驗收：`curl /nuxt-api/health` 回 200，body 含 `status=ok / db=connected / migration=20260522000000_introduce_provider_model / commit=dev / uptimeSec`；DB 斷線情境留待測試站手動驗收（本機 DB 為遠端 Railway 無法即時斷線）
- [x] 8.9 啟動日誌驗收：重啟 `npm run dev` 後 stdout 出現 `[boot] migration=20260522000000_introduce_provider_model commit=dev nodeEnv=development` 一行

## 9. 部署同步驗收（測試站）

> 9.x 為部署驗收，需待 PR 合入並部署測試站後由使用者於實機完成。下列為驗收劇本：

- [ ] 9.1 將 PR 合入 dev 後，部署到測試站（Railway / Docker host）；build 時帶 `--build-arg GIT_COMMIT_SHA=$(git rev-parse --short HEAD)`
- [ ] 9.2 deploy log 觀察：`[deploy] running prisma migrate deploy...` → `[deploy] migrate deploy OK` → `[boot] migration=... commit=... nodeEnv=production` → Nitro server listening；順序與本地一致
- [ ] 9.3 訪問測試站 `https://<staging-domain>/nuxt-api/health` 回 200，`migration` 對得上本次部署的 schema、`commit` 對得上 release commit
- [ ] 9.4 模擬 schema drift：PR 中刻意新增一筆 migration（或在 main 分支補一筆未套用），部署後應看到 `migrate deploy` 自動套用該筆且 server 順利啟動；若刻意改錯 `DATABASE_URL`，container 應 exit 非 0、Nitro 不啟動、Railway 保留前一個健康容器
- [ ] 9.5 確認測試站舊登入使用者：若部署過程 reseed 過，舊 token 進站應自動 redirect 至 `/sign-in`（與本地 8.5 同行為，網路僅一支 me 401，無滿屏 404）
