// 商家服務人員：列表（含 serviceIds aggregation）
import { defineEventHandler } from 'h3';
import { prisma } from '@@/utils/prisma';
import { requireMerchant } from '@@/utils/auth';
import { successResponse } from '@@/utils/response';

export default defineEventHandler(async (event) => {
  const auth = await requireMerchant(event);
  if ('status' in auth) return auth;

  const items = await prisma.provider.findMany({
    where: { merchantId: auth.merchantId, deletedAt: null },
    include: { services: { select: { serviceId: true } } },
    orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }]
  });

  return successResponse({
    items: items.map((p) => ({
      id: p.id,
      name: p.name,
      title: p.title,
      bio: p.bio,
      avatarUrl: p.avatarUrl,
      isActive: p.isActive,
      displayOrder: p.displayOrder,
      serviceIds: p.services.map((s) => s.serviceId),
      createdAt: p.createdAt,
      updatedAt: p.updatedAt
    }))
  });
});
