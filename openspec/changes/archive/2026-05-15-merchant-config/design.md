## Context

商家後台核心配置是預約平台的根基：商家在這裡定義「我提供哪些服務、有哪些資源、何時開門、何時休假」。Change 5 / 6 都會把這份配置當成 ground truth。MVP 不做版本化、不做審計記錄，但**必須**確保：

1. tenancy 安全 — 商家不能透過 path / body 操作別人家的資源
2. 四種 bookingMode 共存 — Service.bookingMode 切換時，欄位語義（capacityPerSlot / slotIntervalMinutes / durationMinutes / 是否需要 resource）對應動態顯示
3. ScheduleRule 寫入是「整週覆蓋」語意 — 避免增量更新衍生狀態漂移；override 與 holiday 走獨立資料表
4. R2 配置缺失時不能讓商家無法測試 — `upload/image.post.ts` 在 dev / R2 未配置時降級到 placeholder URL（與 tinymce/upload.post.ts 對齊）

## Goals / Non-Goals

### Goals
- 商家可在一個對話內完成「設商家資訊 → 建服務 → 建資源 → 綁服務↔資源 → 設每週時段 → 加休假」
- 服務的 bookingMode 切換時 UI 動態變化（capacityPerSlot 僅 TIME_CAPACITY 顯示；resource picker 僅 RESOURCE 顯示）
- 七天網格編輯器在桌機 / 手機都可用（手機改顯示「逐日列表」模式避免破版）
- logo / cover 上傳 → R2 public URL 回傳 → 前端用 ElImage 預覽，dev 模式 R2 未配置時也能 demo

### Non-Goals
- 不做服務 / 資源版本化（編輯直接覆蓋）
- 不做時段衝突偵測（同一資源、同一 weekday 可重複登時段，前端 UI 防呆即可；MVP 容忍重疊）
- 不做員工密碼重設信件（沿用 forgot-password 占位）
- 不做服務的多媒體（圖片 gallery、影片）— 只給 description 文字

## Architectural Decisions

### Decision 1：服務 ↔ 資源關聯用「整組覆蓋」更新

**選擇**：`PUT /service/[id]` 時 body 帶 `resourceIds: string[]`，後端先 `deleteMany({ serviceId: id })` 再 `createMany`。同 transaction。

**理由**：MVP 沒有「中間欄位」需要保留，整組覆蓋語意清楚，前端不用分別追蹤新增 / 刪除差異。

**替代方案**：增量 `add / remove` 端點 — 複雜度高、難測；服務通常綁 1–5 個資源，全量刪建成本可忽略。

### Decision 2：ScheduleRule 用「整週覆蓋」更新

**選擇**：`PUT /schedule/rules` 接收 `{ rules: Array<{ scope, resourceId?, weekday, startTime, endTime }> }`，後端按 `(merchantId, scope, resourceId?)` 範圍 `deleteMany` 再 `createMany`。允許 body 只帶部分 scope（例如：只更 MERCHANT 不動 RESOURCE）→ 用 query `?scope=MERCHANT&resourceId=xxx` 限定刪除範圍。

**理由**：時段編輯器 UX 上是「整週網格」，使用者每次儲存就是整週意圖；增量同步邏輯難寫。

**替代方案**：CRUD 單筆規則 — 編輯器需要先 diff、再多個 API 呼叫，bug 面廣。MVP 用全量覆蓋換簡單性。

### Decision 3：cancelPolicy 存 Json 欄位

**Schema**：Merchant.cancelPolicy 已是 `Json`。

**約定結構**：
```json
{
  "mode": "free" | "cutoff",
  "hoursBeforeCannotCancel": 0
}
```

- `free`：顧客可隨時取消；`hoursBeforeCannotCancel` 忽略
- `cutoff`：預約開始前 N 小時起不能取消；N>=1
- Change 6 取消 API 會讀此欄位判斷

