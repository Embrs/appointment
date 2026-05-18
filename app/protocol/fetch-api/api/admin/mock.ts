// 平台管理員 API mock（NUXT_PUBLIC_TEST_MODE='T' 時走此路）

const SuccessRes = <T>(data: T, wait = 200) => new Promise<ApiRes<T>>((resolve) => {
  const res = { data, status: { code: 200, message: { zh_tw: '', en: '', ja: '' } } } as ApiRes<T>;
  setTimeout(() => { resolve(res); }, wait);
});

const fakeAdmins: AdminItem[] = [
  {
    id: 'mock-admin-1',
    email: 'admin@mock.local',
    name: 'Mock Admin',
    isActive: true,
    createdAt: '2026-05-15T00:00:00.000Z',
    updatedAt: '2026-05-15T00:00:00.000Z'
  },
  {
    id: 'mock-admin-2',
    email: 'editor@mock.local',
    name: 'Mock Editor',
    isActive: true,
    createdAt: '2026-05-14T00:00:00.000Z',
    updatedAt: '2026-05-14T00:00:00.000Z'
  },
  {
    id: 'mock-admin-3',
    email: 'inactive@mock.local',
    name: 'Mock Inactive',
    isActive: false,
    createdAt: '2026-05-13T00:00:00.000Z',
    updatedAt: '2026-05-13T00:00:00.000Z'
  }
];

// -----------------------------------------------------------------------------------------------

export const GetAdminList = () => SuccessRes<GetAdminListRes>({ items: fakeAdmins });

export const CreateAdmin = () => SuccessRes<CreateAdminRes>({
  admin: {
    id: 'mock-admin-new',
    email: 'new@mock.local',
    name: 'New Admin',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
});

export const UpdateAdmin = () => SuccessRes<UpdateAdminRes>({
  admin: fakeAdmins[0]!
});

export const ToggleAdminActive = () => SuccessRes<ToggleAdminActiveRes>({
  admin: { ...fakeAdmins[0]!, isActive: !fakeAdmins[0]!.isActive }
});
