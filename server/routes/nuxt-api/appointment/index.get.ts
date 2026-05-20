// 商家預約列表（filter: 日期範圍、status、resource、service）
import { defineEventHandler, getQuery } from 'h3';
import { z } from 'zod';
import { prisma } from '@@/utils/prisma';
import { requireMerchant } from '@@/utils/auth';
import { badRequestError, successResponse } from '@@/utils/response';

const QuerySchema = z.object({
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  status: z.enum(['CONFIRMED', 'CANCELED', 'NO_SHOW', 'COMPLETED']).optional(),
  serviceId: z.string().min(1).optional(),
  resourceId: z.string().min(1).optional(),
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
  if (q.status) where.status = q.status;
  if (q.serviceId) where.serviceId = q.serviceId;
  if (q.resourceId) where.resourceId = q.resourceId;
  if (q.customerPhone) where.customerPhone = q.customerPhone.replace(/[\s-]/g, '');
  if (q.dateFrom || q.dateTo) {
    const range: Record<string, Date> = {};
    if (q.dateFrom) range.gte = new Date(`${q.dateFrom}T00:00:00Z`);
    if (q.dateTo) range.lt = new Date(new Date(`${q.dateTo}T00:00:00Z`).getTime() + 86400000);
    where.startAt = range;
  }

  const [total, items] = await Promise.all([
    prisma.appointment.count({ where }),
    prisma.appointment.findMany({
      where,
      orderBy: { startAt: 'asc' },
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
      include: {
        service: { select: { id: true, name: true, bookingMode: true, durationMinutes: true } },
        resource: { select: { id: true, name: true } }
      }
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
      service: {
        id: a.service.id,
        name: a.service.name,
        bookingMode: a.service.bookingMode,
        durationMinutes: a.service.durationMinutes
      },
      resource: a.resource ? { id: a.resource.id, name: a.resource.name } : null,
      customerLastName: a.customerLastName,
      customerTitle: a.customerTitle,
      customerPhone: a.customerPhone,
      note: a.note,
      cancelReason: a.cancelReason,
      canceledBy: a.canceledBy,
      canceledAt: a.canceledAt ? a.canceledAt.toISOString() : null,
      createdAt: a.createdAt.toISOString()
    }))
  });
});
