// 平台管理員：商家詳情
import { defineEventHandler, getRouterParam } from 'h3';
import { prisma } from '@@/utils/prisma';
import { requireAdmin } from '@@/utils/auth';
import { notFoundError, successResponse } from '@@/utils/response';

export default defineEventHandler(async (event) => {
  const auth = await requireAdmin(event);
  if ('status' in auth) return auth;

  const id = getRouterParam(event, 'id') ?? '';
  if (!id) return notFoundError(event);

  const merchant = await prisma.merchant.findFirst({
    where: { id, deletedAt: null },
    include: {
      users: {
        where: { role: 'OWNER', deletedAt: null },
        select: { id: true, email: true, name: true, isActive: true, role: true, createdAt: true },
        take: 1,
        orderBy: { createdAt: 'asc' }
      }
    }
  });
  if (!merchant) return notFoundError(event);

  const ownerUser = merchant.users[0] ?? null;

  return successResponse({
    merchant: {
      id: merchant.id,
      slug: merchant.slug,
      name: merchant.name,
      description: merchant.description,
      logoUrl: merchant.logoUrl,
      coverUrl: merchant.coverUrl,
      timezone: merchant.timezone,
      status: merchant.status,
      cancelPolicy: merchant.cancelPolicy,
      contactPhone: merchant.contactPhone,
      contactEmail: merchant.contactEmail,
      address: merchant.address,
      createdAt: merchant.createdAt,
      updatedAt: merchant.updatedAt
    },
    ownerUser
  });
});
