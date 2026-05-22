// 商家服務人員：更新
import { defineEventHandler, getRouterParam, readBody } from 'h3';
import { z } from 'zod';
import { prisma } from '@@/utils/prisma';
import { requireMerchant } from '@@/utils/auth';
import { badRequestError, notFoundError, successResponse } from '@@/utils/response';

const Schema = z
  .object({
    name: z.string().trim().min(1).max(60).optional(),
    title: z.string().trim().max(60).optional().nullable(),
    bio: z.string().trim().max(2000).optional().nullable(),
    avatarUrl: z.string().trim().max(500).optional().nullable(),
    isActive: z.boolean().optional(),
    displayOrder: z.number().int().min(0).max(9999).optional()
  })
  .strict();

export default defineEventHandler(async (event) => {
  const auth = requireMerchant(event);
  if ('status' in auth) return auth;

  const id = getRouterParam(event, 'id') ?? '';
  if (!id) return notFoundError(event);

  const existing = await prisma.provider.findFirst({
    where: { id, merchantId: auth.merchantId, deletedAt: null }
  });
  if (!existing) return notFoundError(event);

  const raw = await readBody(event).catch(() => null);
  const parsed = Schema.safeParse(raw);
  if (!parsed.success) return badRequestError(event);

  const p = await prisma.provider.update({
    where: { id },
    data: {
      name: parsed.data.name,
      title: parsed.data.title ?? undefined,
      bio: parsed.data.bio ?? undefined,
      avatarUrl: parsed.data.avatarUrl ?? undefined,
      isActive: parsed.data.isActive,
      displayOrder: parsed.data.displayOrder
    }
  });

  return successResponse({
    provider: {
      id: p.id,
      name: p.name,
      title: p.title,
      bio: p.bio,
      avatarUrl: p.avatarUrl,
      isActive: p.isActive,
      displayOrder: p.displayOrder,
      updatedAt: p.updatedAt
    }
  });
});
