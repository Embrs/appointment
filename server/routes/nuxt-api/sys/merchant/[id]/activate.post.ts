// 平台管理員：解除停用（SUSPENDED → ACTIVE）
// PENDING 不可走此端點（必須走 approve.post.ts）
import { defineEventHandler, getRouterParam } from 'h3';
import { prisma } from '@@/utils/prisma';
import { requireAdmin } from '@@/utils/auth';
import { conflictError, notFoundError, successResponse } from '@@/utils/response';

const STATUS_CONFLICT = {
  zh_tw: '狀態不允許此操作',
  en: 'Status does not allow this operation',
  ja: '現在の状態では操作できません'
};

export default defineEventHandler(async (event) => {
  const auth = requireAdmin(event);
  if ('status' in auth) return auth;

  const id = getRouterParam(event, 'id') ?? '';
  if (!id) return notFoundError(event);

  const merchant = await prisma.merchant.findFirst({ where: { id, deletedAt: null } });
  if (!merchant) return notFoundError(event);
  if (merchant.status !== 'SUSPENDED') return conflictError(event, STATUS_CONFLICT);

  const updated = await prisma.merchant.update({
    where: { id },
    data: { status: 'ACTIVE' }
  });
  return successResponse({ id: updated.id, status: updated.status });
});
