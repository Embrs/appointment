## Context

商家後台預約管理頁（`/admin/appointments`）採用「行事曆 / 列表」同頁 toggle，加上獨立的「歷史紀錄」歸檔頁（`/admin/appointments/archive`）。資料來源分兩張表：

- `prisma.appointment`：所有即時預約（含 90 天內已取消／完成／未到的紀錄）。
- `prisma.appointmentArchive`：cron 每日凌晨將 `startAt < 今日 - 90 天` 的紀錄搬過來。

目前列表視圖直接顯示 `appointment` 表全部資料且不過濾狀態，使用者會在「列表」看到 `CANCELED/COMPLETED/NO_SHOW` 的舊預約，與「歷史紀錄」感覺重疊；歷史紀錄頁則沒提供返回入口；狀態欄與顧客稱謂直接顯示英文 enum；操作欄寬度不足造成換行。本次改動全部在前端與 i18n locale 達成，**不動 schema、不動後端 API**。

## Goals / Non-Goals

**Goals:**

- 將「列表」語意收斂為「進行中的預約」，與「歷史紀錄（已歸檔）」明確切割。
- 歷史紀錄頁加入返回入口。
- 預約狀態與顧客稱謂全面 i18n，三語（zh / en / ja）正確切換。
- 列表操作欄不換行，主要動作收斂為「詳細／更多」。

**Non-Goals:**

- 不調整 Prisma schema、不新增 migration。
- 不調整列表 API (`GET /nuxt-api/appointment`) 的 query 參數或回傳格式。
- 不調整歷史紀錄 API (`GET /nuxt-api/appointment/archive`)。
- 不調整 cron 歸檔策略（仍為 90 天）。
- 不調整行事曆視圖的狀態顯示策略（行事曆仍顯示所有狀態以避免空白）。

## Decisions

### 決策 1：列表預設過濾完全在前端達成

**選擇**：列表 view 預設將 `filter.status = 'CONFIRMED'` 並設定 `filter.dateFrom = 今日`，再加一個前端切換開關 `showArchived`，開關開啟時清空 status 篩選並擴大 dateFrom（往前推 90 天上限）。

**理由**：
- 後端 API 已支援 `status`、`dateFrom`、`dateTo` query，不需要新增端點。
- 「列表 = 活躍預約」是 UI 層的語意收斂，後端維持中性更利於 BFF 重用。
- 切換開關放在 filter 列，符合 Element Plus 既有篩選 UX。

**替代方案**：
- 新增後端 `?activeOnly=true` 參數：被否決，徒增 API surface。
- 把「已結案」做成 tab：被否決，會增加層級，跟既有「行事曆 / 列表」toggle 衝突。

### 決策 2：i18n key 採 enum 對應命名

**選擇**：

```js
appointment: {
  status: {
    CONFIRMED: '已預約' | 'Confirmed' | '予約済み',
    CANCELED: '已取消' | 'Canceled' | 'キャンセル',
    COMPLETED: '已完成' | 'Completed' | '完了',
    NO_SHOW: '未到' | 'No-show' | '未来店'
  },
  customerTitle: {
    MR: '先生' | 'Mr.' | '様（男性）',
    MRS: '女士' | 'Mrs.' | '様（既婚女性）',
    MISS: '小姐' | 'Miss' | '様（未婚女性）',
    MX: '客人' | 'Mx.' | 'お客様'
  }
}
```

**理由**：key 與資料庫 enum 同名（`Prisma AppointmentStatus`、`CustomerTitle`）使用最直接：`$t('appointment.status.' + row.status)`，不需在前端維護 enum→key 對照表。

**替代方案**：以「中文標籤」做 key（如 `appointment.status.confirmed`）被否決，因為英文 enum 是事實來源，i18n 反向對照容易錯。

### 決策 3：操作欄收斂為「詳細＋更多」

**選擇**：

```
┌──────────────────────────────────────────────────┐
│ 狀態          操作                               │
├──────────────────────────────────────────────────┤
│ 已預約        詳細 [更多▾]                       │
│                  ├─ 取消預約                     │
│                  ├─ 標記完成（已過時間時）       │
│                  └─ 標記未到（已過時間時）       │
│ 已取消        詳細                               │
│ 已完成        詳細                               │
│ 未到          詳細                               │
└──────────────────────────────────────────────────┘
```

- 寬度：220px（足以容下「詳細」+ 「更多▾」兩個 link button + 邊距）。
- 「更多」按鈕只在 `CONFIRMED` 時顯示。
- 「標記完成 / 未到」只在 `CONFIRMED && startAt <= now` 時加入下拉。

**理由**：
- 「取消」與「標記完成 / 未到」都屬於「破壞性 / 結案性」動作，視覺權重應該收斂在二級。
- 單一「更多」入口減少橫向擠壓，欄寬可下降。
- 一致的「詳細 + 更多」格式讓所有列等高、視覺對齊。

**替代方案**：拓寬到 280px 維持三個 link 並列，被否決，會把表格右側壓得太緊。

### 決策 4：歷史紀錄返回鈕走純前端 router.push

**選擇**：`archive.vue` 的 `BizPageHeader` 加 `#actions` slot，放 `ElButton(plain @click="router.push('/admin/appointments')")` 文字「← 返回預約管理」。

**理由**：使用 `router.push`（而非 `router.back`）避免使用者從外部直接連到 archive 時 `back` 跳出站外。

## Risks / Trade-offs

- **[Risk] 列表預設過濾後使用者找不到舊預約** → Mitigation：在篩選列上「顯示已結案」開關需明顯（建議用 `ElSwitch` + label 文字），首次切到列表時可考慮 ElTooltip 提示一次。Spec 中會明確規定該開關必須在篩選列顯眼位置。
- **[Risk] i18n key 與資料庫 enum 強耦合，未來新增狀態時前端會 i18n 缺 key** → Mitigation：採 fallback：`$t('appointment.status.' + s, s)`，未翻譯時退回原始 enum 值；在 `AppointmentStatus` 新增 enum 的 spec / change 中明確要求同步補 i18n。
- **[Risk] 「更多」下拉若使用者頻繁要取消預約多點一層** → Mitigation：操作頻率調研顯示「取消」屬低頻動作（商家後台主要動作為「詳細查看」與「代客預約」），多一層點擊是可接受 trade-off。
- **[Trade-off] 行事曆視圖維持顯示所有狀態** → 與列表行為不對稱，但行事曆若過濾會空白格，反而降低資訊密度。文件中以 Non-Goals 明示。

## Migration Plan

- **無 DB migration**：不動 schema，無回滾風險。
- **部署**：直接走前端打包，部署到測試站驗收後合主分支。
- **回滾策略**：純前端改動，git revert PR 即可，無資料殘留。
- **i18n 補檔順序**：先補 `zh.js`，再補 `en.js` 與 `ja.js`，避免某一語言 fallback 到 key 字串。
