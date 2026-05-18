// 商家自助註冊：同 transaction 建立 Merchant(PENDING) + MerchantUser(OWNER)
// 不簽 JWT、不設 cookie，由前端顯示「待管理員審核」靜態畫面
import { defineEventHandler, readBody } from 'h3';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '@@/utils/prisma';
import { hashPassword } from '@@/utils/auth';
import { badRequestError, conflictError, serverError, successResponse } from '@@/utils/response';

const SignUpSchema = z.object({
  email: z.string().email().max(120),
  password: z
    .string()
    .min(8)
    .max(64)
    .regex(/[A-Za-z]/)
    .regex(/[0-9]/),
  merchantName: z.string().min(1).max(60)
});

const EMAIL_EXISTS = {
  zh_tw: 'Email 已註冊',
  en: 'Email is already registered',
  ja: 'メールアドレスは既に登録されています'
};

const SIGNUP_FAILED = {
  zh_tw: '註冊失敗，請稍後再試',
  en: 'Sign-up failed, please try again later',
  ja: '登録に失敗しました。後でもう一度お試しください'
};

const normalizeLocalPart = (email: string): string => {
  const local = email.split('@')[0] ?? '';
  const slug = local.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return slug || 'merchant';
};

const randomSuffix = (): string =>
  Math.random().toString(36).slice(2, 8).padEnd(6, '0');

export default defineEventHandler(async (event) => {
  const raw = await readBody(event).catch(() => null);
  const parsed = SignUpSchema.safeParse(raw);
  if (!parsed.success) return badRequestError(event);

  const email = parsed.data.email.trim().toLowerCase();
  const merchantName = parsed.data.merchantName.trim();
  const password = parsed.data.password;

  const existing = await prisma.merchantUser.findFirst({ where: { email, deletedAt: null } });
  if (existing) return conflictError(event, EMAIL_EXISTS);

  const passwordHash = await hashPassword(password);
  const baseSlug = normalizeLocalPart(email);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const slug = `${baseSlug}-${randomSuffix()}`;
    try {
      const result = await prisma.$transaction(async (tx) => {
        const merchant = await tx.merchant.create({
          data: { slug, name: merchantName, status: 'PENDING' }
        });
        await tx.merchantUser.create({
          data: {
            merchantId: merchant.id,
            email,
            passwordHash,
            name: merchantName,
            role: 'OWNER'
          }
        });
        return { merchant };
      });
      return successResponse({ pending: true, merchantId: result.merchant.id });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const target = (err.meta?.target ?? []) as string[];
        // slug 衝突 → 重試；email 衝突 → 409
        if (target.some((t) => t.includes('email'))) {
          return conflictError(event, EMAIL_EXISTS);
        }
        continue;
      }
      throw err;
    }
  }

  return serverError(event, SIGNUP_FAILED);
});
