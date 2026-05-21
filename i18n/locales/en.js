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
    selectService: 'Please select a service',
    selectDate: 'Please select a date',
    selectSlot: 'Please select a time slot',
    selectResource: 'Please select a resource',
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
      staffEditCreate: 'Add Staff Member',
      staffEditEdit: 'Edit Staff Member',
      serviceEditCreate: 'Add Service',
      serviceEditEdit: 'Edit Service',
      resourceEditCreate: 'Add Resource',
      resourceEditEdit: 'Edit Resource',
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
      services: 'Services',
      resources: 'Resources',
      appointments: 'Appointments',
      queue: 'Queue Console',
      schedule: 'Scheduling',
      staff: 'Staff',
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
      RESOURCE: 'Per resource',
      RESOURCE_OPTIONAL: 'Optional resource',
      QUEUE: 'Queue ticket'
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
      cutoffHours: 'N hours'
    },
    services: {
      listTitle: 'Services',
      nameLabel: 'Service name',
      bookingModeLabel: 'Booking mode',
      durationLabel: 'Duration (minutes)',
      intervalLabel: 'Slot interval (minutes)',
      capacityLabel: 'Capacity per slot',
      priceLabel: 'Price (cents)',
      resourcesLabel: 'Bound resources',
      avgServiceMinutes: {
        label: 'Average service time (minutes)',
        placeholder: 'Leave empty to use Duration',
        help: 'Average per-customer service time used to estimate queue wait time'
      }
    },
    resources: {
      listTitle: 'Resources',
      nameLabel: 'Resource name',
      boundServices: 'Bound Services',
      boundServicesEmpty: '— Not bound',
      boundServicesHint: 'Edit a RESOURCE-mode service and check this resource so customers can select it.'
    },
    schedule: {
      title: 'Scheduling',
      subtitle: 'Manage weekly hours, single-day overrides, closed days and queue hours',
      scopeMerchant: 'Whole shop',
      scopeResource: 'Resource',
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
        overrides: 'Configure a date whose hours differ from the weekly pattern (per shop or per resource). For a full shop-wide closure, use the "🚫 Closed Days" tab.',
        holidays: 'Shop-wide closed days — the holiday name shows on the customer booking page. For partial-day changes or per-resource leave, use "🔧 Single-day Override".',
        queueWindow: 'Per QUEUE service, configure weekly ticket-issuing hours and daily caps.'
      },
      affects: 'Affects: {names}',
      affectsAll: 'Affects: all services (shop-wide)',
      affectsNone: 'No matching services yet',
      affectsMore: '+{n} more',
      affectsCount: 'Affects {n} services',
      affectsExpand: 'View',
      unboundResource: {
        title: 'This resource is not bound to any service. Customers (and merchant-proxy bookings) cannot select it.',
        action: 'Bind in Services →'
      },
      emptyNoService: 'No services yet. Create one in the Services page first.',
      goCreateService: 'Go to Services →',
      weeklyTitle: 'Booking Hours',
      overridesTitle: 'Single-day Override',
      holidaysTitle: 'Closed Days',
      queueWindowTitle: 'On-site Queue Hours'
    },
    queueWindow: {
      title: 'Queue Hours',
      subtitle: 'Set weekly ticket-issuing hours and daily caps for each QUEUE service',
      loading: 'Loading…',
      serviceLabel: 'Service',
      noQueueService: 'No QUEUE-mode service yet. Create one first.',
      goCreateService: 'Go to services →',
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
      listTitle: 'Staff',
      roleLabel: 'Role',
      roleOwner: 'Owner',
      roleStaff: 'Staff',
      toggleActive: 'Activate / Deactivate',
      cantToggleSelf: 'You cannot deactivate yourself'
    },
    shareLink: {
      title: 'Share Link',
      hint: 'Share the link below with customers or print the QR code',
      copy: 'Copy',
      copied: 'Copied',
      merchantNotConfigured: 'Slug not configured yet, please go to Merchant Settings'
    },
    errors: {
      slugTaken: 'Slug already taken',
      uploadFailed: 'Image upload failed',
      saveFailed: 'Save failed'
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
      service: 'Service',
      resource: 'Resource',
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
      pickService: 'Select a service',
      pickResource: 'Select a resource',
      pickDateTime: 'Select date & time'
    },
    resource: {
      anyLabel: 'Any available (auto-assign)',
      anyDescription: 'The system will pick an available resource for you'
    },
    fields: {
      date: 'Date',
      resource: 'Resource',
      note: 'Note',
      service: 'Service',
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
      goMyBookings: 'Go to My Bookings'
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
    noService: 'No queue service available',
    allDone: 'All tickets served for today',
    pickService: 'Select a service',
    openDisplay: 'Open display screen',
    copyLink: 'Copy link',
    linkCopied: 'Display link copied',
    linkCopyFailed: 'Unable to copy automatically, please copy manually:',
    needQueueService: 'Create a QUEUE service first',
    tts: {
      toggle: 'Voice call-out',
      on: 'Voice call-out: ON',
      off: 'Voice call-out: OFF',
      unsupported: 'Voice call-out is not supported in this browser',
      callPhrase: 'Number {number}, please proceed to {serviceName}.'
    }
  },
  queue: {
    page: {
      landingEyebrow: 'Queue ticket service',
      landingTitle: 'Take a ticket',
      landingHint: 'Pick a service below and submit your contact details to receive today’s queue ticket.',
      statusYourNumber: 'Your number',
      statusServing: 'Now serving',
      statusLastIssued: 'Last issued',
      statusCalledHint: 'Please come up — it’s your turn!',
      statusDoneHint: 'Service completed. Thank you for visiting!',
      statusSkippedHint: 'Marked as skipped. Please check with the counter.',
      statusAheadHint: '{n} people ahead of you',
      adminTitle: 'Queue dashboard',
      adminEmpty: 'No queue service configured',
      adminEmptyHint: 'Go to Services and add a service with bookingMode=QUEUE plus weekly queue windows.',
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
      findHint: 'Pick a service and enter the last 4 digits of your phone number to recover today’s ticket.',
      findServiceLabel: 'Service',
      findServicePlaceholder: 'Select a service',
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
      skippedCtaContact: 'Contact merchant'
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
        serviceLabel: 'Service',
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
      notQueueService: 'Service is not in queue mode',
      alreadyTaken: 'You already have a ticket today',
      queueFull: 'All tickets issued for today',
      noWaiting: 'No waiting tickets',
      invalidTransition: 'Invalid ticket state transition',
      ticketNotFound: 'Ticket not found',
      findAmbiguous: 'More than one match. Please visit the counter with your phone for verification.',
      findNotFound: 'No ticket found today',
      findInvalid: 'Please enter a 4-digit number'
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
      inactive: 'This resource is currently inactive'
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
      forceHint: 'Past-slot override enabled: allows selecting past time and skips resource on-duty check; double-booking conflict is still enforced to prevent operational incidents.',
      forcePromptOnPastSlot: 'Slot is in the past — please enable "Past-slot override" before submitting',
      fields: {
        date: 'New date',
        time: 'New time',
        timePlaceholder: 'HH:mm',
        timeRequired: 'Please select a time',
        resource: 'New resource',
        resourceAny: 'Any (auto assigned)',
        resourceRequired: 'Please select a resource',
        force: 'Past-slot override'
      },
      actions: {
        confirm: 'Confirm',
        cancel: 'Cancel'
      }
    }
  },
  service: {
    durationLabel: '{n} min'
  }
};
