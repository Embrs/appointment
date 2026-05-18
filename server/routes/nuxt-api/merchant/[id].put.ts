// 商家自身：更新當前商家資訊；id 必須等於 auth.merchantId
import { defineEventHandler, getRouterParam, readBody } from 'h3';
import { z } from 'zod';
import { prisma } from '@@/utils/prisma';
import { requireMerchant } from '@@/utils/auth';
import {
  badRequestError,
  conflictError,
  forbiddenError,
  notFoundError,
  successResponse
} from '@@/utils/response';

const SLUG_PATTERN = /^[a-z0-9-]{3,50}$/;

const CancelPolicySchema = z
  .object({
    mode: z.enum(['free', 'cutoff']),
    hoursBeforeCannotCancel: z.number().int().min(0).max(168).optional()
  })
  .strict()
  .refine(
    (v) => v.mode === 'free' || (typeof v.hoursBeforeCannotCancel === 'number' && v.hoursBeforeCannotCancel >= 1),
    { message: 'cutoff requires hoursBeforeCannotCancel >= 1' }
  );

const UpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(60).optional(),
    slug: z.string().trim().regex(SLUG_PATTERN).optional(),
    description: z.string().trim().max(1000).optional().nullable(),
    logoUrl: z.string().trim().max(500).optional().nullable(),
    coverUrl: z.string().trim().max(500).optional().nullable(),
    contactPhone: z.string().trim().max(40).optional().nullable(),
    contactEmail: z.string().trim().email().max(120).optional().nullable(),
    timezone: z.string().trim().min(1).max(60).optional(),
    address: z.string().trim().max(200).optional().nullable(),
    cancelPolicy: CancelPolicySchema.optional()
  })
  .strict();

const SLUG_CONFLICT = {
  zh_tw: '網址已被使用',
  en: 'Slug already taken',
  ja: 'URLスラッグは既に使用されています'
};

export default defineEventHandler(async (event) => {
  const auth = requireMerchant(event, { role: 'OWNER' });
  if ('status' in auth) return auth;

  const id = getRouterParam(event, 'id') ?? '';
  if (!id) return notFoundError(event);
  if (id !== auth.merchantId) return forbiddenError(event);

  const raw = await readBody(event).catch(() => null);
  const parsed = UpdateSchema.safeParse(raw);
  if (!parsed.success) return badRequestError(event);

  const merchant = await prisma.merchant.findFirst({ where: { id, deletedAt: null } });
  if (!merchant) return notFoundError(event);

  const data = parsed.data;
  if (data.slug && data.slug !== merchant.slug) {
    const exists = await prisma.merchant.findUnique({ where: { slug: data.slug } });
    if (exists && exists.id !== id) return conflictError(event, SLUG_CONFLICT);
  }

  const mergedCancelPolicy = data.cancelPolicy
    ? { ...(merchant.cancelPolicy as Record<string, unknown> ?? {}), ...data.cancelPolicy }
    : undefined;

  const updated = await prisma.merchant.update({
    where: { id },
    data: {
      name: data.name,
      slug: data.slug,
      description: data.description ?? undefined,
      logoUrl: data.logoUrl ?? undefined,
      coverUrl: data.coverUrl ?? undefined,
      contactPhone: data.contactPhone ?? undefined,
      contactEmail: data.contactEmail ?? undefined,
      timezone: data.timezone,
      address: data.address ?? undefined,
      cancelPolicy: mergedCancelPolicy
    }
  });

  return successResponse({
    merchant: {
      id: updated.id,
      slug: updated.slug,
      name: updated.name,
      description: updated.description,
      logoUrl: updated.logoUrl,
      coverUrl: updated.coverUrl,
      timezone: updated.timezone,
      status: updated.status,
      cancelPolicy: updated.cancelPolicy,
      contactPhone: updated.contactPhone,
      contactEmail: updated.contactEmail,
      address: updated.address,
      updatedAt: updated.updatedAt
    }
  });
});
