// 商家資源：新增
import { defineEventHandler, readBody } from 'h3';
import { z } from 'zod';
import { prisma } from '@@/utils/prisma';
import { requireMerchant } from '@@/utils/auth';
import { badRequestError, successResponse } from '@@/utils/response';

const Schema = z
  .object({
    name: z.string().trim().min(1).max(60),
    description: z.string().trim().max(500).optional().nullable(),
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

  const r = await prisma.resource.create({
    data: {
      merchantId: auth.merchantId!,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      isActive: parsed.data.isActive ?? true,
      displayOrder: parsed.data.displayOrder ?? 0
    }
  });

  return successResponse({
    resource: {
      id: r.id,
      name: r.name,
      description: r.description,
      isActive: r.isActive,
      displayOrder: r.displayOrder,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt
    }
  });
});
