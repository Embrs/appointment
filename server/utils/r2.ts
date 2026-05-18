// Cloudflare R2（S3 相容）上傳工具
// 失敗一律 return { error }，不拋例外
// Env：R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_BUCKET_NAME
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

let cachedClient: S3Client | null = null;

const getEndpoint = (): string | null => {
  const accountId = process.env.R2_ACCOUNT_ID;
  if (!accountId) return null;
  return `https://${accountId}.r2.cloudflarestorage.com`;
};

const getClient = (): S3Client | null => {
  const endpoint = getEndpoint();
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!endpoint || !accessKeyId || !secretAccessKey) return null;

  if (!cachedClient) {
    cachedClient = new S3Client({
      region: 'auto',
      endpoint,
      credentials: { accessKeyId, secretAccessKey },
      forcePathStyle: true
    });
  }
  return cachedClient;
};

export interface UploadResult {
  /** 物件 key（含路徑） */
  key?: string;
  /** S3 endpoint 形式 URL（非公開 CDN，僅供 server 端參考） */
  url?: string;
  error?: string;
}

/**
 * 上傳檔案到 R2
 * @param key       物件 key（含路徑），例如 `merchant/abc/logo.png`
 * @param body      Buffer 或 Uint8Array
 * @param contentType 例如 `image/png`
 */
export const uploadToR2 = async (
  key: string,
  body: Buffer | Uint8Array,
  contentType: string
): Promise<UploadResult> => {
  const bucket = process.env.R2_BUCKET_NAME;
  const client = getClient();
  const endpoint = getEndpoint();

  if (!client || !bucket || !endpoint) {
    return { error: 'R2 not configured' };
  }

  try {
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: contentType
      })
    );
    const normalizedKey = key.replace(/^\/+/, '');
    return {
      key: normalizedKey,
      url: `${endpoint}/${bucket}/${normalizedKey}`
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { error: `R2 upload failed: ${message}` };
  }
};
