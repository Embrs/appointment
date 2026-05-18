// schedule mock

const SuccessRes = <T>(data: T, wait = 100) => new Promise<ApiRes<T>>((resolve) => {
  const res = { data, status: { code: 200, message: { zh_tw: '', en: '', ja: '' } } } as ApiRes<T>;
  setTimeout(() => { resolve(res); }, wait);
});

export const GetScheduleRules = () => SuccessRes<GetScheduleRulesRes>({ rules: [] });
export const UpdateScheduleRules = () => SuccessRes<UpdateScheduleRulesRes>({ rules: [] });
export const GetScheduleOverrides = () => SuccessRes<GetScheduleOverridesRes>({ items: [] });
export const CreateScheduleOverride = () =>
  SuccessRes<CreateScheduleOverrideRes>({
    override: {
      id: 'mock-ovr-1',
      scope: 'MERCHANT',
      resourceId: null,
      date: '2026-06-01',
      startTime: null,
      endTime: null,
      isClosed: true,
      note: '盤點'
    }
  });
export const DeleteScheduleOverride = () => SuccessRes<DeleteScheduleOverrideRes>({ id: 'mock-ovr-1' });
