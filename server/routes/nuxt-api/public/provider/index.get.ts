// 公開服務人員列表（不需 token，套 IP rate limit 5/秒）
// 商家 providerModeEnabled=false 時回空陣列（不暴露是否存在）
import { defineEventHandler, getQuery, getRequestIP, setResponseHeader } from 'h3';
import { z } from 'zod';
import { prisma } from '@@/utils/prisma';
import {
  badRequestError,
  notFoundError,
  successResponse,
  tooManyRequestsError
} from '@@/utils/response';
import { checkRateLimit } from '@@/utils/rate-limit';

const QuerySchema = z.object({
  slug: z.string().min(1).max(64).regex(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i)
});

export default defineEventHandler(async (event) => {
  const ip = getRequestIP(event, { xForwardedFor: true }) ?? 'unknown';
  const rl = await checkRateLimit(`public-provider:${ip}`, 5, 1);
  if (!rl.ok) {
    setResponseHeader(event, 'Retry-After', String(rl.retryAfterSeconds ?? 1));
    return tooManyRequestsError(event);
  }

  const parsed = QuerySchema.safeParse(getQuery(event));
  if (!parsed.success) return badRequestError(event);

  const merchant = await prisma.merchant.findFirst({
    where: { slug: parsed.data.slug, status: 'ACTIVE', deletedAt: null },
    select: { id: true, providerModeEnabled: true }
  });
  if (!merchant) return notFoundError(event);

  // 未啟用 Provider 制：回空陣列（不暴露 Provider 是否存在）
  if (!merchant.providerModeEnabled) return successResponse({ items: [] });

  const providers = await prisma.provider.findMany({
    where: { merchantId: merchant.id, isActive: true, deletedAt: null },
    include: { services: { select: { serviceId: true } } },
    orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }]
  });

  return successResponse({
    items: providers.map((p) => ({
      id: p.id,
      name: p.name,
      title: p.title,
      bio: p.bio,
      avatarUrl: p.avatarUrl,
      displayOrder: p.displayOrder,
      serviceIds: p.services.map((s) => s.serviceId)
    }))
  });
});
