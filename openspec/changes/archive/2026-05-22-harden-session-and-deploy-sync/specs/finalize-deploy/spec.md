# finalize-deploy Specification Delta

## MODIFIED Requirements

### Requirement: Docker 與部署可重現

The Dockerfile SHALL run `npx prisma generate` at build time and `npx prisma migrate deploy` at container startup. The migration step at startup SHALL be the entrypoint's first action, and SHALL exit with a non-zero status if migration fails (preventing the Nitro server from booting against a stale schema). A `.env.example` SHALL list every required environment variable with comments.

#### Scenario: docker build 成功

- **When** `docker build -t appointment .`
- **Then** builder stage 成功跑 `npm ci` → `npx prisma generate` → `npm run build`，產物含 `node_modules/.prisma/client`

#### Scenario: 容器啟動跑 migration

- **Given** Railway / 任意 Docker host 新部署
- **When** 容器啟動
- **Then** entrypoint 先跑 `npx prisma migrate deploy`，成功後啟動 Nitro server；過程在 stdout 印出 `[deploy] migrate deploy OK`

#### Scenario: migration 失敗中止啟動

- **Given** 新部署的 image 含一筆 migration，但執行時失敗（語法錯、constraint 衝突、DATABASE_URL 不通等）
- **When** 容器啟動
- **Then** entrypoint SHALL 以 exit code 非 0 結束，**不**啟動 Nitro server；Railway / orchestrator 偵測 unhealthy 後保留前一版容器繼續服務（rolling deploy 行為），同時於 deploy log 留下完整錯誤訊息供排查

#### Scenario: 本地與 CI 都能重現

- **Given** 開發者本地或 CI 環境
- **When** 執行 `docker run --env-file .env.dev appointment`
- **Then** 行為一致：先 migrate deploy 再啟動 server；migration 失敗不啟動

#### Scenario: .env.example 完整

- **Given** README 提及部署需要的環境變數
- **When** 開發者複製 `.env.example` 為 `.env`
- **Then** 含 DATABASE_URL、JWT_SECRET、R2_*、CRON_SECRET、NUXT_API_BASE 等所有變數，附用途註解

## ADDED Requirements

### Requirement: 健康檢查與部署可觀測性端點

系統 SHALL 提供 `GET /nuxt-api/health` 公開端點（無需認證），回報應用啟動狀態與資料庫連線狀態，作為 Railway / 監控/巡檢的入口。當資料庫連線正常時回 200，連線失敗時回 503。回應 SHALL 含當前已套用的最新 migration 名稱與 commit hash（如 build 時注入），方便人工確認部署是否到位。

#### Scenario: 健康檢查正常

- **GIVEN** 應用正常啟動、DB 可連線
- **WHEN** `GET /nuxt-api/health`
- **THEN** 響應 200，`data` 含 `{ status: 'ok', db: 'connected', migration: '<最新 migration name>', commit: '<short sha 或 "unknown">', uptimeSec: <number> }`

#### Scenario: 資料庫斷線

- **GIVEN** 應用已啟動但資料庫無法連線（網路 / 帳密錯）
- **WHEN** `GET /nuxt-api/health`
- **THEN** 響應 503，`data` 含 `{ status: 'degraded', db: 'disconnected' }`，並於 server log 留下錯誤

#### Scenario: 健康檢查不需認證

- **GIVEN** 無 Authorization header
- **WHEN** `GET /nuxt-api/health`
- **THEN** 仍回 200 / 503，**不**回 401；端點不洩漏內部敏感欄位（如 DATABASE_URL、JWT_SECRET）

### Requirement: 啟動日誌印出 migration 與 commit hash

Nitro server 啟動完成時 SHALL 於 stdout 印出當前已套用最新 migration 名稱、應用版本（commit hash 或 `package.json` version），方便部署後快速確認版本到位。

#### Scenario: 啟動日誌可見

- **GIVEN** 容器或 `npm run dev` 啟動
- **WHEN** Nitro server 就緒
- **THEN** stdout 出現一行（或數行）形如 `[boot] migration=20260521xxxxxx commit=<short sha or "dev"> nodeEnv=production`

#### Scenario: 無 commit hash 時退回 dev

- **GIVEN** build 階段未注入 `GIT_COMMIT_SHA` 環境變數（如本地 dev）
- **WHEN** 啟動日誌印出
- **THEN** `commit=dev` 或 `commit=unknown`，**不**讓啟動失敗

