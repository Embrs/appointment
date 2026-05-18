// 商家資源 API mock

const SuccessRes = <T>(data: T, wait = 100) => new Promise<ApiRes<T>>((resolve) => {
  const res = { data, status: { code: 200, message: { zh_tw: '', en: '', ja: '' } } } as ApiRes<T>;
  setTimeout(() => { resolve(res); }, wait);
});

const fakeItems: ResourceItem[] = [
  { id: 'mock-r-1', name: '王醫師', isActive: true, displayOrder: 0 },
  { id: 'mock-r-2', name: '李醫師', isActive: true, displayOrder: 1 }
];

export const GetResourceList = () => SuccessRes<GetResourceListRes>({ items: fakeItems });
export const CreateResource = () => SuccessRes<CreateResourceRes>({ resource: fakeItems[0]! });
export const GetResource = () => SuccessRes<GetResourceRes>({ resource: fakeItems[0]! });
export const UpdateResource = () => SuccessRes<UpdateResourceRes>({ resource: fakeItems[0]! });
export const DeleteResource = () => SuccessRes<DeleteResourceRes>({ id: 'mock-r-1' });
