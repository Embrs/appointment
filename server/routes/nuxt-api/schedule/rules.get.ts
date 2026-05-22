// 整週時段規則：讀取
import { defineEventHandler, getQuery } from 'h3';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '@@/utils/prisma';
import { requireMerchant } from '@@/utils/auth';
import { badRequestError, successResponse } from '@@/utils/response';

const QuerySchema = z
  .object({
    scope: z.enum(['MERCHANT', 'RESOURCE', 'PROVIDER']).optional(),
    resourceId: z.string().min(1).optional(),
    providerId: z.string().min(1).optional()
  })
  .passthrough();

export default defineEventHandler(async (event) => {
  const auth = await requireMerchant(event);
  if ('status' in auth) return auth;

  const parsed = QuerySchema.safeParse(getQuery(event));
  if (!parsed.success) return badRequestError(event);

  const where: Prisma.ScheduleRuleWhereInput = { merchantId: auth.merchantId };
  if (parsed.data.scope) where.scope = parsed.data.scope;
  if (parsed.data.resourceId !== undefined) where.resourceId = parsed.data.resourceId;
  if (parsed.data.providerId !== undefined) where.providerId = parsed.data.providerId;

  const rules = await prisma.scheduleRule.findMany({
    where,
    orderBy: [{ weekday: 'asc' }, { startTime: 'asc' }]
  });

  return successResponse({
    rules: rules.map((r) => ({
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
