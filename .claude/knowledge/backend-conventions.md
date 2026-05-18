---
name: 後端編碼規範
description: API 路由結構、return 非 throw 錯誤處理、ApiResponse 格式、三語訊息、認證守衛用法、sanitizeNulls
type: reference
---

# 後端編碼規範（Server API）

Nitro server routes 位於 `server/routes/nuxt-api/`，以 `@@` 別名引用 `server/`。

## API 路由結構

每個資源依 HTTP 方法拆檔：

```
server/routes/nuxt-api/{資源}/
  index.get.ts    — 列表
  index.post.ts   — 新增
  [id].get.ts     — 詳情
  [id].put.ts     — 更新
  [id].delete.ts  — 刪除
  [id]/{action}.post.ts — 子動作（cancel、approve、impersonate 等）
```

## 錯誤處理（核心規則）

- **使用 `return` 回傳錯誤，禁止 `throw`** — 後端任何錯誤條件都必須 `return errorXxx(event, ...)`
- 從 `@@/utils/response` 取錯誤建構器：

| 函式 | HTTP code | 用途 |
|------|-----------|------|
| `successResponse(data, message?)` | 200 | 成功 |
| `badRequestError(event, message?)` | 400 | 參數錯 |
| `unauthorizedError(event, message?)` | 401 | 未登入 |
| `forbiddenError(event, message?)` | 403 | 無權限 |
| `notFoundError(event, message?)` | 404 | 資源不存在 |
| `conflictError(event, message?)` | 409 | 衝突（時段被搶、重複領號） |
| `tooManyRequestsError(event, message?)` | 429 | rate limit |
| `serverError(event, message?)` | 500 | 系統錯誤 |

> `buildError` 內部會同步設 `setResponseStatus(event, code)`，body 的 `status.code` 與 HTTP status 永遠一致。

## 三語錯誤訊息（必須）

每個 `I18nMessage` 都必須提供 `zh_tw` / `en` / `ja` 三語。慣例做法：把訊息常數宣告在檔案頂部或 util 內。

```typescript
const MSG_SLOT_TAKEN: I18nMessage = {
  zh_tw: '該時段已被預約',
  en: 'This time slot has been taken',
  ja: 'この時間帯は予約済みです'
};
return conflictError(event, MSG_SLOT_TAKEN);
```

`response.ts` 內建 200/400/401/403/404/409/429/500 的預設三語訊息，呼叫 `xxxError(event)` 不帶第二參數即可使用。

## 統一響應格式

```typescript
{
  data: T,                              // 成功時為實際資料；錯誤時為 {}
  status: {
    code: number,                       // 與 HTTP status 同步
    message: { zh_tw, en, ja }
  }
}
```

## sanitizeNulls（自動 null → 空字串）

`successResponse(data)` 會遞迴把 `data` 內的 `null` 轉成 `''`（保留 `Date` 與 `undefined`）。前端因此**永遠不需要**處理 `null`／預設值。

## 認證守衛（return 模式）

`@@/utils/auth` 提供 `requireAdmin` / `requireMerchant`，失敗時直接回傳 `ApiResponse`，呼叫端用 in-check 模式：

```typescript
export default defineEventHandler(async (event) => {
  const auth = requireMerchant(event, { role: 'OWNER' });  // 可選 role 過濾
  if ('status' in auth) return auth;   // 401 直接回出
  // auth: AuthPayload — type/sub/merchantId/role/impersonatedBy
});
```

> 詳見 [auth-and-rbac.md](./auth-and-rbac.md)。

## Rate limit

可變速率限制：
```typescript
import { checkRateLimit } from '@@/utils/rate-limit';

const limit = await checkRateLimit(`lookup:${phone}`, 5, 60);  // 60 秒 5 次
if (!limit.ok) return tooManyRequestsError(event);
```

> 詳見 [data-model.md](./data-model.md#ratelimitbucket--joblock)。

## 前後端共享

- 共享程式碼放在 `shared/`，以 `~shared` 別名引用
- 前端 `$api.*` 透過 `app/protocol/fetch-api/` 統一處理 `status.code !== success` 判斷
