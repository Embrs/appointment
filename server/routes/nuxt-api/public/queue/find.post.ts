// 公開查回號碼牌（手機末 4 碼）：localStorage 失效時的兜底救援
// 設計重點：嚴格 RateLimit + 失敗鎖、回應不洩漏個資、多筆命中視為模糊不選任一筆
import { defineEventHandler, readBody, getRequestIP, setResponseHeader, type H3Event } from 'h3';
import { z } from 'zod';
import { prisma } from '@@/utils/prisma';
import {
  badRequestError,
  notFoundError,
  successResponse,
  tooManyRequestsError
} from '@@/utils/response';
import { checkRateLimit } from '@@/utils/rate-limit';
import {
  MSG_QUEUE_FIND_AMBIGUOUS,
  MSG_QUEUE_FIND_INVALID,
  MSG_QUEUE_FIND_NOT_FOUND,
  getTicketDate
} from '@@/utils/queue';

/** 公開讓單元測試引用 */
export const FindBodySchema = z.object({
  slug: z.string().min(1).max(64),
  serviceId: z.string().min(1),
  phoneLast4: z.string().regex(/^\d{4}$/)
});

/** 記錄一次「失敗猜測」並回傳 429（若已超過鎖門檻）。否則回 caller 自訂的錯誤。 */
const recordFailureOr = async (
  event: H3Event,
  ip: string,
  fallback: ReturnType<typeof badRequestError>
) => {
  const fail = await checkRateLimit(`queue-find-fail:${ip}`, 10, 300);
  if (!fail.ok) {
    setResponseHeader(event, 'Retry-After', String(fail.retryAfterSeconds ?? 300));
    return tooManyRequestsError(event);
  }
  return fallback;
};

export default defineEventHandler(async (event) => {
  const ip = getRequestIP(event, { xForwardedFor: true }) ?? 'unknown';

  // 主 RateLimit：每 IP 1 分鐘 5 次
  const rl = await checkRateLimit(`queue-find-ip:${ip}`, 5, 60);
  if (!rl.ok) {
    setResponseHeader(event, 'Retry-After', String(rl.retryAfterSeconds ?? 60));
    return tooManyRequestsError(event);
  }

  const parsed = FindBodySchema.safeParse(await readBody(event));
  if (!parsed.success) {
    return recordFailureOr(event, ip, badRequestError(event, MSG_QUEUE_FIND_INVALID));
  }

  const merchant = await prisma.merchant.findFirst({
    where: { slug: parsed.data.slug, status: 'ACTIVE', deletedAt: null },
    select: { id: true, timezone: true }
  });
  if (!merchant) {
    return recordFailureOr(event, ip, notFoundError(event, MSG_QUEUE_FIND_NOT_FOUND));
  }

  const ticketDate = getTicketDate(merchant.timezone, new Date());

  // 只查「進行中」的票（WAITING/CALLED）；已結束的（DONE/SKIPPED/CANCELED）對顧客回流無意義且會造成假性 ambiguous
  const matches = await prisma.queueTicket.findMany({
    where: {
      merchantId: merchant.id,
      serviceId: parsed.data.serviceId,
      ticketDate,
      customerPhone: { endsWith: parsed.data.phoneLast4 },
      status: { in: ['WAITING', 'CALLED'] }
    },
    select: {
      id: true,
      ticketNumber: true,
      status: true,
      resourceId: true,
      claimToken: true,
      service: { select: { name: true } },
      resource: { select: { name: true } }
    },
    // 多取一筆即可判定模糊；避免 over-fetch；上限拉至 8 處理 ≤8 個 resource 場景
    take: 8,
    orderBy: { ticketNumber: 'asc' }
  });

  if (matches.length === 0) {
    return recordFailureOr(event, ip, notFoundError(event, MSG_QUEUE_FIND_NOT_FOUND));
  }

  // 命中單筆：沿用既有 contract
  if (matches.length === 1) {
    return successResponse({ ticketId: matches[0]!.id });
  }

  // 多筆：必須每筆都在不同 resource（同 resource 不應出現 — internalCreateTicket 已擋同手機 + 同 resource 重複）
  // 若仍出現同 resource 多筆（罕見、髒資料），視為 ambiguous 不洩漏
  const distinctResource = new Set(matches.map((m) => m.resourceId ?? '__null__'));
  if (distinctResource.size !== matches.length) {
    return badRequestError(event, MSG_QUEUE_FIND_AMBIGUOUS);
  }

  return successResponse({
    tickets: matches.map((m) => ({
      ticketId: m.id,
      ticketNumber: m.ticketNumber,
      status: m.status,
      resourceId: m.resourceId,
      resourceName: m.resource?.name ?? null,
      serviceName: m.service?.name ?? '',
      claimToken: m.claimToken
    }))
  });
});
