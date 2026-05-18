// 商家資源：詳情（含關聯服務 id list）
import { defineEventHandler, getRouterParam } from 'h3';
import { prisma } from '@@/utils/prisma';
import { requireMerchant } from '@@/utils/auth';
import { notFoundError, successResponse } from '@@/utils/response';

export default defineEventHandler(async (event) => {
  const auth = requireMerchant(event);
  if ('status' in auth) return auth;

  const id = getRouterParam(event, 'id') ?? '';
  if (!id) return notFoundError(event);

  const r = await prisma.resource.findFirst({
    where: { id, merchantId: auth.merchantId, deletedAt: null },
    include: { services: { select: { serviceId: true } } }
  });
  if (!r) return notFoundError(event);

  return successResponse({
    resource: {
      id: r.id,
      name: r.name,
      description: r.description,
      isActive: r.isActive,
      displayOrder: r.displayOrder,
      serviceIds: r.services.map((s) => s.serviceId),
      createdAt: r.createdAt,
      updatedAt: r.updatedAt
    }
  });
});
