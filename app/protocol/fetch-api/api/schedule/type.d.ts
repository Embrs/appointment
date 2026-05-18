// 時段規則 + 特定日期覆寫 type 定義

type ScheduleScopeType = 'MERCHANT' | 'RESOURCE';

interface ScheduleRuleItem {
  id?: string;
  scope: ScheduleScopeType;
  resourceId: string | null;
  weekday: number;
  startTime: string;
  endTime: string;
  isActive?: boolean;
}

interface GetScheduleRulesParams {
  scope?: ScheduleScopeType;
  resourceId?: string;
}

interface GetScheduleRulesRes {
  rules: ScheduleRuleItem[];
}

interface UpdateScheduleRulesParams {
  scope: ScheduleScopeType;
  resourceId?: string | null;
  rules: Array<{
    weekday: number;
    startTime: string;
    endTime: string;
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
}

interface GetScheduleOverridesRes {
  items: ScheduleOverrideItem[];
}

interface CreateScheduleOverrideParams {
  scope: ScheduleScopeType;
  resourceId?: string | null;
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
