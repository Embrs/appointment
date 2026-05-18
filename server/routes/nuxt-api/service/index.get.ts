// 商家服務：列表
import { defineEventHandler } from 'h3';
import { prisma } from '@@/utils/prisma';
import { requireMerchant } from '@@/utils/auth';
import { successResponse } from '@@/utils/response';

export default defineEventHandler(async (event) => {
  const auth = requireMerchant(event);
  if ('status' in auth) return auth;

  const services = await prisma.service.findMany({
    where: { merchantId: auth.merchantId, deletedAt: null },
    include: {
      resources: { select: { resourceId: true } }
    },
    orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }]
  });

  return successResponse({
    items: services.map((s) => ({
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
    }))
  });
});
