// 平台管理員：切換 AdminUser.isActive
// 不能停用自己
import { defineEventHandler, getRouterParam } from 'h3';
import { prisma } from '@@/utils/prisma';
import { requireAdmin } from '@@/utils/auth';
import {
  badRequestError,
  notFoundError,
  successResponse
} from '@@/utils/response';

const CANT_TOGGLE_SELF = {
  zh_tw: '不能停用自己',
  en: 'Cannot deactivate yourself',
  ja: '自分自身を無効化できません'
};

export default defineEventHandler(async (event) => {
  const auth = await requireAdmin(event);
  if ('status' in auth) return auth;

  const id = getRouterParam(event, 'id') ?? '';
  if (!id) return notFoundError(event);
  if (id === auth.sub) return badRequestError(event, CANT_TOGGLE_SELF);

  const admin = await prisma.adminUser.findFirst({ where: { id, deletedAt: null } });
  if (!admin) return notFoundError(event);

  const updated = await prisma.adminUser.update({
    where: { id },
    data: { isActive: !admin.isActive },
    select: {
      id: true,
      email: true,
      name: true,
      isActive: true,
      createdAt: true,
      updatedAt: true
    }
  });

  return successResponse({ admin: updated });
});
