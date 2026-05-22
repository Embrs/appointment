// 平台管理員：新增 AdminUser
import { defineEventHandler, readBody } from 'h3';
import { z } from 'zod';
import { prisma } from '@@/utils/prisma';
import { requireAdmin, hashPassword } from '@@/utils/auth';
import {
  badRequestError,
  conflictError,
  successResponse
} from '@@/utils/response';

const PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*\d).{8,64}$/;

const CreateSchema = z
  .object({
    email: z.string().trim().toLowerCase().email().max(120),
    password: z.string().regex(PASSWORD_PATTERN),
    name: z.string().trim().min(1).max(40)
  })
  .strict();

const EMAIL_CONFLICT = {
  zh_tw: 'Email 已被使用',
  en: 'Email already in use',
  ja: 'このメールアドレスは既に使用されています'
};

const PASSWORD_INVALID = {
  zh_tw: '密碼至少 8 碼且須含字母與數字',
  en: 'Password must be at least 8 chars with letters and digits',
  ja: 'パスワードは英字と数字を含む8文字以上が必要です'
};

export default defineEventHandler(async (event) => {
  const auth = await requireAdmin(event);
  if ('status' in auth) return auth;

  const raw = await readBody(event).catch(() => null);
  const parsed = CreateSchema.safeParse(raw);
  if (!parsed.success) {
    const passwordIssue = parsed.error.issues.find((i) => i.path[0] === 'password');
    if (passwordIssue) return badRequestError(event, PASSWORD_INVALID);
    return badRequestError(event);
  }

  const { email, password, name } = parsed.data;
  const exists = await prisma.adminUser.findUnique({ where: { email } });
  if (exists && !exists.deletedAt) return conflictError(event, EMAIL_CONFLICT);

  const passwordHash = await hashPassword(password);
  const admin = await prisma.adminUser.create({
    data: { email, name, passwordHash, isActive: true },
    select: {
      id: true,
      email: true,
      name: true,
      isActive: true,
      createdAt: true,
      updatedAt: true
    }
  });

  return successResponse({ admin });
});
