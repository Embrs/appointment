// 平台管理員：代理進入商家後台
// 簽 30 分鐘 TTL 的商家 JWT，payload 含 impersonatedBy: adminId
// 來源 token 若已是代理 token（impersonatedBy 已有值）一律拒絕，避免代理鏈
import { defineEventHandler, getRouterParam } from 'h3';
import { prisma } from '@@/utils/prisma';
import { requireAdmin, signToken, type AuthPayload } from '@@/utils/auth';
import {
  conflictError,
  forbiddenError,
  notFoundError,
  successResponse
} from '@@/utils/response';

const IMPERSONATION_TTL_SECONDS = 30 * 60; // 30 分鐘

const FORBIDDEN_CHAIN = {
  zh_tw: '無權執行此操作',
  en: 'Forbidden',
  ja: 'この操作を実行する権限がありません'
};

const MERCHANT_NOT_ACTIVE = {
  zh_tw: '無法代理非啟用商家',
  en: 'Cannot impersonate non-active merchant',
  ja: '稼働中以外の店舗は代理できません'
};

const NO_OWNER = {
  zh_tw: '商家無啟用中的 OWNER',
  en: 'Merchant has no active OWNER',
  ja: 'オーナーが存在しません'
};

export default defineEventHandler(async (event) => {
  const auth = requireAdmin(event);
  if ('status' in auth) return auth;

  // 拒絕代理鏈：來源 token 已是代理
  if (auth.impersonatedBy) return forbiddenError(event, FORBIDDEN_CHAIN);

  const id = getRouterParam(event, 'id') ?? '';
  if (!id) return notFoundError(event);

  const merchant = await prisma.merchant.findFirst({
    where: { id, deletedAt: null },
    include: {
      users: {
        where: { role: 'OWNER', isActive: true, deletedAt: null },
        orderBy: { createdAt: 'asc' },
        take: 1
      }
    }
  });
  if (!merchant) return notFoundError(event);
  if (merchant.status !== 'ACTIVE') return conflictError(event, MERCHANT_NOT_ACTIVE);

  const owner = merchant.users[0];
  if (!owner) return conflictError(event, NO_OWNER);

  const payload: AuthPayload = {
    type: 'merchant',
    sub: owner.id,
    merchantId: merchant.id,
    role: 'OWNER',
    impersonatedBy: auth.sub
  };
  const token = signToken(payload, IMPERSONATION_TTL_SECONDS);

  return successResponse({
    token,
    merchantId: merchant.id,
    merchantName: merchant.name,
    ownerUserId: owner.id,
    ownerName: owner.name,
    ownerEmail: owner.email,
    expiresInSeconds: IMPERSONATION_TTL_SECONDS
  });
});
