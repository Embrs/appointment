# queue-tickets — Delta for improve-customer-page-nav

## MODIFIED Requirements

### Requirement: 領號頁

The customer queue landing page SHALL list QUEUE-mode services and allow taking a ticket via triplet form. 該頁 SHALL 使用 `BizCustomerPageHeader` 渲染頁首，並設定 `backTo='/m/{slug}'`；既有自製的 `← {merchantName}` 連結 SHALL 移除。

#### Scenario: 列服務

- **Given** 商家有多個服務，僅 2 個是 QUEUE
- **When** 訪客進入 `/m/{slug}/queue`
- **Then** 僅顯示 2 個 QUEUE 服務卡

#### Scenario: 領號流程

- **When** 點服務卡 → 填三元組 → 送出
- **Then** 後端拿號成功 → 自動導向 `/m/{slug}/queue/status?id=...`

#### Scenario: 頁首返回入口

- **GIVEN** 顧客進入 `/m/{slug}/queue`
- **THEN** 頁面頂部以 `BizCustomerPageHeader` 渲染，左上顯示「← 返回」
- **WHEN** 顧客點擊返回
- **THEN** 跳轉至 `/m/{slug}`
- **AND** 既有的 `← {merchantName}` 自製連結不再存在

## ADDED Requirements

### Requirement: 顧客等待頁返回入口

`/m/{slug}/queue/status` 頁 SHALL 使用 `BizCustomerPageHeader` 渲染頁首，並設定 `backTo='/m/{slug}/queue'`，使顧客可從個別票號狀態頁回到該商家的領號列表；既有的自製「回首頁」按鈕 SHALL 由 PageHeader 返回入口取代。

#### Scenario: 票號狀態頁顯示返回入口

- **GIVEN** 顧客已領號並進入 `/m/{slug}/queue/status?id=...`
- **THEN** 頁面頂部以 `BizCustomerPageHeader` 渲染，左上顯示「← 返回」
- **WHEN** 顧客點擊返回
- **THEN** 跳轉至 `/m/{slug}/queue`

#### Scenario: WS / 輪詢不受返回入口影響

- **GIVEN** 票號狀態頁的 WebSocket 連線或 15 秒輪詢正在運行
- **WHEN** 顧客點擊返回離開該頁
- **THEN** Vue 元件 unmount 觸發既有 WS 斷線與輪詢停止邏輯（沿用 `useQueueWS` / cleanup）
- **AND** 不留下殘留連線
