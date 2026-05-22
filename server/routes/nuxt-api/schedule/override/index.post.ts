// 特定日期覆寫：新增或更新（upsert by date+scope+resourceId+providerId）
// PROVIDER scope：providerId 必填；resourceId 為該日預綁診間（選填）
import { defineEventHandler, readBody } from 'h3';
import { z } from 'zod';
import { prisma } from '@@/utils/prisma';
import { requireMerchant } from '@@/utils/auth';
import {
  badRequestError,
  forbiddenError,
  successResponse
} from '@@/utils/response';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;

const BodySchema = z
  .object({
    scope: z.enum(['MERCHANT', 'RESOURCE', 'PROVIDER']),
    resourceId: z.string().min(1).optional().nullable(),
    providerId: z.string().min(1).optional().nullable(),
    date: z.string().regex(DATE),
    startTime: z.string().regex(HHMM).optional().nullable(),
    endTime: z.string().regex(HHMM).optional().nullable(),
    isClosed: z.boolean().optional(),
    note: z.string().trim().max(200).optional().nullable()
  })
  .strict()
  .refine(
    (v) => v.scope !== 'RESOURCE' || typeof v.resourceId === 'string',
    { message: 'RESOURCE scope requires resourceId' }
  )
  .refine(
    (v) => v.scope !== 'PROVIDER' || typeof v.providerId === 'string',
    { message: 'PROVIDER scope requires providerId' }
  )
  .refine(
    (v) => v.isClosed === true || (v.startTime && v.endTime && v.startTime < v.endTime),
    { message: 'Open override requires startTime < endTime' }
  );

const RESOURCE_BAD = {
  zh_tw: '資源不存在或不屬於此商家',
  en: 'Resource not found in this merchant',
  ja: 'リソースが見つかりません'
};
const PROVIDER_BAD = {
  zh_tw: '服務人員不存在或不屬於此商家',
  en: 'Provider not found in this merchant',
  ja: 'スタッフが見つかりません'
};

export default defineEventHandler(async (event) => {
  const auth = await requireMerchant(event);
  if ('status' in auth) return auth;

  const raw = await readBody(event).catch(() => null);
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) return badRequestError(event);
  const { scope, resourceId, providerId, date, startTime, endTime, isClosed, note } = parsed.data;

  if (scope === 'RESOURCE' && resourceId) {
    const owned = await prisma.resource.findFirst({
      where: { id: resourceId, merchantId: auth.merchantId, deletedAt: null }
    });
    if (!owned) return forbiddenError(event, RESOURCE_BAD);
  }

  if (scope === 'PROVIDER') {
    if (providerId) {
      const ownedProvider = await prisma.provider.findFirst({
        where: { id: providerId, merchantId: auth.merchantId, deletedAt: null }
      });
      if (!ownedProvider) return forbiddenError(event, PROVIDER_BAD);
    }
    // PROVIDER scope 的 resourceId 為預綁診間（選填）；若帶必須屬該商家
    if (resourceId) {
      const ownedResource = await prisma.resource.findFirst({
        where: { id: resourceId, merchantId: auth.merchantId, deletedAt: null }
      });
      if (!ownedResource) return forbiddenError(event, RESOURCE_BAD);
    }
  }

  const dateObj = new Date(`${date}T00:00:00.000Z`);
  // 範圍鍵：MERCHANT → 兩個 null；RESOURCE → resourceId 帶值、providerId null；PROVIDER → providerId 帶值，resourceId 可為預綁
  const targetResourceId =
    scope === 'RESOURCE' ? resourceId! : scope === 'PROVIDER' ? (resourceId ?? null) : null;
  const targetProviderId = scope === 'PROVIDER' ? providerId! : null;

  // 沒有 unique constraint，先 findFirst 後 upsert
  const existing = await prisma.scheduleOverride.findFirst({
    where: {
      merchantId: auth.merchantId,
      scope,
      // upsert 鍵：PROVIDER scope 以 (scope, providerId, date) 唯一；resourceId 為「同一條目可改」，不參與比對
      resourceId: scope === 'PROVIDER' ? undefined : targetResourceId,
      providerId: targetProviderId,
      date: dateObj
    }
  });

  const upserted = existing
    ? await prisma.scheduleOverride.update({
      where: { id: existing.id },
      data: {
        resourceId: scope === 'PROVIDER' ? (resourceId ?? null) : existing.resourceId,
        startTime: startTime ?? null,
        endTime: endTime ?? null,
        isClosed: isClosed ?? false,
        note: note ?? null
      }
    })
    : await prisma.scheduleOverride.create({
      data: {
        merchantId: auth.merchantId!,
        scope,
        resourceId: targetResourceId,
        providerId: targetProviderId,
        date: dateObj,
        startTime: startTime ?? null,
        endTime: endTime ?? null,
        isClosed: isClosed ?? false,
        note: note ?? null
      }
    });

  return successResponse({
    override: {
      id: upserted.id,
      scope: upserted.scope,
      resourceId: upserted.resourceId,
      providerId: upserted.providerId,
      date: upserted.date.toISOString().slice(0, 10),
      startTime: upserted.startTime,
      endTime: upserted.endTime,
      isClosed: upserted.isClosed,
      note: upserted.note
    }
  });
});
