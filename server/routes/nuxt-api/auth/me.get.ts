// 取當前身分資訊；長期會話保險：商家狀態若已非 ACTIVE，回 401 觸發前端自動登出
import { defineEventHandler } from 'h3';
import { prisma } from '@@/utils/prisma';
import { getAuth } from '@@/utils/auth';
import { successResponse, unauthorizedError } from '@@/utils/response';

export default defineEventHandler(async (event) => {
  const auth = getAuth(event);
  if (!auth) return unauthorizedError(event);

  if (auth.type === 'admin') {
    const admin = await prisma.adminUser.findUnique({ where: { id: auth.sub } });
    if (!admin || !admin.isActive || admin.deletedAt) return unauthorizedError(event);
    return successResponse({
      type: 'admin' as const,
      userName: admin.name,
      userEmail: admin.email
    });
  }

  if (!auth.merchantId) return unauthorizedError(event);
  const user = await prisma.merchantUser.findUnique({
    where: { id: auth.sub },
    include: { merchant: true }
  });
  if (!user || !user.isActive || user.deletedAt) return unauthorizedError(event);
  const merchant = user.merchant;
  if (!merchant || merchant.deletedAt || merchant.status !== 'ACTIVE') {
    return unauthorizedError(event);
  }
  return successResponse({
    type: 'merchant' as const,
    userName: user.name,
    userEmail: user.email,
    merchantId: merchant.id,
    merchantName: merchant.name,
    role: user.role,
    // 由 Change 3 引入：代理 token 才會帶 impersonatedBy；一般登入為 undefined
    impersonatedBy: auth.impersonatedBy
  });
});
