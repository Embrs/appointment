// 圖片上傳：multipart → R2；R2 未配置時 dev fallback 到 placeholder URL
import { defineEventHandler, getQuery, readMultipartFormData } from 'h3';
import { z } from 'zod';
import { requireMerchant } from '@@/utils/auth';
import { uploadToR2 } from '@@/utils/r2';
import {
  badRequestError,
  serverError,
  successResponse
} from '@@/utils/response';

const ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/webp']);
const EXT_MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp'
};
const MAX_BYTES = 5 * 1024 * 1024;

const QuerySchema = z
  .object({
    kind: z.enum(['logo', 'cover', 'service', 'other']).optional()
  })
  .passthrough();

const INVALID_MIME = {
  zh_tw: '僅支援 PNG / JPEG / WebP 圖片',
  en: 'Only PNG, JPEG, and WebP images are supported',
  ja: 'PNG / JPEG / WebPのみ対応しています'
};
const TOO_LARGE = {
  zh_tw: '圖片需在 5MB 以內',
  en: 'Image must be 5MB or less',
  ja: '画像は5MB以下にしてください'
};
const NO_FILE = {
  zh_tw: '未提供圖片檔案',
  en: 'Image file is required',
  ja: '画像ファイルが必要です'
};
const UPLOAD_FAILED = {
  zh_tw: '圖片上傳失敗',
  en: 'Image upload failed',
  ja: '画像アップロードに失敗しました'
};

const slugifyFilename = (filename: string): string => {
  const dot = filename.lastIndexOf('.');
  const base = dot >= 0 ? filename.slice(0, dot) : filename;
  const ext = dot >= 0 ? filename.slice(dot) : '';
  const safeBase = base.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 60) || 'file';
  const safeExt = ext.replace(/[^a-zA-Z0-9.]/g, '').slice(0, 8);
  return `${safeBase}${safeExt}`;
};

export default defineEventHandler(async (event) => {
  const auth = requireMerchant(event);
  if ('status' in auth) return auth;

  const qParsed = QuerySchema.safeParse(getQuery(event));
  if (!qParsed.success) return badRequestError(event);
  const kind = qParsed.data.kind ?? 'other';

  const formData = await readMultipartFormData(event);
  const part = formData?.find((p) => p.name === 'file' && p.filename);
  if (!part) return badRequestError(event, NO_FILE);

  // 解析 MIME：優先 part.type，否則依副檔名退避
  let contentType = part.type ?? '';
  if (!ALLOWED_MIME.has(contentType)) {
    const ext = (part.filename ?? '').split('.').pop()?.toLowerCase() ?? '';
    contentType = EXT_MIME[ext] ?? contentType;
  }
  if (!ALLOWED_MIME.has(contentType)) return badRequestError(event, INVALID_MIME);
  if (part.data.byteLength > MAX_BYTES) return badRequestError(event, TOO_LARGE);

  const filename = slugifyFilename(part.filename ?? 'image');
  const key = `merchant/${auth.merchantId}/${kind}/${Date.now()}-${filename}`;

  const result = await uploadToR2(key, part.data, contentType);
  if (result.error || !result.url) {
    if (process.env.NODE_ENV !== 'production') {
      // dev fallback：讓本地與 CI 不依賴真實 R2 也能完整測試流程
      console.warn(`[upload/image] R2 fallback: ${result.error ?? 'no url'}`);
      const placeholder = `https://placehold.co/600x400/?text=${encodeURIComponent(kind)}`;
      return successResponse({ url: placeholder, key });
    }
    return serverError(event, UPLOAD_FAILED);
  }

  return successResponse({ url: result.url, key: result.key ?? key });
});
