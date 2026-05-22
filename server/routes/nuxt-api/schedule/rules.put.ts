// 整週時段規則：整組覆蓋寫入；範圍由 (merchantId, scope, resourceId, providerId) 限定
// PROVIDER scope：每條 rule 可選填 resourceId 作為「該時段預綁診間」
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
    endTime: z.string().regex(HHMM),
    /** 僅 PROVIDER scope 有意義：該時段預綁的診間（選填） */
    resourceId: z.string().min(1).optional().nullable()
  })
  .strict()
  .refine((v) => v.startTime < v.endTime, { message: 'startTime must be less than endTime' });

const BodySchema = z
  .object({
    scope: z.enum(['MERCHANT', 'RESOURCE', 'PROVIDER']),
    /** RESOURCE scope 用於外層範圍鍵；PROVIDER / MERCHANT scope 忽略此欄位 */
    resourceId: z.string().min(1).optional().nullable(),
    /** PROVIDER scope 必填 */
    providerId: z.string().min(1).optional().nullable(),
    rules: z.array(RuleSchema).max(50)
  })
  .strict()
  .refine(
    (v) => (v.scope === 'RESOURCE' ? typeof v.resourceId === 'string' : true),
    { message: 'RESOURCE scope requires resourceId' }
  )
  .refine(
    (v) => (v.scope === 'PROVIDER' ? typeof v.providerId === 'string' : true),
    { message: 'PROVIDER scope requires providerId' }
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
  const { scope, resourceId, providerId, rules } = parsed.data;

  if (scope === 'RESOURCE' && resourceId) {
    const owned = await prisma.resource.findFirst({
      where: { id: resourceId, merchantId: auth.merchantId, deletedAt: null }
    });
    if (!owned) return forbiddenError(event, RESOURCE_BAD);
  }

  if (scope === 'PROVIDER' && providerId) {
    const ownedProvider = await prisma.provider.findFirst({
      where: { id: providerId, merchantId: auth.merchantId, deletedAt: null }
    });
    if (!ownedProvider) return forbiddenError(event, PROVIDER_BAD);

    // PROVIDER scope 的 rule.resourceId 也必須屬該商家
    const ruleResourceIds = Array.from(
      new Set(rules.map((r) => r.resourceId).filter((id): id is string => typeof id === 'string'))
    );
    if (ruleResourceIds.length > 0) {
      const ownedResources = await prisma.resource.findMany({
        where: { id: { in: ruleResourceIds }, merchantId: auth.merchantId, deletedAt: null },
        select: { id: true }
      });
      if (ownedResources.length !== ruleResourceIds.length) {
        return forbiddenError(event, RESOURCE_BAD);
      }
    }
  }

  const targetResourceId = scope === 'RESOURCE' ? resourceId! : null;
  const targetProviderId = scope === 'PROVIDER' ? providerId! : null;

  const result = await prisma.$transaction(async (tx) => {
    await tx.scheduleRule.deleteMany({
      where: {
        merchantId: auth.merchantId,
        scope,
        resourceId: scope === 'PROVIDER' ? undefined : targetResourceId,
        providerId: targetProviderId
      }
    });
    if (rules.length > 0) {
      await tx.scheduleRule.createMany({
        data: rules.map((r) => ({
          merchantId: auth.merchantId!,
          scope,
          // PROVIDER scope：每條規則自身的 resourceId（預綁診間，可選）
          // RESOURCE / MERCHANT scope：用外層 targetResourceId 統一帶入
          resourceId: scope === 'PROVIDER' ? (r.resourceId ?? null) : targetResourceId,
          providerId: targetProviderId,
          weekday: r.weekday,
          startTime: r.startTime,
          endTime: r.endTime
        }))
      });
    }
    return tx.scheduleRule.findMany({
      where: {
        merchantId: auth.merchantId,
        scope,
        resourceId: scope === 'PROVIDER' ? undefined : targetResourceId,
        providerId: targetProviderId
      },
      orderBy: [{ weekday: 'asc' }, { startTime: 'asc' }]
    });
  });

  return successResponse({
    rules: result.map((r) => ({
      id: r.id,
      scope: r.scope,
      resourceId: r.resourceId,
      providerId: r.providerId,
      weekday: r.weekday,
      startTime: r.startTime,
      endTime: r.endTime,
      isActive: r.isActive
    }))
  });
});
