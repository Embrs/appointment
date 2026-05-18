// availability mock

const SuccessRes = <T>(data: T, wait = 100) => new Promise<ApiRes<T>>((resolve) => {
  const res = { data, status: { code: 200, message: { zh_tw: '', en: '', ja: '' } } } as ApiRes<T>;
  setTimeout(() => { resolve(res); }, wait);
});

export const GetPublicMerchant = () =>
  SuccessRes<GetPublicMerchantRes>({
    merchant: {
      slug: 'mock-shop',
      name: '示例商家',
      description: 'demo',
      logoUrl: null,
      coverUrl: null,
      timezone: 'Asia/Taipei',
      address: null,
      contactPhone: null,
      contactEmail: null,
      cancelPolicy: { mode: 'free' }
    },
    services: [],
    resources: []
  });

export const GetAvailability = () =>
  SuccessRes<GetAvailabilityRes>({
    timezone: 'Asia/Taipei',
    date: '2026-05-20',
    slots: [
      { startAt: '2026-05-20T01:00:00.000Z', endAt: '2026-05-20T02:00:00.000Z', capacity: 1, remaining: 1 }
    ]
  });
