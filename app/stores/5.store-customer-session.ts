// 顧客 session（匿名身分）
// 用 UseEncryptStorage 把三元組與曾預約過的商家 slug 持久化在 localStorage（加密）
// 規範：只在 client 用；server 端讀到 defaultValue 即可（不影響 SSR）

export type CustomerTitle = 'MR' | 'MRS' | 'MISS' | 'MX';

export interface CustomerTripletShape {
  lastName: string;
  title: CustomerTitle;
  phone: string;
}

interface CustomerSessionState {
  /** 上次填的三元組（下次預約預填、my-bookings 自動查） */
  triplet: CustomerTripletShape | null;
  /** 用過的商家 slug（用於 my-bookings 跨商家彙整） */
  recentSlugs: string[];
}

const DEFAULT: CustomerSessionState = {
  triplet: null,
  recentSlugs: []
};

export const StoreCustomerSession = defineStore('StoreCustomerSession', () => {
  const state = UseEncryptStorage<CustomerSessionState>('cs_t', DEFAULT);

  const triplet = computed(() => state.value.triplet);
  const recentSlugs = computed(() => state.value.recentSlugs);
  const hasTriplet = computed(() => state.value.triplet !== null);

  /** 寫入三元組（會去 phone 空白與 dash） */
  const SetTriplet = (t: CustomerTripletShape) => {
    state.value = {
      ...state.value,
      triplet: {
        lastName: t.lastName.trim(),
        title: t.title,
        phone: t.phone.replace(/[\s-]/g, '')
      }
    };
  };

  /** 清除三元組 */
  const ClearTriplet = () => {
    state.value = { ...state.value, triplet: null };
  };

  /** 紀錄造訪過的 slug（最多保留 50 個，最新在前） */
  const AddSlug = (slug: string) => {
    const existing = state.value.recentSlugs.filter((s) => s !== slug);
    state.value = {
      ...state.value,
      recentSlugs: [slug, ...existing].slice(0, 50)
    };
  };

  /** 清除所有 slug */
  const ClearSlugs = () => {
    state.value = { ...state.value, recentSlugs: [] };
  };

  /** 完整清除 */
  const Reset = () => {
    state.value = { ...DEFAULT };
  };

  return {
    triplet,
    recentSlugs,
    hasTriplet,
    SetTriplet,
    ClearTriplet,
    AddSlug,
    ClearSlugs,
    Reset
  };
});
