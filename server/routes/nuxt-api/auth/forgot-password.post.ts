// MVP 不寄信，但保留契約：固定 return { sent: true } 避免 email 列舉
// 以來源 IP 套用速率限制（10 分鐘內 5 次）
import { defineEventHandler, getRequestIP, readBody } from 'h3';
import { z } from 'zod';
import { checkRateLimit } from '@@/utils/rate-limit';
import { badRequestError, successResponse, tooManyRequestsError } from '@@/utils/response';

const ForgotSchema = z.object({
  email: z.string().email().max(120)
});

const RATE_LIMITED = {
  zh_tw: '請求過於頻繁，請稍後再試',
  en: 'Too many requests, please try later',
  ja: 'リクエストが多すぎます。しばらくしてからお試しください'
};

export default defineEventHandler(async (event) => {
  const raw = await readBody(event).catch(() => null);
  const parsed = ForgotSchema.safeParse(raw);
  if (!parsed.success) return badRequestError(event);

  const ip = getRequestIP(event, { xForwardedFor: true }) ?? 'unknown';
  const rate = await checkRateLimit(`forgot:${ip}`, 5, 600);
  if (!rate.ok) return tooManyRequestsError(event, RATE_LIMITED);

  // 審計痕跡（MVP 不寄信）；避免將 email 直接 join key 防 log injection
  console.info('[forgot-password] request received', {
    ip,
    emailHashSuffix: parsed.data.email.split('@')[1] ?? ''
  });

  return successResponse({ sent: true });
});
