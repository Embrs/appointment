// appointment mock

const SuccessRes = <T>(data: T, wait = 100) => new Promise<ApiRes<T>>((resolve) => {
  const res = { data, status: { code: 200, message: { zh_tw: '', en: '', ja: '' } } } as ApiRes<T>;
  setTimeout(() => { resolve(res); }, wait);
});

export const CreatePublicAppointment = () =>
  SuccessRes<CreatePublicAppointmentRes>({
    id: 'mock-appt-1',
    startAt: '2026-05-20T01:00:00.000Z',
    endAt: '2026-05-20T02:00:00.000Z'
  });

export const LookupAppointment = () =>
  SuccessRes<LookupAppointmentRes>({
    merchant: {
      slug: 'mock-shop',
      name: '示例商家',
      timezone: 'Asia/Taipei',
      cancelPolicy: { mode: 'free' }
    },
    appointments: []
  });

export const CancelPublicAppointment = () =>
  SuccessRes<CancelPublicAppointmentRes>({ id: 'mock-appt-1' });

export const GetAppointmentList = () =>
  SuccessRes<GetAppointmentListRes>({
    total: 0,
    page: 1,
    pageSize: 50,
    items: []
  });

export const CreateAppointment = () =>
  SuccessRes<CreateAppointmentRes>({
    id: 'mock-appt-1',
    startAt: '2026-05-20T01:00:00.000Z',
    endAt: '2026-05-20T02:00:00.000Z'
  });

export const CancelAppointment = () =>
  SuccessRes<CancelAppointmentRes>({ id: 'mock-appt-1' });

export const CompleteAppointment = () =>
  SuccessRes<CompleteAppointmentRes>({ id: 'mock-appt-1', status: 'COMPLETED' });

export const NoShowAppointment = () =>
  SuccessRes<NoShowAppointmentRes>({ id: 'mock-appt-1', status: 'NO_SHOW' });

export const GetAppointmentArchive = () =>
  SuccessRes<GetAppointmentArchiveRes>({
    total: 0,
    page: 1,
    pageSize: 50,
    items: []
  });
