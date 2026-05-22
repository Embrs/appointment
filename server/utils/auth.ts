// JWT 認證與密碼雜湊工具
// 規範：requireAdmin / requireMerchant 失敗時 return unauthorizedError 結果，呼叫端用 `if ('status' in r) return r` 處理
// 守衛在 JWT 驗證通過後 SHALL 額外查 Prisma 確認身分主體仍存在/有效；不存在回 401 並附「會話已失效」訊息
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import type { H3Event } from 'h3';
import { prisma } from './prisma';
import { unauthorizedError, type ApiResponse, type I18nMessage } from './response';

const BCRYPT_ROUNDS = 10;
const DEFAULT_TTL_SECONDS = 60 * 60 * 24 * 14; // 14 天

/** 會話已失效（身分主體在 DB 不存在/停用/Merchant 非 ACTIVE）三語訊息 */
export const MSG_SESSION_EXPIRED: I18nMessage = {
  zh_tw: '會話已失效，請重新登入',
  en: 'Session expired, please sign in again',
  ja: 'セッションが失効しました。再度ログインしてください'
};

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

/** evaluateMerchantSession 判斷結果（純函式產出，requireMerchant 內依此分支） */
export type MerchantSessionResult =
  | { ok: true }
  | { ok: false; reason: 'no-token' | 'wrong-role'; useExpiredMsg: false }
  | { ok: false; reason: 'no-user' | 'merchant-deleted' | 'merchant-not-active'; useExpiredMsg: true };

/** evaluateAdminSession 判斷結果 */
export type AdminSessionResult =
  | { ok: true }
  | { ok: false; reason: 'no-token'; useExpiredMsg: false }
  | { ok: false; reason: 'no-user'; useExpiredMsg: true };

/** Merchant 守衛純判斷函式（不碰 IO，便於單元測試） */
export const evaluateMerchantSession = (
  payload: AuthPayload | null,
  user: {
    isActive: boolean;
    deletedAt: Date | null;
    merchantId: string;
    merchant: { status: string; deletedAt: Date | null } | null;
  } | null,
  options: { role?: 'OWNER' | 'STAFF' } = {}
): MerchantSessionResult => {
  if (!payload || payload.type !== 'merchant' || !payload.merchantId) {
    return { ok: false, reason: 'no-token', useExpiredMsg: false };
  }
  if (options.role && payload.role !== options.role) {
    return { ok: false, reason: 'wrong-role', useExpiredMsg: false };
  }
  if (!user || user.deletedAt || !user.isActive || user.merchantId !== payload.merchantId) {
    return { ok: false, reason: 'no-user', useExpiredMsg: true };
  }
  const merchant = user.merchant;
  if (!merchant || merchant.deletedAt) {
    return { ok: false, reason: 'merchant-deleted', useExpiredMsg: true };
  }
  if (merchant.status !== 'ACTIVE') {
    return { ok: false, reason: 'merchant-not-active', useExpiredMsg: true };
  }
  return { ok: true };
};

/** Admin 守衛純判斷函式 */
export const evaluateAdminSession = (
  payload: AuthPayload | null,
  admin: { isActive: boolean; deletedAt: Date | null } | null
): AdminSessionResult => {
  if (!payload || payload.type !== 'admin') {
    return { ok: false, reason: 'no-token', useExpiredMsg: false };
  }
  if (!admin || admin.deletedAt || !admin.isActive) {
    return { ok: false, reason: 'no-user', useExpiredMsg: true };
  }
  return { ok: true };
};

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
 * 要求 admin 身分；非 admin、無 token、或 AdminUser 在 DB 不存在/停用 時回傳 unauthorizedError 響應
 * 用法：
 *   const auth = await requireAdmin(event);
 *   if ('status' in auth) return auth;
 */
export const requireAdmin = async (event: H3Event): Promise<AuthPayload | ApiResponse> => {
  const payload = getAuth(event);
  // 先做純 token 檢查避免無謂的 DB 查詢
  if (!payload || payload.type !== 'admin') return unauthorizedError(event);

  const admin = await prisma.adminUser.findUnique({
    where: { id: payload.sub },
    select: { id: true, isActive: true, deletedAt: true }
  });
  const result = evaluateAdminSession(payload, admin);
  if (!result.ok) {
    return unauthorizedError(event, result.useExpiredMsg ? MSG_SESSION_EXPIRED : undefined);
  }
  return payload;
};

/**
 * 要求 merchant 身分；可選 role 過濾
 * 守衛 SHALL 確認 Merchant + MerchantUser 在 DB 仍存在且有效，否則回 401（會話已失效）
 */
export const requireMerchant = async (
  event: H3Event,
  options: { role?: 'OWNER' | 'STAFF' } = {}
): Promise<AuthPayload | ApiResponse> => {
  const payload = getAuth(event);
  // 先做純 token 檢查避免無謂的 DB 查詢
  if (!payload || payload.type !== 'merchant' || !payload.merchantId) return unauthorizedError(event);
  if (options.role && payload.role !== options.role) return unauthorizedError(event);

  const user = await prisma.merchantUser.findUnique({
    where: { id: payload.sub },
    select: {
      id: true,
      isActive: true,
      deletedAt: true,
      merchantId: true,
      merchant: { select: { id: true, status: true, deletedAt: true } }
    }
  });
  const result = evaluateMerchantSession(payload, user, options);
  if (!result.ok) {
    return unauthorizedError(event, result.useExpiredMsg ? MSG_SESSION_EXPIRED : undefined);
  }
  return payload;
};

/** bcrypt hash 密碼 */
export const hashPassword = (plain: string): Promise<string> => bcrypt.hash(plain, BCRYPT_ROUNDS);

/** bcrypt 驗證密碼 */
export const verifyPassword = (plain: string, hash: string): Promise<boolean> => bcrypt.compare(plain, hash);
