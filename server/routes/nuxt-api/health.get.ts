// 健康檢查端點（公開，無需認證）
// 用途：Railway / 監控巡檢；同時回報已套用 migration 與 commit hash 方便人工確認版本到位
// DB 連線正常回 200，斷線回 503；不洩漏敏感欄位（DATABASE_URL、JWT_SECRET 等）
import { defineEventHandler, setResponseStatus } from 'h3';
import { successResponse } from '@@/utils/response';
import {
  getCommitHash,
  getCurrentMigration,
  getUptimeSec,
  pingDatabase
} from '@@/utils/deploy-info';

export default defineEventHandler(async (event) => {
  const dbOk = await pingDatabase();
  const commit = getCommitHash();
  const uptimeSec = getUptimeSec();

  if (!dbOk) {
    setResponseStatus(event, 503);
    return {
      data: {
        status: 'degraded' as const,
        db: 'disconnected' as const,
        commit,
        uptimeSec
      },
      status: {
        code: 503,
        message: {
          zh_tw: '資料庫無法連線',
          en: 'Database disconnected',
          ja: 'データベースに接続できません'
        }
      }
    };
  }

  // DB 正常時補查 migration 名稱（DB 通才查得到）
  let migration = 'unknown';
  try {
    migration = await getCurrentMigration();
  } catch {
    migration = 'unknown';
  }

  return successResponse({
    status: 'ok' as const,
    db: 'connected' as const,
    migration,
    commit,
    uptimeSec
  });
});
