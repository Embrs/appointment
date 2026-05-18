// JWT 認證與密碼雜湊工具
// 規範：requireAdmin / requireMerchant 失敗時 return unauthorizedError 結果，呼叫端用 `if ('status' in r) return r` 處理
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import type { H3Event } from 'h3';
import { unauthorizedError, type ApiResponse } from './response';

const BCRYPT_ROUNDS = 10;
const DEFAULT_TTL_SECONDS = 60 * 60 * 24 * 14; // 14 天

/** JWT payload */
export interface AuthPayload {
  /** 身分類型 */
  type: 'admin' | 'merchant';
  /** 使用者 ID（AdminUser.id 或 MerchantUser.id） */
  sub: string;
  /** 商家 ID（type=merchant 才有） */
  merchantId?: string;
  /** 商家成員角色（type=merchant 才有） */
  role?: 'OWNER' | 'STAFF';
  /** 平台管理員代理時帶入 adminId（Change 3 會用） */
  impersonatedBy?: string;
}

const getSecret = (): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    // 啟動時 secret 缺失視為 server 設定錯誤；不應在請求路徑上意外發生
    throw new Error('JWT_SECRET is not configured');
  }
  return secret;
};

/** 簽發 JWT */
export const signToken = (payload: AuthPayload, ttlSeconds: number = DEFAULT_TTL_SECONDS): string => {
  return jwt.sign(payload, getSecret(), {
    algorithm: 'HS256',
    expiresIn: ttlSeconds
  });
};

/** 驗證並解析 JWT；無效或過期回傳 null */
export const verifyToken = (token: string): AuthPayload | null => {
  try {
    const decoded = jwt.verify(token, getSecret()) as jwt.JwtPayload & AuthPayload;
    if (!decoded || typeof decoded !== 'object') return null;
    if (decoded.type !== 'admin' && decoded.type !== 'merchant') return null;
    if (!decoded.sub) return null;
    return {
      type: decoded.type,
      sub: decoded.sub,
      merchantId: decoded.merchantId,
      role: decoded.role,
      impersonatedBy: decoded.impersonatedBy
    };
  } catch {
    return null;
  }
};

/** 從 H3 event 讀取 Authorization Bearer token 並解析；無效回傳 null */
export const getAuth = (event: H3Event): AuthPayload | null => {
  const header = getHeader(event, 'authorization') ?? '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  return verifyToken(match[1]);
};

/**
 * 要求 admin 身分；非 admin 或無 token 時回傳 unauthorizedError 響應
 * 用法：
 *   const auth = requireAdmin(event);
 *   if ('status' in auth) return auth;
 */
export const requireAdmin = (event: H3Event): AuthPayload | ApiResponse => {
  const payload = getAuth(event);
  if (!payload || payload.type !== 'admin') return unauthorizedError(event);
  return payload;
};

/** 要求 merchant 身分；可選 role 過濾 */
export const requireMerchant = (
  event: H3Event,
  options: { role?: 'OWNER' | 'STAFF' } = {}
): AuthPayload | ApiResponse => {
  const payload = getAuth(event);
  if (!payload || payload.type !== 'merchant' || !payload.merchantId) return unauthorizedError(event);
  if (options.role && payload.role !== options.role) return unauthorizedError(event);
  return payload;
};

/** bcrypt hash 密碼 */
export const hashPassword = (plain: string): Promise<string> => bcrypt.hash(plain, BCRYPT_ROUNDS);

/** bcrypt 驗證密碼 */
export const verifyPassword = (plain: string, hash: string): Promise<boolean> => bcrypt.compare(plain, hash);
