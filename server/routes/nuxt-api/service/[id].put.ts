// 商家服務：更新；resourceIds 整組覆蓋
import { defineEventHandler, getRouterParam, readBody } from 'h3';
import { z } from 'zod';
import { prisma } from '@@/utils/prisma';
import { requireMerchant } from '@@/utils/auth';
import {
  badRequestError,
  forbiddenError,
  notFoundError,
  successResponse
} from '@@/utils/response';

const ServiceUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(60).optional(),
    description: z.string().trim().max(1000).optional().nullable(),
    bookingMode: z.enum(['TIME_SLOT', 'TIME_CAPACITY', 'RESOURCE', 'RESOURCE_OPTIONAL', 'QUEUE']).optional(),
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

  const id = getRouterParam(event, 'id') ?? '';
  if (!id) return notFoundError(event);

  const existing = await prisma.service.findFirst({
    where: { id, merchantId: auth.merchantId, deletedAt: null }
  });
  if (!existing) return notFoundError(event);

  const raw = await readBody(event).catch(() => null);
  const parsed = ServiceUpdateSchema.safeParse(raw);
  if (!parsed.success) return badRequestError(event);
  const body = parsed.data;

  const nextMode = body.bookingMode ?? existing.bookingMode;
  const isResourceMode = nextMode === 'RESOURCE' || nextMode === 'RESOURCE_OPTIONAL';

  if (body.resourceIds !== undefined) {
    if (isResourceMode && body.resourceIds.length === 0) {
      return badRequestError(event, RESOURCE_REQUIRED);
    }
    if (body.resourceIds.length > 0) {
      const owned = await prisma.resource.findMany({
        where: { id: { in: body.resourceIds }, merchantId: auth.merchantId, deletedAt: null },
        select: { id: true }
      });
      if (owned.length !== body.resourceIds.length) return forbiddenError(event, RESOURCE_BAD);
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    const s = await tx.service.update({
      where: { id },
      data: {
        name: body.name,
        description: body.description ?? undefined,
        bookingMode: body.bookingMode,
        durationMinutes: body.durationMinutes,
        slotIntervalMinutes: body.slotIntervalMinutes,
        capacityPerSlot: nextMode === 'TIME_CAPACITY' ? body.capacityPerSlot : (nextMode === 'TIME_CAPACITY' ? undefined : (body.capacityPerSlot ?? 1)),
        priceCents: body.priceCents ?? undefined,
        isActive: body.isActive,
        displayOrder: body.displayOrder,
        // QUEUE 才寫入 avgServiceMinutes；切換到非 QUEUE 一律清為 null
        avgServiceMinutes:
          body.avgServiceMinutes !== undefined
            ? (nextMode === 'QUEUE' ? body.avgServiceMinutes : null)
            : (nextMode === 'QUEUE' ? undefined : null)
      }
    });
    if (body.resourceIds !== undefined) {
      await tx.serviceResource.deleteMany({ where: { serviceId: id } });
      if (body.resourceIds.length > 0) {
        await tx.serviceResource.createMany({
          data: body.resourceIds.map((rid) => ({ serviceId: id, resourceId: rid }))
        });
      }
    }
    return s;
  });

  const resourceLinks = await prisma.serviceResource.findMany({
    where: { serviceId: id },
    select: { resourceId: true }
  });

  return successResponse({
    service: {
      id: updated.id,
      name: updated.name,
      description: updated.description,
      bookingMode: updated.bookingMode,
      durationMinutes: updated.durationMinutes,
      slotIntervalMinutes: updated.slotIntervalMinutes,
      capacityPerSlot: updated.capacityPerSlot,
      priceCents: updated.priceCents,
      isActive: updated.isActive,
      displayOrder: updated.displayOrder,
      avgServiceMinutes: updated.avgServiceMinutes,
      resourceIds: resourceLinks.map((r) => r.resourceId),
      updatedAt: updated.updatedAt
    }
  });
});
