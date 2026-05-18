// 商家成員：新增（OWNER only）
import { defineEventHandler, readBody } from 'h3';
import { z } from 'zod';
import { prisma } from '@@/utils/prisma';
import { hashPassword, requireMerchant } from '@@/utils/auth';
import {
  badRequestError,
  conflictError,
  successResponse
} from '@@/utils/response';

const PASSWORD_RULE = /^(?=.*[A-Za-z])(?=.*\d).{8,64}$/;

const BodySchema = z
  .object({
    email: z.string().trim().email().max(120),
    password: z.string().regex(PASSWORD_RULE),
    name: z.string().trim().min(1).max(40),
    role: z.enum(['OWNER', 'STAFF']).optional()
  })
  .strict();

const EMAIL_TAKEN = {
  zh_tw: 'Email 已被使用',
  en: 'Email already exists in this merchant',
  ja: 'このメールアドレスはすでに使用されています'
};

export default defineEventHandler(async (event) => {
  const auth = requireMerchant(event, { role: 'OWNER' });
  if ('status' in auth) return auth;

  const raw = await readBody(event).catch(() => null);
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) return badRequestError(event);

  const email = parsed.data.email.toLowerCase();
  const exists = await prisma.merchantUser.findUnique({
    where: { merchantId_email: { merchantId: auth.merchantId!, email } }
  });
  if (exists && !exists.deletedAt) return conflictError(event, EMAIL_TAKEN);

  const passwordHash = await hashPassword(parsed.data.password);
  const created = await prisma.merchantUser.create({
    data: {
      merchantId: auth.merchantId!,
      email,
      passwordHash,
      name: parsed.data.name,
      role: parsed.data.role ?? 'STAFF',
      isActive: true
    }
  });

  return successResponse({
    user: {
      id: created.id,
      email: created.email,
      name: created.name,
      role: created.role,
      isActive: created.isActive,
      createdAt: created.createdAt
    }
  });
});
