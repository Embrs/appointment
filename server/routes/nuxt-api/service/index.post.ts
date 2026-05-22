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
    avgServiceMinutes: z.number().int().min(0).max(720).nullable().optional(),
    requiresProvider: z.boolean().optional(),
    providerIds: z.array(z.string().min(1)).max(50).optional()
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
const PROVIDER_REQUIRED = {
  zh_tw: '啟用「需指定服務人員」時必須選擇至少一位',
  en: 'When "Requires provider" is enabled, pick at least one provider',
  ja: '「スタッフ指定」を有効にする場合、少なくとも 1 名選択してください'
};
const PROVIDER_BAD = {
  zh_tw: '服務人員不存在或不屬於此商家',
  en: 'Provider not found in this merchant',
  ja: 'スタッフが見つかりません'
};

export default defineEventHandler(async (event) => {
  const auth = requireMerchant(event);
  if ('status' in auth) return auth;

  const raw = await readBody(event).catch(() => null);
  const parsed = ServiceCreateSchema.safeParse(raw);
  if (!parsed.success) return badRequestError(event);
  const body = parsed.data;

  // RESOURCE / RESOURCE_OPTIONAL：必須綁至少一個 resource；QUEUE：可選綁（空陣列維持單號池）；其他模式：不寫 ServiceResource
  const isResourceRequiredMode =
    body.bookingMode === 'RESOURCE' || body.bookingMode === 'RESOURCE_OPTIONAL';
  const acceptsResources = isResourceRequiredMode || body.bookingMode === 'QUEUE';
  const resourceIds = body.resourceIds ?? [];

  if (isResourceRequiredMode && resourceIds.length === 0) {
    return badRequestError(event, RESOURCE_REQUIRED);
  }

  if (resourceIds.length > 0) {
    const owned = await prisma.resource.findMany({
      where: { id: { in: resourceIds }, merchantId: auth.merchantId, deletedAt: null },
      select: { id: true }
    });
    if (owned.length !== resourceIds.length) return forbiddenError(event, RESOURCE_BAD);
  }

  // Provider 驗證：requiresProvider=true 時必須帶非空 providerIds，且都屬該商家
  const requiresProvider = body.requiresProvider ?? false;
  const providerIds = Array.from(new Set(body.providerIds ?? []));
  if (requiresProvider && providerIds.length === 0) {
    return badRequestError(event, PROVIDER_REQUIRED);
  }
  if (providerIds.length > 0) {
    const ownedProviders = await prisma.provider.findMany({
      where: { id: { in: providerIds }, merchantId: auth.merchantId, deletedAt: null },
      select: { id: true }
    });
    if (ownedProviders.length !== providerIds.length) return forbiddenError(event, PROVIDER_BAD);
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
        avgServiceMinutes,
        requiresProvider
      }
    });
    if (acceptsResources && resourceIds.length > 0) {
      await tx.serviceResource.createMany({
        data: resourceIds.map((rid) => ({ serviceId: s.id, resourceId: rid }))
      });
    }
    if (providerIds.length > 0) {
      await tx.providerService.createMany({
        data: providerIds.map((pid) => ({ serviceId: s.id, providerId: pid }))
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
      requiresProvider: created.requiresProvider,
      resourceIds: acceptsResources ? resourceIds : [],
      providerIds
    }
  });
});
