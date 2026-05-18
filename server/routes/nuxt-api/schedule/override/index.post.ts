// 特定日期覆寫：新增或更新（upsert by date+scope+resourceId）
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
    scope: z.enum(['MERCHANT', 'RESOURCE']),
    resourceId: z.string().min(1).optional().nullable(),
    date: z.string().regex(DATE),
    startTime: z.string().regex(HHMM).optional().nullable(),
    endTime: z.string().regex(HHMM).optional().nullable(),
    isClosed: z.boolean().optional(),
    note: z.string().trim().max(200).optional().nullable()
  })
  .strict()
  .refine(
    (v) => v.scope === 'MERCHANT' || typeof v.resourceId === 'string',
    { message: 'RESOURCE scope requires resourceId' }
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

export default defineEventHandler(async (event) => {
  const auth = requireMerchant(event);
  if ('status' in auth) return auth;

  const raw = await readBody(event).catch(() => null);
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) return badRequestError(event);
  const { scope, resourceId, date, startTime, endTime, isClosed, note } = parsed.data;

  if (scope === 'RESOURCE' && resourceId) {
    const owned = await prisma.resource.findFirst({
      where: { id: resourceId, merchantId: auth.merchantId, deletedAt: null }
    });
    if (!owned) return forbiddenError(event, RESOURCE_BAD);
  }

  const dateObj = new Date(`${date}T00:00:00.000Z`);
  const targetResourceId = scope === 'RESOURCE' ? resourceId! : null;

  // 沒有 unique constraint，先 findFirst 後 upsert
  const existing = await prisma.scheduleOverride.findFirst({
    where: {
      merchantId: auth.merchantId,
      scope,
      resourceId: targetResourceId,
      date: dateObj
    }
  });

  const upserted = existing
    ? await prisma.scheduleOverride.update({
      where: { id: existing.id },
      data: {
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
      date: upserted.date.toISOString().slice(0, 10),
      startTime: upserted.startTime,
      endTime: upserted.endTime,
      isClosed: upserted.isClosed,
      note: upserted.note
    }
  });
});
