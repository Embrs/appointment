// 商家預約歷史紀錄（讀 AppointmentArchive）
import { defineEventHandler, getQuery } from 'h3';
import { z } from 'zod';
import { prisma } from '@@/utils/prisma';
import { requireMerchant } from '@@/utils/auth';
import { badRequestError, successResponse } from '@@/utils/response';

const QuerySchema = z.object({
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  customerPhone: z.string().min(1).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50)
});

export default defineEventHandler(async (event) => {
  const auth = requireMerchant(event);
  if ('status' in auth) return auth;

  const parsed = QuerySchema.safeParse(getQuery(event));
  if (!parsed.success) return badRequestError(event);
  const q = parsed.data;

  const where: Record<string, unknown> = { merchantId: auth.merchantId };
  if (q.customerPhone) where.customerPhone = q.customerPhone.replace(/[\s-]/g, '');
  if (q.dateFrom || q.dateTo) {
    const range: Record<string, Date> = {};
    if (q.dateFrom) range.gte = new Date(`${q.dateFrom}T00:00:00Z`);
    if (q.dateTo) range.lt = new Date(new Date(`${q.dateTo}T00:00:00Z`).getTime() + 86400000);
    where.startAt = range;
  }

  const [total, items] = await Promise.all([
    prisma.appointmentArchive.count({ where }),
    prisma.appointmentArchive.findMany({
      where,
      orderBy: { startAt: 'desc' },
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize
    })
  ]);

  return successResponse({
    total,
    page: q.page,
    pageSize: q.pageSize,
    items: items.map((a) => ({
      id: a.id,
      mode: a.mode,
      status: a.status,
      startAt: a.startAt.toISOString(),
      endAt: a.endAt.toISOString(),
      serviceId: a.serviceId,
      resourceId: a.resourceId,
      customerLastName: a.customerLastName,
      customerTitle: a.customerTitle,
      customerPhone: a.customerPhone,
      note: a.note,
      cancelReason: a.cancelReason,
      canceledBy: a.canceledBy,
      canceledAt: a.canceledAt ? a.canceledAt.toISOString() : null,
      archivedAt: a.archivedAt.toISOString()
    }))
  });
});
