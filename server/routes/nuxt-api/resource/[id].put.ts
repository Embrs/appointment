// 商家資源：更新
import { defineEventHandler, getRouterParam, readBody } from 'h3';
import { z } from 'zod';
import { prisma } from '@@/utils/prisma';
import { requireMerchant } from '@@/utils/auth';
import { badRequestError, notFoundError, successResponse } from '@@/utils/response';

const Schema = z
  .object({
    name: z.string().trim().min(1).max(60).optional(),
    description: z.string().trim().max(500).optional().nullable(),
    isActive: z.boolean().optional(),
    displayOrder: z.number().int().min(0).max(9999).optional()
  })
  .strict();

export default defineEventHandler(async (event) => {
  const auth = requireMerchant(event);
  if ('status' in auth) return auth;

  const id = getRouterParam(event, 'id') ?? '';
  if (!id) return notFoundError(event);

  const existing = await prisma.resource.findFirst({
    where: { id, merchantId: auth.merchantId, deletedAt: null }
  });
  if (!existing) return notFoundError(event);

  const raw = await readBody(event).catch(() => null);
  const parsed = Schema.safeParse(raw);
  if (!parsed.success) return badRequestError(event);

  const r = await prisma.resource.update({
    where: { id },
    data: {
      name: parsed.data.name,
      description: parsed.data.description ?? undefined,
      isActive: parsed.data.isActive,
      displayOrder: parsed.data.displayOrder
    }
  });

  return successResponse({
    resource: {
      id: r.id,
      name: r.name,
      description: r.description,
      isActive: r.isActive,
      displayOrder: r.displayOrder,
      updatedAt: r.updatedAt
    }
  });
});
