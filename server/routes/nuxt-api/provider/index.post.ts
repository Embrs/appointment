// 商家服務人員：新增
import { defineEventHandler, readBody } from 'h3';
import { z } from 'zod';
import { prisma } from '@@/utils/prisma';
import { requireMerchant } from '@@/utils/auth';
import { badRequestError, successResponse } from '@@/utils/response';

const Schema = z
  .object({
    name: z.string().trim().min(1).max(60),
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

  const raw = await readBody(event).catch(() => null);
  const parsed = Schema.safeParse(raw);
  if (!parsed.success) return badRequestError(event);

  const p = await prisma.provider.create({
    data: {
      merchantId: auth.merchantId!,
      name: parsed.data.name,
      title: parsed.data.title ?? null,
      bio: parsed.data.bio ?? null,
      avatarUrl: parsed.data.avatarUrl ?? null,
      isActive: parsed.data.isActive ?? true,
      displayOrder: parsed.data.displayOrder ?? 0
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
      serviceIds: [],
      createdAt: p.createdAt,
      updatedAt: p.updatedAt
    }
  });
});
