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

interface ServiceServingState {
  /** 服務 ID */
  serviceId: string;
  /** 服務中號碼 */
  currentServing: number;
  /** 服務中票 id（CALL_NEXT 推播帶入；TICKET_DONE/SKIPPED 後清空） */
  servingTicketId: string;
  /** 該服務的 effective 平均服務時長（avgServiceMinutes ?? durationMinutes） */
  avgServiceMinutes: number;
  /** 最後一次推播時間 */
  lastEventAt: number;
}

interface QueueBroadcastMessage {
  type: 'HELLO' | 'CALL_NEXT' | 'TICKET_DONE' | 'TICKET_SKIPPED' | 'TICKET_TAKEN';
  serviceId?: string;
  current?: number;
  servingTicketId?: string;
  ticketNumber?: number;
  /** 廣播當下服務的 effective 平均服務時長（給訂閱端校準 ETA） */
  avgServiceMinutes?: number;
  /** 廣播當下下一位 WAITING 票的預估等待分鐘（領號頁卡片用） */
  nextWaitMinutes?: number | null;
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

  // ====== WS 訊息處理 ======
  const HandleMessage = (_ev: MessageEvent, parsed: unknown | null) => {
    if (!parsed || typeof parsed !== 'object') return;
    const msg = parsed as QueueBroadcastMessage;
    lastEventAt.value = msg.timestamp ?? Date.now();

    if (msg.type === 'HELLO') return;

    // 統一更新 serviceMap 內該服務的 avgServiceMinutes（任何含此欄位的 payload）
    if (msg.serviceId && typeof msg.avgServiceMinutes === 'number') {
      const prev = serviceMap.value[msg.serviceId];
      serviceMap.value[msg.serviceId] = {
        serviceId: msg.serviceId,
        currentServing: prev?.currentServing ?? 0,
        servingTicketId: prev?.servingTicketId ?? '',
        avgServiceMinutes: msg.avgServiceMinutes,
        lastEventAt: msg.timestamp
      };
    }

    if (msg.type === 'CALL_NEXT' && msg.serviceId && typeof msg.current === 'number') {
      const prev = serviceMap.value[msg.serviceId];
      serviceMap.value[msg.serviceId] = {
        serviceId: msg.serviceId,
        currentServing: msg.current,
        servingTicketId: msg.servingTicketId ?? '',
        avgServiceMinutes: msg.avgServiceMinutes ?? prev?.avgServiceMinutes ?? 0,
        lastEventAt: msg.timestamp
      };
      // 同步 myTicket（如果是自己被叫）
      if (myTicket.value && msg.servingTicketId === myTicketId.value) {
        myTicket.value = {
          ...myTicket.value,
          ticket: { ...myTicket.value.ticket, status: 'CALLED', calledAt: new Date(msg.timestamp).toISOString() },
          currentServing: msg.current,
          waitingAhead: 0,
          estimatedWaitMinutes: 0
        };
      } else if (myTicket.value) {
        // 自己沒被叫到：currentServing 推進，重算 myTicket 的 ETA
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
    if (msg.type === 'TICKET_DONE' && msg.serviceId) {
      const prev = serviceMap.value[msg.serviceId];
      if (prev && prev.servingTicketId === msg.servingTicketId) {
        serviceMap.value[msg.serviceId] = { ...prev, servingTicketId: '', lastEventAt: msg.timestamp };
      }
      if (myTicket.value && msg.servingTicketId === myTicketId.value) {
        myTicket.value = {
          ...myTicket.value,
          ticket: { ...myTicket.value.ticket, status: 'DONE', doneAt: new Date(msg.timestamp).toISOString() }
        };
      }
    }
    if (msg.type === 'TICKET_SKIPPED' && msg.serviceId) {
      const prev = serviceMap.value[msg.serviceId];
      if (prev && prev.servingTicketId === msg.servingTicketId) {
        serviceMap.value[msg.serviceId] = { ...prev, servingTicketId: '', lastEventAt: msg.timestamp };
      }
      if (myTicket.value && msg.servingTicketId === myTicketId.value) {
        myTicket.value = {
          ...myTicket.value,
          ticket: { ...myTicket.value.ticket, status: 'SKIPPED' }
        };
      }
    }
    // TICKET_TAKEN 不更新 currentServing（號碼還沒被叫），但商家控制台會自己重抓
  };

  // ====== ETA 計算 getter（供 status.vue / admin queue.vue 即時讀取） ======
  /** 算指定票的當下預估等待分鐘；無法估算回 null */
  const GetEtaForTicket = (
    ticket: { ticketNumber: number; status: QueueTicketStatusForEta },
    serviceId: string
  ): number | null => {
    const svc = serviceMap.value[serviceId];
    if (!svc || svc.avgServiceMinutes <= 0) return null;
    const ahead = getTicketsAhead(ticket, { lastCalledNumber: svc.currentServing });
    return estimateWaitMinutes(ahead, svc.avgServiceMinutes);
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
          const serviceId = (res.data.ticket as any).serviceId || '';
          // currentServing 同步進 serviceMap（無 serviceId 時跳過，避免汙染）
          if (serviceId) {
            const prev = serviceMap.value[serviceId];
            serviceMap.value[serviceId] = {
              serviceId,
              currentServing: res.data.currentServing,
              servingTicketId: prev?.servingTicketId ?? '',
              avgServiceMinutes: res.data.avgServiceMinutes ?? prev?.avgServiceMinutes ?? 0,
              lastEventAt: Date.now()
            };
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
    const prev = serviceMap.value[serviceId];
    serviceMap.value[serviceId] = {
      serviceId,
      currentServing: ticket.currentServing,
      servingTicketId: prev?.servingTicketId ?? '',
      avgServiceMinutes: ticket.avgServiceMinutes ?? prev?.avgServiceMinutes ?? 0,
      lastEventAt: Date.now()
    };
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
    GetEtaForTicket
  };
});
