// 商家休假日：新增
import { defineEventHandler, readBody } from 'h3';
import { z } from 'zod';
import { prisma } from '@@/utils/prisma';
import { requireMerchant } from '@@/utils/auth';
import {
  badRequestError,
  conflictError,
  successResponse
} from '@@/utils/response';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

const BodySchema = z
  .object({
    date: z.string().regex(DATE),
    name: z.string().trim().min(1).max(60)
  })
  .strict();

const DUPLICATE = {
  zh_tw: '此日期已加入休假',
  en: 'This date is already a holiday',
  ja: 'この日付はすでに休日です'
};

export default defineEventHandler(async (event) => {
  const auth = await requireMerchant(event);
  if ('status' in auth) return auth;

  const raw = await readBody(event).catch(() => null);
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) return badRequestError(event);

  const dateObj = new Date(`${parsed.data.date}T00:00:00.000Z`);
  const existing = await prisma.merchantHoliday.findUnique({
    where: { merchantId_date: { merchantId: auth.merchantId!, date: dateObj } }
  });
  if (existing) return conflictError(event, DUPLICATE);

  const h = await prisma.merchantHoliday.create({
    data: {
      merchantId: auth.merchantId!,
      date: dateObj,
      name: parsed.data.name
    }
  });

  return successResponse({
    holiday: {
      id: h.id,
      date: h.date.toISOString().slice(0, 10),
      name: h.name,
      createdAt: h.createdAt
    }
  });
});
