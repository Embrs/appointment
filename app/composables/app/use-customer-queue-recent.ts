// 客端號碼牌「最近領取的票」紀錄（localStorage）
// 用途：顧客領完號離開後，重新進入 /m/[slug]/queue 時自動還原；解析失敗時自我修復
export interface CustomerQueueRecentEntry {
  slug: string;
  merchantId: string;
  ticketId: string;
  ticketNumber: number;
  /** YYYY-MM-DD（merchant timezone） */
  ticketDate: string;
  serviceId: string;
  serviceName: string;
  /** 只存末 4 碼，不存完整手機 */
  phoneLast4: string;
  /** Date.now() 寫入時間戳，方便排序 */
  takenAt: number;
}

const MAX_ENTRIES = 20;

/** 用客戶端日期（YYYY-MM-DD）作為「今日」基準；merchant timezone 的精確比對由後端把關 */
const TodayClient = (): string => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const UseCustomerQueueRecent = () => {
  const state = UseEncryptStorage<CustomerQueueRecentEntry[]>('customerQueueRecent', []);

  const PruneExpired = () => {
    const today = TodayClient();
    const next = (state.value ?? []).filter((e) => e && e.ticketDate === today);
    if (next.length !== (state.value ?? []).length) {
      state.value = next;
    }
  };

  const ReadAll = (): CustomerQueueRecentEntry[] => {
    try {
      PruneExpired();
      return state.value ?? [];
    } catch {
      state.value = [];
      return [];
    }
  };

  const ReadBySlug = (slug: string): CustomerQueueRecentEntry[] => {
    return ReadAll().filter((e) => e.slug === slug);
  };

  const Append = (entry: CustomerQueueRecentEntry) => {
    try {
      const current = ReadAll().filter((e) => e.ticketId !== entry.ticketId);
      // 新的在前；上限 MAX_ENTRIES
      state.value = [entry, ...current].slice(0, MAX_ENTRIES);
    } catch {
      state.value = [entry];
    }
  };

  const RemoveByTicketId = (ticketId: string) => {
    try {
      state.value = ReadAll().filter((e) => e.ticketId !== ticketId);
    } catch {
      state.value = [];
    }
  };

  const Clear = () => {
    state.value = [];
  };

  return {
    ReadAll,
    ReadBySlug,
    Append,
    RemoveByTicketId,
    PruneExpired,
    Clear
  };
};
