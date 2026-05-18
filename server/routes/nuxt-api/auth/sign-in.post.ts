// 雙身分登入：admin / merchant 走同端點，由 body.type 切換
// 失敗訊息不洩漏「帳號不存在」與「密碼錯誤」差異，統一回 401「帳號或密碼錯誤」
import { defineEventHandler, readBody } from 'h3';
import { z } from 'zod';
import { prisma } from '@@/utils/prisma';
import {
  signToken,
  verifyPassword,
  type AuthPayload
} from '@@/utils/auth';
import {
  badRequestError,
  forbiddenError,
  successResponse,
  unauthorizedError
} from '@@/utils/response';

const SignInSchema = z.object({
  type: z.enum(['admin', 'merchant']),
  email: z.string().email().max(120),
  password: z.string().min(1).max(64)
});

const INVALID_CREDENTIALS = {
  zh_tw: '帳號或密碼錯誤',
  en: 'Invalid email or password',
  ja: 'メールアドレスまたはパスワードが正しくありません'
};

const ACCOUNT_PENDING = {
  zh_tw: '帳號待管理員審核',
  en: 'Account pending admin review',
  ja: '管理者の審査待ち'
};

const ACCOUNT_SUSPENDED = {
  zh_tw: '商家已停用',
  en: 'Merchant is suspended',
  ja: '店舗が停止されました'
};

const ACCOUNT_REJECTED = {
  zh_tw: '註冊申請未通過',
  en: 'Sign-up application was rejected',
  ja: '登録申請が却下されました'
};

export default defineEventHandler(async (event) => {
  const raw = await readBody(event).catch(() => null);
  const parsed = SignInSchema.safeParse(raw);
  if (!parsed.success) return badRequestError(event);

  const { type, email, password } = parsed.data;
  const normalizedEmail = email.trim().toLowerCase();

  if (type === 'admin') {
    const admin = await prisma.adminUser.findUnique({ where: { email: normalizedEmail } });
    if (!admin || !admin.isActive || admin.deletedAt) {
      return unauthorizedError(event, INVALID_CREDENTIALS);
    }
    const ok = await verifyPassword(password, admin.passwordHash);
    if (!ok) return unauthorizedError(event, INVALID_CREDENTIALS);

    const payload: AuthPayload = { type: 'admin', sub: admin.id };
    return successResponse({
      token: signToken(payload),
      type: 'admin' as const,
      userName: admin.name,
      userEmail: admin.email
    });
  }

  // type === 'merchant'
  const user = await prisma.merchantUser.findFirst({
    where: { email: normalizedEmail, deletedAt: null },
    include: { merchant: true }
  });
  if (!user || !user.isActive) {
    return unauthorizedError(event, INVALID_CREDENTIALS);
  }
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) return unauthorizedError(event, INVALID_CREDENTIALS);

  const { merchant } = user;
  if (merchant.deletedAt) return forbiddenError(event, ACCOUNT_SUSPENDED);
  switch (merchant.status) {
    case 'PENDING':
      return forbiddenError(event, ACCOUNT_PENDING);
    case 'SUSPENDED':
      return forbiddenError(event, ACCOUNT_SUSPENDED);
    case 'REJECTED':
      return forbiddenError(event, ACCOUNT_REJECTED);
    case 'ACTIVE':
      break;
    default:
      return forbiddenError(event, ACCOUNT_SUSPENDED);
  }

  const payload: AuthPayload = {
    type: 'merchant',
    sub: user.id,
    merchantId: merchant.id,
    role: user.role
  };
  return successResponse({
    token: signToken(payload),
    type: 'merchant' as const,
    role: user.role,
    merchantId: merchant.id,
    merchantName: merchant.name,
    userName: user.name,
    userEmail: user.email
  });
});
