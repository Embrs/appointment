// 部署版本資訊：查 _prisma_migrations 表最新已套用的 migration 名稱、讀取 build 注入的 commit hash
// 用途：/nuxt-api/health 與 server/plugins/boot-log.ts 共用
import { prisma } from './prisma';

const BOOT_AT_MS = Date.now();

/** 查當前資料庫最新已套用 migration 名稱；查不到回 'none'，查詢失敗 throw */
export const getCurrentMigration = async (): Promise<string> => {
  const rows = await prisma.$queryRawUnsafe<{ migration_name: string }[]>(
    'SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL ORDER BY finished_at DESC LIMIT 1'
  );
  if (!rows || rows.length === 0) return 'none';
  return rows[0].migration_name;
};

/** 讀 build 階段注入的 commit hash；缺值 fallback 'dev'（本地）或 'unknown'（容器） */
export const getCommitHash = (): string => {
  const sha = process.env.GIT_COMMIT_SHA;
  if (sha && sha.trim() !== '') return sha.slice(0, 12);
  return process.env.NODE_ENV === 'production' ? 'unknown' : 'dev';
};

/** Server 啟動秒數（用於 /health 顯示 uptime） */
export const getUptimeSec = (): number => {
  return Math.floor((Date.now() - BOOT_AT_MS) / 1000);
};

/** 簡易 DB ping；連線正常回 true，失敗回 false（不 throw，由呼叫端決定 503 與否） */
export const pingDatabase = async (): Promise<boolean> => {
  try {
    await prisma.$queryRawUnsafe<{ ok: number }[]>('SELECT 1 AS ok');
    return true;
  } catch {
    return false;
  }
};
