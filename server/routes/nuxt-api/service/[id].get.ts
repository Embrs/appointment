// 商家服務：詳情
import { defineEventHandler, getRouterParam } from 'h3';
import { prisma } from '@@/utils/prisma';
import { requireMerchant } from '@@/utils/auth';
import { notFoundError, successResponse } from '@@/utils/response';

export default defineEventHandler(async (event) => {
  const auth = requireMerchant(event);
  if ('status' in auth) return auth;

  const id = getRouterParam(event, 'id') ?? '';
  if (!id) return notFoundError(event);

  const s = await prisma.service.findFirst({
    where: { id, merchantId: auth.merchantId, deletedAt: null },
    include: { resources: { select: { resourceId: true } } }
  });
  if (!s) return notFoundError(event);

  return successResponse({
    service: {
      id: s.id,
      name: s.name,
      description: s.description,
      bookingMode: s.bookingMode,
      durationMinutes: s.durationMinutes,
      slotIntervalMinutes: s.slotIntervalMinutes,
      capacityPerSlot: s.capacityPerSlot,
      priceCents: s.priceCents,
      isActive: s.isActive,
      displayOrder: s.displayOrder,
      resourceIds: s.resources.map((r) => r.resourceId),
      createdAt: s.createdAt,
      updatedAt: s.updatedAt
    }
  });
});
