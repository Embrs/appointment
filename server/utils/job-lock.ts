// 排程互斥鎖工具
// 使用 JobLock 表 + Prisma upsert + expiresAt 過期檢查
// 設計：失敗（lock 有效）會回 null，呼叫方需處理 409；成功會回 lockedBy id

import { prisma } from './prisma';

interface AcquireOptions {
  jobName: string;
  ttlMinutes?: number; // 預設 30 分鐘
  lockedBy?: string;   // 預設為 ISO timestamp
}

/**
 * 嘗試取得 JobLock。
 * - 不存在或過期：upsert 寫入新 lock，回 { acquired: true, lockId }
 * - 仍有效：回 { acquired: false, expiresAt }
 */
export const AcquireJobLock = async (opts: AcquireOptions) => {
  const now = new Date();
  const ttl = opts.ttlMinutes ?? 30;
  const expiresAt = new Date(now.getTime() + ttl * 60 * 1000);
  const lockedBy = opts.lockedBy ?? `worker-${now.toISOString()}`;

  // 嘗試取得既有 lock
  const existing = await prisma.jobLock.findUnique({
    where: { jobName: opts.jobName }
  });

  if (existing && existing.expiresAt > now) {
    return { acquired: false as const, expiresAt: existing.expiresAt };
  }

  // 過期或不存在：使用 upsert（按 jobName unique）覆寫
  const lock = await prisma.jobLock.upsert({
    where: { jobName: opts.jobName },
    create: { jobName: opts.jobName, lockedBy, expiresAt },
    update: { lockedBy, lockedAt: now, expiresAt }
  });

  return { acquired: true as const, lockId: lock.id };
};

/** 釋放 JobLock（刪除該筆） */
export const ReleaseJobLock = async (jobName: string) => {
  await prisma.jobLock.deleteMany({ where: { jobName } });
};
