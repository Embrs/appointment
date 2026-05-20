## ADDED Requirements

### Requirement: 服務 CRUD 支援 RESOURCE_OPTIONAL 模式

系統 SHALL 在 Service CRUD 端點接受 `bookingMode = 'RESOURCE_OPTIONAL'`，其驗證規則與 `RESOURCE` 一致：必須提供 `resourceIds` 且至少含一個屬於當前商家的啟用資源；商家後台「編輯服務」彈窗 SHALL 將 RESOURCE_OPTIONAL 與 RESOURCE 並列為可選模式並沿用同一資源綁定 UI。

#### Scenario: 新增服務（RESOURCE_OPTIONAL + resourceIds）

- **GIVEN** 已登入商家、存在啟用資源 `[r1, r2]`
- **WHEN** `POST /nuxt-api/service` body `{ name: '拔牙', bookingMode: 'RESOURCE_OPTIONAL', durationMinutes: 60, slotIntervalMinutes: 60, resourceIds: ['r1', 'r2'] }`
- **THEN** 響應 200；DB 寫入 Service（bookingMode=RESOURCE_OPTIONAL）+ 兩筆 ServiceResource

#### Scenario: RESOURCE_OPTIONAL 未提供 resourceIds 拒絕

- **WHEN** body `{ name: '拔牙', bookingMode: 'RESOURCE_OPTIONAL', resourceIds: [] }`
- **THEN** 響應 400，三語訊息提示需綁定至少一個資源

#### Scenario: RESOURCE_OPTIONAL 跨商家資源拒絕

- **WHEN** body 含的 `resourceIds` 任一 id 不屬於 `auth.merchantId`
- **THEN** 響應 400 或 403（與 RESOURCE 模式同等保護）

#### Scenario: 更新 RESOURCE_OPTIONAL 覆蓋 resourceIds

- **GIVEN** Service `bookingMode=RESOURCE_OPTIONAL` 已綁定 `[r1, r2]`
- **WHEN** `PUT /nuxt-api/service/[id]` body `{ resourceIds: ['r2', 'r3'] }`
- **THEN** transaction 內 deleteMany 後 createMany `[r2, r3]`；最終只剩 r2、r3 關聯

#### Scenario: RESOURCE 與 RESOURCE_OPTIONAL 互轉

- **GIVEN** Service `bookingMode=RESOURCE` 綁定 `[r1, r2]`
- **WHEN** `PUT /nuxt-api/service/[id]` body `{ bookingMode: 'RESOURCE_OPTIONAL' }`（resourceIds 未送）
- **THEN** 響應 200；bookingMode 更新；既有 ServiceResource 關聯保留不動
- **WHEN** 再 PUT `{ bookingMode: 'RESOURCE' }`
- **THEN** 響應 200；既有資源綁定不變；既有 Appointment 不受影響

#### Scenario: 商家後台彈窗模式選項

- **GIVEN** 商家進入「服務管理」並點擊「新增 / 編輯」按鈕
- **THEN** 「預約模式」下拉至少含五個選項：`TIME_SLOT / TIME_CAPACITY / RESOURCE / RESOURCE_OPTIONAL / QUEUE`
- **AND** 選 `RESOURCE_OPTIONAL` 時，顯示「綁定資源」多選區塊（同 RESOURCE 行為）
- **AND** 文案以三語標明 RESOURCE_OPTIONAL 為「顧客可選不指定」、RESOURCE 為「顧客必須指定」
