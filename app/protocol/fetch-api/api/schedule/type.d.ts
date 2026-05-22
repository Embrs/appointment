// 時段規則 + 特定日期覆寫 type 定義

type ScheduleScopeType = 'MERCHANT' | 'RESOURCE' | 'PROVIDER';

interface ScheduleRuleItem {
  id?: string;
  scope: ScheduleScopeType;
  resourceId: string | null;
  /** PROVIDER scope 必填；其他 scope 為 null */
  providerId?: string | null;
  weekday: number;
  startTime: string;
  endTime: string;
  isActive?: boolean;
}

interface GetScheduleRulesParams {
  scope?: ScheduleScopeType;
  resourceId?: string;
  providerId?: string;
}

interface GetScheduleRulesRes {
  rules: ScheduleRuleItem[];
}

interface UpdateScheduleRulesParams {
  scope: ScheduleScopeType;
  resourceId?: string | null;
  /** PROVIDER scope 必填 */
  providerId?: string | null;
  rules: Array<{
    weekday: number;
    startTime: string;
    endTime: string;
    /** 僅 PROVIDER scope：該時段預綁診間（選填） */
    resourceId?: string | null;
  }>;
}

interface UpdateScheduleRulesRes {
  rules: ScheduleRuleItem[];
}

// 特定日期覆寫 ---------------------------------------------------------------------------------

interface ScheduleOverrideItem {
  id: string;
  scope: ScheduleScopeType;
  resourceId: string | null;
  providerId?: string | null;
  date: string;
  startTime: string | null;
  endTime: string | null;
  isClosed: boolean;
  note: string;
}

interface GetScheduleOverridesParams {
  from?: string;
  to?: string;
  scope?: ScheduleScopeType;
  resourceId?: string;
  providerId?: string;
}

interface GetScheduleOverridesRes {
  items: ScheduleOverrideItem[];
}

interface CreateScheduleOverrideParams {
  scope: ScheduleScopeType;
  resourceId?: string | null;
  providerId?: string | null;
  date: string;
  startTime?: string;
  endTime?: string;
  isClosed?: boolean;
  note?: string;
}

interface CreateScheduleOverrideRes {
  override: ScheduleOverrideItem;
}

interface DeleteScheduleOverrideParams {
  id: string;
}

interface DeleteScheduleOverrideRes {
  id: string;
}
