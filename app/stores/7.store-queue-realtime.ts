// 號碼牌即時 store：WS 連線 + 15 秒輪詢兜底
// 規範：頁面 mounted 時呼叫 Connect(merchantId)；unmounted 時 Disconnect
// 雙軌制：WS 為主、HTTP polling 為 fallback；onmessage 直接 patch 本地 state
// 連線狀態四態：live / reconnecting / fallback / offline，state 切換 1.5s debounce（避免短瞬斷抖動）
import {
  estimateWaitMinutes,
  getTicketsAhead,
  type QueueTicketStatusForEta
} from '~shared/queue-eta';

export type QueueConnectionState = 'live' | 'reconnecting' | 'fallback' | 'offline';

/** 未綁 resource 的單號池在 resourceMap 內的 key */
export const RESOURCE_NULL_KEY = '__null__';

/** key=resourceId 或 RESOURCE_NULL_KEY */
export interface ResourceServingState {
  /** resource id；null 表 service 未綁 resource */
  resourceId: string | null;
  /** resource name；未綁時為 null */
  resourceName: string | null;
  currentServing: number;
  servingTicketId: string;
  servingCustomerLastName: string;
  servingCustomerTitle: string;
  avgServiceMinutes: number;
  /** 該 resource 當日累計 waitingCount（snapshot 灌入時帶；WS 不主動推） */
  waitingCount: number;
  /** 該 resource 當日累計 ticketsTaken */
  ticketsTaken: number;
  lastEventAt: number;
  /** 啟用 Provider 制商家：當下時段該 resource 排定的 Provider id；未啟用 / 未命中 / 多匹配為 null */
  providerId: string | null;
  /** 啟用 Provider 制商家：對應 Provider 顯示名稱；未啟用 / 未命中 / 多匹配為 null */
  providerName: string | null;
}

interface ServiceServingState {
  /** 服務 ID */
  serviceId: string;
  /** 服務中號碼（向後相容：最近事件 resource 的 currentServing 投影） */
  currentServing: number;
  /** 服務中票 id（CALL_NEXT 推播帶入；TICKET_DONE/SKIPPED 後清空） */
  servingTicketId: string;
  /** 服務中顧客姓氏（CALL_NEXT 推播帶入；TICKET_DONE/SKIPPED 後清空） */
  servingCustomerLastName: string;
  /** 服務中顧客稱謂 enum（'MR' | 'MRS' | 'MISS' | 'MX'）；空字串表無資料 */
  servingCustomerTitle: string;
  /** 該服務的 effective 平均服務時長（avgServiceMinutes ?? durationMinutes） */
  avgServiceMinutes: number;
  /** 最後一次推播時間 */
  lastEventAt: number;
  /** 按 resourceId 分群（未綁 resource 用 RESOURCE_NULL_KEY 為 key） */
  resourceMap: Record<string, ResourceServingState>;
  /** 最近事件對應的 resourceId（用於頂層 projection 來源追蹤） */
  lastEventResourceId: string | null;
  /** 頂層 Provider 投影（最近事件 resource 的 providerId / providerName） */
  providerId: string | null;
  providerName: string | null;
}

interface QueueBroadcastMessage {
  type: 'HELLO' | 'CALL_NEXT' | 'TICKET_DONE' | 'TICKET_SKIPPED' | 'TICKET_TAKEN';
  serviceId?: string;
  /** 多 resource 號池：本次事件對應的 resource；未綁時為 null */
  resourceId?: string | null;
  /** 對應 resource 名稱（供 store 灌入 resourceMap.resourceName） */
  resourceName?: string | null;
  current?: number;
  servingTicketId?: string;
  servingCustomerLastName?: string;
  servingCustomerTitle?: 'MR' | 'MRS' | 'MISS' | 'MX';
  ticketNumber?: number;
  /** 廣播當下服務的 effective 平均服務時長（給訂閱端校準 ETA） */
  avgServiceMinutes?: number;
  /** 廣播當下下一位 WAITING 票的預估等待分鐘（領號頁卡片用） */
  nextWaitMinutes?: number | null;
  /** 啟用 Provider 制商家：對應 resource 當下時段排定的 Provider id；未啟用 / 未命中 / 多匹配為 null */
  providerId?: string | null;
  /** 啟用 Provider 制商家：對應 Provider 顯示名稱；未啟用 / 未命中 / 多匹配為 null */
  providerName?: string | null;
  timestamp: number;
}

