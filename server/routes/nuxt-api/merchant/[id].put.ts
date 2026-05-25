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

const ProviderLabelSchema = z
  .object({
    zh: z.string().trim().min(1).max(20).optional(),
    en: z.string().trim().min(1).max(40).optional(),
    ja: z.string().trim().min(1).max(20).optional()
  })
  .strict();

// 空字串（含純空白）視為 null，避免前端送 "" 觸發 email/max 等驗證 fail
export const nullableString = <T extends z.ZodTypeAny>(inner: T) =>
  z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? null : v),
    inner.nullable().optional()
  );

export const UpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(60).optional(),
    slug: z.string().trim().regex(SLUG_PATTERN).optional(),
    description: nullableString(z.string().trim().max(1000)),
    logoUrl: nullableString(z.string().trim().max(500)),
    coverUrl: nullableString(z.string().trim().max(500)),
    contactPhone: nullableString(z.string().trim().max(40)),
    contactEmail: nullableString(z.string().trim().email().max(120)),
    timezone: z.string().trim().min(1).max(60).optional(),
    address: nullableString(z.string().trim().max(200)),
    cancelPolicy: CancelPolicySchema.optional(),
    maxActiveAppointmentsPerCustomer: z.number().int().min(1).max(99).optional(),
    providerModeEnabled: z.boolean().optional(),
    providerLabel: ProviderLabelSchema.optional()
  })
  .strict();

const SLUG_CONFLICT = {
  zh_tw: '網址已被使用',
  en: 'Slug already taken',
  ja: 'URLスラッグは既に使用されています'
};

export default defineEventHandler(async (event) => {
  const auth = await requireMerchant(event, { role: 'OWNER' });
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

  // providerLabel 採 merge 合併（保留未提及的語言）
  const mergedProviderLabel = data.providerLabel
    ? { ...(merchant.providerLabel as Record<string, unknown> ?? {}), ...data.providerLabel }
    : undefined;

  const updated = await prisma.merchant.update({
    where: { id },
    data: {
      name: data.name,
      slug: data.slug,
      description: data.description,
      logoUrl: data.logoUrl,
      coverUrl: data.coverUrl,
      contactPhone: data.contactPhone,
      contactEmail: data.contactEmail,
      timezone: data.timezone,
      address: data.address,
      cancelPolicy: mergedCancelPolicy,
      maxActiveAppointmentsPerCustomer: data.maxActiveAppointmentsPerCustomer,
      providerModeEnabled: data.providerModeEnabled,
      providerLabel: mergedProviderLabel
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
      maxActiveAppointmentsPerCustomer: updated.maxActiveAppointmentsPerCustomer,
      providerModeEnabled: updated.providerModeEnabled,
      providerLabel: updated.providerLabel,
      updatedAt: updated.updatedAt
    }
  });
});
