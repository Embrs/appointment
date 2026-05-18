## ADDED Requirements

### Requirement: default layout 骨架

`app/layouts/default.vue` SHALL 提供一個簡潔的全域 layout，用於登入、登出、靜態介紹頁。

#### Scenario: 結構
- **WHEN** 頁面使用 `definePageMeta({ layout: 'default' })`
- **THEN** layout SHALL 渲染 `<NuxtPage />`（或 `<slot />`）內容
- **AND** SHALL 不含 nav / sidebar
- **AND** SHALL 套用全域 SCSS 樣式（不額外引入業務元素）

### Requirement: front-desk layout 骨架（顧客面）

`app/layouts/front-desk.vue` SHALL 提供顧客面 layout，含頂部 header 殼。

#### Scenario: 結構
- **WHEN** 頁面用 `definePageMeta({ layout: 'front-desk' })`
- **THEN** SHALL 渲染 `header`（含商家名稱 placeholder + 語系切換按鈕殼）+ `<NuxtPage />` 主內容區
- **AND** SHALL 支援 RWD（手機顯示時 header 高度合理）

#### Scenario: 不含後台元素
- **WHEN** 檢視 front-desk layout
- **THEN** SHALL 不含「登出」按鈕（顧客是匿名）
- **AND** SHALL 不含側邊 nav

### Requirement: back-desk layout 骨架（後台）

`app/layouts/back-desk.vue` SHALL 提供管理員/商家後台 layout，含側邊 nav 殼 + 頂部 header。

#### Scenario: 結構
- **WHEN** 頁面用 `definePageMeta({ layout: 'back-desk' })`
- **THEN** SHALL 渲染側邊 nav 區（內容由後續 changes 填）+ 頂部 header（含登出按鈕呼叫 `StoreSelf.SignOut()`）+ `<NuxtPage />` 主內容區
- **AND** SHALL 在使用者為 admin 時於頂部顯示「平台管理員」標記殼
- **AND** SHALL 在使用者為 admin 代理某商家時顯示紅色「代理中」橫條殼（本 change 內 v-if 條件先綁 false placeholder）

#### Scenario: 登出按鈕
- **WHEN** 使用者點擊 header 登出按鈕
- **THEN** SHALL 呼叫 `StoreSelf.SignOut()` 清除 token 並跳轉

### Requirement: 環境變數 .env.dev

`.env.dev` SHALL 提供完整的開發環境變數範本。

#### Scenario: 必要變數
- **WHEN** 開發者建立 `.env.dev`
- **THEN** SHALL 包含 `DATABASE_URL`、`JWT_SECRET`、`R2_ENDPOINT`、`R2_ACCESS_KEY`、`R2_SECRET_KEY`、`R2_BUCKET`、`R2_PUBLIC_BASE`、`CRON_SECRET` 八個變數
- **AND** SHALL 含註解說明每個變數用途

#### Scenario: 啟動
- **WHEN** 開發者跑 `npm run dev`
- **THEN** Nuxt SHALL 載入 `.env.dev` 並注入到 `process.env`
- **AND** Prisma SHALL 透過 `DATABASE_URL` 連線
