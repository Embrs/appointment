## ADDED Requirements

### Requirement: 統一響應工具 (response.ts)

系統 SHALL 在 `server/utils/response.ts` 提供統一響應工具集，所有 API 回傳 `{ data, status: { code, message: { zh_tw, en, ja } } }`。

#### Scenario: 成功響應
- **WHEN** server 處理器呼叫 `successResponse(data)`
- **THEN** SHALL 回傳 `{ data: <sanitized data>, status: { code: 200, message: { zh_tw: '成功', en: 'Success', ja: '成功' } } }`
- **AND** HTTP response status SHALL 為 200
- **AND** data 內所有 `null` 值 SHALL 被轉為空字串 `''`
- **AND** `status.code` SHALL 對齊既有前端 `$enum.apiStatus.success === 200`

#### Scenario: 錯誤響應族（badRequest / notFound / forbidden / unauthorized / conflict / server）
- **WHEN** server 處理器呼叫 `badRequestError(messages)` 或 `notFoundError(messages)` 或 `forbiddenError(messages)` 或 `unauthorizedError(messages)` 或 `conflictError(messages)` 或 `serverError(messages)`
- **THEN** SHALL 同時設定 HTTP response status 與 `status.code` 為對應 HTTP code（400 / 404 / 403 / 401 / 409 / 500）
- **AND** `status.message` SHALL 為 `{ zh_tw, en, ja }` 三語訊息（呼叫端可覆寫，未指定則用預設訊息）

#### Scenario: 後端禁用 throw
- **WHEN** 任何 server 處理器要回傳錯誤
- **THEN** SHALL 使用 `return <errorFn>(...)` 而非 `throw createError(...)`

#### Scenario: sanitizeNulls
- **WHEN** 呼叫 `sanitizeNulls(obj)`
- **THEN** SHALL 遞迴將物件/陣列中所有 `null` 值替換成空字串
- **AND** 非 null 的原始型別、Date、嵌套結構 SHALL 保留

### Requirement: Prisma singleton (prisma.ts)

系統 SHALL 在 `server/utils/prisma.ts` 提供 PrismaClient singleton，避免 dev 模式 hot reload 重複連線。

#### Scenario: 取得 client
- **WHEN** server 處理器 `import { prisma } from '@@/utils/prisma'`
- **THEN** SHALL 取得同一個 `PrismaClient` 實例
- **AND** dev 模式 SHALL 將實例掛在 `globalThis.__prisma` 上避免重建

### Requirement: JWT 認證工具 (auth.ts)

系統 SHALL 在 `server/utils/auth.ts` 提供 JWT 簽發/解析與三個 helper：`getAuth`、`requireAdmin`、`requireMerchant`。

#### Scenario: signToken
- **WHEN** 呼叫 `signToken({ type, sub, merchantId?, role?, impersonatedBy? }, ttlSeconds?)`
- **THEN** SHALL 使用 `JWT_SECRET` 簽出 HS256 JWT
- **AND** 預設 TTL SHALL 為 14 天，可被參數覆寫

#### Scenario: getAuth — 解析 Header
- **WHEN** Server handler 拿到 `event` 呼叫 `getAuth(event)`
- **THEN** SHALL 從 `Authorization: Bearer <token>` 解析 JWT
- **AND** 有效 token SHALL 回傳 payload；無效或缺失 SHALL 回傳 `null`

#### Scenario: requireAdmin
- **WHEN** Server handler 呼叫 `await requireAdmin(event)`
- **THEN** payload `type === 'admin'` 時 SHALL 回傳 payload
- **AND** 否則 SHALL 回傳 `unauthorizedError(...)` 的響應（呼叫端 `if (!auth || 'status' in auth) return auth`）

#### Scenario: requireMerchant
- **WHEN** Server handler 呼叫 `await requireMerchant(event)`
- **THEN** payload `type === 'merchant'` 時 SHALL 回傳 payload
- **AND** 否則 SHALL 回傳 `unauthorizedError` 響應

#### Scenario: hashPassword / verifyPassword
- **WHEN** 呼叫 `hashPassword(plain)` 或 `verifyPassword(plain, hash)`
- **THEN** SHALL 走 `bcrypt`，rounds = 10

### Requirement: R2 上傳工具 (r2.ts)

系統 SHALL 在 `server/utils/r2.ts` 提供 `uploadToR2(key, body, contentType)`。

#### Scenario: 上傳檔案
- **WHEN** Server handler 呼叫 `await uploadToR2(key, body, contentType)`
- **THEN** SHALL 使用 `@aws-sdk/client-s3` PutObjectCommand 上傳到 `R2_ENDPOINT / R2_BUCKET`
- **AND** 成功 SHALL 回傳 `{ url: \`${R2_PUBLIC_BASE}/${key}\` }`
- **AND** 失敗 SHALL 回傳 `{ error: <error message> }`（不拋例外）

#### Scenario: 環境變數未配置時
- **WHEN** `R2_ENDPOINT` 或 `R2_BUCKET` 為空
- **THEN** `uploadToR2` SHALL 直接回傳 `{ error: 'R2 not configured' }`，不嘗試呼叫遠端

### Requirement: Rate limit 工具 (rate-limit.ts)

系統 SHALL 在 `server/utils/rate-limit.ts` 提供 `checkRateLimit(key, limit, windowSeconds)`，基於 `RateLimitBucket` 表。

#### Scenario: 通過
- **WHEN** Server handler 呼叫 `await checkRateLimit('lookup:0912345678', 5, 60)`
- **THEN** 此 key 在當前 window 內呼叫次數 < limit 時 SHALL 回傳 `{ ok: true }`
- **AND** 並 SHALL 在 DB 將該 window 的 count +1

#### Scenario: 超出
- **WHEN** 呼叫次數 ≥ limit
- **THEN** SHALL 回傳 `{ ok: false, retryAfterSeconds }`

#### Scenario: window 切分
- **WHEN** 計算當前 window
- **THEN** SHALL 用 `floor(Date.now() / 1000 / windowSeconds) * windowSeconds * 1000` 取得 `windowStart`，確保同一 key 同一窗口聚合
