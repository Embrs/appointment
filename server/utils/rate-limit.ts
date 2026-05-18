// 基於 RateLimitBucket 表的固定窗口速率限制
import { prisma } from './prisma';

export interface RateLimitResult {
  ok: boolean;
  /** 達上限時提示客戶端再等多少秒 */
  retryAfterSeconds?: number;
  /** 當前窗口已用次數 */
  count: number;
}

/**
 * 檢查並累加速率計數（固定窗口算法）
 * @param key            業務 key，例如 `lookup:0912345678` 或 `signup-ip:1.2.3.4`
 * @param limit          窗口內允許次數上限
 * @param windowSeconds  窗口長度（秒）
 */
export const checkRateLimit = async (
  key: string,
  limit: number,
  windowSeconds: number
): Promise<RateLimitResult> => {
  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  const windowStart = new Date(Math.floor(now / windowMs) * windowMs);

  // 用 upsert 確保同一窗口同一 key 累加到同一列
  const bucket = await prisma.rateLimitBucket.upsert({
    where: { bucketKey_windowStart: { bucketKey: key, windowStart } },
    update: { count: { increment: 1 } },
    create: { bucketKey: key, windowStart, count: 1 }
  });

  if (bucket.count > limit) {
    const retryAfterSeconds = Math.max(1, Math.ceil((windowStart.getTime() + windowMs - now) / 1000));
    return { ok: false, retryAfterSeconds, count: bucket.count };
  }

  return { ok: true, count: bucket.count };
};
