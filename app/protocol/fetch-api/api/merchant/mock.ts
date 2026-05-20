// 平台管理員視角的 merchant API mock

const SuccessRes = <T>(data: T, wait = 200) => new Promise<ApiRes<T>>((resolve) => {
  const res = { data, status: { code: 200, message: { zh_tw: '', en: '', ja: '' } } } as ApiRes<T>;
  setTimeout(() => { resolve(res); }, wait);
});

const fakeItems: SysMerchantItem[] = [
  {
    id: 'mock-merchant-pending',
    name: 'Mock Pending Shop',
    slug: 'pending-shop',
    status: 'PENDING',
    contactEmail: 'pending@mock.local',
    contactPhone: '',
    createdAt: '2026-05-15T00:00:00.000Z',
    ownerEmail: 'pending-owner@mock.local',
    ownerName: 'Pending Owner'
  },
  {
    id: 'mock-merchant-active',
    name: 'Mock Active Shop',
    slug: 'active-shop',
    status: 'ACTIVE',
    contactEmail: 'active@mock.local',
    contactPhone: '0912000111',
    createdAt: '2026-05-10T00:00:00.000Z',
    ownerEmail: 'active-owner@mock.local',
    ownerName: 'Active Owner'
  },
  {
    id: 'mock-merchant-suspended',
    name: 'Mock Suspended Shop',
    slug: 'suspended-shop',
    status: 'SUSPENDED',
    contactEmail: 'sus@mock.local',
    contactPhone: '',
    createdAt: '2026-05-05T00:00:00.000Z',
    ownerEmail: 'sus-owner@mock.local',
    ownerName: 'Suspended Owner'
  }
];

const fakeDetail: SysMerchantFull = {
  id: 'mock-merchant-pending',
  slug: 'pending-shop',
  name: 'Mock Pending Shop',
  description: '',
  logoUrl: '',
  coverUrl: '',
  timezone: 'Asia/Taipei',
  status: 'PENDING',
  cancelPolicy: {},
  contactPhone: '',
  contactEmail: 'pending@mock.local',
  address: '',
  createdAt: '2026-05-15T00:00:00.000Z',
  updatedAt: '2026-05-15T00:00:00.000Z'
};

const fakeOwner: SysMerchantOwner = {
  id: 'mock-owner-1',
  email: 'pending-owner@mock.local',
  name: 'Pending Owner',
  isActive: true,
  role: 'OWNER',
  createdAt: '2026-05-15T00:00:00.000Z'
};

// -----------------------------------------------------------------------------------------------

const fakeSelf: SelfMerchantFull = {
  id: 'mock-self-merchant',
  slug: 'demo-clinic',
  name: 'Demo 牙醫診所',
  description: '示範用商家',
  logoUrl: '',
  coverUrl: '',
  timezone: 'Asia/Taipei',
  status: 'ACTIVE',
  cancelPolicy: { mode: 'free' },
  contactPhone: '',
  contactEmail: 'demo@mock.local',
  address: '',
  maxActiveAppointmentsPerCustomer: 5,
  createdAt: '2026-05-10T00:00:00.000Z',
  updatedAt: '2026-05-15T00:00:00.000Z'
};

const fakeStaff: MerchantStaffItem[] = [
  {
    id: 'mock-staff-owner',
    email: 'owner@mock.local',
    name: 'Mock Owner',
    role: 'OWNER',
    isActive: true,
    createdAt: '2026-05-10T00:00:00.000Z',
    updatedAt: '2026-05-10T00:00:00.000Z'
  },
  {
    id: 'mock-staff-1',
    email: 'staff1@mock.local',
    name: 'Mock Staff',
    role: 'STAFF',
    isActive: true,
    createdAt: '2026-05-11T00:00:00.000Z',
    updatedAt: '2026-05-11T00:00:00.000Z'
  }
];

export const GetSelfMerchant = () => SuccessRes<GetSelfMerchantRes>({ merchant: fakeSelf });

export const UpdateSelfMerchant = () => SuccessRes<UpdateSelfMerchantRes>({
  merchant: { ...fakeSelf, updatedAt: new Date().toISOString() }
});

export const GetStaffList = () => SuccessRes<GetStaffListRes>({ items: fakeStaff });

export const CreateStaff = () => SuccessRes<CreateStaffRes>({
  user: { ...fakeStaff[1]!, id: 'mock-staff-new', email: 'new@mock.local' }
});

export const UpdateStaff = () => SuccessRes<UpdateStaffRes>({ user: fakeStaff[1]! });

export const ToggleStaffActive = () => SuccessRes<ToggleStaffActiveRes>({
  user: { ...fakeStaff[1]!, isActive: !fakeStaff[1]!.isActive }
});

export const SysGetMerchantList = () => SuccessRes<SysGetMerchantListRes>({
  items: fakeItems,
  total: fakeItems.length,
  page: 1,
  pageSize: 20
});

export const SysGetMerchantDetail = () => SuccessRes<SysGetMerchantDetailRes>({
  merchant: fakeDetail,
  ownerUser: fakeOwner
});

export const SysUpdateMerchant = () => SuccessRes<SysUpdateMerchantRes>({
  merchant: {
    id: fakeDetail.id,
    slug: fakeDetail.slug,
    name: fakeDetail.name,
    description: fakeDetail.description,
    timezone: fakeDetail.timezone,
    status: fakeDetail.status,
    contactPhone: fakeDetail.contactPhone,
    contactEmail: fakeDetail.contactEmail,
    address: fakeDetail.address,
    updatedAt: new Date().toISOString()
  }
});

export const SysMerchantStatus = (status: MerchantStatusType) =>
  SuccessRes<SysMerchantStatusRes>({ id: fakeDetail.id, status });

export const SysImpersonateMerchant = () => SuccessRes<SysImpersonateMerchantRes>({
  token: 'mock-impersonation-token',
  merchantId: fakeDetail.id,
  merchantName: fakeDetail.name,
  ownerUserId: fakeOwner.id,
  ownerName: fakeOwner.name,
  ownerEmail: fakeOwner.email,
  expiresInSeconds: 1800
});

// QueueWindow ---------------------------------------------------------------------------------

const fakeQueueWindows: QueueWindowItem[] = [
  { weekday: 1, startTime: '09:00', endTime: '18:00', maxTickets: 20, isActive: true },
  { weekday: 2, startTime: '09:00', endTime: '18:00', maxTickets: 20, isActive: true },
  { weekday: 3, startTime: '09:00', endTime: '18:00', maxTickets: 20, isActive: true },
  { weekday: 4, startTime: '09:00', endTime: '18:00', maxTickets: 20, isActive: true },
  { weekday: 5, startTime: '09:00', endTime: '18:00', maxTickets: 20, isActive: true }
];

export const GetQueueWindows = () => SuccessRes<GetQueueWindowsRes>({ windows: fakeQueueWindows });
export const UpdateQueueWindows = () => SuccessRes<UpdateQueueWindowsRes>({ windows: fakeQueueWindows });
