// queue mock

const SuccessRes = <T>(data: T, wait = 100) => new Promise<ApiRes<T>>((resolve) => {
  const res = { data, status: { code: 200, message: { zh_tw: '', en: '', ja: '' } } } as ApiRes<T>;
  setTimeout(() => { resolve(res); }, wait);
});

export const TakeQueueTicket = () =>
  SuccessRes<TakeQueueTicketRes>({
    ticketId: 'mock-ticket-1',
    ticketNumber: 1,
    ticketDate: '2026-05-15',
    status: 'WAITING',
    currentServing: 0,
    serviceName: '示例號碼牌服務',
    timezone: 'Asia/Taipei'
  });

export const FindQueueTicket = () =>
  SuccessRes<FindQueueTicketRes>({
    ticketId: 'mock-ticket-1'
  });

export const GetQueueTicket = () =>
  SuccessRes<GetQueueTicketRes>({
    ticket: {
      id: 'mock-ticket-1',
      serviceId: 'mock-service',
      ticketNumber: 1,
      ticketDate: '2026-05-15',
      status: 'WAITING',
      takenAt: new Date().toISOString(),
      calledAt: null,
      doneAt: null,
      serviceName: '示例號碼牌服務'
    },
    merchant: { id: 'mock-merchant', name: '示例商家', timezone: 'Asia/Taipei' },
    currentServing: 0,
    lastTicketNumber: 1,
    waitingAhead: 0
  });

export const GetQueueToday = () =>
  SuccessRes<GetQueueTodayRes>({
    ticketDate: '2026-05-15',
    timezone: 'Asia/Taipei',
    services: []
  });

export const CallNextQueueTicket = () =>
  SuccessRes<CallNextQueueTicketRes>({
    ticketId: 'mock-ticket-1',
    ticketNumber: 1,
    serviceId: 'mock-service'
  });

export const MarkQueueTicketDone = () =>
  SuccessRes<QueueTicketActionRes>({
    ticketId: 'mock-ticket-1',
    ticketNumber: 1,
    status: 'DONE',
    doneAt: new Date().toISOString()
  });

export const MarkQueueTicketSkip = () =>
  SuccessRes<QueueTicketActionRes>({
    ticketId: 'mock-ticket-1',
    ticketNumber: 1,
    status: 'SKIPPED'
  });
