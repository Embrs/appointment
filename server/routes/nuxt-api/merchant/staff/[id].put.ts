// 商家成員：編輯（OWNER only）；email 不可改
import { defineEventHandler, getRouterParam, readBody } from 'h3';
import { z } from 'zod';
import { prisma } from '@@/utils/prisma';
import { hashPassword, requireMerchant } from '@@/utils/auth';
import {
  badRequestError,
  notFoundError,
  successResponse
} from '@@/utils/response';

const PASSWORD_RULE = /^(?=.*[A-Za-z])(?=.*\d).{8,64}$/;

const BodySchema = z
  .object({
    name: z.string().trim().min(1).max(40).optional(),
    password: z.string().regex(PASSWORD_RULE).optional(),
    role: z.enum(['OWNER', 'STAFF']).optional()
  })
  .strict();

export default defineEventHandler(async (event) => {
  const auth = requireMerchant(event, { role: 'OWNER' });
  if ('status' in auth) return auth;

  const id = getRouterParam(event, 'id') ?? '';
  if (!id) return notFoundError(event);

  const existing = await prisma.merchantUser.findFirst({
    where: { id, merchantId: auth.merchantId, deletedAt: null }
  });
  if (!existing) return notFoundError(event);

  const raw = await readBody(event).catch(() => null);
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) return badRequestError(event);

  const data: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) data.name = parsed.data.name;
  if (parsed.data.role !== undefined) data.role = parsed.data.role;
  if (parsed.data.password !== undefined) data.passwordHash = await hashPassword(parsed.data.password);

  const updated = await prisma.merchantUser.update({ where: { id }, data });

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
