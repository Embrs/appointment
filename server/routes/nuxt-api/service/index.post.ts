// 商家服務：新增；依 bookingMode 對欄位做語義約束
import { defineEventHandler, readBody } from 'h3';
import { z } from 'zod';
import { prisma } from '@@/utils/prisma';
import { requireMerchant } from '@@/utils/auth';
import {
  badRequestError,
  forbiddenError,
  successResponse
} from '@@/utils/response';

const ServiceCreateSchema = z
  .object({
    name: z.string().trim().min(1).max(60),
    description: z.string().trim().max(1000).optional().nullable(),
    bookingMode: z.enum(['TIME_SLOT', 'TIME_CAPACITY', 'RESOURCE', 'RESOURCE_OPTIONAL', 'QUEUE']),
    durationMinutes: z.number().int().min(5).max(720).optional(),
    slotIntervalMinutes: z.number().int().min(5).max(720).optional(),
    capacityPerSlot: z.number().int().min(1).max(999).optional(),
    priceCents: z.number().int().min(0).max(99_999_999).optional().nullable(),
    isActive: z.boolean().optional(),
    displayOrder: z.number().int().min(0).max(9999).optional(),
    resourceIds: z.array(z.string().min(1)).max(50).optional(),
    avgServiceMinutes: z.number().int().min(0).max(720).nullable().optional()
  })
  .strict();

const RESOURCE_REQUIRED = {
  zh_tw: 'RESOURCE / RESOURCE_OPTIONAL 模式需綁定至少一個資源',
  en: 'RESOURCE or RESOURCE_OPTIONAL mode requires at least one resource',
  ja: 'RESOURCEまたはRESOURCE_OPTIONALモードでは少なくとも1つのリソースが必要です'
};
const RESOURCE_BAD = {
  zh_tw: '資源不存在或不屬於此商家',
  en: 'Resource not found in this merchant',
  ja: 'リソースが見つかりません'
};

export default defineEventHandler(async (event) => {
  const auth = requireMerchant(event);
  if ('status' in auth) return auth;

  const raw = await readBody(event).catch(() => null);
  const parsed = ServiceCreateSchema.safeParse(raw);
  if (!parsed.success) return badRequestError(event);
  const body = parsed.data;

  const isResourceMode =
    body.bookingMode === 'RESOURCE' || body.bookingMode === 'RESOURCE_OPTIONAL';
  const resourceIds = body.resourceIds ?? [];

  if (isResourceMode && resourceIds.length === 0) {
    return badRequestError(event, RESOURCE_REQUIRED);
  }

  if (resourceIds.length > 0) {
    const owned = await prisma.resource.findMany({
      where: { id: { in: resourceIds }, merchantId: auth.merchantId, deletedAt: null },
      select: { id: true }
    });
    if (owned.length !== resourceIds.length) return forbiddenError(event, RESOURCE_BAD);
  }

  // 依 bookingMode 收斂欄位
  const capacityPerSlot = body.bookingMode === 'TIME_CAPACITY' ? (body.capacityPerSlot ?? 1) : 1;
  const durationMinutes = body.bookingMode === 'QUEUE' ? 30 : (body.durationMinutes ?? 30);
  const slotIntervalMinutes = body.bookingMode === 'QUEUE' ? 30 : (body.slotIntervalMinutes ?? 30);

  // QUEUE 模式才接受 avgServiceMinutes；其他模式一律 null（避免誤用）
  const avgServiceMinutes =
    body.bookingMode === 'QUEUE' ? (body.avgServiceMinutes ?? null) : null;

  const created = await prisma.$transaction(async (tx) => {
    const s = await tx.service.create({
      data: {
        merchantId: auth.merchantId!,
        name: body.name,
        description: body.description ?? null,
        bookingMode: body.bookingMode,
        durationMinutes,
        slotIntervalMinutes,
        capacityPerSlot,
        priceCents: body.priceCents ?? null,
        isActive: body.isActive ?? true,
        displayOrder: body.displayOrder ?? 0,
        avgServiceMinutes
      }
    });
    if (isResourceMode && resourceIds.length > 0) {
      await tx.serviceResource.createMany({
        data: resourceIds.map((rid) => ({ serviceId: s.id, resourceId: rid }))
      });
    }
    return s;
  });

  return successResponse({
    service: {
      id: created.id,
      name: created.name,
      bookingMode: created.bookingMode,
      durationMinutes: created.durationMinutes,
      slotIntervalMinutes: created.slotIntervalMinutes,
      capacityPerSlot: created.capacityPerSlot,
      priceCents: created.priceCents,
      isActive: created.isActive,
      displayOrder: created.displayOrder,
      avgServiceMinutes: created.avgServiceMinutes,
      resourceIds: isResourceMode ? resourceIds : []
    }
  });
});
