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
      schedule: 'スケジュール',
      holidays: '休日',
      staff: 'メンバー'
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
      nameLabel: 'リソース名'
    },
    schedule: {
      title: 'スケジュール',
      scopeMerchant: '店舗全体',
      scopeResource: 'リソース',
      addSlot: '+ 枠を追加',
      overrides: '特定日上書き',
      addOverride: '+ 上書きを追加',
      closed: '当日休業'
    },
    holidays: {
      listTitle: '休日',
      nameLabel: '名称',
      dateLabel: '日付'
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
      date: '日付',
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
      titleField: '敬称',
      phone: '電話番号',
      note: '備考'
    },
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
      success: '予約完了',
      lookup: '照会',
      switchIdentity: '別の方として照会',
      switchLocale: '言語切替',
      goCalendar: 'カレンダー',
      goArchive: '履歴',
      delegate: '代理予約'
    },
    messages: {
      bookSuccess: '予約が完了しました',
      cancelSuccess: '予約をキャンセルしました',
      slotTaken: 'この時間帯はすでに予約済みです',
      cancelTooLate: 'キャンセル期限を過ぎています。店舗にご連絡ください',
      notFound: '該当する予約がありません',
      emptyList: '予約はまだありません',
      noSlot: 'この日は予約可能な時間帯がありません'
    },
    queryTitle: '予約照会',
    querySubmit: '検索',
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
      connLive: 'ライブ接続中',
      connFallback: 'ポーリング待機中（15秒）'
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
      ticketNotFound: '整理券が見つかりません'
    }
  }
};
