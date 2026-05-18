// 排程歸檔 cron 端點
// - header `x-cron-secret` 驗證
// - JobLock 互斥鎖
// - 事務批次（500/batch）搬 90 天前 Appointment → AppointmentArchive
// - 清理 30 天前 QueueCounter、1 小時前 RateLimitBucket
// 觸發：cron-job.org 每日 04:00 UTC

import { defineEventHandler, getHeader } from 'h3';
import { prisma } from '@@/utils/prisma';
import { successResponse, unauthorizedError, conflictError, serverError } from '@@/utils/response';
import { AcquireJobLock, ReleaseJobLock } from '@@/utils/job-lock';

const JOB_NAME = 'archive-appointments';
const APPOINTMENT_RETENTION_DAYS = 90;
const QUEUE_COUNTER_RETENTION_DAYS = 30;
const RATE_LIMIT_RETENTION_HOURS = 1;
const BATCH_SIZE = 500;

export default defineEventHandler(async (event) => {
  // 1. 驗證 secret
  const secret = getHeader(event, 'x-cron-secret');
  const expected = process.env.CRON_SECRET;
  if (!expected || secret !== expected) {
    return unauthorizedError(event, {
      zh_tw: '無效的 cron 密鑰',
      en: 'Invalid cron secret',
      ja: '無効な cron シークレット'
    });
  }

  // 2. 取得 JobLock
  const lock = await AcquireJobLock({ jobName: JOB_NAME, ttlMinutes: 30 });
  if (!lock.acquired) {
    return conflictError(event, {
      zh_tw: '歸檔任務正在執行中',
      en: 'Archive job is already running',
      ja: 'アーカイブジョブが実行中です'
    });
  }

  const startedAt = Date.now();
  let archived = 0;
  let queueCounterDeleted = 0;
  let rateLimitDeleted = 0;

  try {
    // 3. 批次搬 Appointment → AppointmentArchive
    const cutoff = new Date(Date.now() - APPOINTMENT_RETENTION_DAYS * 86400_000);

     
    while (true) {
      // 抓一批過期 Appointment
      const batch = await prisma.appointment.findMany({
        where: { startAt: { lt: cutoff } },
        take: BATCH_SIZE
      });
      if (batch.length === 0) break;

      // 事務內：寫入 archive、刪除原表
      const ids = batch.map((a) => a.id);
      await prisma.$transaction([
        prisma.appointmentArchive.createMany({
          data: batch.map((a) => ({
            id: a.id,
            merchantId: a.merchantId,
            serviceId: a.serviceId,
            resourceId: a.resourceId,
            mode: a.mode,
            status: a.status,
            startAt: a.startAt,
            endAt: a.endAt,
            customerLastName: a.customerLastName,
            customerTitle: a.customerTitle,
            customerPhone: a.customerPhone,
            note: a.note,
            cancelReason: a.cancelReason,
            canceledAt: a.canceledAt,
            canceledBy: a.canceledBy,
            createdAt: a.createdAt,
            updatedAt: a.updatedAt
          })),
          skipDuplicates: true
        }),
        prisma.appointment.deleteMany({
          where: { id: { in: ids } }
        })
      ]);
      archived += batch.length;

      // 若 batch 數 < BATCH_SIZE，下一輪會抓到 0 並退出
      if (batch.length < BATCH_SIZE) break;
    }

    // 4. 清理過期 QueueCounter（30 天前）
    const queueCutoff = new Date(Date.now() - QUEUE_COUNTER_RETENTION_DAYS * 86400_000);
    const queueResult = await prisma.queueCounter.deleteMany({
      where: { counterDate: { lt: queueCutoff } }
    });
    queueCounterDeleted = queueResult.count;

    // 5. 清理過期 RateLimitBucket（1 小時前）
    const rateLimitCutoff = new Date(Date.now() - RATE_LIMIT_RETENTION_HOURS * 3600_000);
    const rateLimitResult = await prisma.rateLimitBucket.deleteMany({
      where: { windowStart: { lt: rateLimitCutoff } }
    });
    rateLimitDeleted = rateLimitResult.count;
  } catch (err) {
    await ReleaseJobLock(JOB_NAME);
    return serverError(event, {
      zh_tw: `歸檔失敗：${(err as Error).message}`,
      en: `Archive failed: ${(err as Error).message}`,
      ja: `アーカイブ失敗：${(err as Error).message}`
    });
  }

  // 6. 釋放 JobLock
  await ReleaseJobLock(JOB_NAME);

  const durationMs = Date.now() - startedAt;
  return successResponse(
    {
      archived,
      queueCounterDeleted,
      rateLimitDeleted,
      durationMs
    },
    {
      zh_tw: '歸檔完成',
      en: 'Archive completed',
      ja: 'アーカイブ完了'
    }
  );
});
