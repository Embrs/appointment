## ADDED Requirements

### Requirement: StoreSelf 多角色身分

`StoreSelf` SHALL 擴充以表達「我是誰」，支援 admin / merchant / 顧客匿名三種狀態。

#### Scenario: 新增欄位
- **WHEN** 讀取 `StoreSelf()`
- **THEN** SHALL 暴露既有 `apiToken / isSignIn / SetToken / SignOut`
- **AND** SHALL 額外暴露 `selfType (Ref<'admin' | 'merchant' | 'guest'>)`
- **AND** SHALL 額外暴露 `merchantId (Ref<string>)`
- **AND** SHALL 額外暴露 `role (Ref<'OWNER' | 'STAFF' | 'ADMIN' | ''>)`
- **AND** SHALL 額外暴露 `userName (Ref<string>)`、`userEmail (Ref<string>)`

#### Scenario: 持久化
- **WHEN** 設定 `selfType / merchantId / role` 後重新整理頁面
- **THEN** SHALL 透過加密 cookie 還原（共用 `UseEncryptCookie`）
- **AND** 既有 `apiToken (ss_t)` 行為 SHALL 不變

#### Scenario: 既有介面相容
- **WHEN** 既有頁面或工具呼叫 `storeSelf.apiToken / isSignIn / SetToken / SignOut`
- **THEN** SHALL 完全保持原本行為（不破壞）

### Requirement: HasRule 權限檢查

`StoreSelf` SHALL 提供 `HasRule(rule: string): boolean` 用於前端權限檢查。

#### Scenario: admin 全通
- **WHEN** `selfType === 'admin'` 呼叫 `HasRule(任何字串)`
- **THEN** SHALL 回傳 `true`

#### Scenario: merchant OWNER
- **WHEN** `selfType === 'merchant' && role === 'OWNER'`
- **AND** 呼叫 `HasRule('merchant.*')` 或具體商家權限
- **THEN** SHALL 回傳 `true`

#### Scenario: merchant STAFF 受限
- **WHEN** `selfType === 'merchant' && role === 'STAFF'`
- **AND** 呼叫 `HasRule('merchant.staff.manage')` 之類僅限 OWNER 的權限
- **THEN** SHALL 回傳 `false`
- **AND** 呼叫 `HasRule('merchant.appointment.read')` 之類 STAFF 允許的權限
- **THEN** SHALL 回傳 `true`

#### Scenario: 未登入
- **WHEN** `selfType === 'guest'` 或未登入呼叫 `HasRule(任何字串)`
- **THEN** SHALL 回傳 `false`

### Requirement: 401 自動跳轉

`app/protocol/fetch-api/methods.ts` SHALL 在 API 回應 401 時自動清除身分並跳轉登入頁。

#### Scenario: admin 401
- **WHEN** API 響應狀態為 401 且 `StoreSelf.selfType === 'admin'`
- **THEN** SHALL 清除 token 與相關身分欄位
- **AND** SHALL `navigateTo('/sys/sign-in')`

#### Scenario: merchant 401
- **WHEN** API 響應狀態為 401 且 `StoreSelf.selfType === 'merchant'`
- **THEN** SHALL 清除 token 與相關身分欄位
- **AND** SHALL `navigateTo('/sign-in')`

#### Scenario: 顧客頁面 401
- **WHEN** API 響應狀態為 401 且 `StoreSelf.selfType === 'guest'`
- **THEN** 不 SHALL 跳轉（顧客頁面不應收到 401，但 defensive 處理）
- **AND** 錯誤 SHALL 仍走 onResponseError 原本流程

### Requirement: 具名 middleware

系統 SHALL 提供 `app/middleware/admin.ts` 與 `app/middleware/merchant.ts` 兩個具名 middleware，並刪除空白 `demo.global.ts`。

#### Scenario: admin middleware 未登入
- **WHEN** 頁面用 `definePageMeta({ middleware: ['admin'] })` 且 `StoreSelf.selfType !== 'admin'`
- **THEN** SHALL 重導向到 `/sys/sign-in`

#### Scenario: merchant middleware 未登入
- **WHEN** 頁面用 `definePageMeta({ middleware: ['merchant'] })` 且 `StoreSelf.selfType !== 'merchant'`
- **THEN** SHALL 重導向到 `/sign-in`

#### Scenario: admin / merchant middleware 已登入
- **WHEN** middleware 對應角色匹配
- **THEN** SHALL 放行不重導

#### Scenario: demo.global.ts 移除
- **WHEN** 檢視 `app/middleware/`
- **THEN** SHALL 不存在 `demo.global.ts`
- **AND** SHALL 存在 `admin.ts` 與 `merchant.ts`
