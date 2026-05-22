---
name: 認證與權限模型
description: JWT 簽發/驗證、bcrypt 密碼、三身分（admin/merchant/guest）、HasRule 規則、impersonation 代理鏈防護
type: reference
---

# 認證與權限模型

JWT + bcrypt 認證、三身分權限模型、平台管理員代理（impersonate）。

## 三種身分

| `selfType` | 對象 | 進入點 |
|-----------|------|--------|
| `admin` | 平台管理員 | `/sys/sign-in` → `/sys/*` |
| `merchant` | 商家成員（OWNER/STAFF） | `/sign-in` → `/admin/*` |
| `guest` | 顧客 / 未登入 | `m/[slug]/*`（無守衛） |

> 顧客**沒有帳號**，識別用 `lastName + title + phone` 三元組（見 [data-model.md](./data-model.md#顧客識別三元組)）。

## JWT 設計

`server/utils/auth.ts`：

| 項目 | 值 |
|------|---|
| 演算法 | HS256 |
| Secret | `process.env.JWT_SECRET`（缺失時 throw） |
| 預設 TTL | 14 天 |
| Impersonation TTL | 30 分鐘 |
| Header 格式 | `Authorization: Bearer <token>` |

### Payload

```typescript
interface AuthPayload {
  type: 'admin' | 'merchant';
  sub: string;                          // AdminUser.id 或 MerchantUser.id
  merchantId?: string;                  // type=merchant
  role?: 'OWNER' | 'STAFF';             // type=merchant
  impersonatedBy?: string;              // 代理進入時帶 admin.sub
}
```

## 後端守衛

`requireAdmin` / `requireMerchant` **為 async**，失敗時回傳 `ApiResponse`，呼叫端用 in-check 模式：

```typescript
const auth = await requireMerchant(event, { role: 'OWNER' });
if ('status' in auth) return auth;     // 401 直接 return
```

`requireMerchant(event, { role: 'OWNER' })` 加上 `role` 過濾，STAFF 也會被拒。

### DB 存在性驗證（重要）

守衛在 JWT 簽章驗證通過後 **會再查一次 Prisma** 確認身分主體仍存在：

- `requireMerchant`：查 `MerchantUser`（含 `merchant` join）必須 `isActive=true`、`deletedAt=null`、`user.merchantId === payload.merchantId`、`merchant.status='ACTIVE'`、`merchant.deletedAt=null`
- `requireAdmin`：查 `AdminUser` 必須 `isActive=true`、`deletedAt=null`

不滿足時回 **401**（不是 404），訊息為三語 `MSG_SESSION_EXPIRED`「會話已失效，請重新登入 / Session expired, please sign in again / セッションが失効しました。再度ログインしてください」。

> 此設計保證 reseed / 軟刪除 / 商家停用後，舊 token 進站不會看到「滿屏 404」，而是被前端 401 處理機制乾淨地踢回登入頁。

純判斷邏輯抽出為 `evaluateMerchantSession(payload, user, options)` 與 `evaluateAdminSession(payload, admin)`，可單測。守衛內負責 IO（getAuth + prisma.findUnique）、純函式回 `{ ok, reason, useExpiredMsg }`。

## 密碼雜湊

- 用 `bcrypt`，`BCRYPT_ROUNDS = 10`
- `hashPassword(plain)` 寫入 `passwordHash`
- `verifyPassword(plain, hash)` 登入驗證

## 前端權限：StoreSelf.HasRule

`app/stores/3.store-self.ts` 的 `HasRule(rule: string)` 邏輯：

```
admin                → true（永遠通過）
merchant + OWNER     → 所有 'merchant.*' 為 true
merchant + STAFF     → 'merchant.*' 中，下列字首為 false，其他為 true：
                       - 'merchant.staff.'    （員工管理）
                       - 'merchant.settings.' （商家設定）
                       - 'merchant.billing.'  （帳務，未來）
guest 或不符        → false
```

OWNER_ONLY 字首寫死在 `store-self.ts` 頂部常數 `OWNER_ONLY_PREFIXES`。

**前端 `HasRule` 只是 UI 顯示守門**，**後端必須**用 `requireMerchant({ role: 'OWNER' })` 再次把關。

## 平台管理員代理（impersonate）

`POST /nuxt-api/sys/merchant/[id]/impersonate`（見 [api-modules.md](./api-modules.md#sys--平台管理員)）：

1. `requireAdmin`
2. **拒絕代理鏈**：來源 token 若已有 `impersonatedBy` → 403（防止 admin A 代理 admin B 再代理 merchant）
3. 找該 merchant 第一個 `role=OWNER` + `isActive` + 未刪除的成員
4. merchant 必須 `status=ACTIVE`
5. 簽發 30 分鐘短 token，payload `{ type: 'merchant', sub: ownerId, merchantId, role: 'OWNER', impersonatedBy: adminId }`
6. 前端 `UseImpersonation().EnterImpersonation(...)` 把目前 admin 身分備份到 `ss_back_*` cookie，再切到 merchant 身分

退出：`UseImpersonation().ExitImpersonation()` 從 `ss_back_*` 還原、清備份、跳 `/sys/merchants`。

## 加密 Cookie / Storage

身分相關狀態都用 `UseEncryptCookie<T>` 持久化：

| Cookie key | 用途 |
|-----------|------|
| `ss_t` | API token |
| `ss_type` | `SelfType` |
| `ss_role` | OWNER / STAFF / ADMIN |
| `ss_mid` | merchantId |
| `ss_name` / `ss_email` | 顯示用 |
| `ss_back_*` | impersonation 備份 |

顧客 session 用 `UseEncryptStorage<T>('cs_t', ...)`（加密 localStorage）。

## 頁面層守衛

| Middleware | 守衛 |
|-----------|------|
| `admin` | `selfType !== 'admin'` → `/sys/sign-in`；其餘進站前 await `$api.MeInfo()` 驗 session |
| `merchant` | `selfType !== 'merchant'` → `/sign-in`；其餘進站前 await `$api.MeInfo()` 驗 session |

兩支都 **async** + me 預檢：

```typescript
if (import.meta.server) return;             // SSR 短路
if (!isSignIn || selfType !== '...') return navigateTo('/...');
const result = await checkMe();              // 模組 scope 共享 in-flight promise
if (result === 'fail') { storeSelf.ClearInfo(); return navigateTo('/...'); }
```

- 失敗清 cookie：`storeSelf.ClearInfo()`（清 ss_t / ss_type / ss_role / ss_mid / ss_name / ss_email 全部 6 個）
- 並發去重：middleware 模組 scope 放 `let pendingMe: Promise<...> | null`；microtask 後重置

兩支只查 `selfType`，**不**做 role 細項檢查（細項由 `HasRule` + 後端守衛把關）。詳見 [data-and-routing.md](./data-and-routing.md#middleware)。

## 前端 401 處理（redirect lock）

`app/protocol/fetch-api/methods.ts` 的 `onResponseError` 收到 401 時呼叫 `HandleUnauthorized`：

1. 若 `isRedirecting` 已 true，直接 return（避免並發多 API 同時 401 觸發多次 navigate）
2. `guest` 不跳轉
3. 設 `isRedirecting=true`，呼叫 `storeSelf.SignOut()`（內部 ClearInfo + navigateTo 對應登入頁）
4. 5 秒後重置 `isRedirecting=false`

`xhrFileUpload` 401 分支也走同一 `HandleUnauthorized`，lock 一體適用。
