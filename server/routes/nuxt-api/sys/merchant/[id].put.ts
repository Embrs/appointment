// 平台管理員：編輯商家基本資料
// 不可改 status（用獨立轉換端點）；不可改 deletedAt
import { defineEventHandler, getRouterParam, readBody } from 'h3';
import { z } from 'zod';
import { prisma } from '@@/utils/prisma';
import { requireAdmin } from '@@/utils/auth';
import {
  badRequestError,
  conflictError,
  notFoundError,
  successResponse
} from '@@/utils/response';

const SLUG_PATTERN = /^[a-z0-9-]{3,50}$/;

const UpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(60).optional(),
    slug: z.string().trim().regex(SLUG_PATTERN).optional(),
    description: z.string().trim().max(1000).optional().nullable(),
    contactPhone: z.string().trim().max(40).optional().nullable(),
    contactEmail: z.string().trim().email().max(120).optional().nullable(),
    timezone: z.string().trim().min(1).max(60).optional(),
    address: z.string().trim().max(200).optional().nullable()
  })
  .strict();

const SLUG_CONFLICT = {
  zh_tw: '網址已被使用',
  en: 'Slug already taken',
  ja: 'URLスラッグは既に使用されています'
};

export default defineEventHandler(async (event) => {
  const auth = requireAdmin(event);
  if ('status' in auth) return auth;

  const id = getRouterParam(event, 'id') ?? '';
  if (!id) return notFoundError(event);

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

  const updated = await prisma.merchant.update({
    where: { id },
    data: {
      name: data.name,
      slug: data.slug,
      description: data.description ?? undefined,
      contactPhone: data.contactPhone ?? undefined,
      contactEmail: data.contactEmail ?? undefined,
      timezone: data.timezone,
      address: data.address ?? undefined
    }
  });

  return successResponse({
    merchant: {
      id: updated.id,
      slug: updated.slug,
      name: updated.name,
      description: updated.description,
      timezone: updated.timezone,
      status: updated.status,
      contactPhone: updated.contactPhone,
      contactEmail: updated.contactEmail,
      address: updated.address,
      updatedAt: updated.updatedAt
    }
  });
});
