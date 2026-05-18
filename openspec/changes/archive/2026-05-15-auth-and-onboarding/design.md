# Auth & Onboarding 設計筆記

## 1. 雙身分登入：同端點 vs 分端點

**選擇**：同端點 `POST /nuxt-api/auth/sign-in`，由 `type` 欄位切換。

**理由**：
- 兩種身分的 request shape 完全一致（email + password）；分端點純粹翻倍維護
- JWT 與回傳 payload 差異由 server 決定，前端只需要關心「我登入的是哪個身分」並把 type 傳上去
- 未來新增「員工帳號登入（也屬 merchant 一脈）」也能放同端點

**取捨**：分端點能直接從 URL 看出語意（觀測友善），但 MVP 不值。

## 2. 商家註冊後不簽 JWT

**選擇**：sign-up 成功後**完全不簽 token**，僅 return `pending: true`，前端切換到「待審核」靜態畫面。

**理由**：
- 業務語意是「先排隊等審核」，發 token 意味「已是會員」會誤導
- 避免 PENDING 商家用 token 呼叫商家 API，server 還得多一層擋
- 退一步說，即使日後改為審核期間能查詢自己的申請進度，也應該用「temporary signup token + 限定 scope」而不是直接核發正式 token，現在不開這個口

## 3. 商家狀態檢查放 sign-in，不是 middleware

**選擇**：在 `sign-in.post.ts` 內直接讀 `Merchant.status` 並依四種值回對應 403/401；不在 `requireMerchant` 內檢查。

**理由**：
- JWT 已含 merchantId，但每次 API 都查 `Merchant.status` 會多一次 DB query；MVP 商家被 SUSPENDED 是低頻事件，登入時擋一次就好
- 若日後要做「即時停用」（管理員按下停用，商家立即被踢），再在 `requireMerchant` 加 `Merchant.status === 'ACTIVE'` 檢查；屆時可同時補一張快取表（Redis）
- `me.get.ts` 額外再驗一次 status，作為長期會話的次要保險

## 4. Slug 生成策略

**選擇**：`{normalize(emailLocalPart)}-{random6}`，唯一衝突重試 3 次，仍失敗回 500「請稍後重試」。

理由：
- Email local part 已具備人類可讀性，加 6 碼隨機降低碰撞
- 不允許用戶在 sign-up 自選 slug，避免「保留字／辱罵字串／同名搶註」問題；Change 3 / 4 才開放管理員與商家本人修改 slug
- 正則化：lowercase、僅保留 `[a-z0-9]`、其餘轉 `-`、開頭/結尾 `-` 修剪

## 5. forgot-password 採通用回應

**選擇**：不論 email 是否存在，固定 return `{ sent: true }`。

**理由**：
- 避免「不同錯誤訊息」洩漏哪些 email 已註冊
- MVP 不真寄信但保留接口契約；future hook 點留在端點末端，不影響前端流程
- rate limit 用 IP，10 分鐘 5 次；同一 email 反覆觸發不另計

## 6. NUXT_PUBLIC_TEST_MODE 切換

**選擇**：將 `.env.dev` 的 `NUXT_PUBLIC_TEST_MODE` 從 `T` 改 `F`，預設走真實 API。

**理由**：
- 樣板期 mock 是必要的；現在後端有 endpoint 了，繼續 mock 反而會掩蓋 server 問題
- mock.ts 程式碼**保留**，需要 demo / E2E 時可切回 T

## 7. 為什麼 me.get 而不是把身分塞 JWT 永久使用

**選擇**：登入後立即用一次 `me.get` 補齊 `userName / merchantName`，cookie 內僅放最小必要 cache。

**理由**：
- JWT 不該塞 displayName 等可變欄位；改名後沒人 invalidate token
- `me.get` 在頁面初始化 / 後台 layout 掛載時各呼叫一次，作為 source of truth
- StoreSelf 已存 token + type + role + merchantId，足以走完路由守門；userName 為 UI 顯示用

## 8. 三語錯誤訊息結構

統一在 `server/utils/response.ts` 的 `*Error(event, message)` 第二參數帶 `Partial<I18nMessage>`：

```ts
return unauthorizedError(event, {
  zh_tw: '帳號或密碼錯誤',
  en: 'Invalid email or password',
  ja: 'メールアドレスまたはパスワードが正しくありません'
});
```

i18n 前端 keys 留作頁面 placeholder / validator 訊息使用，**錯誤訊息直接從 API response 取**而不再經過 i18n key 對應，避免前後端兩處維護。

## 9. 風險與後續

- **無 email 驗證**：MVP 接受；藍圖決策 #11 已紀錄為「不做 Email 驗證，管理員人工審核即可」
- **無重設密碼 token**：本 change 只接 forgot-password 入口，下發機制留待後續
- **bcrypt 同步呼叫成本**：rounds=10 在 dev 約 60ms，OK；上線 prod 若需要可調 12
