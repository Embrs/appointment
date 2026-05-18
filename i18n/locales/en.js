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
      schedule: 'Schedule',
      holidays: 'Holidays',
      staff: 'Staff'
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
      resourcesLabel: 'Bound resources'
    },
    resources: {
      listTitle: 'Resources',
      nameLabel: 'Resource name'
    },
    schedule: {
      title: 'Schedule',
      scopeMerchant: 'Whole shop',
      scopeResource: 'Resource',
      addSlot: '+ Add slot',
      overrides: 'Date overrides',
      addOverride: '+ Add override',
      closed: 'Closed'
    },
    holidays: {
      listTitle: 'Holidays',
      nameLabel: 'Name',
      dateLabel: 'Date'
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
      date: 'Date',
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
      titleField: 'Title',
      phone: 'Phone',
      note: 'Note'
    },
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
      success: 'Booked',
      lookup: 'Search',
      switchIdentity: 'Switch identity',
      switchLocale: 'Switch language',
      goCalendar: 'Calendar',
      goArchive: 'History',
      delegate: 'Book on behalf'
    },
    messages: {
      bookSuccess: 'Booking confirmed',
      cancelSuccess: 'Booking canceled',
      slotTaken: 'This time slot has been taken',
      cancelTooLate: 'Cancellation deadline passed, please contact merchant',
      notFound: 'Appointment not found',
      emptyList: 'No bookings yet',
      noSlot: 'No available slots for this date'
    },
    queryTitle: 'Lookup Booking',
    querySubmit: 'Search',
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
  queue: {
    page: {
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
      connLive: 'Live connection',
      connFallback: 'Fallback polling (15s)'
    },
    status: {
      WAITING: 'Waiting',
      CALLED: 'Now serving',
      DONE: 'Done',
      SKIPPED: 'Skipped',
      CANCELED: 'Canceled'
    },
    messages: {
      takeSuccess: 'Ticket issued',
      windowClosed: 'Queue is not open right now',
      notQueueService: 'Service is not in queue mode',
      alreadyTaken: 'You already have a ticket today',
      queueFull: 'All tickets issued for today',
      noWaiting: 'No waiting tickets',
      invalidTransition: 'Invalid ticket state transition',
      ticketNotFound: 'Ticket not found'
    }
  }
};
