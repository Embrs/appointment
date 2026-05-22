# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 語言規則

- 所有對話、回覆、註解說明一律使用**繁體中文**
- 程式碼中的變數名稱、函式名稱維持英文
- Git commit message 使用繁體中文，遵循 Conventional Commits 格式（`feat:`, `fix:`, `docs:`, `refactor:`, `style:`, `chore:`）
  - 範例：`feat: 新增使用者列表分頁`、`fix: 修正登入後 Token 未更新問題`

## 常用指令

```bash
npm run dev          # 開發伺服器（使用 .env.dev，端口 3000）
npm run build        # 生產構建
npm run preview      # 本地預覽生產構建
npm run lint         # ESLint 檢查
npm run lint:fix     # ESLint 自動修復
npm test             # Vitest 單元測試（目前覆蓋 availability 引擎）
npx prisma migrate dev   # 套用資料庫遷移
npx prisma studio        # 開啟 Prisma Studio 視覺化資料庫
```

- 環境需求：Node.js >= 24.13.0
- 測試框架：**Vitest**（設定檔 `vitest.config.ts`，測試位於 `server/__tests__/`）
- `npm run dev` 會載入 `.env.dev`；新環境需先自行建立該檔（可參考 `.env.example`）
- `postinstall` 會自動執行 `prisma generate` + `nuxt prepare` + `node scripts/copy-tinymce.mjs`

## 專案架構

多商家預約平台 SaaS：Nuxt 4 全端應用，前端 Vue 3 Composition API + TypeScript + Element Plus + Pinia，後端 Nitro Server + Prisma ORM + PostgreSQL，部署目標 Docker / Railway。

### 目錄結構

- `app/` — 應用程式核心（pages、components、composables、stores、utils、plugins、protocol、middleware）
- `server/` — Nitro 伺服器端
  - `routes/nuxt-api/` — API 路由（使用 `@@` 別名）
  - `utils/` — 後端工具（`auth`、`availability`、`booking`、`prisma`、`r2`、`rate-limit`、`response`、`queue`、`queue-window-schema`、`job-lock`）
  - `__tests__/` — Vitest 單元測試
- `prisma/` — 資料庫 schema、遷移檔、seed 腳本
- `i18n/locales/` — 多語系翻譯檔（zh、en、ja）
- `types/` — 全局 TypeScript 型別定義
- `shared/` — 前後端共享程式碼（以 `~shared` 別名引用）
- `openspec/` — OpenSpec 規格系統，新增功能或重構時透過 openspec skill 建立變更提案
- `scripts/` — 一次性腳本（如 TinyMCE 複製、Queue 探針）

### 業務模組總覽

| 模組 | 範圍 | OpenSpec spec |
|------|------|---------------|
| 認證 / 入駐 | 商家註冊、登入、忘記密碼、Customer Session | `auth-flow` |
| 平台管理員 | 平台後台（sys/*）、商家審核、停權、impersonate | `platform-admin` |
| 商家後台 | 服務、資源、員工、排班、假日、設定（admin/*） | `merchant-platform` |
| 可用時段引擎 | `server/utils/availability.ts` + `public/availability` | `public-availability` |
| 顧客預約流程 | `m/[slug]/*` 公開頁、預約建立 / 取消 / 查詢 | `customer-booking` |
| 號碼牌即時叫號 | Queue tickets、WebSocket、Cron 歸檔 | `queue-tickets` |
| 部署與收尾 | i18n、廣告 slot、Cron、Dockerfile | `finalize-deploy` |

### 路徑別名

| 別名 | 對應路徑 |
|------|---------|
| `~` / `~/` | `./app` |
| `@` / `@/` | `./app/assets` |
| `@@` | `./server` |
| `~shared` | `./shared` |

## 知識庫

詳細規範與技術知識存放於 `.claude/knowledge/`，按需讀取以減少上下文消耗：

| 文件 | 內容 | 建議閱讀時機 |
|------|------|-------------|
| [frontend-conventions.md](.claude/knowledge/frontend-conventions.md) | SFC 結構、Pug/SCSS BEM、Element Plus 限制、客製指令、TinyEditor | 撰寫或修改 Vue 組件、頁面、SCSS 樣式時 |
| [backend-conventions.md](.claude/knowledge/backend-conventions.md) | API 路由結構、`return` 非 `throw` 錯誤處理、ApiResponse 格式、三語訊息 | 撰寫 `server/routes/nuxt-api/*` 端點時 |
| [stores-and-globals.md](.claude/knowledge/stores-and-globals.md) | Pinia stores 清單、composables、自動導入、彈窗系統、`$api` 範式 | 操作 store、使用 `Use*()` / `$*` 全局工具、開啟業務彈窗時 |
| [data-and-routing.md](.claude/knowledge/data-and-routing.md) | Layouts、middleware 守衛、頁面路由結構、i18n 策略、Nitro 設定 | 改動頁面/layout/middleware、處理 i18n、調整 Nitro 設定時 |
| [data-model.md](.claude/knowledge/data-model.md) | Prisma 模型分群、enum 取值、軟刪除約定、顧客三元組識別 | 查詢/修改 schema、改動任何 Prisma model 操作時 |
| [api-modules.md](.claude/knowledge/api-modules.md) | 13 個 `nuxt-api/` 資源目錄職責、認證需求、與 spec 對應 | 找端點位置、新增 API、判斷該掛哪支守衛時 |
| [availability-and-booking.md](.claude/knowledge/availability-and-booking.md) | `availability.ts` 純函式設計、BookingMode 分流、`createAppointment` advisory lock、取消政策 | 改動預約流程、可用時段算法、`booking.ts` / `availability.ts` 時 |
| [queue-realtime.md](.claude/knowledge/queue-realtime.md) | 號碼牌全棧：DB 三表 + WS 廣播 + walk-in 代建 + claim QR + 店面大螢幕 + ETA 預估 + 商家叫號台 UX（多 CALLED、tabs、搜尋、RWD） | 改動號碼牌相關（領號、叫號、ws、StoreQueueRealtime、display、claim、ETA、admin 叫號台）時 |
| [auth-and-rbac.md](.claude/knowledge/auth-and-rbac.md) | JWT 簽發/驗證、bcrypt、三身分、`HasRule` 規則、impersonation 代理鏈防護 | 改動登入、權限檢查、impersonate、`requireAdmin/Merchant` 時 |
| [deploy-and-env.md](.claude/knowledge/deploy-and-env.md) | Dockerfile multi-stage、環境變數清單、cron jobs、R2、JobLock / RateLimit | 部署、環境變數調整、cron 排程、R2 上傳、排程互斥時 |

> 知識庫結構：fact-context-layered-v1
> 最後更新時間：2026-05-22
