// 精確驗證每個 migration 對應的 schema 是否已存在
import { PrismaClient } from '@prisma/client'

const url = process.env.INSPECT_DB_URL
if (!url) {
  console.error('需要 INSPECT_DB_URL')
  process.exit(1)
}
const prisma = new PrismaClient({ datasources: { db: { url } } })

async function exists(label, sql) {
  const rows = await prisma.$queryRawUnsafe(sql)
  const ok = rows.length > 0
  console.log(`${ok ? '✓' : '✗'} ${label}`)
  return ok
}

try {
  await exists(
    'init: AdminUser table',
    `SELECT 1 FROM information_schema.tables WHERE table_name='AdminUser' AND table_schema='public'`,
  )
  await exists(
    'init: MerchantStatus enum',
    `SELECT 1 FROM pg_type WHERE typname='MerchantStatus'`,
  )
  await exists(
    '18000000: Merchant.maxActiveAppointmentsPerCustomer',
    `SELECT 1 FROM information_schema.columns
       WHERE table_name='Merchant' AND column_name='maxActiveAppointmentsPerCustomer'`,
  )
  await exists(
    '20061421: AppointmentMode has RESOURCE_OPTIONAL',
    `SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid=t.oid
       WHERE t.typname='AppointmentMode' AND e.enumlabel='RESOURCE_OPTIONAL'`,
  )
  await exists(
    '20061421: BookingMode has RESOURCE_OPTIONAL',
    `SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid=t.oid
       WHERE t.typname='BookingMode' AND e.enumlabel='RESOURCE_OPTIONAL'`,
  )
  await exists(
    '21021719: QueueTicket walk-in (resourceId or source)',
    `SELECT 1 FROM information_schema.columns
       WHERE table_name='QueueTicket' AND column_name IN ('resourceId','source','createdBy','walkIn')`,
  )
  await exists(
    '21030411: Service.avgServiceMinutes',
    `SELECT 1 FROM information_schema.columns
       WHERE table_name='Service' AND column_name='avgServiceMinutes'`,
  )
  await exists(
    '21121102: QueueTicket.claimToken',
    `SELECT 1 FROM information_schema.columns
       WHERE table_name='QueueTicket' AND column_name='claimToken'`,
  )
  await exists(
    '21150000: QueueTicket.resourceId (multi-resource)',
    `SELECT 1 FROM information_schema.columns
       WHERE table_name='QueueTicket' AND column_name='resourceId'`,
  )
  await exists(
    '21150000: QueueCounter.resourceId (multi-resource)',
    `SELECT 1 FROM information_schema.columns
       WHERE table_name='QueueCounter' AND column_name='resourceId'`,
  )
  await exists(
    '21150000: new unique idx QueueTicket include resourceId',
    `SELECT 1 FROM pg_indexes WHERE indexname='QueueTicket_merchantId_serviceId_resourceId_ticketDate_tick_key'`,
  )
  await exists(
    '21150000: new unique idx QueueCounter include resourceId',
    `SELECT 1 FROM pg_indexes WHERE indexname='QueueCounter_merchantId_serviceId_resourceId_counterDate_key'`,
  )
  await exists(
    '21150000: old QueueTicket unique idx REMOVED',
    `SELECT 1 WHERE NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname='QueueTicket_merchantId_serviceId_ticketDate_ticketNumber_key')`,
  )
  await exists(
    '22000000: Provider table',
    `SELECT 1 FROM information_schema.tables WHERE table_name='Provider' AND table_schema='public'`,
  )
  await exists(
    '22000000: ProviderService table',
    `SELECT 1 FROM information_schema.tables WHERE table_name='ProviderService' AND table_schema='public'`,
  )
} finally {
  await prisma.$disconnect()
}
