// 平台管理員：拒絕商家註冊申請（PENDING → REJECTED）
// reason 寫入 cancelPolicy.rejectReason，保留 cancelPolicy 其他欄位
import { defineEventHandler, getRouterParam, readBody } from 'h3';
import { z } from 'zod';
import { prisma } from '@@/utils/prisma';
import { requireAdmin } from '@@/utils/auth';
import {
  badRequestError,
  conflictError,
  notFoundError,
  successResponse
} from '@@/utils/response';

const RejectSchema = z
  .object({
    reason: z.string().trim().max(200).optional()
  })
  .strict();

const STATUS_CONFLICT = {
  zh_tw: '狀態不允許此操作',
  en: 'Status does not allow this operation',
  ja: '現在の状態では操作できません'
};

export default defineEventHandler(async (event) => {
  const auth = requireAdmin(event);
  if ('status' in auth) return auth;

  const id = getRouterParam(event, 'id') ?? '';
  if (!id) return notFoundError(event);

  const raw = await readBody(event).catch(() => ({}));
  const parsed = RejectSchema.safeParse(raw ?? {});
  if (!parsed.success) return badRequestError(event);

  const merchant = await prisma.merchant.findFirst({ where: { id, deletedAt: null } });
  if (!merchant) return notFoundError(event);
  if (merchant.status !== 'PENDING') return conflictError(event, STATUS_CONFLICT);

  const prevPolicy =
    merchant.cancelPolicy && typeof merchant.cancelPolicy === 'object' && !Array.isArray(merchant.cancelPolicy)
      ? (merchant.cancelPolicy as Record<string, unknown>)
      : {};

  const nextPolicy = {
    ...prevPolicy,
    rejectReason: parsed.data.reason ?? ''
  };

  const updated = await prisma.merchant.update({
    where: { id },
    data: {
      status: 'REJECTED',
      cancelPolicy: nextPolicy
    }
  });
  return successResponse({ id: updated.id, status: updated.status });
});
