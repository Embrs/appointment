// 整週時段規則：整組覆蓋寫入；範圍由 (merchantId, scope, resourceId) 限定
import { defineEventHandler, readBody } from 'h3';
import { z } from 'zod';
import { prisma } from '@@/utils/prisma';
import { requireMerchant } from '@@/utils/auth';
import {
  badRequestError,
  forbiddenError,
  successResponse
} from '@@/utils/response';

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;

const RuleSchema = z
  .object({
    weekday: z.number().int().min(0).max(6),
    startTime: z.string().regex(HHMM),
    endTime: z.string().regex(HHMM)
  })
  .strict()
  .refine((v) => v.startTime < v.endTime, { message: 'startTime must be less than endTime' });

const BodySchema = z
  .object({
    scope: z.enum(['MERCHANT', 'RESOURCE']),
    resourceId: z.string().min(1).optional().nullable(),
    rules: z.array(RuleSchema).max(50)
  })
  .strict()
  .refine(
    (v) => (v.scope === 'RESOURCE' ? typeof v.resourceId === 'string' : true),
    { message: 'RESOURCE scope requires resourceId' }
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
  const { scope, resourceId, rules } = parsed.data;

  if (scope === 'RESOURCE' && resourceId) {
    const owned = await prisma.resource.findFirst({
      where: { id: resourceId, merchantId: auth.merchantId, deletedAt: null }
    });
    if (!owned) return forbiddenError(event, RESOURCE_BAD);
  }

  const targetResourceId = scope === 'RESOURCE' ? resourceId! : null;

  const result = await prisma.$transaction(async (tx) => {
    await tx.scheduleRule.deleteMany({
      where: {
        merchantId: auth.merchantId,
        scope,
        resourceId: targetResourceId
      }
    });
    if (rules.length > 0) {
      await tx.scheduleRule.createMany({
        data: rules.map((r) => ({
          merchantId: auth.merchantId!,
          scope,
          resourceId: targetResourceId,
          weekday: r.weekday,
          startTime: r.startTime,
          endTime: r.endTime
        }))
      });
    }
    return tx.scheduleRule.findMany({
      where: { merchantId: auth.merchantId, scope, resourceId: targetResourceId },
      orderBy: [{ weekday: 'asc' }, { startTime: 'asc' }]
    });
  });

  return successResponse({
    rules: result.map((r) => ({
      id: r.id,
      scope: r.scope,
      resourceId: r.resourceId,
      weekday: r.weekday,
      startTime: r.startTime,
      endTime: r.endTime,
      isActive: r.isActive
    }))
  });
});
