// 商家休假 type 定義

interface HolidayItem {
  id: string;
  date: string;
  name: string;
  createdAt?: string;
}

interface GetHolidayListParams {
  year?: number;
}

interface GetHolidayListRes {
  items: HolidayItem[];
}

interface CreateHolidayParams {
  date: string;
  name: string;
}

interface CreateHolidayRes {
  holiday: HolidayItem;
}

interface DeleteHolidayParams {
  id: string;
}

interface DeleteHolidayRes {
  id: string;
}
