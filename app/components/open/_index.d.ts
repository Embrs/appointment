// 組件群 -----------------------------------------------------------------------------------------------
type OpenComponent =
  'OpenDialogDemo'
  | 'OpenDrawerDemoInfo'
  | 'OpenDialogVideoRecording' // 影片錄製
  | 'OpenDialogImageSelect' // 圖片選擇
  | 'OpenDialogMerchantApprove' // 商家審核通過 / 拒絕
  | 'OpenDialogAdminEdit' // 平台管理員新增 / 編輯
  | 'OpenDialogServiceEdit' // 商家服務新增 / 編輯
  | 'OpenDialogResourceEdit' // 商家資源新增 / 編輯
  | 'OpenDialogProviderEdit' // 商家服務人員新增 / 編輯
  | 'OpenDialogScheduleRuleEdit' // 每週時段新增
  | 'OpenDialogScheduleOverrideEdit' // 特定日期覆寫
  | 'OpenDialogHolidayEdit' // 休假日新增
  | 'OpenDialogStaffEdit' // 商家成員新增 / 編輯
  | 'OpenDialogCustomerForm' // 顧客三元組表單
  | 'OpenDrawerBookingConfirm' // 預約最後確認 drawer
  | 'OpenDialogBookingSuccess' // 預約成功通知
  | 'OpenDrawerAppointmentInfo' // 商家預約詳情 drawer
  | 'OpenDialogAppointmentCreate' // 商家代客預約
  | 'OpenDialogAppointmentReschedule' // 商家修改既有預約
  | 'OpenDialogCancelReason' // 商家取消理由
  | 'OpenDialogQueueWalkIn' // 商家現場代客領號
  | 'OpenDialogQueueClaimQr' // 顧客領號 QR Code 對話框

// 參數群 -----------------------------------------------------------------------------------------------
type OpenParams =
  OpenDialogDemo
  | DialogMerchantApproveParams
  | DialogAdminEditParams
  | DialogServiceEditParams
  | DialogResourceEditParams
  | DialogProviderEditParams
  | DialogScheduleRuleEditParams
  | DialogScheduleOverrideEditParams
  | DialogHolidayEditParams
  | DialogStaffEditParams
  | DialogCustomerFormParams
  | DrawerBookingConfirmParams
  | DialogBookingSuccessParams
  | DrawerAppointmentInfoParams
  | DialogAppointmentCreateParams
  | DialogAppointmentRescheduleParams
  | DialogCancelReasonParams
  | DialogQueueWalkInParams
  | DialogQueueClaimQrParams

// 組件參數 ---------------------------------------------------------------------------------------------
type DialogDemoParams = {
  demo: string
}

type DialogMerchantApproveParams = {
  /** approve：審核通過；reject：拒絕（可選填理由） */
  mode: 'approve' | 'reject'
  merchantId: string
  merchantName: string
}

type DialogAdminEditParams = {
  /** create：新增；edit：編輯（email 鎖死、password 留空表示不變） */
  mode: 'create' | 'edit'
  admin?: AdminItem
}

type DialogServiceEditParams = {
  mode: 'create' | 'edit'
  service?: ServiceItem
}

type DialogResourceEditParams = {
  mode: 'create' | 'edit'
  resource?: ResourceItem
}

type DialogProviderEditParams = {
  mode: 'create' | 'edit'
  provider?: ProviderItem
  /** 啟用精靈第一次建立後是否引導去排班頁 */
  onCreatedGotoSchedule?: boolean
}

type DialogScheduleRuleEditParams = {
  mode: 'create'
  /** 預設 weekday */
  weekday?: number
}

type DialogScheduleOverrideEditParams = {
  scope: ScheduleScopeType
  resourceId?: string | null
}

type DialogHolidayEditParams = Record<string, never>

type DialogStaffEditParams = {
  mode: 'create' | 'edit'
  user?: MerchantStaffItem
}

type CustomerTitleType = 'MR' | 'MRS' | 'MISS' | 'MX'

type DialogCustomerFormParams = {
  /** 對話框標題（例：「填寫聯絡資訊」、「查預約」） */
  title?: string
  /** 送出按鈕文案（例：「下一步」、「查詢」） */
  submitLabel?: string
  /** 預填值 */
  initial?: { lastName: string; title: CustomerTitleType; phone: string }
}

type DrawerBookingConfirmParams = {
  slug: string
  serviceId: string
  serviceName: string
  resourceId?: string
  resourceName?: string
  providerId?: string
  providerName?: string
  startAt: string
  endAt: string
  timezone: string
  customer: { lastName: string; title: CustomerTitleType; phone: string }
  note?: string
}

type DialogBookingSuccessParams = {
  serviceName: string
  startAt: string
  timezone: string
}

type DrawerAppointmentInfoParams = {
  appointment: AppointmentItem
  timezone: string
  /** 商家 slug，傳遞給 DialogAppointmentReschedule 用 */
  slug: string
}

type DialogAppointmentCreateParams = {
  /** 商家當前 slug，用於查 availability（公開 API） */
  slug: string
  /** 預填日期 YYYY-MM-DD（行事曆空白格點擊或外部入口提供） */
  prefillDate?: string
  /** 預填時段 ISO UTC 字串；slot 載入後自動 active 或提示不可用 */
  prefillStartAt?: string
  /** 預填服務 id */
  prefillServiceId?: string
  /** 預填資源 id（限 RESOURCE 模式服務） */
  prefillResourceId?: string
}

type DialogAppointmentRescheduleParams = {
  appointment: AppointmentItem
  /** 商家 slug，用於 availability 查詢 */
  slug: string
  timezone?: string
}

type DialogCancelReasonParams = Record<string, never>

type DialogQueueWalkInParams = {
  /** 服務 id */
  serviceId: string
  /** 服務名稱（顯示於彈窗與列印小單） */
  serviceName: string
  /** 該票要落到的 resource id；單一號池 service 傳 null */
  resourceId?: string | null
  /** 該 resource 名稱（顯示於彈窗，可選） */
  resourceName?: string | null
  /** merchant timezone（列印小單時間用） */
  timezone?: string
  /** 商家名稱（列印小單表頭，可選） */
  merchantName?: string
  /** 商家 slug：列印小單 QR 連結用；缺省則只印短碼不印 QR */
  merchantSlug?: string
}

type DialogQueueClaimQrParams = {
  /** 商家 slug，用於組成 QR 內容 URL */
  slug: string
  /** 8 碼 nanoid claim token */
  claimToken: string
  /** 當下票號（提示用，可選） */
  ticketNumber?: number
}
