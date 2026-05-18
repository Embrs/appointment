// 號碼牌即時 store：WS 連線 + 15 秒輪詢兜底
// 規範：頁面 mounted 時呼叫 Connect(merchantId)；unmounted 時 Disconnect
// 雙軌制：WS 為主、HTTP polling 為 fallback；onmessage 直接 patch 本地 state

interface ServiceServingState {
  /** 服務 ID */
  serviceId: string;
  /** 服務中號碼 */
  currentServing: number;
  /** 服務中票 id（CALL_NEXT 推播帶入；TICKET_DONE/SKIPPED 後清空） */
  servingTicketId: string;
  /** 最後一次推播時間 */
  lastEventAt: number;
}

interface QueueBroadcastMessage {
  type: 'HELLO' | 'CALL_NEXT' | 'TICKET_DONE' | 'TICKET_SKIPPED' | 'TICKET_TAKEN';
  serviceId?: string;
  current?: number;
  servingTicketId?: string;
  ticketNumber?: number;
  timestamp: number;
}

export const StoreQueueRealtime = defineStore('StoreQueueRealtime', () => {
  /** 各服務當前服務中狀態，key=serviceId */
  const serviceMap = ref<Record<string, ServiceServingState>>({});
  /** 自己手上的票 id（顧客等待頁用） */
  const myTicketId = ref<string>('');
  /** 自己票的完整資料（用於顯示 + 兜底輪詢比對） */
  const myTicket = ref<GetQueueTicketRes | null>(null);
  /** WS 是否連線 */
  const isWsConnected = ref(false);
  /** 最後一次廣播時間 */
  const lastEventAt = ref(0);

  /** 內部：WS handle */
  let wsHandle: ReturnType<typeof UseWS> | null = null;
  /** 內部：輪詢計時器 */
  let pollTimerId: ReturnType<typeof setInterval> | null = null;
  /** 當前訂閱中的 merchantId */
  let currentMerchantId = '';

  // ====== WS 訊息處理 ======
  const HandleMessage = (_ev: MessageEvent, parsed: unknown | null) => {
    if (!parsed || typeof parsed !== 'object') return;
    const msg = parsed as QueueBroadcastMessage;
    lastEventAt.value = msg.timestamp ?? Date.now();

    if (msg.type === 'HELLO') return;

    if (msg.type === 'CALL_NEXT' && msg.serviceId && typeof msg.current === 'number') {
      serviceMap.value[msg.serviceId] = {
        serviceId: msg.serviceId,
        currentServing: msg.current,
        servingTicketId: msg.servingTicketId ?? '',
        lastEventAt: msg.timestamp
      };
      // 同步 myTicket（如果是自己被叫）
      if (myTicket.value && msg.servingTicketId === myTicketId.value) {
        myTicket.value = {
          ...myTicket.value,
          ticket: { ...myTicket.value.ticket, status: 'CALLED', calledAt: new Date(msg.timestamp).toISOString() },
          currentServing: msg.current,
          waitingAhead: 0
        };
      } else if (myTicket.value) {
        myTicket.value = { ...myTicket.value, currentServing: msg.current };
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
            serviceMap.value[serviceId] = {
              serviceId,
              currentServing: res.data.currentServing,
              servingTicketId: serviceMap.value[serviceId]?.servingTicketId ?? '',
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
      OnOpen: () => { isWsConnected.value = true; },
      OnClose: () => { isWsConnected.value = false; },
      OnMessage: HandleMessage
    });
    // 手動觸發連線（UseWS 的 autoConnect 仰賴 onMounted，但 store 不是 component）
    try { wsHandle.Connect(); } catch { /* ignore */ }
    StartPolling();
  };

  /** 主動斷線（離開頁面時呼叫） */
  const Disconnect = () => {
    if (wsHandle) {
      try { wsHandle.Disconnect(); wsHandle.Dispose(); } catch { /* ignore */ }
      wsHandle = null;
    }
    isWsConnected.value = false;
    currentMerchantId = '';
    StopPolling();
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

  return {
    serviceMap,
    myTicket,
    myTicketId,
    isWsConnected,
    lastEventAt,
    Connect,
    Disconnect,
    SetMyTicket,
    ClearMyTicket,
    RefreshMyTicket
  };
});
