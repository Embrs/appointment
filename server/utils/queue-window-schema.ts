// 共用：QueueWindow Zod 驗證 schema
// 由 routes/nuxt-api/merchant/queue-window.put.ts 與 __tests__/queue-window-put.test.ts 共用
import { z } from 'zod';

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const QueueWindowItemSchema = z
  .object({
    weekday: z.number().int().min(0).max(6),
    startTime: z.string().regex(HHMM),
    endTime: z.string().regex(HHMM),
    maxTickets: z.number().int().min(0),
    isActive: z.boolean()
  })
  .strict();

export const QueueWindowPutBodySchema = z
  .object({
    serviceId: z.string().min(1),
    windows: z.array(QueueWindowItemSchema).max(28)
  })
  .strict();

export type QueueWindowItemInput = z.infer<typeof QueueWindowItemSchema>;
export type QueueWindowPutBodyInput = z.infer<typeof QueueWindowPutBodySchema>;
