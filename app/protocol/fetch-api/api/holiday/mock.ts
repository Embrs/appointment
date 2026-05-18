// holiday mock

const SuccessRes = <T>(data: T, wait = 100) => new Promise<ApiRes<T>>((resolve) => {
  const res = { data, status: { code: 200, message: { zh_tw: '', en: '', ja: '' } } } as ApiRes<T>;
  setTimeout(() => { resolve(res); }, wait);
});

const fakeItems: HolidayItem[] = [
  { id: 'mock-hol-1', date: '2026-02-17', name: '春節' }
];

export const GetHolidayList = () => SuccessRes<GetHolidayListRes>({ items: fakeItems });
export const CreateHoliday = () => SuccessRes<CreateHolidayRes>({ holiday: fakeItems[0]! });
export const DeleteHoliday = () => SuccessRes<DeleteHolidayRes>({ id: 'mock-hol-1' });
