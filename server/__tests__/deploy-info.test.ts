// deploy-info 純函式測試：getCommitHash 環境變數讀取邏輯
// 注意：getCurrentMigration / pingDatabase 屬 DB IO，由 Playwright 實機驗收
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
// vi.mock 由 vitest hoist 到 import 之前生效；ESLint import/first 看不出 hoist，因此於下方 import 行 disable
vi.mock('@@/utils/prisma', () => ({ prisma: {} }));
// eslint-disable-next-line import/first
import { getCommitHash, getUptimeSec } from '@@/utils/deploy-info';

const originalEnv = { ...process.env };

beforeEach(() => {
  process.env = { ...originalEnv };
});

afterEach(() => {
  process.env = { ...originalEnv };
});

describe('getCommitHash', () => {
  it('有 GIT_COMMIT_SHA 時回傳前 12 碼', () => {
    process.env.GIT_COMMIT_SHA = 'abcdef1234567890fullhash';
    expect(getCommitHash()).toBe('abcdef123456');
  });

  it('GIT_COMMIT_SHA 為空字串 + NODE_ENV=production → unknown', () => {
    process.env.GIT_COMMIT_SHA = '';
    process.env.NODE_ENV = 'production';
    expect(getCommitHash()).toBe('unknown');
  });

  it('GIT_COMMIT_SHA 為 undefined + NODE_ENV=development → dev', () => {
    delete process.env.GIT_COMMIT_SHA;
    process.env.NODE_ENV = 'development';
    expect(getCommitHash()).toBe('dev');
  });

  it('GIT_COMMIT_SHA 只有空白 → fallback', () => {
    process.env.GIT_COMMIT_SHA = '   ';
    process.env.NODE_ENV = 'production';
    expect(getCommitHash()).toBe('unknown');
  });

  it('GIT_COMMIT_SHA 短於 12 碼時原樣回傳', () => {
    process.env.GIT_COMMIT_SHA = 'abc1234';
    expect(getCommitHash()).toBe('abc1234');
  });
});

describe('getUptimeSec', () => {
  it('回傳非負整數', () => {
    const uptime = getUptimeSec();
    expect(uptime).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(uptime)).toBe(true);
  });
});
