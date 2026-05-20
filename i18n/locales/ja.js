export default {
  welcome: 'ようこそ',
  about: {
    title: '会社概要',
    description: 'これは会社概要ページです'
  },
  common: {
    back: '戻る',
    goHome: 'ホームに戻る',
    backToSignIn: 'ログインに戻る',
    save: '保存',
    cancel: 'キャンセル',
    confirm: '確認',
    create: '作成',
    edit: '編集',
    delete: '削除',
    submit: '送信',
    search: '検索',
    copy: 'コピー',
    loading: '読み込み中…',
    previous: '前へ',
    next: '次へ',
    saveSuccess: '保存しました',
    deleteSuccess: '削除しました',
    createSuccess: '作成しました',
    updateSuccess: '更新しました',
    copySuccess: 'リンクをコピーしました',
    copyFailed: 'コピー失敗、手動で選択してください',
    operationFailed: '操作失敗',
    weekdayShort: ['日', '月', '火', '水', '木', '金', '土'],
    weekdayLong: ['日曜', '月曜', '火曜', '水曜', '木曜', '金曜', '土曜'],
    yes: 'はい',
    no: 'いいえ',
    enabled: '有効',
    disabled: '無効',
    isActive: '有効中',
    isInactive: '無効'
  },
  validation: {
    required: 'この項目は必須です',
    maxLength: '最大 {n} 文字',
    password: {
      required: 'パスワードを入力してください',
      tooShort: 'パスワードは 8 文字以上必要です',
      needLetter: 'パスワードに英字が必要です',
      needNumber: 'パスワードに数字が必要です',
      mismatch: 'パスワードが一致しません',
      retype: 'パスワードを再入力してください',
      rule: 'パスワードは英字と数字を含む 8 文字以上'
    },
    phone: '電話番号の形式が正しくありません',
    timeFormat: '時刻の形式が正しくありません',
    timeOrder: '開始時刻は終了時刻より前に設定してください',
    selectService: 'サービスを選択してください',
    selectDate: '日付を選択してください',
    selectSlot: '時間枠を選択してください',
    selectResource: 'リソースを選択してください',
    completeFields: '連絡先情報をすべて入力してください',
    completeTriplet: '3 項目をすべて入力してください',
    nameRequired: '名称を入力してください',
    nameRequiredMerchant: '店舗名を入力してください',
    slugRequired: 'スラッグを入力してください',
    slugFormat: '英小文字・数字・ハイフンのみ、3-50 文字'
  },
  auth: {
    signIn: {
      titleMerchant: '店舗ログイン',
      titleAdmin: 'プラットフォーム管理者ログイン',
      submit: 'ログイン',
      signUp: '新規登録',
      forgot: 'パスワードをお忘れですか'
    },
    signUp: {
      title: '店舗登録',
      hint: '登録後、管理者の審査が必要です',
      submit: '申請を送信',
      backToSignIn: 'アカウント済み？ログインへ'
    },
    forgot: {
      title: 'パスワード再設定',
      hint: 'メールアドレスを入力してください。アカウントが存在する場合、再設定リンクを送信します',
      submit: '送信'
    },
    notice: {
      pendingReview: '店舗登録申請を受け付けました。管理者の審査をお待ちください',
      forgotSent: 'アカウントが存在する場合、パスワード再設定メールが届きます'
    },
    errors: {
      invalidCredentials: 'メールアドレスまたはパスワードが正しくありません',
      accountPending: '管理者の審査待ち',
      accountSuspended: '店舗が停止されました',
      accountRejected: '登録申請が却下されました',
      emailExists: 'メールアドレスは既に登録されています',
      rateLimited: 'リクエストが多すぎます。しばらくしてからお試しください',
      passwordRule: 'パスワードは英字と数字を含む 8 文字以上が必要です',
      passwordMismatch: 'パスワードが一致しません'
    }
  },
  admin: {
    dialog: {
      adminEditCreate: '管理者追加',
      adminEditEdit: '管理者編集',
      staffEditCreate: 'メンバー追加',
      staffEditEdit: 'メンバー編集',
      serviceEditCreate: 'サービス追加',
      serviceEditEdit: 'サービス編集',
      resourceEditCreate: 'リソース追加',
      resourceEditEdit: 'リソース編集',
      appointmentCreateTitle: '代理予約',
      holidayCreateTitle: '休業日追加',
      holidayEditTitle: '休業日編集',
      scheduleRuleTitle: 'スケジュールルール',
      scheduleOverrideTitle: 'スケジュール上書き',
      merchantApproveTitle: '店舗審査承認',
      merchantRejectTitle: '店舗申請却下',
      merchantApproveConfirm: '承認確定',
      merchantRejectConfirm: '却下確定',
      pwdNew: '新パスワード（空欄で変更なし）',
      pwdField: 'パスワード',
      pwdHintNew: '英字と数字を含む 8 文字以上',
      pwdHintKeep: '変更しない場合は空欄',
      createSuccess: '作成しました',
      updateSuccess: '更新しました',
      approveSuccess: '審査を承認しました',
      rejectSuccess: '申請を却下しました',
      saveOverrideSuccess: '上書きを保存しました',
      addHolidaySuccess: '休業日を追加しました'
    },
    nav: {
      home: 'ホーム',
      settings: '店舗設定',
      shareLink: '共有リンク',
      services: 'サービス',
      resources: 'リソース',
      appointments: '予約管理',
      queue: '呼び出し',
      schedule: 'スケジュール',
      staff: 'メンバー',
      sectionOperate: '運用',
      sectionSchedule: 'スケジュール',
      sectionSettings: '設定',
      // @deprecated スケジュール統合ページへ移行
      holidays: '定休日'
    },
    actions: {
      create: '作成',
      edit: '編集',
      delete: '削除',
      save: '保存',
      cancel: 'キャンセル',
      confirm: '確認'
    },
    bookingMode: {
      TIME_SLOT: '固定枠',
      TIME_CAPACITY: '枠+定員',
      RESOURCE: 'リソース指定',
      RESOURCE_OPTIONAL: 'リソース選択（任意）',
      QUEUE: '整理券'
    },
    settings: {
      title: '店舗設定',
      basic: '基本情報',
      appearance: '外観',
      cancelPolicy: 'キャンセルポリシー',
      uploadLogo: 'ロゴをアップロード',
      uploadCover: 'カバー画像をアップロード',
      policyFree: 'お客様はいつでもキャンセル可能',
      policyCutoff: '予約開始 N 時間前以降はキャンセル不可',
      cutoffHours: 'N 時間'
    },
    services: {
      listTitle: 'サービス',
      nameLabel: 'サービス名',
      bookingModeLabel: '予約モード',
      durationLabel: '所要時間（分）',
      intervalLabel: '枠間隔（分）',
      capacityLabel: '1枠あたり定員',
      priceLabel: '料金（セント）',
      resourcesLabel: '紐付けリソース'
    },
    resources: {
      listTitle: 'リソース',
      nameLabel: 'リソース名',
      boundServices: '紐付けサービス',
      boundServicesEmpty: '— 紐付け無し',
      boundServicesHint: 'RESOURCE モードのサービスを編集してこのリソースを選択すると、お客様が指定できるようになります。'
    },
    schedule: {
      title: 'スケジュール',
      subtitle: '週時間・単日調整・定休日・整理券時間をまとめて管理します',
      scopeMerchant: '店舗全体',
      scopeResource: 'リソース',
      addSlot: '+ 枠を追加',
      // @deprecated 単日調整に置き換え
      overrides: '単日調整',
      singleDayOverrides: '単日調整',
      addOverride: '+ 調整を追加',
      closed: '当日休業',
      tab: {
        weekly: '📅 予約時間',
        overrides: '🔧 単日調整',
        holidays: '🚫 定休日',
        queueWindow: '🎟 来店受付時間'
      },
      hint: {
        weekly: '毎週の固定営業時間を設定します。特定日のみ時間が違う場合は「🔧 単日調整」タブをご利用ください。',
        overrides: '特定の日だけ普段と違う時間または休業を設定できます(店舗全体または特定リソースを指定可能)。終日全店休業の場合は「🚫 定休日」タブをお使いください。',
        holidays: '店舗全体の休業日。お客様の予約ページに祝日名が表示されます。早終いや特定リソースの欠勤は「🔧 単日調整」を使ってください。',
        queueWindow: 'QUEUE サービスごとに、毎週の整理券発行時間帯と 1 日の上限を設定します。'
      },
      affects: '対象サービス:{names}',
      affectsAll: '対象:店舗全体のサービス',
      affectsNone: '対象サービスがまだありません',
      affectsMore: 'ほか {n} 件',
      affectsCount: '対象 {n} 件のサービス',
      affectsExpand: '表示',
      unboundResource: {
        title: 'このリソースは未だどのサービスにも紐付けられていません。お客様予約・代理予約のどちらでも選択できません。',
        action: 'サービスページで紐付ける →'
      },
      emptyNoService: 'まだサービスがありません。「サービス」ページで作成してください。',
      goCreateService: 'サービスページへ →',
      weeklyTitle: '予約時間',
      overridesTitle: '単日調整',
      holidaysTitle: '定休日',
      queueWindowTitle: '来店受付時間'
    },
    queueWindow: {
      title: '整理券時間',
      subtitle: '曜日ごとに各 QUEUE サービスの受付時間帯と 1 日の上限を設定します',
      loading: '読み込み中…',
      serviceLabel: 'サービス',
      noQueueService: 'QUEUE モードのサービスがありません。先に作成してください。',
      goCreateService: 'サービス管理へ →',
      saveSuccess: '受付時間を保存しました',
      maxTicketsHint: '上限 0 = 無制限',
      adminNoWindow: '受付時間が未設定です。お客様は整理券を取得できません。',
      adminNoWindowAction: '設定へ →',
      applyWeekdays: '平日に適用',
      applyAllDays: '全曜日に適用',
      applyAllDaysConfirm: 'この操作は土・日の設定を上書きします。続行しますか？',
      needSourceRow: '適用元となる曜日を先に有効化してください'
    },
    holidays: {
      listTitle: '定休日',
      nameLabel: '名称',
      dateLabel: '日付',
      addHoliday: '+ 定休日を追加'
    },
    staff: {
      listTitle: 'メンバー',
      roleLabel: '役割',
      roleOwner: 'オーナー',
      roleStaff: 'スタッフ',
      toggleActive: '有効化 / 無効化',
      cantToggleSelf: '自分自身を無効化できません'
    },
    shareLink: {
      title: '共有リンク',
      hint: '以下のリンクをお客様に共有、または QR コードを店舗に掲示してください',
      copy: 'コピー',
      copied: 'コピーしました',
      merchantNotConfigured: 'スラッグが未設定です。店舗設定でご確認ください'
    },
    errors: {
      slugTaken: 'URL スラッグはすでに使用されています',
      uploadFailed: '画像のアップロードに失敗しました',
      saveFailed: '保存に失敗しました'
    }
  },
  sys: {
    welcome: 'ようこそ、{name} 様',
    welcomeFallback: '管理者',
    statusLabel: {
      PENDING: '審査待ち',
      ACTIVE: '稼働中',
      SUSPENDED: '停止',
      REJECTED: '却下'
    },
    merchantSuspendTitle: '店舗を停止',
    merchantActivateTitle: '店舗を有効化',
    merchantSuspendConfirm: '「{name}」を停止しますか？',
    merchantActivateConfirm: '「{name}」を有効化しますか？',
    merchantSuspendSuccess: '停止しました',
    merchantActivateSuccess: '有効化しました',
    adminToggleConfirm: '「{name}」を{action}しますか？',
    adminToggleTitle: '管理者を{action}',
    adminCantToggleSelf: '自分自身を無効化できません',
    tabs: {
      all: 'すべて',
      pending: '審査待ち',
      active: '稼働中',
      suspended: '停止',
      rejected: '却下'
    },
    actions: {
      approve: '承認',
      reject: '却下',
      suspend: '停止',
      activate: '有効化',
      impersonate: '店舗管理画面に入る',
      exitImpersonation: '代理を終了'
    },
    notice: {
      impersonationActive: 'プラットフォーム管理者が代理中',
      suspendConfirm: '本当にこの店舗を停止しますか？',
      activateConfirm: '本当にこの店舗を有効化しますか？',
      cantToggleSelf: '自分自身を無効化できません'
    }
  },
  booking: {
    nav: {
      myBookings: '予約履歴',
      lookup: '予約照会',
      bookNow: '今すぐ予約'
    },
    steps: {
      service: 'サービス',
      resource: 'リソース',
      datetime: '日付と時間帯',
      // @deprecated datetime に置換済み
      date: '日付',
      // @deprecated datetime に置換済み
      slot: '時間帯',
      info: '情報',
      confirm: '確認'
    },
    customer: {
      titleMr: '様（男性）',
      titleMrs: '様（既婚女性）',
      titleMiss: '様（未婚女性）',
      titleMx: '様',
      lastName: '姓',
      lastNamePlaceholder: '例：田中',
      titleField: '敬称',
      phone: '電話番号',
      phonePlaceholder: '09012345678',
      note: '備考',
      noteOptional: '備考（任意）'
    },
    panel: {
      pickService: 'サービスを選択',
      pickResource: 'リソースを選択',
      pickDateTime: '日付と時間を選択'
    },
    resource: {
      anyLabel: '指定なし（自動割り当て）',
      anyDescription: 'システムが空きリソースから自動で選択します'
    },
    fields: {
      date: '日付',
      resource: 'リソース',
      note: '備考',
      service: 'サービス',
      time: '時間帯',
      customer: 'お客様'
    },
    validation: {
      lastNameRequired: '姓を入力してください',
      lastNameMaxLength: '姓は20文字以内で入力してください',
      titleRequired: '敬称を選択してください',
      phoneRequired: '電話番号を入力してください',
      phoneFormat: '電話番号の形式が正しくありません'
    },
    placeholders: {
      pickTitle: '敬称を選択',
      phoneExample: '例：09012345678',
      lastNameExample: '例：田中'
    },
    submitFailed: '予約に失敗しました。再度お試しください',
    status: {
      CONFIRMED: '予約済み',
      CANCELED: 'キャンセル済み',
      NO_SHOW: '未来店',
      COMPLETED: '完了'
    },
    canceledBy: {
      CUSTOMER: 'お客様によるキャンセル',
      MERCHANT: '店舗によるキャンセル',
      SYSTEM: 'システムによるキャンセル'
    },
    actions: {
      cancel: '予約をキャンセル',
      confirmBooking: '予約確定',
      reviseBooking: '修正に戻る',
      success: '予約完了',
      lookup: '照会',
      switchIdentity: '別の方として照会',
      switchLocale: '言語切替',
      goCalendar: 'カレンダー',
      goArchive: '履歴',
      delegate: '代理予約'
    },
    slotPicker: {
      morning: '午前',
      afternoon: '午後',
      evening: '夜',
      full: '満',
      remaining: '残 {n}',
      loading: '時間帯を読み込み中…',
      empty: 'この日は予約可能な時間帯がありません'
    },
    messages: {
      bookSuccess: '予約が完了しました',
      cancelSuccess: '予約をキャンセルしました',
      slotTaken: 'この時間帯はすでに予約済みです',
      cancelTooLate: 'キャンセル期限を過ぎています。店舗にご連絡ください',
      notFound: '該当する予約がありません',
      emptyList: '予約はまだありません',
      noSlot: 'この日は予約可能な時間帯がありません',
      limitExceeded: 'この店舗での予約数が上限に達しました。既存の予約をキャンセルしてから再度お試しください',
      limitExceededTitle: '予約上限に達しました',
      limitExceededHint: '「マイ予約」で不要な予約をキャンセルできます',
      goMyBookings: 'マイ予約へ'
    },
    queryTitle: '予約照会',
    querySubmit: '検索',
    queryHint: '以下の3つの情報を入力して予約履歴を照会してください',
    fillContactTitle: '連絡先情報',
    calendar: {
      prev: '前の',
      next: '次の',
      day: '日',
      week: '週',
      prevMonth: '前月',
      nextMonth: '翌月',
      today: '今日'
    }
  },
  enum: {
    apiStatus: {
      200: '成功',
      400: '失敗',
      401: '未認証',
      403: 'アクセス禁止',
      404: '見つかりません',
      500: 'サーバーエラー'
    }
  },
  queue: {
    page: {
      landingEyebrow: '整理券サービス',
      landingTitle: '整理券を取る',
      landingHint: '下のサービスを選んで連絡先を入力すると、本日の整理券を発行します。',
      statusYourNumber: 'お持ちの番号',
      statusServing: '現在の受付番号',
      statusLastIssued: '最新発行番号',
      statusCalledHint: 'お入りください — あなたの番です！',
      statusDoneHint: 'サービス完了。ご来店ありがとうございました。',
      statusSkippedHint: '不在として処理されました。カウンターへお越しください。',
      statusAheadHint: 'あと {n} 人お待ちです',
      adminTitle: '整理券コール台',
      adminEmpty: '整理券サービスがありません',
      adminEmptyHint: '「サービス」ページで bookingMode=QUEUE のサービスと毎週の受付時間帯を追加してください。',
      callNext: '次の番号を呼ぶ',
      markDone: '完了',
      markSkip: 'パス',
      take: '整理券を取る',
      formTitle: '整理券のための連絡先',
      formSubmit: '整理券を取る',
      connLive: 'リアルタイム更新中',
      connFallback: '接続が不安定ですが、自動更新を継続します',
      connReconnecting: '接続が切れました、{n} 秒後に再接続',
      connOffline: 'この端末はオフラインです',
      connRetry: '今すぐ再接続',
      currentServing: '対応中',
      waitingCount: '待ち {n} 人',
      notServing: '未呼出し',
      notStarted: '受付開始前',
      recentTitle: '本日 {n} 番の整理券をお持ちです',
      recentSubtitle: 'この端末で発行済み',
      recentReturn: '待ち画面に戻る',
      recentDismiss: '自分ではない',
      findEntry: '整理券を探す',
      findTitle: '整理券を探す',
      findHint: 'サービスを選び、電話番号の下 4 桁を入力して本日の整理券を呼び戻します。',
      findServiceLabel: 'サービス',
      findServicePlaceholder: 'サービスを選択',
      findPhoneLabel: '電話番号の下 4 桁',
      findPhonePlaceholder: '例：1234',
      findSubmit: '整理券を探す',
      findAmbiguous: '複数件見つかりました。完全な電話番号でお問い合わせください。',
      findNotFound: '本日の整理券は見つかりません',
      findInvalid: '4 桁の数字を入力してください',
      callOverlayTitle: 'あなたの番です',
      callOverlaySubtitle: 'カウンターへお越しください',
      callOverlayDismiss: 'わかりました',
      titleCalled: '🔔 あなたの番です - {serviceName} - {n} 番',
      titleWaiting: '待機中 - {serviceName}',
      progressStart: '受付',
      progressYou: 'あなた',
      progressEnd: '末尾',
      progressAhead: 'あと {n} 人',
      progressNotStarted: '呼び出しはまだ始まっていません',
      progressPassed: 'あなたの番号は通過しました。スタッフへご相談ください。',
      doneTitle: 'サービス完了、ありがとうございました',
      doneSubtitle: 'またのご来店をお待ちしております',
      doneCtaHome: 'トップへ',
      doneCtaRetake: '再発行',
      skippedTitle: 'あなたの番号はスキップされました',
      skippedSubtitle: 'ご用の方はスタッフまでお声がけください',
      skippedCtaContact: 'お店に連絡'
    },
    status: {
      WAITING: '待機中',
      CALLED: '対応中',
      DONE: '完了',
      SKIPPED: 'パス',
      CANCELED: 'キャンセル'
    },
    messages: {
      takeSuccess: '整理券を発行しました',
      windowClosed: '現在は受付時間外です',
      notQueueService: 'このサービスは整理券モードではありません',
      alreadyTaken: '本日すでに整理券をお持ちです',
      queueFull: '本日の整理券は配布終了しました',
      noWaiting: 'お待ちの整理券はありません',
      invalidTransition: '整理券の状態変更ができません',
      ticketNotFound: '整理券が見つかりません',
      findAmbiguous: '複数件見つかりました。携帯電話をご持参のうえカウンターまでお越しください。',
      findNotFound: '本日の整理券は見つかりません',
      findInvalid: '4 桁の数字を入力してください'
    }
  },
  slot: {
    reason: {
      past: '時間切れ',
      taken: '予約済み',
      capacity: '満員',
      closed: '休憩中',
      holiday: '休業日',
      inactive: 'リソース停止中'
    },
    reasonTooltip: {
      past: 'この時間帯は既に過ぎており、予約できません',
      taken: 'この時間帯は他のお客様により予約済みです',
      capacity: 'この時間帯は満員です',
      closed: 'この時間帯は休憩時間です',
      holiday: '本日は休業日です',
      inactive: 'このリソースは現在停止中です'
    },
    prefillNotice: '{time} を選択しました。お客様情報の入力を続けてください。',
    prefillUnavailable: '選択した {time} は利用できません（{reason}）。他の時間帯をお選びください。'
  },
  appointment: {
    status: {
      CONFIRMED: '予約済み',
      CANCELED: 'キャンセル',
      COMPLETED: '完了',
      NO_SHOW: '未来店'
    },
    customerTitle: {
      MR: '様（男性）',
      MRS: '様（既婚女性）',
      MISS: '様（未婚女性）',
      MX: 'お客様'
    },
    list: {
      showArchived: '終了済みを表示',
      showArchivedHint: 'オンにすると、キャンセル／完了／未来店の記録も表示します（90日以内）'
    },
    tooltip: {
      list: '進行中の予約（「終了済みを表示」でキャンセル／完了／未来店も確認できます）',
      archive: '90日より前にアーカイブされた予約記録'
    },
    actions: {
      backToMain: '← 予約管理に戻る',
      more: 'その他',
      detail: '詳細',
      cancel: 'キャンセル',
      complete: '完了にする',
      noShow: '未来店にする',
      reschedule: '予約変更'
    },
    confirm: {
      complete: 'この予約を完了にしますか？',
      noShow: 'この予約を未来店にしますか？'
    },
    reschedule: {
      title: '予約変更',
      origin: '元の予約',
      success: '予約を更新しました',
      loadingSlots: '時間帯を読み込み中…',
      forceHint: '過去時間補登が有効：過去の時間帯を選択でき、リソースのシフトチェックをスキップします。ダブルブッキング防止は引き続き有効です。',
      forcePromptOnPastSlot: '選択した時間は過去のため、「過去時間補登」を有効にしてから送信してください',
      fields: {
        date: '新しい日付',
        time: '新しい時間',
        timePlaceholder: 'HH:mm',
        timeRequired: '時間を選択してください',
        resource: '新しいリソース',
        resourceAny: '指定しない（自動割り当て）',
        resourceRequired: 'リソースを選択してください',
        force: '過去時間補登（過去時間帯を許可）'
      },
      actions: {
        confirm: '変更を確定',
        cancel: 'キャンセル'
      }
    }
  },
  service: {
    durationLabel: '{n} 分'
  }
};
