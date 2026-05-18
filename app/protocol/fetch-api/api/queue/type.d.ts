// 號碼牌 API type 定義

type QueueTicketStatusType = 'WAITING' | 'CALLED' | 'DONE' | 'SKIPPED' | 'CANCELED';

interface QueueCustomerTriplet {
  lastName: string;
  title: CustomerTitleType;
  phone: string;
}

// 公開：拿號 -----------------------------------------------------------------------------------

interface TakeQueueTicketParams {
  slug: string;
  serviceId: string;
  customer: QueueCustomerTriplet;
}

interface TakeQueueTicketRes {
  ticketId: string;
  ticketNumber: number;
  /** YYYY-MM-DD */
  ticketDate: string;
  status: QueueTicketStatusType;
  currentServing: number;
  serviceName: string;
  timezone: string;
}

// 公開：查單張號碼牌 ---------------------------------------------------------------------------

interface GetQueueTicketParams {
  id: string;
}

interface GetQueueTicketRes {
  ticket: {
    id: string;
    serviceId: string;
    ticketNumber: number;
    ticketDate: string;
    status: QueueTicketStatusType;
    takenAt: string;
    calledAt: string | null;
    doneAt: string | null;
    serviceName: string;
  };
  merchant: {
    id: string;
    name: string;
    timezone: string;
  };
  currentServing: number;
  lastTicketNumber: number;
  waitingAhead: number;
}

// 商家：當日總覽 -------------------------------------------------------------------------------

interface QueueTodayTicketItem {
  id: string;
  ticketNumber: number;
  status: QueueTicketStatusType;
  customerLastName: string;
  customerTitle: CustomerTitleType;
  customerPhone: string;
  takenAt: string;
  calledAt: string | null;
  doneAt: string | null;
}

interface QueueTodayServiceItem {
  serviceId: string;
  serviceName: string;
  isActive: boolean;
  lastTicketNumber: number;
  lastCalledNumber: number;
  tickets: QueueTodayTicketItem[];
}

interface GetQueueTodayRes {
  ticketDate: string;
  timezone: string;
  services: QueueTodayServiceItem[];
}

// 商家：叫下一號 -------------------------------------------------------------------------------

interface CallNextQueueTicketParams {
  serviceId: string;
}

interface CallNextQueueTicketRes {
  ticketId: string;
  ticketNumber: number;
  serviceId: string;
}

// 商家：標完成 / 過號 ---------------------------------------------------------------------------

interface QueueTicketActionParams {
  id: string;
}

interface QueueTicketActionRes {
  ticketId: string;
  ticketNumber: number;
  status: QueueTicketStatusType;
  doneAt?: string | null;
}
