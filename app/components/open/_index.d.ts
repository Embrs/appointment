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
  | 'OpenDialogScheduleRuleEdit' // 每週時段新增
  | 'OpenDialogScheduleOverrideEdit' // 特定日期覆寫
  | 'OpenDialogHolidayEdit' // 休假日新增
  | 'OpenDialogStaffEdit' // 商家成員新增 / 編輯
  | 'OpenDialogCustomerForm' // 顧客三元組表單
  | 'OpenDrawerBookingConfirm' // 預約最後確認 drawer
  | 'OpenDialogBookingSuccess' // 預約成功通知
  | 'OpenDrawerAppointmentInfo' // 商家預約詳情 drawer
  | 'OpenDialogAppointmentCreate' // 商家代客預約
  | 'OpenDialogCancelReason' // 商家取消理由

// 參數群 -----------------------------------------------------------------------------------------------
type OpenParams =
  OpenDialogDemo
  | DialogMerchantApproveParams
  | DialogAdminEditParams
  | DialogServiceEditParams
  | DialogResourceEditParams
  | DialogScheduleRuleEditParams
  | DialogScheduleOverrideEditParams
  | DialogHolidayEditParams
  | DialogStaffEditParams
  | DialogCustomerFormParams
  | DrawerBookingConfirmParams
  | DialogBookingSuccessParams
  | DrawerAppointmentInfoParams
  | DialogAppointmentCreateParams
  | DialogCancelReasonParams

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
}

type DialogAppointmentCreateParams = {
  /** 商家當前 slug，用於查 availability（公開 API） */
  slug: string
}

type DialogCancelReasonParams = Record<string, never>
