// 商家資源：軟刪除
import { defineEventHandler, getRouterParam } from 'h3';
import { prisma } from '@@/utils/prisma';
import { requireMerchant } from '@@/utils/auth';
import { notFoundError, successResponse } from '@@/utils/response';

export default defineEventHandler(async (event) => {
  const auth = await requireMerchant(event);
  if ('status' in auth) return auth;

  const id = getRouterParam(event, 'id') ?? '';
  if (!id) return notFoundError(event);

  const existing = await prisma.resource.findFirst({
    where: { id, merchantId: auth.merchantId, deletedAt: null }
  });
  if (!existing) return notFoundError(event);

  await prisma.resource.update({
    where: { id },
    data: { deletedAt: new Date(), isActive: false }
  });

  return successResponse({ id });
});
