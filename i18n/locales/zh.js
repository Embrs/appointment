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
    loading: '載入中…',
    previous: '上一步',
    next: '下一步',
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
    isInactive: '已停用',
    tagInactive: ' (停用)',
    col: {
      name: '名稱',
      actions: '操作'
    }
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
    selectService: '請選擇服務項目',
    selectDate: '請選擇日期',
    selectSlot: '請選擇時段',
    selectResource: '請選擇場所或設備',
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
      staffEditCreate: '新增成員帳號',
      staffEditEdit: '編輯成員帳號',
      serviceEditCreate: '新增項目',
      serviceEditEdit: '編輯項目',
      resourceEditCreate: '新增場所或設備',
      resourceEditEdit: '編輯場所或設備',
      providerEditCreate: '新增{label}',
      providerEditEdit: '編輯{label}',
      providerDeleteConfirm: '確定停用此{label}？此操作可復原（軟刪除）',
      providerModeWizardTitle: '啟用{label}制',
      providerModeWizardBody: '啟用後，顧客預約時將先選擇{label}。建議先建立至少一位。',
      providerModeWizardCreate: '建立第一位{label}',
      providerCreatedTitle: '已新增{label}',
      providerCreatedBody: '請到排班頁，把{label}的可服務時段建立起來。',
      providerCreatedGoSchedule: '前往排班',
      requiresProviderToggleTitle: '變更「需指定{label}」設定',
      requiresProviderToggleBody: '此設定將僅影響日後的新預約，既有預約不會回填。是否確認變更？',
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
      services: '服務項目管理',
      resources: '場所或設備管理',
      providers: '{label}管理',
      appointments: '預約管理',
      queue: '叫號',
      schedule: '排班',
      staff: '成員帳號管理',
      sectionOperate: '營運',
      sectionSchedule: '排班',
      sectionSettings: '設定',
      // @deprecated 由 schedule 整合頁取代
      holidays: '公休日'
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
      RESOURCE: '場所或設備指定',
      RESOURCE_OPTIONAL: '可選場所或設備',
      QUEUE: '號碼牌',
      helperResource: '顧客預約時必須指定一個場所或設備',
      helperResourceOptional: '顧客可選「不指定」由系統自動分配，或指定其中一個'
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
      cutoffHours: 'N 小時',
      providerMode: {
        title: '服務人員（Provider）制',
        enabledLabel: '啟用服務人員制',
        enabledHint: '啟用後，顧客預約時可先選擇服務人員（醫師／技師／老師…）；既有商家預設關閉，與現狀完全一致。',
        labelTitle: '自訂稱呼',
        labelHint: '對顧客顯示的稱呼；未填則使用預設「服務人員 / Provider / スタッフ」',
        labelZh: '中文稱呼',
        labelEn: '英文稱呼',
        labelJa: '日文稱呼',
        labelPlaceholderZh: '例：醫師、技師、老師',
        labelPlaceholderEn: 'e.g. Doctor, Therapist, Coach',
        labelPlaceholderJa: '例：医師、セラピスト、コーチ'
      }
    },
    services: {
      listTitle: '服務項目管理',
      subtitle: '管理可被預約的服務項目、模式與時長',
      newButton: '+ 新增項目',
      nameLabel: '項目名稱',
      bookingModeLabel: '預約模式',
      durationLabel: '項目時長（分鐘）',
      intervalLabel: '時段間隔（分鐘）',
      capacityLabel: '每時段容量',
      priceLabel: '價格（分）',
      resourcesLabel: '綁定場所或設備',
      columns: {
        mode: '模式',
        durationInterval: '時長 / 間隔',
        capacity: '容量',
        resources: '場所或設備'
      },
      avgServiceMinutes: {
        label: '平均項目時長（分鐘）',
        placeholder: '留空自動沿用項目時長',
        help: '實際每位顧客的平均處理時間，用於號碼牌「預估等待時間」顯示'
      }
    },
    resources: {
      listTitle: '場所或設備管理',
      subtitle: '管理技師、座位、設備等可被分配的場所或設備',
      newButton: '+ 新增場所或設備',
      nameLabel: '名稱',
      boundServices: '已綁服務項目',
      boundServicesEmpty: '— 尚未綁定',
      boundServicesHint: '請在「服務項目」頁編輯項目時勾選此場所或設備,顧客才看得到他',
      columns: {
        description: '描述',
        displayOrder: '顯示順序'
      }
    },
    schedule: {
      title: '排班',
      subtitle: '管理每週時段、單日調整、公休日與領號時間',
      scopeMerchant: '整店',
      scopeResource: '場所或設備',
      scopeProvider: '{label}',
      providerScopeResourceLabel: '預綁診間（選填）',
      providerScopeResourceHint: '可指定該時段{label}所在的診間／工位；不指定則僅排人不排地',
      addSlot: '+ 新增時段',
      // @deprecated 由 singleDayOverrides 取代(顯示名稱改為「單日調整」)
      overrides: '單日調整',
      singleDayOverrides: '單日調整',
      addOverride: '+ 新增調整',
      closed: '當日休息',
      tab: {
        weekly: '📅 預約時段',
        overrides: '🔧 單日調整',
        holidays: '🚫 公休日',
        queueWindow: '🎟 現場領號時段'
      },
      hint: {
        weekly: '設定每週固定營業時段;若某天時間和平常不一樣,請切換到「🔧 單日調整」tab',
        overrides: '設定某一天和平常不一樣的時段或休息(可指定整店或單一場所或設備)。整店全日休請改用「🚫 公休日」tab',
        holidays: '整店休息日,會在顧客訂位頁顯示假日名稱。如果只是某天提早收或某場所或設備請假,請改用「🔧 單日調整」tab',
        queueWindow: '設定每個 QUEUE 服務項目每週的領號時段與每日上限'
      },
      affects: '影響服務項目:{names}',
      affectsAll: '影響:整店所有服務項目',
      affectsNone: '尚無對應服務項目',
      affectsMore: '等 {n} 個',
      affectsCount: '影響 {n} 個服務項目',
      affectsExpand: '查看',
      unboundResource: {
        title: '此場所或設備尚未被任何服務項目綁定,顧客在預約頁與後台代客預約都無法選到他',
        action: '前往服務項目頁綁定 →'
      },
      emptyNoService: '尚未建立任何服務項目,請先到「服務項目」頁建立',
      goCreateService: '前往服務項目頁 →',
      weeklyTitle: '預約時段',
      overridesTitle: '單日調整',
      holidaysTitle: '公休日',
      queueWindowTitle: '現場領號時段'
    },
    queueWindow: {
      title: '領號時間',
      subtitle: '依星期設定每個 QUEUE 服務項目的領號時段與每日上限',
      loading: '載入中…',
      serviceLabel: '服務項目',
      noQueueService: '尚無 QUEUE 模式服務項目，請先建立',
      goCreateService: '前往服務項目管理 →',
      saveSuccess: '已儲存領號時間',
      maxTicketsHint: '上限 0 = 無限',
      adminNoWindow: '尚未設定領號時間，顧客將無法領號',
      adminNoWindowAction: '前往設定 →',
      applyWeekdays: '套用到所有平日',
      applyAllDays: '套用到所有日',
      applyAllDaysConfirm: '此操作會覆蓋週六、週日的設定，是否繼續？',
      needSourceRow: '請先啟用任一列做為來源'
    },
    holidays: {
      listTitle: '公休日',
      nameLabel: '名稱',
      dateLabel: '日期',
      addHoliday: '+ 新增公休日'
    },
    staff: {
      listTitle: '成員帳號管理',
      subtitle: '管理商家內部員工與權限',
      newButton: '+ 新增成員帳號',
      noPermission: '此頁僅限 OWNER 操作；目前帳號為 STAFF。',
      roleLabel: '角色',
      roleOwner: '擁有者',
      roleStaff: '員工',
      toggleActive: '啟用 / 停用',
      cantToggleSelf: '不能停用自己',
      columns: {
        email: 'Email',
        status: '狀態'
      }
    },
    shareLink: {
      title: '對外連結',
      subtitle: '把連結傳給顧客，或印 QR code 張貼於店面',
      hint: '把以下連結傳給顧客，或印 QR code 張貼於店面',
      hintWithColon: '把以下連結傳給顧客，或印 QR code 張貼於店面：',
      copy: '複製',
      copied: '已複製連結',
      copyFailed: '複製失敗，請手動選取',
      empty: '尚未設定 slug',
      goSettings: '前往商家設定',
      merchantNotConfigured: '尚未設定 slug，請先到「商家設定」'
    },
    errors: {
      slugTaken: '網址已被使用',
      uploadFailed: '圖片上傳失敗',
      saveFailed: '儲存失敗'
    },
    queue: {
      tabs: {
        waiting: '等待中',
        called: '服務中',
        history: '歷史',
        countSuffix: '（{n}）'
      },
      search: {
        placeholder: '輸入號碼或手機末 4 碼',
        empty: '找不到符合的號碼',
        clear: '清除搜尋'
      },
      serving: {
        empty: '目前無服務中號碼'
      },
      conn: {
        live: '即時連線中',
        off: '連線中斷'
      },
      operatingRoom: {
        label: '目前操作'
      }
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
      service: '服務項目',
      provider: '{label}',
      resource: '場所或設備',
      datetime: '日期與時段',
      // @deprecated 由 datetime 取代
      date: '日期',
      // @deprecated 由 datetime 取代
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
      lastNamePlaceholder: '例：王',
      titleField: '稱謂',
      phone: '手機號碼',
      phonePlaceholder: '0912345678',
      note: '備註',
      noteOptional: '備註（選填）'
    },
    panel: {
      pickService: '選擇服務項目',
      pickProvider: '選擇{label}',
      pickResource: '選擇場所或設備',
      pickDateTime: '選擇日期與時段'
    },
    resource: {
      anyLabel: '不指定（由系統自動分配）',
      anyDescription: '由系統為您挑選一個可用的場所或設備'
    },
    provider: {
      cardTitleFallback: '此{label}',
      bioEmpty: '尚無介紹',
      unavailable: '此{label}目前沒有可預約時段',
      pickHint: '請點選您希望為您服務的{label}'
    },
    fields: {
      date: '日期',
      resource: '場所或設備',
      note: '備註',
      service: '服務項目',
      time: '時段',
      customer: '顧客'
    },
    validation: {
      lastNameRequired: '請填寫姓氏',
      lastNameMaxLength: '姓氏請在 20 字以內',
      titleRequired: '請選擇稱謂',
      phoneRequired: '請填寫手機號碼',
      phoneFormat: '手機號碼格式錯誤'
    },
    placeholders: {
      pickTitle: '選擇稱謂',
      phoneExample: '例：0912345678',
      lastNameExample: '例：王'
    },
    submitFailed: '預約失敗，請重試',
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
      reviseBooking: '返回修改',
      success: '預約成功',
      lookup: '查詢',
      switchIdentity: '切換身分',
      switchLocale: '切換語系',
      goCalendar: '行事曆檢視',
      goArchive: '歷史紀錄',
      delegate: '代客預約'
    },
    slotPicker: {
      morning: '上午',
      afternoon: '下午',
      evening: '晚上',
      full: '滿',
      remaining: '剩 {n}',
      loading: '時段載入中…',
      empty: '該日無可預約時段'
    },
    messages: {
      bookSuccess: '預約成功',
      cancelSuccess: '已取消預約',
      slotTaken: '該時段已被預約',
      cancelTooLate: '已超過取消期限，請聯絡商家',
      notFound: '查無此預約',
      emptyList: '暫無預約紀錄',
      noSlot: '該日無可預約時段',
      limitExceeded: '您在本商家的預約已達上限，請取消舊預約後再試',
      limitExceededTitle: '已達預約上限',
      limitExceededHint: '您可至「我的預約」取消不需要的預約',
      goMyBookings: '前往我的預約',
      providerRequired: '請先選擇{label}',
      providerNotForService: '該{label}不提供此服務項目',
      providerInactive: '該{label}已停用',
      providerTaken: '該{label}此時段已被預約'
    },
    queryTitle: '查詢預約',
    querySubmit: '查詢',
    queryHint: '輸入下方三項資訊查詢您的預約紀錄',
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
      landingEyebrow: '號碼牌服務',
      landingTitle: '領號排隊',
      landingHint: '選擇下方服務項目後填寫聯絡資訊，即可領取今日號碼牌。',
      statusYourNumber: '您的號碼',
      statusServing: '目前服務中',
      statusLastIssued: '最後發出號碼',
      statusCalledHint: '請進入，輪到您了！',
      statusDoneHint: '已完成服務，謝謝光臨',
      statusSkippedHint: '已被標為過號，如需服務請洽櫃台',
      statusAheadHint: '您前面還有 {n} 人',
      adminTitle: '號碼牌叫號台',
      adminEmpty: '尚未建立號碼牌服務項目',
      adminEmptyHint: '請至「服務項目」頁新增 bookingMode=QUEUE 的服務項目並設定每週領號時段。',
      callNext: '叫下一號',
      markDone: '完成',
      markSkip: '過號',
      take: '立即領號',
      formTitle: '填寫聯絡資訊以領號',
      formSubmit: '領號',
      connLive: '即時更新中',
      connFallback: '即時連線不穩，仍會自動更新',
      connReconnecting: '連線中斷，{n} 秒後重試',
      connOffline: '裝置目前離線',
      connRetry: '立即重試',
      currentServing: '目前叫到',
      waitingCount: '等待 {n} 人',
      notServing: '目前未叫號',
      notStarted: '尚未開始服務',
      recentTitle: '你今天已有 {n} 號',
      recentSubtitle: '上次領號於本裝置',
      recentReturn: '回到等待頁',
      recentDismiss: '我不是這個',
      findEntry: '找回我的號碼',
      findTitle: '找回我的號碼',
      findHint: '請選擇服務項目並輸入手機末 4 碼，協助你回到今日已領取的號碼牌。',
      findServiceLabel: '服務項目',
      findServicePlaceholder: '請選擇服務項目',
      findPhoneLabel: '手機末 4 碼',
      findPhonePlaceholder: '例如：1234',
      findSubmit: '找回號碼',
      findAmbiguous: '查詢結果不只一筆，請改用完整手機或聯絡店家',
      findNotFound: '查無今日的號碼牌',
      findInvalid: '請輸入正確的 4 位數字',
      callOverlayTitle: '該你了',
      callOverlaySubtitle: '請至櫃台',
      callOverlayDismiss: '我知道了',
      titleCalled: '🔔 該你了 - {serviceName} - 您的號碼 {n}',
      titleWaiting: '等待中 - {serviceName}',
      progressStart: '起點',
      progressYou: '你',
      progressEnd: '隊尾',
      progressAhead: '前面還有 {n} 位',
      progressNotStarted: '尚未開始叫號',
      progressPassed: '您的號碼已過，請聯絡店家或重新領號',
      doneTitle: '服務完成，謝謝您',
      doneSubtitle: '歡迎再次光臨',
      doneCtaHome: '回首頁',
      doneCtaRetake: '重新領號',
      skippedTitle: '您的號碼已被跳過',
      skippedSubtitle: '如仍需服務，請洽櫃台或重新領號',
      skippedCtaContact: '聯絡店家',
      ticketWithRoom: '{room} {number} 號',
      statusCalledHintWithRoom: '請至 {room}，輪到您了！'
    },
    take: {
      selectRoomLabel: '選擇診間／櫃台',
      selectRoomHint: '目前各間等待狀況可幫您決策',
      roomStat: '現叫 {current} 號・等待 {waiting} 人'
    },
    walkIn: {
      title: '現場登記',
      hint: '為現場到店的顧客代為領取號碼牌；可在領號時間窗外協助補單。',
      fields: {
        lastName: '姓',
        lastNamePlaceholder: '例：王',
        title: '稱謂',
        phone: '手機（可選）',
        phonePlaceholder: '例：0912345678（可留空）',
        phoneHint: '未留電話則無法以末 4 碼自助查詢，請當面交付號碼。'
      },
      actions: {
        submit: '送出領號',
        cancel: '取消',
        print: '列印小單',
        close: '關閉'
      },
      success: '已領號 {ticketNumber}',
      printTicket: {
        merchantLabel: '商家',
        serviceLabel: '服務項目',
        numberLabel: '號碼',
        timeLabel: '領號時間'
      }
    },
    status: {
      WAITING: '等待中',
      CALLED: '服務中',
      DONE: '已完成',
      SKIPPED: '已過號',
      CANCELED: '已取消'
    },
    eta: {
      aheadOfYou: '您前面還有 {n} 位',
      estimateMinutes: '預估還需 {n} 分鐘',
      almostYourTurn: '即將輪到您',
      unknown: '預估時間尚無法計算',
      aboutMinutesLater: '約 {n} 分鐘後'
    },
    claim: {
      title: '掃碼追蹤您的號碼',
      qrHint: '掃描下方 QR Code，即可在自己手機上即時追蹤叫號進度，去吃飯或逛街也不錯過。',
      shortCode: '短碼',
      shortCodeHint: '若 QR 掃描失敗，可至以下網址手動輸入此 8 碼短碼',
      todayOnly: '本日有效，當日結束後自動失效',
      printSlip: '小單背面掃碼即可在手機追蹤',
      scanToTrack: '掃碼即可在手機追蹤叫號',
      tokenExpired: '票券已過期或不存在，請改用手機末 4 碼回查',
      fallbackToPhoneLookup: '改用手機末 4 碼',
      gotIt: '我知道了',
      qrFallbackLabel: '請使用以下連結與短碼追蹤',
      copyLink: '複製連結'
    },
    messages: {
      takeSuccess: '領號成功',
      windowClosed: '目前不在領號時間',
      notQueueService: '此服務項目非號碼牌模式',
      alreadyTaken: '您今日已領過號碼牌',
      queueFull: '今日號碼牌已發完',
      noWaiting: '目前沒有等待中的號碼',
      invalidTransition: '號碼牌狀態無法變更',
      ticketNotFound: '查無此號碼牌',
      findAmbiguous: '查詢結果不只一筆，請至櫃台出示手機號碼協助核對',
      findNotFound: '查無今日的號碼牌',
      findInvalid: '請輸入正確的 4 位數字'
    },
    checkIn: {
      title: '待報到',
      empty: '目前無待報到顧客',
      assignedRoom: '指派診間',
      confirm: '確認報到',
      confirmed: '已報到',
      reassigned: '已改派 {from} → {to}',
      unassignedProvider: '未指派服務人員',
      assignFailed: '改派失敗，請稍後再試'
    }
  },
  slot: {
    reason: {
      past: '已過',
      taken: '已被預約',
      capacity: '已額滿',
      closed: '本時段休息',
      holiday: '本日休假',
      inactive: '場所或設備停用'
    },
    reasonTooltip: {
      past: '此時段已過，無法預約',
      taken: '此時段已被其他顧客預約',
      capacity: '此時段名額已滿',
      closed: '本時段為休息時間',
      holiday: '本日為休假日',
      inactive: '此場所或設備目前停用'
    },
    prefillNotice: '您點選的 {time} 已選中，請繼續填寫顧客資訊',
    prefillUnavailable: '您點選的 {time} 目前不可用（{reason}），請選擇其他時段'
  },
  appointment: {
    status: {
      CONFIRMED: '已預約',
      CANCELED: '已取消',
      COMPLETED: '已完成',
      NO_SHOW: '未到'
    },
    fields: {
      provider: '{label}',
      providerUnspecified: '未指定',
      providerInactiveSuffix: '（已停用）'
    },
    customerTitle: {
      MR: '先生',
      MRS: '女士',
      MISS: '小姐',
      MX: '客人'
    },
    list: {
      showArchived: '顯示已結案',
      showArchivedHint: '開啟後將同時顯示已取消、已完成、未到的紀錄（最多回溯 90 天）'
    },
    tooltip: {
      list: '進行中的預約（可開啟「顯示已結案」查看已取消／完成／未到）',
      archive: '90 天前已歸檔的舊預約紀錄'
    },
    actions: {
      backToMain: '← 返回預約管理',
      more: '更多',
      detail: '詳細',
      cancel: '取消預約',
      complete: '標記完成',
      noShow: '標記未到',
      reschedule: '修改預約'
    },
    confirm: {
      complete: '確定將此預約標記為已完成？',
      noShow: '確定將此預約標記為未到？'
    },
    reschedule: {
      title: '修改預約',
      origin: '原預約',
      success: '已更新預約',
      loadingSlots: '載入時段中…',
      forceHint: '已啟用過號補登：允許選擇已過時段、跳過場所或設備排班檢查；仍會檢查雙開衝突，避免造成業務事故。',
      forcePromptOnPastSlot: '時段已過，請啟用「過號補登」再送出',
      fields: {
        date: '新日期',
        time: '新時段',
        timePlaceholder: 'HH:mm',
        timeRequired: '請選擇時段',
        resource: '新場所或設備',
        resourceAny: '不指定（由系統自動分配）',
        resourceRequired: '請選擇場所或設備',
        force: '過號補登（允許過去時段）'
      },
      actions: {
        confirm: '確認修改',
        cancel: '取消'
      }
    }
  },
  service: {
    durationLabel: '{n} 分鐘',
    edit: {
      queueResourcesLabel: '可叫號的診間／櫃台／醫師（選填）',
      queueResourcesHint: '綁定後每個場所或設備獨立一條號碼牌隊列；不綁則維持單一號池',
      requiresProviderLabel: '需指定{label}',
      requiresProviderHint: '啟用後，顧客預約此服務項目時必須選擇一位{label}；需先綁定至少一位',
      providersLabel: '可服務的{label}',
      providersHint: '勾選此服務項目由哪些{label}提供；顧客預約時將從這份名單挑選',
      providersEmptyError: '啟用「需指定{label}」時必須選擇至少一位'
    }
  },
  provider: {
    listTitle: '{label}管理',
    addButton: '+ 新增{label}',
    fields: {
      avatar: '頭像',
      name: '姓名',
      title: '職稱',
      bio: '介紹',
      displayOrder: '排序',
      isActive: '啟用',
      boundServices: '可服務的項目',
      boundServicesEmpty: '— 尚未綁定服務項目'
    },
    placeholders: {
      name: '例：王醫師、Lisa 老師',
      title: '例：主治醫師、資深技師',
      bio: '簡短介紹（可多行）'
    },
    actions: {
      edit: '編輯',
      delete: '停用'
    },
    bannerNotEnabled: '尚未啟用「服務人員制」，到「商家設定」啟用後此頁才會在側邊欄出現。',
    bannerGoSettings: '前往商家設定',
    empty: '尚未建立任何{label}'
  },
  display: {
    calling: '現在叫號',
    noNumber: '尚未叫號',
    next: '下一位',
    nextAfter: '再下一位',
    waiting: '等待中',
    waitingPeople: '{count} 人',
    estimate: '預估等待',
    minutes: '{n} 分鐘',
    minutesShort: '< 1 分鐘',
    noService: '目前無服務項目開放',
    allDone: '今日已完成所有號碼',
    pickService: '請選擇服務項目',
    openDisplay: '開啟顯示頁',
    copyLink: '複製連結',
    linkCopied: '已複製顯示頁連結',
    linkCopyFailed: '無法自動複製，請手動複製：',
    needQueueService: '請先建立 QUEUE 服務項目',
    gotoRoom: '請至 {room}',
    tts: {
      toggle: '語音廣播',
      on: '語音廣播：開',
      off: '語音廣播：關',
      unsupported: '此瀏覽器不支援語音廣播',
      callPhraseSimple: '請 {number} 號',
      callPhraseWithCustomer: '請 {number} 號 {customerName}',
      callPhraseWithRoom: '{number} 號，請至 {room}'
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
