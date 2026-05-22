// 圖片上傳 type 定義

type UploadImageKind = 'logo' | 'cover' | 'service' | 'provider-avatar' | 'other';

interface UploadImageParams {
  /** input[type=file] 拿到的 File */
  file: File;
  kind?: UploadImageKind;
}

interface UploadImageRes {
  url: string;
  key: string;
}
