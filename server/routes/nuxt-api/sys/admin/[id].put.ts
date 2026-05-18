// 平台管理員：編輯 AdminUser
// email 不可改（避免身分混淆）；password 留空表示不變
import { defineEventHandler, getRouterParam, readBody } from 'h3';
import { z } from 'zod';
import { prisma } from '@@/utils/prisma';
import { requireAdmin, hashPassword } from '@@/utils/auth';
import {
  badRequestError,
  notFoundError,
  successResponse
} from '@@/utils/response';

const PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*\d).{8,64}$/;

const UpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(40).optional(),
    password: z.string().regex(PASSWORD_PATTERN).optional()
  })
  .strict();

const PASSWORD_INVALID = {
  zh_tw: '密碼至少 8 碼且須含字母與數字',
  en: 'Password must be at least 8 chars with letters and digits',
  ja: 'パスワードは英字と数字を含む8文字以上が必要です'
};

export default defineEventHandler(async (event) => {
  const auth = requireAdmin(event);
  if ('status' in auth) return auth;

  const id = getRouterParam(event, 'id') ?? '';
  if (!id) return notFoundError(event);

  const raw = await readBody(event).catch(() => null);
  const parsed = UpdateSchema.safeParse(raw);
  if (!parsed.success) {
    const passwordIssue = parsed.error.issues.find((i) => i.path[0] === 'password');
    if (passwordIssue) return badRequestError(event, PASSWORD_INVALID);
    return badRequestError(event);
  }

  const admin = await prisma.adminUser.findFirst({ where: { id, deletedAt: null } });
  if (!admin) return notFoundError(event);

  const data: { name?: string; passwordHash?: string } = {};
  if (parsed.data.name !== undefined) data.name = parsed.data.name;
  if (parsed.data.password !== undefined) data.passwordHash = await hashPassword(parsed.data.password);

  const updated = await prisma.adminUser.update({
    where: { id },
    data,
    select: {
      id: true,
      email: true,
      name: true,
      isActive: true,
      createdAt: true,
      updatedAt: true
    }
  });

  return successResponse({ admin: updated });
});