其他 key（如 Change 3 寫入的 `rejectReason`）會被原樣保留 — 後端用 `{ ...existing, mode, hoursBeforeCannotCancel }` 合併。

### Decision 4：上傳圖片走 multipart → R2 → 回傳 public URL；R2 未配置時 fallback

**流程**：
1. `POST /nuxt-api/upload/image`（multipart，field `file`，需 `requireMerchant`）
2. 限制 MIME `image/png | image/jpeg | image/webp`；大小 ≤ 5MB
3. key 命名：`merchant/{merchantId}/{kind}/{timestamp}-{slugifiedFilename}`（kind 由 query `?kind=logo|cover|service|other` 帶；預設 `other`）
4. 呼叫 `uploadToR2(key, buffer, contentType)`；若回 `{ error }`，dev 模式（`process.env.NODE_ENV !== 'production'`）回 placeholder URL `https://placehold.co/600x400?text=...`；生產模式回 500
5. 成功 return `{ url, key }`

**理由**：dev 與 CI 環境通常沒 R2 憑證，要讓全鏈路驗證能跑；生產嚴格失敗以避免無聲掉檔。

### Decision 5：時段網格編輯器手機降級

桌機：橫向七列（週日…週六），每列直向多個時段段落（如 09:00-12:00、14:00-18:00）。
手機（≤ 640px）：改成上下七節，每節展開該日所有時段；用 ElCollapse。SchedulerWeeklyEditor 內部判斷 `StoreTool().isMobile`。

### Decision 6：bookingMode 切換的欄位動態顯示

| bookingMode | durationMinutes | slotIntervalMinutes | capacityPerSlot | resourceIds |
|---|---|---|---|---|
| TIME_SLOT | 顯示，必填 | 顯示，必填 | 隱藏（固定 1） | 隱藏 |
| TIME_CAPACITY | 顯示，必填 | 顯示，必填 | 顯示，必填 ≥1 | 隱藏 |
| RESOURCE | 顯示，必填 | 顯示，必填 | 隱藏（固定 1） | 顯示，至少 1 個 |
| QUEUE | 隱藏 | 隱藏 | 隱藏 | 隱藏 |

QUEUE 模式的「服務」其實是「排隊看診」這類，時段由 QueueWindow（Change 7 處理）決定，本 change 只記 Service 本身。

### Decision 7：staff 管理沿用 sign-up 流程的密碼規則

新增員工 = 在當前 merchantId 下 INSERT MerchantUser；密碼用 `hashPassword`；email 在當前商家內唯一（`@@unique([merchantId, email])` 已存在）。員工可設 role = OWNER / STAFF，**但前端只允許 OWNER 操作此頁**。停用員工沿用 toggle isActive；不刪除（避免 cascade 把歷史預約搞掉）。

## Risks / Trade-offs

- **R2 fallback** 讓 dev 體驗變好但隱藏配置錯誤；mitigation：在 generation 模式也記 `console.warn`。
- **整週覆蓋 ScheduleRule** 並發風險低（MVP 單一商家後台多人同時編輯機率極小）；mitigation：在 transaction 內處理，若需要強保證可用 `pg_advisory_xact_lock` 鎖 merchantId（暫不做）。
- **resourceIds 整組覆蓋**：若兩個瀏覽器同時編 service 各自選不同 resourceIds，後存的會覆蓋；MVP 接受。
- **七天網格手機 RWD**：使用 isMobile 模式切換是 client-only，SSR 首屏會以桌機版渲染；mitigation：將編輯器掛在 `<ClientOnly>` 包裝。

## Migration Plan

無 schema 變更；所有欄位 / 表已在 Change 1 落地。
無資料遷移需求。

## Open Questions

1. cancelPolicy `cutoff` 模式的 N 上限？暫定 168（一週）足夠 MVP。
2. 上傳圖片大小限制？暫定 5MB；超過回 400。
3. 服務的 `priceCents` 欄位 — 顯示給顧客嗎？MVP 後台可填、顧客頁先不顯示（屬 Change 6 決定）。
