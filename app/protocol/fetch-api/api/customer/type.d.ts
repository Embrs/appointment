// 顧客多商家彙整查詢 type

interface CustomerLookupParams {
  lastName: string;
  title: CustomerTitleType;
  phone: string;
  slugs: string[];
}

interface CustomerLookupGroup {
  merchant: {
    slug: string;
    name: string;
    timezone: string;
    logoUrl: string | null;
    cancelPolicy: { mode: 'free' | 'cutoff'; hoursBeforeCannotCancel?: number };
  };
  appointments: LookupAppointmentItem[];
}

interface CustomerLookupRes {
  groups: CustomerLookupGroup[];
}
