// 平台管理員：AdminUser 列表（不含 passwordHash）
import { defineEventHandler } from 'h3';
import { prisma } from '@@/utils/prisma';
import { requireAdmin } from '@@/utils/auth';
import { successResponse } from '@@/utils/response';

export default defineEventHandler(async (event) => {
  const auth = await requireAdmin(event);
  if ('status' in auth) return auth;

  const items = await prisma.adminUser.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      email: true,
      name: true,
      isActive: true,
      createdAt: true,
      updatedAt: true
    },
    orderBy: { createdAt: 'desc' }
  });

  return successResponse({ items });
});
