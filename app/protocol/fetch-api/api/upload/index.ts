import * as mock from './mock';
import methods from '@/protocol/fetch-api/methods';

const IsMock = () => {
  const { public: { testMode } } = useRuntimeConfig();
  return testMode === 'T';
};

// -----------------------------------------------------------------------------------------------

/**
 * 商家：上傳圖片到 R2，回傳 public URL；R2 未配置時 dev fallback 到 placeholder URL。
 * 內部用原生 fetch 直送 multipart，避免 methods.formData 把 File 用 JsonToFormData 拍扁。
 */
export const UploadImage = async (params: UploadImageParams): Promise<ApiRes<UploadImageRes>> => {
  if (IsMock()) return mock.UploadImage();

  const storeSelf = StoreSelf();
  const kind = params.kind ?? 'other';
  const form = new FormData();
  form.append('file', params.file, params.file.name);

  try {
    const res = await $fetch<{ data: UploadImageRes; status: { code: number; message: { zh_tw: string; en: string; ja: string } } }>(
      `/nuxt-api/upload/image?kind=${kind}&t=${Date.now()}`,
      {
        method: 'POST',
        body: form,
        headers: { Authorization: `Bearer ${storeSelf.apiToken}` }
      }
    );
    return res as ApiRes<UploadImageRes>;
  } catch (err) {
    const r = (err as { data?: ApiRes<UploadImageRes> }).data;
    if (r?.status) return r as ApiRes<UploadImageRes>;
    return {
      data: { url: '', key: '' },
      status: { code: 9998, message: { zh_tw: '上傳失敗', en: 'Upload failed', ja: 'アップロードに失敗しました' } }
    } as ApiRes<UploadImageRes>;
  }
};
