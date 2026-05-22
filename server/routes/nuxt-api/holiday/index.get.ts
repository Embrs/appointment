// 商家休假日：列表（可選 year 過濾）
import { defineEventHandler, getQuery } from 'h3';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '@@/utils/prisma';
import { requireMerchant } from '@@/utils/auth';
import { badRequestError, successResponse } from '@@/utils/response';

const QuerySchema = z
  .object({
    year: z.coerce.number().int().min(2000).max(2100).optional()
  })
  .passthrough();

export default defineEventHandler(async (event) => {
  const auth = await requireMerchant(event);
  if ('status' in auth) return auth;

  const parsed = QuerySchema.safeParse(getQuery(event));
  if (!parsed.success) return badRequestError(event);

  const where: Prisma.MerchantHolidayWhereInput = { merchantId: auth.merchantId };
  if (parsed.data.year) {
    where.date = {
      gte: new Date(Date.UTC(parsed.data.year, 0, 1)),
      lte: new Date(Date.UTC(parsed.data.year, 11, 31))
    };
  }

  const items = await prisma.merchantHoliday.findMany({
    where,
    orderBy: [{ date: 'asc' }]
  });

  return successResponse({
    items: items.map((h) => ({
      id: h.id,
      date: h.date.toISOString().slice(0, 10),
      name: h.name,
      createdAt: h.createdAt
    }))
  });
});
