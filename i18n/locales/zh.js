export default {
  welcome: '您好',
  about: {
    title: '關於我們',
    description: '這是關於我們頁面'
  },
  common: {
    back: '返回',
    goHome: '回到首頁',
    backToSignIn: '返回登入',
    save: '儲存',
    cancel: '取消',
    confirm: '確認',
    create: '建立',
    edit: '編輯',
    delete: '刪除',
    submit: '送出',
    search: '查詢',
    copy: '複製',
    saveSuccess: '已儲存',
    deleteSuccess: '已刪除',
    createSuccess: '已新增',
    updateSuccess: '已更新',
    copySuccess: '已複製連結',
    copyFailed: '複製失敗，請手動選取',
    operationFailed: '操作失敗',
    weekdayShort: ['日', '一', '二', '三', '四', '五', '六'],
    weekdayLong: ['週日', '週一', '週二', '週三', '週四', '週五', '週六'],
    yes: '是',
    no: '否',
    enabled: '啟用',
    disabled: '停用',
    isActive: '啟用中',
    isInactive: '已停用'
  },
  validation: {
    required: '此欄位為必填',
    maxLength: '請在 {n} 字以內',
    password: {
      required: '請輸入密碼',
      tooShort: '密碼至少 8 碼',
      needLetter: '密碼需包含字母',
      needNumber: '密碼需包含數字',
      mismatch: '兩次密碼不一致',
      retype: '請再次輸入密碼',
      rule: '密碼至少 8 碼，需包含字母與數字'
    },
    phone: '手機格式錯誤',
    timeFormat: '時間格式錯誤',
    timeOrder: '起始時間需早於結束時間',
    selectService: '請選擇服務',
    selectDate: '請選擇日期',
    selectSlot: '請選擇時段',
    selectResource: '請選擇資源',
    completeFields: '請完整填寫聯絡資訊',
    completeTriplet: '請完整填寫三元組',
    nameRequired: '請輸入名稱',
    nameRequiredMerchant: '請輸入商家名稱',
    slugRequired: '請輸入網址 slug',
    slugFormat: '只允許小寫英數與短橫線，3-50 字'
  },
  auth: {
    signIn: {
      titleMerchant: '商家登入',
      titleAdmin: '平台管理員登入',
      submit: '登入',
      signUp: '立即註冊',
      forgot: '忘記密碼'
    },
    signUp: {
      title: '商家註冊',
      hint: '註冊送出後，需平台管理員審核通過才能登入',
      submit: '送出申請',
      backToSignIn: '已有帳號？返回登入'
    },
    forgot: {
      title: '忘記密碼',
      hint: '輸入帳號 Email，若帳號存在我們會寄送重設連結',
      submit: '送出'
    },
    notice: {
      pendingReview: '您的商家註冊申請已送出，請等待平台管理員審核',
      forgotSent: '若帳號存在，您將很快收到密碼重設信件'
    },
    errors: {
      invalidCredentials: '帳號或密碼錯誤',
      accountPending: '帳號待管理員審核',
      accountSuspended: '商家已停用',
      accountRejected: '註冊申請未通過',
      emailExists: 'Email 已註冊',
      rateLimited: '請求過於頻繁，請稍後再試',
      passwordRule: '密碼至少 8 碼，需包含字母與數字',
      passwordMismatch: '兩次密碼不一致'
    }
  },
  admin: {
    dialog: {
      adminEditCreate: '新增管理員',
      adminEditEdit: '編輯管理員',
      staffEditCreate: '新增成員',
      staffEditEdit: '編輯成員',
      serviceEditCreate: '新增服務',
      serviceEditEdit: '編輯服務',
      resourceEditCreate: '新增資源',
      resourceEditEdit: '編輯資源',
      appointmentCreateTitle: '代客預約',
      holidayCreateTitle: '新增休假',
      holidayEditTitle: '編輯休假',
      scheduleRuleTitle: '時段規則',
      scheduleOverrideTitle: '時段覆寫',
      merchantApproveTitle: '審核通過商家',
      merchantRejectTitle: '拒絕商家申請',
      merchantApproveConfirm: '確認通過',
      merchantRejectConfirm: '確認拒絕',
      pwdNew: '新密碼（留空表示不變）',
      pwdField: '密碼',
      pwdHintNew: '至少 8 碼含字母與數字',
      pwdHintKeep: '不修改請留空',
      createSuccess: '已新增',
      updateSuccess: '已更新',
      approveSuccess: '已通過審核',
      rejectSuccess: '已拒絕申請',
      saveOverrideSuccess: '已儲存覆寫',
      addHolidaySuccess: '已新增休假'
    },
    nav: {
      home: '首頁',
      settings: '商家設定',
      shareLink: '對外連結',
      services: '服務',
      resources: '資源',
      schedule: '時段',
      holidays: '休假',
      staff: '成員'
    },
    actions: {
      create: '新增',
      edit: '編輯',
      delete: '刪除',
      save: '儲存',
      cancel: '取消',
      confirm: '確認'
    },
    bookingMode: {
      TIME_SLOT: '固定時段',
      TIME_CAPACITY: '時段+人數',
      RESOURCE: '指定資源',
      QUEUE: '號碼牌'
    },
    settings: {
      title: '商家設定',
      basic: '基本資訊',
      appearance: '外觀',
      cancelPolicy: '取消政策',
      uploadLogo: '上傳 Logo',
      uploadCover: '上傳封面圖',
      policyFree: '顧客可隨時取消',
      policyCutoff: '預約前 N 小時起不可取消',
      cutoffHours: 'N 小時'
    },
    services: {
      listTitle: '服務管理',
      nameLabel: '服務名稱',
      bookingModeLabel: '預約模式',
      durationLabel: '服務時長（分鐘）',
      intervalLabel: '時段間隔（分鐘）',
      capacityLabel: '每時段容量',
      priceLabel: '價格（分）',
      resourcesLabel: '綁定資源'
    },
    resources: {
      listTitle: '資源管理',
      nameLabel: '資源名稱'
    },
    schedule: {
      title: '時段管理',
      scopeMerchant: '整店',
      scopeResource: '資源',
      addSlot: '+ 新增時段',
      overrides: '特定日期覆寫',
      addOverride: '+ 新增覆寫',
      closed: '當日休息'
    },
    holidays: {
      listTitle: '休假日',
      nameLabel: '名稱',
      dateLabel: '日期'
    },
    staff: {
      listTitle: '成員管理',
      roleLabel: '角色',
      roleOwner: '擁有者',
      roleStaff: '員工',
      toggleActive: '啟用 / 停用',
      cantToggleSelf: '不能停用自己'
    },
    shareLink: {
      title: '對外連結',
      hint: '把以下連結傳給顧客，或印 QR code 張貼於店面',
      copy: '複製',
      copied: '已複製連結',
      merchantNotConfigured: '尚未設定 slug，請先到「商家設定」'
    },
    errors: {
      slugTaken: '網址已被使用',
      uploadFailed: '圖片上傳失敗',
      saveFailed: '儲存失敗'
    }
  },
  sys: {
    welcome: '歡迎，{name}',
    welcomeFallback: '管理員',
    statusLabel: {
      PENDING: '待審核',
      ACTIVE: '在線',
      SUSPENDED: '停用',
      REJECTED: '已拒絕'
    },
    merchantSuspendTitle: '停用商家',
    merchantActivateTitle: '啟用商家',
    merchantSuspendConfirm: '確定要停用「{name}」嗎？',
    merchantActivateConfirm: '確定要啟用「{name}」嗎？',
    merchantSuspendSuccess: '已停用',
    merchantActivateSuccess: '已啟用',
    adminToggleConfirm: '確定要{action}「{name}」嗎？',
    adminToggleTitle: '{action}管理員',
    adminCantToggleSelf: '不能停用自己',
    tabs: {
      all: '全部',
      pending: '待審核',
      active: '在線',
      suspended: '停用',
      rejected: '拒絕'
    },
    actions: {
      approve: '審核通過',
      reject: '拒絕',
      suspend: '停用',
      activate: '啟用',
      impersonate: '進入該商家後台',
      exitImpersonation: '退出代理'
    },
    notice: {
      impersonationActive: '平台管理員代理中',
      suspendConfirm: '確定要停用此商家嗎？',
      activateConfirm: '確定要啟用此商家嗎？',
      cantToggleSelf: '不能停用自己'
    }
  },
  booking: {
    nav: {
      myBookings: '我的預約',
      lookup: '查詢預約',
      bookNow: '立即預約'
    },
    steps: {
      service: '服務',
      resource: '資源',
      date: '日期',
      slot: '時段',
      info: '資訊',
      confirm: '確認'
    },
    customer: {
      titleMr: '先生',
      titleMrs: '女士',
      titleMiss: '小姐',
      titleMx: '客人',
      lastName: '姓氏',
      titleField: '稱謂',
      phone: '手機號碼',
      note: '備註'
    },
    status: {
      CONFIRMED: '已預約',
      CANCELED: '已取消',
      NO_SHOW: '未到',
      COMPLETED: '已完成'
    },
    canceledBy: {
      CUSTOMER: '顧客取消',
      MERCHANT: '商家取消',
      SYSTEM: '系統取消'
    },
    actions: {
      cancel: '取消預約',
      confirmBooking: '確認預約',
      success: '預約成功',
      lookup: '查詢',
      switchIdentity: '切換身分',
      switchLocale: '切換語系',
      goCalendar: '行事曆檢視',
      goArchive: '歷史紀錄',
      delegate: '代客預約'
    },
    messages: {
      bookSuccess: '預約成功',
      cancelSuccess: '已取消預約',
      slotTaken: '該時段已被預約',
      cancelTooLate: '已超過取消期限，請聯絡商家',
      notFound: '查無此預約',
      emptyList: '暫無預約紀錄',
      noSlot: '該日無可預約時段'
    },
    queryTitle: '查詢預約',
    querySubmit: '查詢',
    fillContactTitle: '填寫聯絡資訊',
    calendar: {
      prev: '上一',
      next: '下一',
      day: '日',
      week: '週',
      prevMonth: '上個月',
      nextMonth: '下個月',
      today: '今'
    }
  },
  queue: {
    page: {
      landingTitle: '領號排隊',
      landingHint: '選擇下方服務後填寫聯絡資訊，即可領取今日號碼牌。',
      statusYourNumber: '您的號碼',
      statusServing: '目前服務中',
      statusLastIssued: '最後發出號碼',
      statusCalledHint: '請進入，輪到您了！',
      statusDoneHint: '已完成服務，謝謝光臨',
      statusSkippedHint: '已被標為過號，如需服務請洽櫃台',
      statusAheadHint: '您前面還有 {n} 人',
      adminTitle: '號碼牌叫號台',
      adminEmpty: '尚未建立號碼牌服務',
      adminEmptyHint: '請至「服務」頁新增 bookingMode=QUEUE 的服務並設定每週領號時段。',
      callNext: '叫下一號',
      markDone: '完成',
      markSkip: '過號',
      take: '立即領號',
      formTitle: '填寫聯絡資訊以領號',
      formSubmit: '領號',
      connLive: '即時連線中',
      connFallback: '兜底輪詢中（15s）'
    },
    status: {
      WAITING: '等待中',
      CALLED: '服務中',
      DONE: '已完成',
      SKIPPED: '已過號',
      CANCELED: '已取消'
    },
    messages: {
      takeSuccess: '領號成功',
      windowClosed: '目前不在領號時間',
      notQueueService: '此服務非號碼牌模式',
      alreadyTaken: '您今日已領過號碼牌',
      queueFull: '今日號碼牌已發完',
      noWaiting: '目前沒有等待中的號碼',
      invalidTransition: '號碼牌狀態無法變更',
      ticketNotFound: '查無此號碼牌'
    }
  },
  enum: {
    apiStatus: {
      200: '成功',
      400: '失敗',
      401: '未授權',
      403: '禁止存取',
      404: '找不到',
      500: '系統錯誤'
    }
  }
};
