// 商家成員：列表
import { defineEventHandler } from 'h3';
import { prisma } from '@@/utils/prisma';
import { requireMerchant } from '@@/utils/auth';
import { successResponse } from '@@/utils/response';

export default defineEventHandler(async (event) => {
  const auth = requireMerchant(event);
  if ('status' in auth) return auth;

  const items = await prisma.merchantUser.findMany({
    where: { merchantId: auth.merchantId, deletedAt: null },
    orderBy: [{ createdAt: 'asc' }]
  });

  return successResponse({
    items: items.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      isActive: u.isActive,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt
    }))
  });
});
