/** 插入開啟組件（不用動） */
const Open = <T>(componentName: OpenComponent, params: any = {}): Promise<T> => {
  const storeOpen = StoreOpen();
  return new Promise<T>((resolve) => {
    storeOpen.OnOpen<T>({
      uuid: `open-${$tool.CreateUUID()}`,  // uuid
      componentName, // 組件
      params, // 參數
      resolve // 回傳
    });
  });
};

/** 關閉指定名稱 組件 */
const CloseName = (name: OpenComponent | OpenComponent[]) => {
  const nameList = Array.isArray(name) ? name : [name];
  const storeOpen = StoreOpen();
  storeOpen.openList.forEach((item) => {
    if (nameList.includes(item.componentName)) {
      storeOpen.OnClose(item.uuid);
    }
  });
};

/** 關閉所有組件 */
const CloseAll = () => {
  const storeOpen = StoreOpen();
  storeOpen.openList.forEach((item) => {
    storeOpen.OnClose(item.uuid);
  });
};

/** 關閉指定組件 */
const Close = (uuid: string | string[]) => {
  const uuidList = Array.isArray(uuid) ? uuid : [uuid];
  const storeOpen = StoreOpen();
  storeOpen.openList.forEach((item) => {
    if (uuidList.includes(item.uuid)) {
      storeOpen.OnClose(item.uuid);
    }
  });
};

// -----------------------------------------------------------------------------------------------
export default {
  /** 關閉 */
  Close,
  /** 關閉所有 */
  CloseAll,
  /** 關閉指定名稱 組件 */
  CloseName,
  // -----------------------------------------------------------------------------------------------
  /** 開啟測試 */
  DialogDemo: (params: DialogDemoParams) => Open('OpenDialogDemo', params),
  /** 開啟測試 抽屜 */
  DrawerDemoInfo: () => Open('OpenDrawerDemoInfo'),
  /** 影片錄製 */
  DialogVideoRecording: () => Open<File>('OpenDialogVideoRecording'),
  /** 圖片選擇 */
  DialogImageEdit: () => Open<File>('OpenDialogImageSelect'),
  /** 商家審核通過 / 拒絕（二合一） */
  DialogMerchantApprove: (params: DialogMerchantApproveParams) =>
    Open<{ done: boolean }>('OpenDialogMerchantApprove', params),
  /** 平台管理員新增 / 編輯 */
  DialogAdminEdit: (params: DialogAdminEditParams) =>
    Open<{ done: boolean }>('OpenDialogAdminEdit', params),
  /** 商家服務新增 / 編輯 */
  DialogServiceEdit: (params: DialogServiceEditParams) =>
    Open<{ done: boolean }>('OpenDialogServiceEdit', params),
  /** 商家資源新增 / 編輯 */
  DialogResourceEdit: (params: DialogResourceEditParams) =>
    Open<{ done: boolean }>('OpenDialogResourceEdit', params),
  /** 商家服務人員新增 / 編輯 */
  DialogProviderEdit: (params: DialogProviderEditParams) =>
    Open<{ done: boolean }>('OpenDialogProviderEdit', params),
  /** 每週時段段落新增 */
  DialogScheduleRuleEdit: (params: DialogScheduleRuleEditParams) =>
    Open<{ done: boolean; rule?: { weekday: number; startTime: string; endTime: string } }>(
      'OpenDialogScheduleRuleEdit',
      params
    ),
  /** 特定日期覆寫 */
  DialogScheduleOverrideEdit: (params: DialogScheduleOverrideEditParams) =>
    Open<{ done: boolean }>('OpenDialogScheduleOverrideEdit', params),
  /** 休假日新增 */
  DialogHolidayEdit: () =>
    Open<{ done: boolean }>('OpenDialogHolidayEdit', {}),
  /** 商家成員新增 / 編輯（OWNER） */
  DialogStaffEdit: (params: DialogStaffEditParams) =>
    Open<{ done: boolean }>('OpenDialogStaffEdit', params),
  /** 顧客三元組表單 */
  DialogCustomerForm: (params: DialogCustomerFormParams) =>
    Open<{ done: boolean; triplet?: { lastName: string; title: CustomerTitleType; phone: string } }>(
      'OpenDialogCustomerForm',
      params
    ),
  /** 預約最終確認 drawer */
  DrawerBookingConfirm: (params: DrawerBookingConfirmParams) =>
    Open<{ done: boolean; appointmentId?: string; limitExceeded?: boolean }>('OpenDrawerBookingConfirm', params),
  /** 預約成功通知 */
  DialogBookingSuccess: (params: DialogBookingSuccessParams) =>
    Open<{ done: boolean }>('OpenDialogBookingSuccess', params),
  /** 商家預約詳情 drawer */
  DrawerAppointmentInfo: (params: DrawerAppointmentInfoParams) =>
    Open<{ done: boolean; canceled?: boolean }>('OpenDrawerAppointmentInfo', params),
  /** 商家代客建立預約 */
  DialogAppointmentCreate: (params: DialogAppointmentCreateParams) =>
    Open<{ done: boolean }>('OpenDialogAppointmentCreate', params),
  /** 商家修改既有預約（reschedule） */
  DialogAppointmentReschedule: (params: DialogAppointmentRescheduleParams) =>
    Open<{ done: boolean }>('OpenDialogAppointmentReschedule', params),
  /** 商家取消預約理由 */
  DialogCancelReason: (params: DialogCancelReasonParams) =>
    Open<{ done: boolean; reason?: string }>('OpenDialogCancelReason', params),
  /** 商家現場代客領號 */
  DialogQueueWalkIn: (params: DialogQueueWalkInParams) =>
    Open<{ done: boolean; ticketId?: string; ticketNumber?: number }>('OpenDialogQueueWalkIn', params),
  /** 顧客領號 QR Code 對話框 */
  DialogQueueClaimQr: (params: DialogQueueClaimQrParams) =>
    Open<{ done: boolean }>('OpenDialogQueueClaimQr', params)
};