/** UseWS 內部 backoff 設定（與 use-ws.ts 對齊）；用來推估倒數初始值 */
const WS_INITIAL_BACKOFF_MS = 1000;
const WS_BACKOFF_FACTOR = 1.6;
const WS_MAX_BACKOFF_MS = 30000;
/** 連續重試到此次數視為 fallback */
const FALLBACK_RETRY_THRESHOLD = 3;
/** state 切換 debounce */
const STATE_DEBOUNCE_MS = 1500;

const CalcBackoffSeconds = (retry: number): number => {
  const exp = Math.min(retry, 10);
  const delayMs = Math.min(WS_INITIAL_BACKOFF_MS * Math.pow(WS_BACKOFF_FACTOR, exp), WS_MAX_BACKOFF_MS);
  return Math.max(1, Math.ceil(delayMs / 1000));
};

export const StoreQueueRealtime = defineStore('StoreQueueRealtime', () => {
  /** 各服務當前服務中狀態，key=serviceId */
  const serviceMap = ref<Record<string, ServiceServingState>>({});
  /** 自己手上的票 id（顧客等待頁用） */
  const myTicketId = ref<string>('');
  /** 自己票的完整資料（用於顯示 + 兜底輪詢比對） */
  const myTicket = ref<GetQueueTicketRes | null>(null);
  /** WS 是否連線（既有對外狀態，向下相容） */
  const isWsConnected = ref(false);
  /** 最後一次廣播時間 */
  const lastEventAt = ref(0);
  /** 連線狀態四態（經 debounce） */
  const connectionState = ref<QueueConnectionState>('offline');
  /** 重連倒數秒；非 reconnecting 時恆為 0 */
  const reconnectIn = ref(0);
  /** 裝置是否在線（navigator.onLine） */
  const isOnline = ref(true);

  /** 內部：WS handle */
  let wsHandle: ReturnType<typeof UseWS> | null = null;
  /** 內部：輪詢計時器 */
  let pollTimerId: ReturnType<typeof setInterval> | null = null;
  /** 當前訂閱中的 merchantId */
  let currentMerchantId = '';
  /** state debounce timer */
  let stateDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  /** 倒數 timer */
  let countdownTimerId: ReturnType<typeof setInterval> | null = null;
  /** WS retryCount watcher stop fn */
  let stopRetryWatch: (() => void) | null = null;
  /** online/offline listeners */
  let onlineHandler: (() => void) | null = null;
  let offlineHandler: (() => void) | null = null;

  // ====== 連線狀態計算與套用 ======
  const ComputeRawState = (): QueueConnectionState => {
    if (!isOnline.value) return 'offline';
    if (!wsHandle) return 'offline';
    if (wsHandle.isConnected.value) return 'live';
    if (wsHandle.retryCount.value >= FALLBACK_RETRY_THRESHOLD) return 'fallback';
    return 'reconnecting';
  };

  const StopCountdown = () => {
    if (countdownTimerId !== null) {
      clearInterval(countdownTimerId);
      countdownTimerId = null;
    }
    reconnectIn.value = 0;
  };

  const StartCountdown = () => {
    StopCountdown();
    const retry = wsHandle?.retryCount.value ?? 0;
    reconnectIn.value = CalcBackoffSeconds(retry);
    countdownTimerId = setInterval(() => {
      if (reconnectIn.value <= 1) {
        // 倒數結束：以新的 retryCount 重新估算下一次（UseWS 會自動排程重連）
        const next = wsHandle?.retryCount.value ?? 0;
        reconnectIn.value = CalcBackoffSeconds(next);
      } else {
        reconnectIn.value -= 1;
      }
    }, 1000);
  };

  const ApplyState = (next: QueueConnectionState) => {
    if (connectionState.value === next) return;
    connectionState.value = next;
    StopCountdown();
    if (next === 'reconnecting') StartCountdown();
  };

  const ScheduleApply = () => {
    const target = ComputeRawState();
    // live 切換立即生效（不抖動，回到綠燈越快越好）
    if (target === 'live') {
      if (stateDebounceTimer) {
        clearTimeout(stateDebounceTimer);
        stateDebounceTimer = null;
      }
      ApplyState('live');
      return;
    }
    // 其餘狀態 1.5s debounce，避免短瞬斷抖動
    if (stateDebounceTimer) clearTimeout(stateDebounceTimer);
    stateDebounceTimer = setTimeout(() => {
      stateDebounceTimer = null;
      ApplyState(ComputeRawState());
    }, STATE_DEBOUNCE_MS);
  };

  // ====== resourceMap 寫入 helper ======
  /** 取／建 service slot；缺則建立空殼 */
  const EnsureServiceSlot = (serviceId: string): ServiceServingState => {
    let svc = serviceMap.value[serviceId];
    if (!svc) {
      svc = {
        serviceId,
        currentServing: 0,
        servingTicketId: '',
        servingCustomerLastName: '',
        servingCustomerTitle: '',
        avgServiceMinutes: 0,
        lastEventAt: 0,
        resourceMap: {},
        lastEventResourceId: null,
        providerId: null,
        providerName: null
      };
      serviceMap.value[serviceId] = svc;
    } else if (!svc.resourceMap) {
      svc.resourceMap = {};
    }
    return svc;
  };

  /** 取／建 resource slot；缺則建立空殼 */
  const EnsureResourceSlot = (
    svc: ServiceServingState,
    resourceId: string | null,
    resourceName: string | null
  ): ResourceServingState => {
    const key = resourceId ?? RESOURCE_NULL_KEY;
    let r = svc.resourceMap[key];
    if (!r) {
      r = {
        resourceId,
        resourceName,
        currentServing: 0,
        servingTicketId: '',
        servingCustomerLastName: '',
        servingCustomerTitle: '',
        avgServiceMinutes: svc.avgServiceMinutes ?? 0,
        waitingCount: 0,
        ticketsTaken: 0,
        lastEventAt: 0,
        providerId: null,
        providerName: null
      };
      svc.resourceMap[key] = r;
    } else if (resourceName && !r.resourceName) {
      r.resourceName = resourceName;
    }
    return r;
  };

  /** 寫入單一 resource 的 partial state，並 project 至頂層作為「最近事件」 */
  const ApplyServiceResourceState = (input: {
    serviceId: string;
    resourceId: string | null;
    resourceName?: string | null;
    patch: Partial<ResourceServingState>;
    timestamp?: number;
  }) => {
    const svc = EnsureServiceSlot(input.serviceId);
    const r = EnsureResourceSlot(svc, input.resourceId, input.resourceName ?? null);
    Object.assign(r, input.patch);
    if (typeof input.timestamp === 'number') r.lastEventAt = input.timestamp;
    // 頂層 projection：以「本次事件」為準
    svc.currentServing = r.currentServing;
    svc.servingTicketId = r.servingTicketId;
    svc.servingCustomerLastName = r.servingCustomerLastName;
    svc.servingCustomerTitle = r.servingCustomerTitle;
    svc.avgServiceMinutes = r.avgServiceMinutes ?? svc.avgServiceMinutes;
    svc.lastEventAt = r.lastEventAt;
    svc.lastEventResourceId = input.resourceId;
    svc.providerId = r.providerId;
    svc.providerName = r.providerName;
  };

  /** 取 service 內某 resource 的 state；缺則 null */
  const GetResourceState = (
    serviceId: string,
    resourceId: string | null
  ): ResourceServingState | null => {
    const svc = serviceMap.value[serviceId];
    if (!svc) return null;
    return svc.resourceMap[resourceId ?? RESOURCE_NULL_KEY] ?? null;
  };

  /** 上層批次灌入（拿號頁 / display 從 GetPublicMerchant snapshot 取資料時呼叫） */
  const UpsertResourcesSnapshot = (input: {
    serviceId: string;
    avgServiceMinutes: number;
    resources: Array<{
      id: string | null;
      name: string | null;
      currentServing: number;
      ticketsTaken: number;
      waitingCount: number;
      avgServiceMinutes: number;
      provider?: { id: string; name: string } | null;
    }>;
  }) => {
    const svc = EnsureServiceSlot(input.serviceId);
    svc.avgServiceMinutes = input.avgServiceMinutes;
    // 不直接覆寫頂層 currentServing / serving*；保留 WS 事件帶來的最新值
    for (const r of input.resources) {
      const slot = EnsureResourceSlot(svc, r.id, r.name);
      // snapshot 只在「該 resource 尚無 currentServing」或當前推估值 <= snapshot 時補
      if (slot.currentServing === 0 && r.currentServing > 0) {
        slot.currentServing = r.currentServing;
      }
      slot.ticketsTaken = r.ticketsTaken;
      slot.waitingCount = r.waitingCount;
      slot.avgServiceMinutes = r.avgServiceMinutes || slot.avgServiceMinutes;
      slot.providerId = r.provider?.id ?? null;
      slot.providerName = r.provider?.name ?? null;
    }
    // 頂層 projection：若 lastEventResourceId 尚未設定，挑「有 waiting 且 currentServing 最小」者做初始 projection
    if (svc.lastEventResourceId === null && svc.lastEventAt === 0) {
      const all = Object.values(svc.resourceMap);
      const withWait = all.filter((x) => x.waitingCount > 0);
      const pool = withWait.length > 0 ? withWait : all;
      const pick = pool.sort((a, b) => a.currentServing - b.currentServing)[0];
      if (pick) {
        svc.currentServing = pick.currentServing;
        svc.servingTicketId = pick.servingTicketId;
        svc.servingCustomerLastName = pick.servingCustomerLastName;
        svc.servingCustomerTitle = pick.servingCustomerTitle;
        svc.avgServiceMinutes = pick.avgServiceMinutes || svc.avgServiceMinutes;
        svc.lastEventResourceId = pick.resourceId;
      }
    }
  };

  // ====== WS 訊息處理 ======
  const HandleMessage = (_ev: MessageEvent, parsed: unknown | null) => {
    if (!parsed || typeof parsed !== 'object') return;
    const msg = parsed as QueueBroadcastMessage;
    lastEventAt.value = msg.timestamp ?? Date.now();

    if (msg.type === 'HELLO') return;

    if (!msg.serviceId) return;

    const resourceId: string | null = msg.resourceId ?? null;
    const resourceName: string | null = msg.resourceName ?? null;
    const ts = msg.timestamp ?? Date.now();

    // 統一更新該 (service, resource) 的 avgServiceMinutes 與 Provider 投影
    const providerPatch: Pick<ResourceServingState, 'providerId' | 'providerName'> = {
      providerId: msg.providerId ?? null,
      providerName: msg.providerName ?? null
    };
    if (
      typeof msg.avgServiceMinutes === 'number' ||
      msg.providerId !== undefined ||
      msg.providerName !== undefined
    ) {
      ApplyServiceResourceState({
        serviceId: msg.serviceId,
        resourceId,
        resourceName,
        patch: {
          ...(typeof msg.avgServiceMinutes === 'number'
            ? { avgServiceMinutes: msg.avgServiceMinutes }
            : {}),
          ...providerPatch
        },
        timestamp: ts
      });
    }

    if (msg.type === 'CALL_NEXT' && typeof msg.current === 'number') {
      ApplyServiceResourceState({
        serviceId: msg.serviceId,
        resourceId,
        resourceName,
        patch: {
          currentServing: msg.current,
          servingTicketId: msg.servingTicketId ?? '',
          servingCustomerLastName: msg.servingCustomerLastName ?? '',
          servingCustomerTitle: msg.servingCustomerTitle ?? '',
          avgServiceMinutes:
            msg.avgServiceMinutes ?? GetResourceState(msg.serviceId, resourceId)?.avgServiceMinutes ?? 0
        },
        timestamp: ts
      });
      // 同步 myTicket（按 resource 隔離）：必須同 service 同 resource
      if (myTicket.value) {
        const myResourceId = (myTicket.value.ticket as { resourceId?: string | null }).resourceId ?? null;
        const myServiceId = (myTicket.value.ticket as { serviceId?: string }).serviceId ?? '';
        const sameRoute = myServiceId === msg.serviceId && myResourceId === resourceId;
        if (sameRoute) {
          if (msg.servingTicketId === myTicketId.value) {
            myTicket.value = {
              ...myTicket.value,
              ticket: { ...myTicket.value.ticket, status: 'CALLED', calledAt: new Date(ts).toISOString() },
              currentServing: msg.current,
              waitingAhead: 0,
              estimatedWaitMinutes: 0
            };
          } else {
            const newAhead = Math.max(0, (myTicket.value.ticket.ticketNumber - msg.current - 1));
            const avg = msg.avgServiceMinutes ?? myTicket.value.avgServiceMinutes ?? 0;
            const newEta = avg > 0 ? estimateWaitMinutes(newAhead, avg) : null;
            myTicket.value = {
              ...myTicket.value,
              currentServing: msg.current,
              waitingAhead: newAhead,
              estimatedWaitMinutes: newEta,
              avgServiceMinutes: avg
            };
          }
        }
      }
    }
    if (msg.type === 'TICKET_DONE') {
      const r = GetResourceState(msg.serviceId, resourceId);
      if (r && r.servingTicketId === msg.servingTicketId) {
        ApplyServiceResourceState({
          serviceId: msg.serviceId,
          resourceId,
          resourceName,
          patch: {
            servingTicketId: '',
            servingCustomerLastName: '',
            servingCustomerTitle: ''
          },
          timestamp: ts
        });
      }
      if (myTicket.value && msg.servingTicketId === myTicketId.value) {
        myTicket.value = {
          ...myTicket.value,
          ticket: { ...myTicket.value.ticket, status: 'DONE', doneAt: new Date(ts).toISOString() }
        };
      }
    }
    if (msg.type === 'TICKET_SKIPPED') {
      const r = GetResourceState(msg.serviceId, resourceId);
      if (r && r.servingTicketId === msg.servingTicketId) {
        ApplyServiceResourceState({
          serviceId: msg.serviceId,
          resourceId,
          resourceName,
          patch: {
            servingTicketId: '',
            servingCustomerLastName: '',
            servingCustomerTitle: ''
          },
          timestamp: ts
        });
      }
      if (myTicket.value && msg.servingTicketId === myTicketId.value) {
        myTicket.value = {
          ...myTicket.value,
          ticket: { ...myTicket.value.ticket, status: 'SKIPPED' }
        };
      }
    }
    if (msg.type === 'TICKET_TAKEN') {
      // 不動 currentServing；只用來確保 resourceMap 內 slot 存在 + 更新 name（供 display 即時加 cell）
      ApplyServiceResourceState({
        serviceId: msg.serviceId,
        resourceId,
        resourceName,
        patch: {},
        timestamp: ts
      });
    }
  };

  // ====== ETA 計算 getter（供 status.vue / admin queue.vue 即時讀取） ======
  /** 算指定票的當下預估等待分鐘；無法估算回 null
   *  - 帶 resourceId 時優先讀 resourceMap[resourceId] 的 currentServing / avgServiceMinutes
   *  - 未帶或讀不到時 fallback 至頂層 projection（向後相容既有 admin 呼叫端）
   */
  const GetEtaForTicket = (
    ticket: { ticketNumber: number; status: QueueTicketStatusForEta },
    serviceId: string,
    resourceId?: string | null
  ): number | null => {
    const svc = serviceMap.value[serviceId];
    if (!svc) return null;
    let avg = svc.avgServiceMinutes;
    let serving = svc.currentServing;
    if (resourceId !== undefined) {
      const r = svc.resourceMap[resourceId ?? RESOURCE_NULL_KEY];
      if (r) {
        avg = r.avgServiceMinutes || avg;
        serving = r.currentServing;
      }
    }
    if (avg <= 0) return null;
    const ahead = getTicketsAhead(ticket, { lastCalledNumber: serving });
    return estimateWaitMinutes(ahead, avg);
  };

  // ====== 輪詢兜底 ======
  const StartPolling = () => {
    if (pollTimerId !== null) return;
    if (!import.meta.client) return;
    pollTimerId = setInterval(async () => {
      if (isWsConnected.value) return; // WS 在線時不輪詢
      if (!myTicketId.value) return;
      try {
        const res = await $api.GetQueueTicket({ id: myTicketId.value });
        if (res.status.code === $enum.apiStatus.success) {
          myTicket.value = res.data;
          const serviceId = (res.data.ticket as { serviceId?: string }).serviceId || '';
          // currentServing 同步進 serviceMap（無 serviceId 時跳過，避免汙染）
          if (serviceId) {
            const ticketAny = res.data.ticket as { resourceId?: string | null; resourceName?: string | null };
            ApplyServiceResourceState({
              serviceId,
              resourceId: ticketAny.resourceId ?? null,
              resourceName: ticketAny.resourceName ?? null,
              patch: {
                currentServing: res.data.currentServing,
                avgServiceMinutes:
                  res.data.avgServiceMinutes
                  ?? GetResourceState(serviceId, ticketAny.resourceId ?? null)?.avgServiceMinutes
                  ?? 0
              },
              timestamp: Date.now()
            });
          }
        }
      } catch { /* ignore */ }
    }, 15000);
  };

  const StopPolling = () => {
    if (pollTimerId !== null) {
      clearInterval(pollTimerId);
      pollTimerId = null;
    }
  };

  // ====== 對外：連線 / 中斷 ======
  /** 連線到指定商家的 queue ws */
  const Connect = (merchantId: string) => {
    if (!import.meta.client) return;
    if (!merchantId) return;
    if (currentMerchantId === merchantId && wsHandle) return;

    Disconnect();
    currentMerchantId = merchantId;

    // 初始化在線狀態並掛上 online/offline listener
    isOnline.value = typeof navigator !== 'undefined' ? navigator.onLine !== false : true;
    onlineHandler = () => { isOnline.value = true; ScheduleApply(); };
    offlineHandler = () => { isOnline.value = false; ScheduleApply(); };
    window.addEventListener('online', onlineHandler);
    window.addEventListener('offline', offlineHandler);

    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const wsURL = `${proto}://${window.location.host}/nuxt-api/queue/ws?merchantId=${encodeURIComponent(merchantId)}`;
    wsHandle = UseWS(wsURL, {
      canDispose: false, // 由 store 控制
      autoConnect: false, // store 內無 component lifecycle；手動呼叫 Connect
      reconnectOnClose: true,
      heartbeatIntervalMs: 25000,
      heartbeatMsg: 'ping',
      expectPong: true,
      parseJSON: true,
      OnOpen: () => { isWsConnected.value = true; ScheduleApply(); },
      OnClose: () => { isWsConnected.value = false; ScheduleApply(); },
      OnMessage: HandleMessage
    });
    // 監聽 retryCount 變動以同步 reconnecting / fallback 狀態
    stopRetryWatch = watch(
      () => wsHandle?.retryCount.value ?? 0,
      () => ScheduleApply()
    );
    // 手動觸發連線（UseWS 的 autoConnect 仰賴 onMounted，但 store 不是 component）
    try { wsHandle.Connect(); } catch { /* ignore */ }
    StartPolling();
    // 首次狀態評估
    ScheduleApply();
  };

  /** 主動斷線（離開頁面時呼叫） */
  const Disconnect = () => {
    if (wsHandle) {
      try { wsHandle.Disconnect(); wsHandle.Dispose(); } catch { /* ignore */ }
      wsHandle = null;
    }
    if (stopRetryWatch) {
      stopRetryWatch();
      stopRetryWatch = null;
    }
    if (onlineHandler) {
      window.removeEventListener('online', onlineHandler);
      onlineHandler = null;
    }
    if (offlineHandler) {
      window.removeEventListener('offline', offlineHandler);
      offlineHandler = null;
    }
    if (stateDebounceTimer) {
      clearTimeout(stateDebounceTimer);
      stateDebounceTimer = null;
    }
    StopCountdown();
    isWsConnected.value = false;
    connectionState.value = 'offline';
    currentMerchantId = '';
    StopPolling();
  };

  /** 立即重試 WS 連線（給連線 banner 上的「立即重試」按鈕） */
  const ForceReconnect = () => {
    if (!wsHandle) return;
    try { wsHandle.ForceReconnect(); } catch { /* ignore */ }
    // 立即評估狀態
    ScheduleApply();
  };

  // ====== 對外：myTicket 操作 ======
  const SetMyTicket = (ticketId: string, ticket: GetQueueTicketRes | null) => {
    myTicketId.value = ticketId;
    myTicket.value = ticket;
  };

  const ClearMyTicket = () => {
    myTicketId.value = '';
    myTicket.value = null;
  };

  /** 強制立即抓最新狀態（手動 refresh） */
  const RefreshMyTicket = async () => {
    if (!myTicketId.value) return;
    const res = await $api.GetQueueTicket({ id: myTicketId.value });
    if (res.status.code === $enum.apiStatus.success) {
      myTicket.value = res.data;
    }
  };

  /** 自 SetMyTicket 同步進 serviceMap，避免初始載入時 ETA 無法計算 */
  const SyncMyTicketIntoServiceMap = (ticket: GetQueueTicketRes | null) => {
    if (!ticket) return;
    const serviceId = (ticket.ticket as { serviceId?: string }).serviceId || '';
    if (!serviceId) return;
    const ticketAny = ticket.ticket as { resourceId?: string | null; resourceName?: string | null };
    const resourceId = ticketAny.resourceId ?? null;
    ApplyServiceResourceState({
      serviceId,
      resourceId,
      resourceName: ticketAny.resourceName ?? null,
      patch: {
        currentServing: ticket.currentServing,
        avgServiceMinutes:
          ticket.avgServiceMinutes ?? GetResourceState(serviceId, resourceId)?.avgServiceMinutes ?? 0
      },
      timestamp: Date.now()
    });
  };

  const SetMyTicketWithSync = (ticketId: string, ticket: GetQueueTicketRes | null) => {
    SetMyTicket(ticketId, ticket);
    SyncMyTicketIntoServiceMap(ticket);
  };

  return {
    serviceMap,
    myTicket,
    myTicketId,
    isWsConnected,
    lastEventAt,
    connectionState,
    reconnectIn,
    isOnline,
    Connect,
    Disconnect,
    ForceReconnect,
    SetMyTicket: SetMyTicketWithSync,
    ClearMyTicket,
    RefreshMyTicket,
    GetEtaForTicket,
    /** 取單一 (service, resource) 即時 state；缺則 null */
    GetResourceState,
    /** 把 GetPublicMerchant 取回的多 resource snapshot 灌入 store */
    UpsertResourcesSnapshot,
    /** 寫入單一 resource partial state（外部少用，多數情境走 WS） */
    ApplyServiceResourceState
  };
});
