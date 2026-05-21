---
name: Layouts、Middleware 與多語系
description: Nuxt Layouts、頁面 middleware 守衛、i18n prefix_except_default 策略、路徑別名、Nitro 設定
type: reference
---

# Layouts、Middleware 與多語系

頁面結構守衛、路由策略、多語系。

## Layouts

| Layout | 對應頁面 |
|--------|---------|
| `default` | `index.vue`、`sign-in.vue`、`sign-up.vue`、`forgot-password.vue`、`demo/*` |
| `front-desk` | 顧客端 `m/[slug]/*`（公開預約頁、號碼牌） |
| `back-desk` | 商家後台 `admin/*` + 平台後台 `sys/*` |

## Middleware

`app/middleware/` 內僅兩支頁面守衛，頁面以 `definePageMeta({ middleware: [...] })` 掛載：

| Middleware | 守衛範圍 | 失敗跳轉 |
|-----------|---------|---------|
| `admin` | 平台管理員存取（`sys/*`） | `/sys/sign-in` |
| `merchant` | 商家後台存取（`admin/*`） | `/sign-in` |

> 兩支只檢查 `StoreSelf().selfType` 是否符合，**不**檢查細項權限；細項由前端 `HasRule()` 與後端 `requireMerchant({ role })` 共同把關。詳見 [auth-and-rbac.md](./auth-and-rbac.md)。

## 頁面路由結構

```
app/pages/
  index.vue                       — 首頁
  sign-in.vue                     — 商家登入
  sign-up.vue                     — 商家註冊
  forgot-password.vue             — 忘記密碼
  m/[slug]/
    index.vue                     — 商家公開頁
    book.vue                      — 預約建立
    lookup.vue                    — 預約查詢
    my-bookings.vue               — 我的預約（跨商家彙整）
    display.vue                   — 店面大螢幕投影（front-desk layout + displayMode meta）
    queue/index.vue               — 領號
    queue/status.vue              — 等待頁（支援 ?token=claim 與 ?id= 雙入口）
    queue/find.vue                — 手機末 4 碼回查（localStorage 失效兜底）
  admin/                          — 商家後台（middleware: merchant）
    index.vue                     — Dashboard
    appointments/{index,calendar,archive}.vue
    services/index.vue
    resources/index.vue
    schedule/index.vue
    holidays.vue
    queue.vue                     — 號碼牌控制台（含 walk-in 代建、開啟顯示頁）
    queue-window.vue              — QUEUE 服務領號時段設定
    staff.vue
    settings.vue
    share-link.vue                — QR 與分享連結
  sys/                            — 平台後台（middleware: admin）
    index.vue / sign-in.vue
    merchants/{index,[id]}.vue
    admins.vue
    impersonate/[merchantId].vue
```

## 路徑別名

| 別名 | 對應 |
|------|------|
| `~` / `~/` | `./app` |
| `@` / `@/` | `./app/assets` |
| `@@` | `./server` |
| `~shared` | `./shared` |

設定處:`nuxt.config.ts` 的 `alias` 區塊（`@@` 與 `~shared`）+ Nuxt 預設別名。

## 多語系（i18n）

由 `@nuxtjs/i18n` v10 提供：

| 設定 | 值 |
|------|---|
| 語系列表 | `zh`（繁中，`zh-Hant-TW`）/ `en` / `ja` |
| 預設語系 | `zh` |
| 路由策略 | `prefix_except_default`（預設語系不加前綴，其他加 `/en/` 或 `/ja/`） |
| 翻譯檔位置 | `i18n/locales/{zh.js,en.js,ja.js}` |
| 瀏覽器偵測 | `useCookie: true`、`cookieKey: 'i18n_redirected'`、`redirectOn: 'root'` |

後端錯誤訊息也必須提供三語言（見 [backend-conventions.md](./backend-conventions.md)）。

## Nitro 設定重點

`nuxt.config.ts` → `nitro`：

- `compressPublicAssets: { gzip: true }`
- `experimental.websocket: true`（號碼牌即時叫號需要，見 [queue-realtime.md](./queue-realtime.md)）
- 無 devProxy / routeRules 客製
