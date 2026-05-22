// 平台管理員：商家列表
// 支援 status / keyword 篩選與分頁；列表自帶 OWNER email 摘要
import { defineEventHandler, getQuery } from 'h3';
import { z } from 'zod';
import { prisma } from '@@/utils/prisma';
import { requireAdmin } from '@@/utils/auth';
import { badRequestError, successResponse } from '@@/utils/response';
import type { MerchantStatus, Prisma } from '@prisma/client';

const QuerySchema = z.object({
  status: z.enum(['ALL', 'PENDING', 'ACTIVE', 'SUSPENDED', 'REJECTED']).optional().default('ALL'),
  keyword: z.string().trim().max(60).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(20)
});

// PENDING 優先；其他狀態按字典序自然排列，整體再按 createdAt desc
const STATUS_PRIORITY: Record<MerchantStatus, number> = {
  PENDING: 0,
  ACTIVE: 1,
  SUSPENDED: 2,
  REJECTED: 3
};

export default defineEventHandler(async (event) => {
  const auth = await requireAdmin(event);
  if ('status' in auth) return auth;

  const parsed = QuerySchema.safeParse(getQuery(event));
  if (!parsed.success) return badRequestError(event);
  const { status, keyword, page, pageSize } = parsed.data;

  const where: Prisma.MerchantWhereInput = { deletedAt: null };
  if (status !== 'ALL') where.status = status;
  if (keyword) {
    where.OR = [
      { name: { contains: keyword, mode: 'insensitive' } },
      { slug: { contains: keyword, mode: 'insensitive' } },
      { users: { some: { email: { contains: keyword, mode: 'insensitive' }, deletedAt: null } } }
    ];
  }

  // 取一頁資料；先抓多一點再以 status priority 排序，最後切頁
  // MVP 商家量級不會破萬，client 側 priority 排序成本可忽略
  const [items, total] = await Promise.all([
    prisma.merchant.findMany({
      where,
      include: {
        users: {
          where: { role: 'OWNER', deletedAt: null },
          select: { id: true, email: true, name: true, isActive: true },
          take: 1,
          orderBy: { createdAt: 'asc' }
        }
      },
      orderBy: { createdAt: 'desc' }
    }),
    prisma.merchant.count({ where })
  ]);

  const sorted = items
    .map((m) => ({
      id: m.id,
      name: m.name,
      slug: m.slug,
      status: m.status,
      contactEmail: m.contactEmail,
      contactPhone: m.contactPhone,
      createdAt: m.createdAt,
      ownerEmail: m.users[0]?.email ?? '',
      ownerName: m.users[0]?.name ?? ''
    }))
    .sort((a, b) => {
      const pa = STATUS_PRIORITY[a.status];
      const pb = STATUS_PRIORITY[b.status];
      if (pa !== pb) return pa - pb;
      return b.createdAt.getTime() - a.createdAt.getTime();
    });

  const start = (page - 1) * pageSize;
  const sliced = sorted.slice(start, start + pageSize);

  return successResponse({
    items: sliced,
    total,
    page,
    pageSize
  });
});
