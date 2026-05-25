export default {
  welcome: 'Welcome',
  about: {
    title: 'About Us',
    description: 'This is About Page'
  },
  common: {
    back: 'Back',
    goHome: 'Back Home',
    backToSignIn: 'Back to sign-in',
    save: 'Save',
    cancel: 'Cancel',
    confirm: 'Confirm',
    create: 'Create',
    edit: 'Edit',
    delete: 'Delete',
    submit: 'Submit',
    search: 'Search',
    copy: 'Copy',
    loading: 'Loading…',
    previous: 'Previous',
    next: 'Next',
    saveSuccess: 'Saved',
    deleteSuccess: 'Deleted',
    createSuccess: 'Created',
    updateSuccess: 'Updated',
    copySuccess: 'Link copied',
    copyFailed: 'Copy failed, please select manually',
    operationFailed: 'Operation failed',
    weekdayShort: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    weekdayLong: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    yes: 'Yes',
    no: 'No',
    tagInactive: ' (inactive)',
    col: {
      name: 'Name',
      actions: 'Actions'
    },
    enabled: 'Enable',
    disabled: 'Disable',
    isActive: 'Active',
    isInactive: 'Inactive'
  },
  validation: {
    required: 'This field is required',
    maxLength: 'Maximum {n} characters',
    password: {
      required: 'Please enter password',
      tooShort: 'Password must be at least 8 characters',
      needLetter: 'Password must contain letters',
      needNumber: 'Password must contain numbers',
      mismatch: 'Passwords do not match',
      retype: 'Please re-enter password',
      rule: 'Password must be at least 8 characters with letters and numbers'
    },
    phone: 'Invalid phone format',
    timeFormat: 'Invalid time format',
    timeOrder: 'Start time must be before end time',
    selectService: 'Please select a service item',
    selectDate: 'Please select a date',
    selectSlot: 'Please select a time slot',
    selectResource: 'Please select a venue or equipment',
    completeFields: 'Please fill in all contact fields',
    completeTriplet: 'Please fill in all three fields',
    nameRequired: 'Please enter a name',
    nameRequiredMerchant: 'Please enter merchant name',
    slugRequired: 'Please enter slug',
    slugFormat: 'Only lowercase letters, digits and hyphens, 3-50 chars'
  },
  auth: {
    signIn: {
      titleMerchant: 'Merchant sign-in',
      titleAdmin: 'Platform admin sign-in',
      submit: 'Sign in',
      signUp: 'Sign up',
      forgot: 'Forgot password'
    },
    signUp: {
      title: 'Merchant sign-up',
      hint: 'Your application will be reviewed by a platform admin before you can sign in',
      submit: 'Submit application',
      backToSignIn: 'Already have an account? Sign in'
    },
    forgot: {
      title: 'Forgot password',
      hint: 'Enter your email. If the account exists we will send a reset link',
      submit: 'Submit'
    },
    notice: {
      pendingReview: 'Your merchant application has been submitted and is pending admin review',
      forgotSent: 'If the account exists, you will receive a password reset email shortly'
    },
    errors: {
      invalidCredentials: 'Invalid email or password',
      accountPending: 'Account pending admin review',
      accountSuspended: 'Merchant is suspended',
      accountRejected: 'Sign-up application was rejected',
      emailExists: 'Email is already registered',
      rateLimited: 'Too many requests, please try later',
      passwordRule: 'Password must be at least 8 characters with letters and numbers',
      passwordMismatch: 'Passwords do not match'
    }
  },
  admin: {
    dialog: {
      adminEditCreate: 'Add Administrator',
      adminEditEdit: 'Edit Administrator',
      staffEditCreate: 'Add Member Account',
      staffEditEdit: 'Edit Member Account',
      serviceEditCreate: 'Add Item',
      serviceEditEdit: 'Edit Item',
      resourceEditCreate: 'Add Venue/Equipment',
      resourceEditEdit: 'Edit Venue/Equipment',
      providerEditCreate: 'Add {label}',
      providerEditEdit: 'Edit {label}',
      providerDeleteConfirm: 'Deactivate this {label}? This action is recoverable (soft delete).',
      providerModeWizardTitle: 'Enable {label} Mode',
      providerModeWizardBody: 'Once enabled, customers will choose a {label} first when booking. We recommend creating at least one.',
      providerModeWizardCreate: 'Create First {label}',
      providerCreatedTitle: '{label} Created',
      providerCreatedBody: 'Now go to the Schedule page and set up the {label}\'s working hours.',
      providerCreatedGoSchedule: 'Go to Schedule',
      requiresProviderToggleTitle: 'Change "Requires {label}" Setting',
      requiresProviderToggleBody: 'This will only affect future bookings; existing bookings won\'t be backfilled. Confirm?',
      appointmentCreateTitle: 'Book on Behalf',
      holidayCreateTitle: 'Add Holiday',
      holidayEditTitle: 'Edit Holiday',
      scheduleRuleTitle: 'Schedule Rule',
      scheduleOverrideTitle: 'Schedule Override',
      merchantApproveTitle: 'Approve Merchant',
      merchantRejectTitle: 'Reject Application',
      merchantApproveConfirm: 'Confirm Approve',
      merchantRejectConfirm: 'Confirm Reject',
      pwdNew: 'New password (leave blank to keep)',
      pwdField: 'Password',
      pwdHintNew: 'At least 8 chars with letters and digits',
      pwdHintKeep: 'Leave blank to keep current',
      createSuccess: 'Created',
      updateSuccess: 'Updated',
      approveSuccess: 'Approved',
      rejectSuccess: 'Rejected',
      saveOverrideSuccess: 'Override saved',
      addHolidaySuccess: 'Holiday added'
    },
    nav: {
      home: 'Home',
      settings: 'Merchant Settings',
      shareLink: 'Share Link',
      services: 'Service Item Management',
      resources: 'Venue & Equipment Management',
      providers: '{label} Management',
      appointments: 'Appointments',
      queue: 'Queue Console',
      schedule: 'Scheduling',
      staff: 'Member Account Management',
      sectionOperate: 'Operations',
      sectionSchedule: 'Scheduling',
      sectionSettings: 'Settings',
      // @deprecated merged into Scheduling
      holidays: 'Closed Days'
    },
    actions: {
      create: 'Create',
      edit: 'Edit',
      delete: 'Delete',
      save: 'Save',
      cancel: 'Cancel',
      confirm: 'Confirm'
    },
    bookingMode: {
      TIME_SLOT: 'Fixed slot',
      TIME_CAPACITY: 'Slot + capacity',
      RESOURCE: 'Venue or Equipment Required',
      RESOURCE_OPTIONAL: 'Venue or Equipment Optional',
      QUEUE: 'Queue ticket',
      helperResource: 'Customers must pick a specific venue or equipment when booking',
      helperResourceOptional: 'Customers may choose "Any" for auto-assignment, or pick a specific one'
    },
    settings: {
      title: 'Merchant Settings',
      basic: 'Basic Info',
      appearance: 'Appearance',
      cancelPolicy: 'Cancellation Policy',
      uploadLogo: 'Upload logo',
      uploadCover: 'Upload cover image',
      policyFree: 'Customers can cancel anytime',
      policyCutoff: 'Cannot cancel within N hours of appointment',
      cutoffHours: 'N hours',
      providerMode: {
        title: 'Provider Mode',
        enabledLabel: 'Enable Provider Mode',
        enabledHint: 'Once enabled, customers may pick a service provider (doctor / therapist / coach) when booking. Disabled by default for existing merchants — behavior unchanged.',
        labelTitle: 'Custom Label',
        labelHint: 'Label shown to customers. Leave blank to use the defaults ("服務人員 / Provider / スタッフ").',
        labelZh: 'Chinese label',
        labelEn: 'English label',
        labelJa: 'Japanese label',
        labelPlaceholderZh: 'e.g. 醫師, 技師, 老師',
        labelPlaceholderEn: 'e.g. Doctor, Therapist, Coach',
        labelPlaceholderJa: 'e.g. 医師, セラピスト, コーチ'
      }
    },
    services: {
      listTitle: 'Service Items',
      subtitle: 'Manage bookable service items, modes and durations',
      newButton: '+ Add Item',
      nameLabel: 'Item name',
      bookingModeLabel: 'Booking mode',
      durationLabel: 'Duration (minutes)',
      intervalLabel: 'Slot interval (minutes)',
      capacityLabel: 'Capacity per slot',
      priceLabel: 'Price (cents)',
      resourcesLabel: 'Bound venues/equipment',
      columns: {
        mode: 'Mode',
        durationInterval: 'Duration / Interval',
        capacity: 'Capacity',
        resources: 'Venue/Equipment'
      },
      avgServiceMinutes: {
        label: 'Average service time (minutes)',
        placeholder: 'Leave empty to use Duration',
        help: 'Average per-customer service time used to estimate queue wait time'
      }
    },
    resources: {
      listTitle: 'Venues or Equipment',
      subtitle: 'Manage technicians, seats, equipment and other allocatable venues/equipment',
      newButton: '+ Add Venue/Equipment',
      nameLabel: 'Name',
      boundServices: 'Bound Service Items',
      boundServicesEmpty: '— Not bound',
      boundServicesHint: 'Edit a service item and check this venue/equipment so customers can select it.',
      columns: {
        description: 'Description',
        displayOrder: 'Display order'
      }
    },
    schedule: {
      title: 'Scheduling',
      subtitle: 'Manage weekly hours, single-day overrides, closed days and queue hours',
      scopeMerchant: 'Whole shop',
      scopeResource: 'Venue/Equipment',
      scopeProvider: '{label}',
      providerScopeResourceLabel: 'Preferred room (optional)',
      providerScopeResourceHint: 'Optionally pin which room/seat the {label} uses for this rule; leave blank to schedule the person only.',
      addSlot: '+ Add slot',
      // @deprecated renamed to "Single-day Override"
      overrides: 'Single-day Override',
      singleDayOverrides: 'Single-day Override',
      addOverride: '+ Add override',
      closed: 'Closed',
      tab: {
        weekly: '📅 Booking Hours',
        overrides: '🔧 Single-day Override',
        holidays: '🚫 Closed Days',
        queueWindow: '🎟 On-site Queue Hours'
      },
      hint: {
        weekly: 'Set the fixed weekly business hours. For one-off changes on a specific date, switch to the "🔧 Single-day Override" tab.',
        overrides: 'Configure a date whose hours differ from the weekly pattern (per shop or per venue/equipment). For a full shop-wide closure, use the "🚫 Closed Days" tab.',
        holidays: 'Shop-wide closed days — the holiday name shows on the customer booking page. For partial-day changes or per venue/equipment leave, use "🔧 Single-day Override".',
        queueWindow: 'Per QUEUE service item, configure weekly ticket-issuing hours and daily caps.'
      },
      affects: 'Affects: {names}',
      affectsAll: 'Affects: all service items (shop-wide)',
      affectsNone: 'No matching service items yet',
      affectsMore: '+{n} more',
      affectsCount: 'Affects {n} service items',
      affectsExpand: 'View',
      unboundResource: {
        title: 'This venue/equipment is not bound to any service item. Customers (and merchant-proxy bookings) cannot select it.',
        action: 'Bind in Service Items →'
      },
      emptyNoService: 'No service items yet. Create one in the Service Items page first.',
      goCreateService: 'Go to Service Items →',
      weeklyTitle: 'Booking Hours',
      overridesTitle: 'Single-day Override',
      holidaysTitle: 'Closed Days',
      queueWindowTitle: 'On-site Queue Hours'
    },
    queueWindow: {
      title: 'Queue Hours',
      subtitle: 'Set weekly ticket-issuing hours and daily caps for each QUEUE service item',
      loading: 'Loading…',
      serviceLabel: 'Service Item',
      noQueueService: 'No QUEUE-mode service item yet. Create one first.',
      goCreateService: 'Go to Service Items →',
      saveSuccess: 'Queue window saved',
      maxTicketsHint: 'Cap 0 = unlimited',
      adminNoWindow: 'Queue window not configured — customers cannot take tickets',
      adminNoWindowAction: 'Configure →',
      applyWeekdays: 'Apply to weekdays',
      applyAllDays: 'Apply to all days',
      applyAllDaysConfirm: 'This will overwrite Saturday & Sunday. Continue?',
      needSourceRow: 'Enable a row first as source'
    },
    holidays: {
      listTitle: 'Closed Days',
      nameLabel: 'Name',
      dateLabel: 'Date',
      addHoliday: '+ Add Closed Day'
    },
    staff: {
      listTitle: 'Member Accounts',
      subtitle: 'Manage merchant staff and access',
      newButton: '+ Add Member Account',
      noPermission: 'This page is for OWNER only; current account is STAFF.',
      roleLabel: 'Role',
      roleOwner: 'Owner',
      roleStaff: 'Staff',
      toggleActive: 'Activate / Deactivate',
      cantToggleSelf: 'You cannot deactivate yourself',
      columns: {
        email: 'Email',
        status: 'Status'
      }
    },
    shareLink: {
      title: 'Share Link',
      subtitle: 'Share the link with customers or print the QR code for in-store display',
      hint: 'Share the link below with customers or print the QR code',
      hintWithColon: 'Share the link below with customers or print the QR code:',
      copy: 'Copy',
      copied: 'Copied',
      copyFailed: 'Failed to copy, please select manually',
      empty: 'Slug not configured yet',
      goSettings: 'Go to Merchant Settings',
      merchantNotConfigured: 'Slug not configured yet, please go to Merchant Settings'
    },
    errors: {
      slugTaken: 'Slug already taken',
      uploadFailed: 'Image upload failed',
      saveFailed: 'Save failed'
    },
    queue: {
      tabs: {
        waiting: 'Waiting',
        called: 'Serving',
        history: 'History',
        countSuffix: ' ({n})'
      },
      search: {
        placeholder: 'Search by number or last 4 of phone',
        empty: 'No matching tickets',
        clear: 'Clear search'
      },
      serving: {
        empty: 'No tickets are being served'
      },
      conn: {
        live: 'Live',
        off: 'Disconnected'
      },
      operatingRoom: {
        label: 'Operating'
      }
    }
  },
  sys: {
    welcome: 'Welcome, {name}',
    welcomeFallback: 'Administrator',
    statusLabel: {
      PENDING: 'Pending',
      ACTIVE: 'Active',
      SUSPENDED: 'Suspended',
      REJECTED: 'Rejected'
    },
    merchantSuspendTitle: 'Suspend Merchant',
    merchantActivateTitle: 'Activate Merchant',
    merchantSuspendConfirm: 'Are you sure you want to suspend "{name}"?',
    merchantActivateConfirm: 'Are you sure you want to activate "{name}"?',
    merchantSuspendSuccess: 'Suspended',
    merchantActivateSuccess: 'Activated',
    adminToggleConfirm: 'Are you sure you want to {action} "{name}"?',
    adminToggleTitle: '{action} Administrator',
    adminCantToggleSelf: 'You cannot deactivate yourself',
    tabs: {
      all: 'All',
      pending: 'Pending',
      active: 'Active',
      suspended: 'Suspended',
      rejected: 'Rejected'
    },
    actions: {
      approve: 'Approve',
      reject: 'Reject',
      suspend: 'Suspend',
      activate: 'Activate',
      impersonate: 'Enter merchant console',
      exitImpersonation: 'Exit impersonation'
    },
    notice: {
      impersonationActive: 'Platform admin is impersonating',
      suspendConfirm: 'Are you sure you want to suspend this merchant?',
      activateConfirm: 'Are you sure you want to activate this merchant?',
      cantToggleSelf: 'Cannot deactivate yourself'
    }
  },
  booking: {
    nav: {
      myBookings: 'My Bookings',
      lookup: 'Lookup',
      bookNow: 'Book Now'
    },
    steps: {
      service: 'Service Item',
      provider: '{label}',
      resource: 'Venue/Equipment',
      datetime: 'Date & Time',
      // @deprecated superseded by datetime
      date: 'Date',
      // @deprecated superseded by datetime
      slot: 'Slot',
      info: 'Info',
      confirm: 'Confirm'
    },
    customer: {
      titleMr: 'Mr.',
      titleMrs: 'Mrs.',
      titleMiss: 'Miss',
      titleMx: 'Mx.',
      lastName: 'Last name',
      lastNamePlaceholder: 'e.g. Smith',
      titleField: 'Title',
      phone: 'Phone',
      phonePlaceholder: '0912345678',
      note: 'Note',
      noteOptional: 'Note (optional)'
    },
    panel: {
      pickService: 'Select a service item',
      pickProvider: 'Select a {label}',
      pickResource: 'Select a venue or equipment',
      pickDateTime: 'Select date & time'
    },
    resource: {
      anyLabel: 'Any available (auto-assign)',
      anyDescription: 'The system will pick an available venue/equipment for you'
    },
    provider: {
      cardTitleFallback: 'This {label}',
      bioEmpty: 'No introduction yet',
      unavailable: 'This {label} has no bookable slots',
      pickHint: 'Tap the {label} you\'d like to be served by'
    },
    fields: {
      date: 'Date',
      resource: 'Venue/Equipment',
      note: 'Note',
      service: 'Service Item',
      time: 'Time',
      customer: 'Customer'
    },
    validation: {
      lastNameRequired: 'Please enter last name',
      lastNameMaxLength: 'Last name must be within 20 characters',
      titleRequired: 'Please select a title',
      phoneRequired: 'Please enter phone number',
      phoneFormat: 'Invalid phone number format'
    },
    placeholders: {
      pickTitle: 'Select title',
      phoneExample: 'e.g. 0912345678',
      lastNameExample: 'e.g. Smith'
    },
    submitFailed: 'Booking failed, please try again',
    status: {
      CONFIRMED: 'Confirmed',
      CANCELED: 'Canceled',
      NO_SHOW: 'No show',
      COMPLETED: 'Completed'
    },
    canceledBy: {
      CUSTOMER: 'Canceled by customer',
      MERCHANT: 'Canceled by merchant',
      SYSTEM: 'Canceled by system'
    },
    actions: {
      cancel: 'Cancel booking',
      confirmBooking: 'Confirm',
      reviseBooking: 'Back to edit',
      success: 'Booked',
      lookup: 'Search',
      switchIdentity: 'Switch identity',
      switchLocale: 'Switch language',
      goCalendar: 'Calendar',
      goArchive: 'History',
      delegate: 'Book on behalf'
    },
    slotPicker: {
      morning: 'Morning',
      afternoon: 'Afternoon',
      evening: 'Evening',
      full: 'Full',
      remaining: '{n} left',
      loading: 'Loading slots…',
      empty: 'No available slots for this date'
    },
    messages: {
      bookSuccess: 'Booking confirmed',
      cancelSuccess: 'Booking canceled',
      slotTaken: 'This time slot has been taken',
      cancelTooLate: 'Cancellation deadline passed, please contact merchant',
      notFound: 'Appointment not found',
      emptyList: 'No bookings yet',
      noSlot: 'No available slots for this date',
      limitExceeded: 'You have reached the booking limit at this merchant, please cancel an existing booking and try again',
      limitExceededTitle: 'Booking limit reached',
      limitExceededHint: 'You may cancel unnecessary bookings in "My Bookings"',
      goMyBookings: 'Go to My Bookings',
      providerRequired: 'Please select a {label}',
      providerNotForService: 'This {label} does not offer this service item',
      providerInactive: 'This {label} is no longer active',
      providerTaken: 'This {label} is already booked at this time'
    },
    queryTitle: 'Lookup Booking',
    querySubmit: 'Search',
    queryHint: 'Enter the three details below to look up your booking records',
    fillContactTitle: 'Contact Details',
    calendar: {
      prev: 'Prev',
      next: 'Next',
      day: 'day',
      week: 'week',
      prevMonth: 'Previous month',
      nextMonth: 'Next month',
      today: 'Today'
    }
  },
  enum: {
    apiStatus: {
      200: 'Success',
      400: 'Failed',
      401: 'Unauthorized',
      403: 'Forbidden',
      404: 'Not Found',
      500: 'Server Error'
    }
  },
  display: {
    calling: 'Now Serving',
    noNumber: 'Not started',
    next: 'Next',
    nextAfter: 'After next',
    waiting: 'Waiting',
    waitingPeople: '{count} people',
    estimate: 'Estimated wait',
    minutes: '{n} min',
    minutesShort: '< 1 min',
    noService: 'No queue service item available',
    allDone: 'All tickets served for today',
    pickService: 'Select a service item',
    openDisplay: 'Open display screen',
    copyLink: 'Copy link',
    linkCopied: 'Display link copied',
    linkCopyFailed: 'Unable to copy automatically, please copy manually:',
    needQueueService: 'Create a QUEUE service item first',
    gotoRoom: 'Please proceed to {room}',
    tts: {
      toggle: 'Voice call-out',
      on: 'Voice call-out: ON',
      off: 'Voice call-out: OFF',
      unsupported: 'Voice call-out is not supported in this browser',
      callPhraseSimple: 'Number {number}, please come up.',
      callPhraseWithCustomer: 'Number {number}, {customerName}, please come up.',
      callPhraseWithRoom: 'Number {number}, please proceed to {room}.'
    }
  },
  queue: {
    page: {
      landingEyebrow: 'Queue ticket service',
      landingTitle: 'Take a ticket',
      landingHint: 'Pick a service item below and submit your contact details to receive today’s queue ticket.',
      statusYourNumber: 'Your number',
      statusServing: 'Now serving',
      statusLastIssued: 'Last issued',
      statusCalledHint: 'Please come up — it’s your turn!',
      statusDoneHint: 'Service completed. Thank you for visiting!',
      statusSkippedHint: 'Marked as skipped. Please check with the counter.',
      statusAheadHint: '{n} people ahead of you',
      adminTitle: 'Queue dashboard',
      adminEmpty: 'No queue service item configured',
      adminEmptyHint: 'Go to Service Items and add an item with bookingMode=QUEUE plus weekly queue windows.',
      callNext: 'Call next',
      markDone: 'Done',
      markSkip: 'Skip',
      take: 'Take ticket',
      formTitle: 'Contact details for ticket',
      formSubmit: 'Take ticket',
      connLive: 'Live updates on',
      connFallback: 'Live link unstable - still auto-updating',
      connReconnecting: 'Disconnected, retrying in {n}s',
      connOffline: 'This device is offline',
      connRetry: 'Retry now',
      currentServing: 'Now serving',
      waitingCount: '{n} waiting',
      notServing: 'No active call',
      notStarted: 'Service has not started',
      recentTitle: 'You already have ticket #{n} today',
      recentSubtitle: 'Last taken on this device',
      recentReturn: 'Back to waiting page',
      recentDismiss: 'Not me',
      findEntry: 'Find my ticket',
      findTitle: 'Find my ticket',
      findHint: 'Pick a service item and enter the last 4 digits of your phone number to recover today’s ticket.',
      findServiceLabel: 'Service Item',
      findServicePlaceholder: 'Select a service item',
      findPhoneLabel: 'Last 4 digits of phone',
      findPhonePlaceholder: 'e.g. 1234',
      findSubmit: 'Find my ticket',
      findAmbiguous: 'More than one match. Please use the full phone or contact the merchant.',
      findNotFound: 'No ticket found today',
      findInvalid: 'Please enter a 4-digit number',
      callOverlayTitle: 'It’s your turn',
      callOverlaySubtitle: 'Please come to the counter',
      callOverlayDismiss: 'Got it',
      titleCalled: '🔔 Your turn - {serviceName} - #{n}',
      titleWaiting: 'Waiting - {serviceName}',
      progressStart: 'Start',
      progressYou: 'You',
      progressEnd: 'End',
      progressAhead: '{n} ahead of you',
      progressNotStarted: 'Not started yet',
      progressPassed: 'Your number has passed. Please contact staff or take a new ticket.',
      doneTitle: 'Service completed. Thank you!',
      doneSubtitle: 'See you next time',
      doneCtaHome: 'Back home',
      doneCtaRetake: 'Take new ticket',
      skippedTitle: 'Your number was skipped',
      skippedSubtitle: 'Please contact staff or take a new ticket if you still need service',
      skippedCtaContact: 'Contact merchant',
      ticketWithRoom: '{room} #{number}',
      statusCalledHintWithRoom: 'Please proceed to {room} — it is your turn!'
    },
    take: {
      selectRoomLabel: 'Choose room / counter',
      selectRoomHint: 'Current wait at each room helps you decide',
      roomStat: 'Now serving #{current} · {waiting} waiting'
    },
    walkIn: {
      title: 'Walk-in registration',
      hint: 'Create a queue ticket on behalf of an on-site walk-in customer. Allowed outside the queue window.',
      fields: {
        lastName: 'Last name',
        lastNamePlaceholder: 'e.g. Wang',
        title: 'Title',
        phone: 'Phone (optional)',
        phonePlaceholder: 'e.g. 0912345678 (optional)',
        phoneHint: 'Without a phone number, the customer cannot self-recover the ticket by last-4 digits. Hand off the number in person.'
      },
      actions: {
        submit: 'Issue ticket',
        cancel: 'Cancel',
        print: 'Print ticket',
        close: 'Close'
      },
      success: 'Ticket #{ticketNumber} issued',
      printTicket: {
        merchantLabel: 'Merchant',
        serviceLabel: 'Service Item',
        numberLabel: 'Number',
        timeLabel: 'Issued at'
      }
    },
    status: {
      WAITING: 'Waiting',
      CALLED: 'Now serving',
      DONE: 'Done',
      SKIPPED: 'Skipped',
      CANCELED: 'Canceled'
    },
    eta: {
      aheadOfYou: '{n} people ahead of you',
      estimateMinutes: 'About {n} min more',
      almostYourTurn: 'You are next',
      unknown: 'Estimate not available',
      aboutMinutesLater: 'In ~{n} min'
    },
    claim: {
      title: 'Track your ticket on your phone',
      qrHint: 'Scan the QR code below to track your queue progress on your own phone — feel free to grab a bite or run errands.',
      shortCode: 'Short code',
      shortCodeHint: 'If the QR scan fails, type this 8-character code at the URL below.',
      todayOnly: 'Valid today only — expires when the queue closes.',
      printSlip: 'Scan the QR on the back of your slip to track on your phone.',
      scanToTrack: 'Scan to track your number on your phone',
      tokenExpired: 'Ticket expired or not found. Please use the last 4 digits of your phone instead.',
      fallbackToPhoneLookup: 'Use phone last 4 digits',
      gotIt: 'Got it',
      qrFallbackLabel: 'Open this URL with the short code below',
      copyLink: 'Copy link'
    },
    messages: {
      takeSuccess: 'Ticket issued',
      windowClosed: 'Queue is not open right now',
      notQueueService: 'Service item is not in queue mode',
      alreadyTaken: 'You already have a ticket today',
      queueFull: 'All tickets issued for today',
      noWaiting: 'No waiting tickets',
      invalidTransition: 'Invalid ticket state transition',
      ticketNotFound: 'Ticket not found',
      findAmbiguous: 'More than one match. Please visit the counter with your phone for verification.',
      findNotFound: 'No ticket found today',
      findInvalid: 'Please enter a 4-digit number'
    },
    checkIn: {
      title: 'Check-in',
      empty: 'No customers waiting for check-in',
      assignedRoom: 'Assigned room',
      confirm: 'Confirm check-in',
      confirmed: 'Checked in',
      reassigned: 'Reassigned {from} → {to}',
      unassignedProvider: 'No provider assigned',
      assignFailed: 'Reassignment failed, please retry'
    }
  },
  slot: {
    reason: {
      past: 'Past',
      taken: 'Booked',
      capacity: 'Full',
      closed: 'Closed',
      holiday: 'Holiday',
      inactive: 'Inactive'
    },
    reasonTooltip: {
      past: 'This time slot has passed and is no longer available',
      taken: 'This slot is already booked by another customer',
      capacity: 'This slot is fully booked',
      closed: 'This time period is a break',
      holiday: 'This day is a holiday',
      inactive: 'This venue/equipment is currently inactive'
    },
    prefillNotice: 'You selected {time}. Please continue filling in customer information.',
    prefillUnavailable: 'The slot you selected ({time}) is unavailable ({reason}). Please choose another time.'
  },
  appointment: {
    status: {
      CONFIRMED: 'Confirmed',
      CANCELED: 'Canceled',
      COMPLETED: 'Completed',
      NO_SHOW: 'No-show'
    },
    fields: {
      provider: '{label}',
      providerUnspecified: 'Unspecified',
      providerInactiveSuffix: ' (inactive)'
    },
    customerTitle: {
      MR: 'Mr.',
      MRS: 'Mrs.',
      MISS: 'Miss',
      MX: 'Mx.'
    },
    list: {
      showArchived: 'Show closed',
      showArchivedHint: 'Also show canceled / completed / no-show records (up to 90 days back)'
    },
    tooltip: {
      list: 'Active appointments (toggle "Show closed" to view canceled / completed / no-show)',
      archive: 'Archived records older than 90 days'
    },
    actions: {
      backToMain: '← Back to Appointments',
      more: 'More',
      detail: 'Detail',
      cancel: 'Cancel',
      complete: 'Mark completed',
      noShow: 'Mark no-show',
      reschedule: 'Reschedule'
    },
    confirm: {
      complete: 'Mark this appointment as completed?',
      noShow: 'Mark this appointment as no-show?'
    },
    reschedule: {
      title: 'Reschedule',
      origin: 'Original',
      success: 'Appointment updated',
      loadingSlots: 'Loading slots…',
      forceHint: 'Past-slot override enabled: allows selecting past time and skips venue/equipment on-duty check; double-booking conflict is still enforced to prevent operational incidents.',
      forcePromptOnPastSlot: 'Slot is in the past — please enable "Past-slot override" before submitting',
      fields: {
        date: 'New date',
        time: 'New time',
        timePlaceholder: 'HH:mm',
        timeRequired: 'Please select a time',
        resource: 'New venue/equipment',
        resourceAny: 'Any (auto assigned)',
        resourceRequired: 'Please select a venue or equipment',
        force: 'Past-slot override'
      },
      actions: {
        confirm: 'Confirm',
        cancel: 'Cancel'
      }
    }
  },
  service: {
    durationLabel: '{n} min',
    edit: {
      queueResourcesLabel: 'Callable rooms / counters / staff (optional)',
      queueResourcesHint: 'Each bound venue/equipment keeps its own queue; leave empty to keep a single queue.',
      requiresProviderLabel: 'Requires {label}',
      requiresProviderHint: 'When enabled, customers must pick a {label} when booking this service item; bind at least one first.',
      providersLabel: 'Available {label}s',
      providersHint: 'Pick which {label}s offer this service item; customers will choose from this list.',
      providersEmptyError: 'Pick at least one {label} when "Requires {label}" is enabled.'
    }
  },
  provider: {
    listTitle: '{label} Management',
    addButton: '+ Add {label}',
    fields: {
      avatar: 'Avatar',
      name: 'Name',
      title: 'Title',
      bio: 'Bio',
      displayOrder: 'Order',
      isActive: 'Active',
      boundServices: 'Service Items Offered',
      boundServicesEmpty: '— Not bound to any service item'
    },
    placeholders: {
      name: 'e.g. Dr. Smith, Lisa',
      title: 'e.g. Attending physician, Senior therapist',
      bio: 'Short bio (multi-line allowed)'
    },
    actions: {
      edit: 'Edit',
      delete: 'Deactivate'
    },
    bannerNotEnabled: 'Provider mode is not enabled. Enable it in Merchant Settings — this page only appears in the sidebar once enabled.',
    bannerGoSettings: 'Go to Merchant Settings',
    empty: 'No {label} yet'
  }
};
