// 公開可預約時段查詢（不需 token，套 IP rate limit 5/秒）
import { defineEventHandler, getQuery, getRequestIP, setResponseHeader } from 'h3';
import { z } from 'zod';
import {
  badRequestError,
  successResponse,
  tooManyRequestsError
} from '@@/utils/response';
import { checkRateLimit } from '@@/utils/rate-limit';
import { computeAvailability } from '@@/utils/availability';

const QuerySchema = z.object({
  slug: z.string().min(1).max(64),
  serviceId: z.string().min(1),
  resourceId: z.string().min(1).optional(),
  providerId: z.string().min(1).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
});

export default defineEventHandler(async (event) => {
  const ip = getRequestIP(event, { xForwardedFor: true }) ?? 'unknown';
  const rl = await checkRateLimit(`public-availability:${ip}`, 5, 1);
  if (!rl.ok) {
    setResponseHeader(event, 'Retry-After', String(rl.retryAfterSeconds ?? 1));
    return tooManyRequestsError(event);
  }

  const parsed = QuerySchema.safeParse(getQuery(event));
  if (!parsed.success) return badRequestError(event);

  const result = await computeAvailability(event, parsed.data);
  if (!result.ok) return result.response;

  return successResponse({
    timezone: result.timezone,
    date: result.date,
    slots: result.slots
  });
});
