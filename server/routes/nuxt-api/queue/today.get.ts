// 商家當日號碼牌總覽（依服務 → resource 兩層群組；未綁 resource 走單元素 fallback 保持 schema 一致）
import { defineEventHandler } from 'h3';
import { prisma } from '@@/utils/prisma';
import { requireMerchant } from '@@/utils/auth';
import { successResponse } from '@@/utils/response';
import {
  getTicketDate,
  computeTicketEtaMinutes,
  getEffectiveAvgServiceMinutes,
  getResourcesForQueueService,
  resolveProviderByResourceMap,
  getResourceProviderEntry
} from '@@/utils/queue';

export default defineEventHandler(async (event) => {
  const auth = requireMerchant(event);
  if ('status' in auth) return auth;
  const merchantId = auth.merchantId!;

  const merchant = await prisma.merchant.findUnique({
    where: { id: merchantId },
    select: { timezone: true }
  });
  const tz = merchant?.timezone ?? 'Asia/Taipei';
  const ticketDate = getTicketDate(tz);

  const services = await prisma.service.findMany({
    where: { merchantId, bookingMode: 'QUEUE', deletedAt: null },
    orderBy: { displayOrder: 'asc' },
    select: {
      id: true,
      name: true,
      isActive: true,
      avgServiceMinutes: true,
      durationMinutes: true
    }
  });

  // 一次撈所有 counter / ticket，後續在記憶體分群
  const counters = await prisma.queueCounter.findMany({
    where: { merchantId, counterDate: ticketDate },
    select: {
      serviceId: true,
      resourceId: true,
      lastTicketNumber: true,
      lastCalledNumber: true
    }
  });

  const tickets = await prisma.queueTicket.findMany({
    where: { merchantId, ticketDate },
    orderBy: { ticketNumber: 'asc' },
    select: {
      id: true,
      serviceId: true,
      resourceId: true,
      ticketNumber: true,
      status: true,
      customerLastName: true,
      customerTitle: true,
      customerPhone: true,
      createdByMerchant: true,
      takenAt: true,
      calledAt: true,
      doneAt: true,
      resource: { select: { name: true, displayOrder: true, isActive: true } }
    }
  });

  // 並行載入每個 service 的綁定 resources + 一次性 schedule → provider 反查（短路：未啟用 Provider 制回空 Map）
  const [resourcesByService, providerMap] = await Promise.all([
    Promise.all(
      services.map(async (s) => [s.id, await getResourcesForQueueService(s.id)] as const)
    ).then((entries) => new Map(entries)),
    resolveProviderByResourceMap(merchantId)
  ]);

  // counter 索引：`${serviceId}::${resourceId ?? 'null'}`
  const counterKey = (serviceId: string, resourceId: string | null) =>
    `${serviceId}::${resourceId ?? 'null'}`;
  const counterMap = new Map(
    counters.map((c) => [counterKey(c.serviceId, c.resourceId), c])
  );

  const grouped = services.map((s) => {
    const serviceForEta = { avgServiceMinutes: s.avgServiceMinutes, durationMinutes: s.durationMinutes };
    const effectiveAvg = getEffectiveAvgServiceMinutes(serviceForEta);
    const serviceTickets = tickets.filter((t) => t.serviceId === s.id);
    const bound = resourcesByService.get(s.id) ?? [];

    // 收集該 service 下實際出現過 ticket 的 resource id 集合（包括已解綁／軟刪的歷史 resource）
    const ticketResourceIds = new Set<string | null>();
    for (const t of serviceTickets) ticketResourceIds.add(t.resourceId);

    // 決定要輸出哪些 resource 項
    type ResourceSlot = {
      id: string | null;
      name: string | null;
      displayOrder: number | null;
      isActive: boolean | null;
    };
    const slots: ResourceSlot[] = [];
    if (bound.length === 0 && !ticketResourceIds.has(null) && ticketResourceIds.size === 0) {
      // 完全沒綁也沒票：fallback 單元素 null
      slots.push({ id: null, name: null, displayOrder: null, isActive: null });
    } else {
      // 已綁 active resources 先入列
      for (const r of bound) {
        slots.push({ id: r.id, name: r.name, displayOrder: r.displayOrder, isActive: r.isActive });
      }
      // 歷史票對應 resource（已解綁或已軟刪）補上
      for (const rid of ticketResourceIds) {
        if (rid === null) continue; // null 另外處理
        if (slots.some((slot) => slot.id === rid)) continue;
        // 從任一張該 resource 的 ticket 反查 name
        const sample = serviceTickets.find((t) => t.resourceId === rid);
        slots.push({
          id: rid,
          name: sample?.resource?.name ?? null,
          displayOrder: sample?.resource?.displayOrder ?? null,
          isActive: sample?.resource?.isActive ?? false
        });
      }
      // 若該 service 同時有「未綁 resource 的票」（null 路徑歷史資料），補一個 null slot
      if (ticketResourceIds.has(null)) {
        slots.push({ id: null, name: null, displayOrder: null, isActive: null });
      }
      // 若 bound 為空（QUEUE 未綁）但有歷史票走過 null，前面 if 已覆蓋；確保至少一個 slot
      if (slots.length === 0) {
        slots.push({ id: null, name: null, displayOrder: null, isActive: null });
      }
    }

    const resources = slots.map((slot) => {
      const counter = counterMap.get(counterKey(s.id, slot.id)) ?? null;
      const counterForEta = counter ? { lastCalledNumber: counter.lastCalledNumber } : null;
      const providerEntry = getResourceProviderEntry(providerMap, slot.id);
      const list = serviceTickets
        .filter((t) => t.resourceId === slot.id)
        .map((t) => ({
          id: t.id,
          ticketNumber: t.ticketNumber,
          status: t.status,
          customerLastName: t.customerLastName,
          customerTitle: t.customerTitle,
          customerPhone: t.customerPhone,
          createdByMerchant: t.createdByMerchant,
          takenAt: t.takenAt.toISOString(),
          calledAt: t.calledAt ? t.calledAt.toISOString() : null,
          doneAt: t.doneAt ? t.doneAt.toISOString() : null,
          estimatedWaitMinutes: computeTicketEtaMinutes(
            { ticketNumber: t.ticketNumber, status: t.status },
            counterForEta,
            serviceForEta
          ),
          providerId: providerEntry?.providerId ?? null,
          providerName: providerEntry?.providerName ?? null
        }));
      return {
        id: slot.id,
        name: slot.name,
        displayOrder: slot.displayOrder,
        isActive: slot.isActive,
        lastTicketNumber: counter?.lastTicketNumber ?? 0,
        lastCalledNumber: counter?.lastCalledNumber ?? 0,
        provider: providerEntry
          ? { id: providerEntry.providerId, name: providerEntry.providerName }
          : null,
        tickets: list
      };
    });

    // 頂層 service-level 合計欄位（沿用既有欄位，給尚未升級的前端使用）
    const totalTaken = resources.reduce((acc, r) => acc + r.lastTicketNumber, 0);
    const allActiveWaitingCalled = serviceTickets.filter(
      (t) => t.status === 'WAITING' || t.status === 'CALLED'
    );
    const minActiveLastCalled = resources
      .filter((r) => allActiveWaitingCalled.some((t) => t.resourceId === r.id))
      .map((r) => r.lastCalledNumber)
      .sort((a, b) => a - b)[0] ?? 0;
    const aggregateLastTicket = resources.reduce(
      (acc, r) => Math.max(acc, r.lastTicketNumber),
      0
    );

    return {
      serviceId: s.id,
      serviceName: s.name,
      isActive: s.isActive,
      // 既有欄位：未綁時 = 唯一 slot 的值；綁多 resource 時取合計／代表值（給尚未升級的前端 fallback）
      lastTicketNumber: resources.length === 1 ? resources[0].lastTicketNumber : aggregateLastTicket,
      lastCalledNumber: resources.length === 1 ? resources[0].lastCalledNumber : minActiveLastCalled,
      avgServiceMinutes: effectiveAvg,
      // 既有 tickets 攤平欄位（向後相容；綁多 resource 時為所有 resource 合併）
      tickets: resources.flatMap((r) => r.tickets),
      ticketsTotal: totalTaken,
      resources
    };
  });

  return successResponse({
    ticketDate: ticketDate.toISOString().slice(0, 10),
    timezone: tz,
    services: grouped
  });
});
