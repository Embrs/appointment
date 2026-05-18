// 商家資源：列表
import { defineEventHandler } from 'h3';
import { prisma } from '@@/utils/prisma';
import { requireMerchant } from '@@/utils/auth';
import { successResponse } from '@@/utils/response';

export default defineEventHandler(async (event) => {
  const auth = requireMerchant(event);
  if ('status' in auth) return auth;

  const items = await prisma.resource.findMany({
    where: { merchantId: auth.merchantId, deletedAt: null },
    orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }]
  });

  return successResponse({
    items: items.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      isActive: r.isActive,
      displayOrder: r.displayOrder,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt
    }))
  });
});
