// 特定日期覆寫：列表（可選日期區間）
import { defineEventHandler, getQuery } from 'h3';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '@@/utils/prisma';
import { requireMerchant } from '@@/utils/auth';
import { badRequestError, successResponse } from '@@/utils/response';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

const QuerySchema = z
  .object({
    from: z.string().regex(DATE).optional(),
    to: z.string().regex(DATE).optional(),
    scope: z.enum(['MERCHANT', 'RESOURCE']).optional(),
    resourceId: z.string().min(1).optional()
  })
  .passthrough();

export default defineEventHandler(async (event) => {
  const auth = requireMerchant(event);
  if ('status' in auth) return auth;

  const parsed = QuerySchema.safeParse(getQuery(event));
  if (!parsed.success) return badRequestError(event);
  const { from, to, scope, resourceId } = parsed.data;

  const where: Prisma.ScheduleOverrideWhereInput = { merchantId: auth.merchantId };
  if (scope) where.scope = scope;
  if (resourceId !== undefined) where.resourceId = resourceId;
  if (from || to) {
    where.date = {};
    if (from) (where.date as Record<string, Date>).gte = new Date(`${from}T00:00:00.000Z`);
    if (to) (where.date as Record<string, Date>).lte = new Date(`${to}T00:00:00.000Z`);
  }

  const items = await prisma.scheduleOverride.findMany({
    where,
    orderBy: [{ date: 'asc' }]
  });

  return successResponse({
    items: items.map((o) => ({
      id: o.id,
      scope: o.scope,
      resourceId: o.resourceId,
      date: o.date.toISOString().slice(0, 10),
      startTime: o.startTime,
      endTime: o.endTime,
      isClosed: o.isClosed,
      note: o.note
    }))
  });
});
