// upload mock

const SuccessRes = <T>(data: T, wait = 100) => new Promise<ApiRes<T>>((resolve) => {
  const res = { data, status: { code: 200, message: { zh_tw: '', en: '', ja: '' } } } as ApiRes<T>;
  setTimeout(() => { resolve(res); }, wait);
});

export const UploadImage = () => SuccessRes<UploadImageRes>({
  url: 'https://placehold.co/600x400?text=mock',
  key: 'mock/placeholder.png'
});
