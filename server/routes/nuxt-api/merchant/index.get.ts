// 商家自身：取得當前商家完整資訊
import { defineEventHandler } from 'h3';
import { prisma } from '@@/utils/prisma';
import { requireMerchant } from '@@/utils/auth';
import { notFoundError, successResponse } from '@@/utils/response';

export default defineEventHandler(async (event) => {
  const auth = await requireMerchant(event);
  if ('status' in auth) return auth;

  const merchant = await prisma.merchant.findFirst({
    where: { id: auth.merchantId, deletedAt: null }
  });
  if (!merchant) return notFoundError(event);

  return successResponse({
    merchant: {
      id: merchant.id,
      slug: merchant.slug,
      name: merchant.name,
      description: merchant.description,
      logoUrl: merchant.logoUrl,
      coverUrl: merchant.coverUrl,
      timezone: merchant.timezone,
      status: merchant.status,
      cancelPolicy: merchant.cancelPolicy,
      contactPhone: merchant.contactPhone,
      contactEmail: merchant.contactEmail,
      address: merchant.address,
      maxActiveAppointmentsPerCustomer: merchant.maxActiveAppointmentsPerCustomer,
      providerModeEnabled: merchant.providerModeEnabled,
      providerLabel: merchant.providerLabel,
      createdAt: merchant.createdAt,
      updatedAt: merchant.updatedAt
    }
  });
});
