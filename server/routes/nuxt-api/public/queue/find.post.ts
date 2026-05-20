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
    // 多取一筆即可判定模糊；避免 over-fetch
    select: { id: true },
    take: 2,
    orderBy: { ticketNumber: 'asc' }
  });

  if (matches.length === 0) {
    return recordFailureOr(event, ip, notFoundError(event, MSG_QUEUE_FIND_NOT_FOUND));
  }
  if (matches.length > 1) {
    // 多筆視為模糊：不洩漏任何 ticketId、不計入失敗鎖（已是有效查詢）
    return badRequestError(event, MSG_QUEUE_FIND_AMBIGUOUS);
  }

  // 命中單一票，回 ticketId（不洩漏 phone / lastName / title）
  return successResponse({ ticketId: matches[0].id });
});
