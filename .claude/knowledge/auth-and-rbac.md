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

`requireAdmin` / `requireMerchant` **失敗時回傳 `ApiResponse`**，呼叫端用 in-check 模式：

```typescript
const auth = requireMerchant(event, { role: 'OWNER' });
if ('status' in auth) return auth;     // 401 直接 return
```

`requireMerchant(event, { role: 'OWNER' })` 加上 `role` 過濾，STAFF 也會被拒。

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
| `admin` | `selfType !== 'admin'` → `/sys/sign-in` |
| `merchant` | `selfType !== 'merchant'` → `/sign-in` |

兩支只查 `selfType`，**不**做 role 細項檢查（細項由 `HasRule` + 後端守衛把關）。詳見 [data-and-routing.md](./data-and-routing.md#middleware)。
