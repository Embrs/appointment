// 商家成員：啟用切換（OWNER only；不能停用自己）
import { defineEventHandler, getRouterParam } from 'h3';
import { prisma } from '@@/utils/prisma';
import { requireMerchant } from '@@/utils/auth';
import {
  badRequestError,
  notFoundError,
  successResponse
} from '@@/utils/response';

const CANT_TOGGLE_SELF = {
  zh_tw: '不能停用自己',
  en: 'You cannot deactivate yourself',
  ja: '自分を無効にすることはできません'
};

export default defineEventHandler(async (event) => {
  const auth = requireMerchant(event, { role: 'OWNER' });
  if ('status' in auth) return auth;

  const id = getRouterParam(event, 'id') ?? '';
  if (!id) return notFoundError(event);
  if (id === auth.sub) return badRequestError(event, CANT_TOGGLE_SELF);

  const existing = await prisma.merchantUser.findFirst({
    where: { id, merchantId: auth.merchantId, deletedAt: null }
  });
  if (!existing) return notFoundError(event);

  const updated = await prisma.merchantUser.update({
    where: { id },
    data: { isActive: !existing.isActive }
  });

  return successResponse({
    user: {
      id: updated.id,
      email: updated.email,
      name: updated.name,
      role: updated.role,
      isActive: updated.isActive,
      updatedAt: updated.updatedAt
    }
  });
});
