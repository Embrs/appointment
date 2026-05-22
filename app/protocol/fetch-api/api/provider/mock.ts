// 商家服務人員 API mock

const SuccessRes = <T>(data: T, wait = 100) => new Promise<ApiRes<T>>((resolve) => {
  const res = { data, status: { code: 200, message: { zh_tw: '', en: '', ja: '' } } } as ApiRes<T>;
  setTimeout(() => { resolve(res); }, wait);
});

const fakeItems: ProviderItem[] = [
  { id: 'mock-p-1', name: '王醫師', title: '院長', isActive: true, displayOrder: 0, serviceIds: [] },
  { id: 'mock-p-2', name: '李醫師', title: '主治', isActive: true, displayOrder: 1, serviceIds: [] }
];

export const GetProviderList = () => SuccessRes<GetProviderListRes>({ items: fakeItems });
export const CreateProvider = () => SuccessRes<CreateProviderRes>({ provider: fakeItems[0]! });
export const GetProvider = () => SuccessRes<GetProviderRes>({ provider: fakeItems[0]! });
export const UpdateProvider = () => SuccessRes<UpdateProviderRes>({ provider: fakeItems[0]! });
export const DeleteProvider = () => SuccessRes<DeleteProviderRes>({ id: 'mock-p-1' });
export const GetPublicProviderList = () => SuccessRes<GetPublicProviderListRes>({
  items: fakeItems.map((p) => ({ ...p, serviceIds: [] }))
});
