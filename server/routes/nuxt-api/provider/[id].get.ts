// 商家服務人員：詳情（含關聯服務 id list）
import { defineEventHandler, getRouterParam } from 'h3';
import { prisma } from '@@/utils/prisma';
import { requireMerchant } from '@@/utils/auth';
import { notFoundError, successResponse } from '@@/utils/response';

export default defineEventHandler(async (event) => {
  const auth = await requireMerchant(event);
  if ('status' in auth) return auth;

  const id = getRouterParam(event, 'id') ?? '';
  if (!id) return notFoundError(event);

  const p = await prisma.provider.findFirst({
    where: { id, merchantId: auth.merchantId, deletedAt: null },
    include: { services: { select: { serviceId: true } } }
  });
  if (!p) return notFoundError(event);

  return successResponse({
    provider: {
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
    }
  });
});
