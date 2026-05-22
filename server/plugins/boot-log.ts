// 啟動日誌：Nitro server 就緒時印出當前已套用 migration 與 commit hash
// 用途：部署後一眼確認版本到位；migration 查失敗不影響啟動，只標 unknown
import { getCommitHash, getCurrentMigration } from '@@/utils/deploy-info';

export default defineNitroPlugin(async () => {
  let migration = 'unknown';
  try {
    migration = await getCurrentMigration();
  } catch {
    // DB 尚未連線或 _prisma_migrations 不存在皆視為未知，不阻止啟動
    migration = 'unknown';
  }
  const commit = getCommitHash();
  const nodeEnv = process.env.NODE_ENV ?? 'development';
  console.log(`[boot] migration=${migration} commit=${commit} nodeEnv=${nodeEnv}`);
});
