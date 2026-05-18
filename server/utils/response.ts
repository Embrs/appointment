// 統一 API 響應工具
// 規範：後端錯誤一律 return（不 throw）；響應格式 { data, status: { code, message: { zh_tw, en, ja } } }
import type { H3Event } from 'h3';

/** 三語錯誤訊息 */
export interface I18nMessage {
  zh_tw: string;
  en: string;
  ja: string;
}

/** API 響應結構 */
export interface ApiResponse<T = Record<string, unknown>> {
  data: T;
  status: {
    code: number;
    message: I18nMessage;
  };
}

/** 預設訊息（與 HTTP 語意對齊） */
const DEFAULT_MESSAGES: Record<number, I18nMessage> = {
  200: { zh_tw: '成功', en: 'Success', ja: '成功' },
  400: { zh_tw: '請求格式錯誤', en: 'Bad request', ja: 'リクエストエラー' },
  401: { zh_tw: '未授權，請重新登入', en: 'Unauthorized', ja: '認証されていません' },
  403: { zh_tw: '無權限存取', en: 'Forbidden', ja: 'アクセスが拒否されました' },
  404: { zh_tw: '資源不存在', en: 'Not found', ja: '見つかりません' },
  409: { zh_tw: '資源衝突', en: 'Conflict', ja: '競合が発生しました' },
  429: { zh_tw: '請求過於頻繁，請稍後再試', en: 'Too many requests', ja: 'リクエストが多すぎます' },
  500: { zh_tw: '伺服器錯誤', en: 'Server error', ja: 'サーバーエラー' }
};

/** 將物件/陣列中的 null 遞迴轉為空字串（保留 Date、原始型別、undefined） */
export const sanitizeNulls = <T>(value: T): T => {
  if (value === null) return '' as unknown as T;
  if (value === undefined) return value;
  if (value instanceof Date) return value;
  if (Array.isArray(value)) return value.map((v) => sanitizeNulls(v)) as unknown as T;
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(value as Record<string, unknown>)) {
      out[k] = sanitizeNulls((value as Record<string, unknown>)[k]);
    }
    return out as unknown as T;
  }
  return value;
};

/** 取得預設訊息（找不到對應 code 時退回 500） */
const messageFor = (code: number, override?: Partial<I18nMessage>): I18nMessage => {
  const base = DEFAULT_MESSAGES[code] ?? DEFAULT_MESSAGES[500];
  return { ...base, ...(override ?? {}) };
};

/** 成功響應 */
export const successResponse = <T>(data: T, message?: Partial<I18nMessage>): ApiResponse<T> => ({
  data: sanitizeNulls(data) as T,
  status: { code: 200, message: messageFor(200, message) }
});

/** 通用錯誤建構：同時設 HTTP status 與 body code，避免 onResponseError 與業務邏輯需各自判斷 */
const buildError = (
  event: H3Event | undefined,
  code: number,
  message?: Partial<I18nMessage>
): ApiResponse<Record<string, never>> => {
  if (event) {
    setResponseStatus(event, code);
  }
  return {
    data: {},
    status: { code, message: messageFor(code, message) }
  };
};

export const badRequestError = (event?: H3Event, message?: Partial<I18nMessage>) =>
  buildError(event, 400, message);

export const unauthorizedError = (event?: H3Event, message?: Partial<I18nMessage>) =>
  buildError(event, 401, message);

export const forbiddenError = (event?: H3Event, message?: Partial<I18nMessage>) =>
  buildError(event, 403, message);

export const notFoundError = (event?: H3Event, message?: Partial<I18nMessage>) =>
  buildError(event, 404, message);

export const conflictError = (event?: H3Event, message?: Partial<I18nMessage>) =>
  buildError(event, 409, message);

export const tooManyRequestsError = (event?: H3Event, message?: Partial<I18nMessage>) =>
  buildError(event, 429, message);

export const serverError = (event?: H3Event, message?: Partial<I18nMessage>) =>
  buildError(event, 500, message);
