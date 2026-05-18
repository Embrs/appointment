// 商家服務 API mock

const SuccessRes = <T>(data: T, wait = 100) => new Promise<ApiRes<T>>((resolve) => {
  const res = { data, status: { code: 200, message: { zh_tw: '', en: '', ja: '' } } } as ApiRes<T>;
  setTimeout(() => { resolve(res); }, wait);
});

const fakeItems: ServiceItem[] = [
  {
    id: 'mock-svc-1', name: '拔牙', bookingMode: 'TIME_SLOT',
    durationMinutes: 60, slotIntervalMinutes: 30, capacityPerSlot: 1,
    priceCents: 0, isActive: true, displayOrder: 0, resourceIds: []
  }
];

export const GetServiceList = () => SuccessRes<GetServiceListRes>({ items: fakeItems });
export const CreateService = () => SuccessRes<CreateServiceRes>({ service: fakeItems[0]! });
export const GetService = () => SuccessRes<GetServiceRes>({ service: fakeItems[0]! });
export const UpdateService = () => SuccessRes<UpdateServiceRes>({ service: fakeItems[0]! });
export const DeleteService = () => SuccessRes<DeleteServiceRes>({ id: 'mock-svc-1' });
