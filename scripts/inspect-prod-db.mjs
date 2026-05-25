// 一次性：探勘 Railway develop DB 目前狀態（migration / table / 帳號筆數）
import { PrismaClient } from '@prisma/client'

const url = process.env.INSPECT_DB_URL
if (!url) {
  console.error('需要 INSPECT_DB_URL')
  process.exit(1)
}

const prisma = new PrismaClient({ datasources: { db: { url } } })

async function safeQuery(label, sql) {
  try {
    const rows = await prisma.$queryRawUnsafe(sql)
    console.log(`\n[${label}]`)
    console.log(JSON.stringify(rows, null, 2))
  } catch (err) {
    console.log(`\n[${label}] FAILED: ${err.message}`)
  }
}

try {
  await safeQuery(
    'all tables',
    `SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename`,
  )
  await safeQuery(
    '_prisma_migrations',
    `SELECT migration_name, started_at, finished_at, applied_steps_count, logs IS NOT NULL AS has_logs
     FROM "_prisma_migrations" ORDER BY started_at`,
  )
  await safeQuery(
    '_prisma_migrations failure log',
    `SELECT migration_name, logs FROM "_prisma_migrations"
     WHERE finished_at IS NULL OR rolled_back_at IS NOT NULL`,
  )
  await safeQuery('AdminUser count', `SELECT COUNT(*)::int AS n FROM "AdminUser"`)
  await safeQuery('Merchant count', `SELECT COUNT(*)::int AS n FROM "Merchant"`)
  await safeQuery('MerchantUser count', `SELECT COUNT(*)::int AS n FROM "MerchantUser"`)
} finally {
  await prisma.$disconnect()
}
