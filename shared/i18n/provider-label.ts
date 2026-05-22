// 商家自訂「服務人員」稱呼解析；前後端共用，避免雙實作漂移
// fallback 鏈：自訂 label[locale] → 自訂 label[商家偏好語] → i18n 預設

export type ProviderLabelLocale = 'zh' | 'en' | 'ja';

export interface ProviderLabelInput {
  /** 商家三語自訂稱呼 Json，可能為 null / {} / 部分填寫 */
  providerLabel?: { zh?: string | null; en?: string | null; ja?: string | null } | null;
  /** 商家時區，用於推斷偏好語（Asia/Taipei → zh；Asia/Tokyo → ja；其他 → en） */
  timezone?: string | null;
}

const I18N_DEFAULT: Record<ProviderLabelLocale, string> = {
  zh: '服務人員',
  en: 'Provider',
  ja: 'スタッフ'
};

/** 由商家時區推斷偏好語（用於 fallback 第二層） */
export const inferMerchantLocale = (timezone?: string | null): ProviderLabelLocale => {
  if (!timezone) return 'zh';
  if (timezone.startsWith('Asia/Taipei') || timezone.startsWith('Asia/Shanghai') || timezone.startsWith('Asia/Hong_Kong')) {
    return 'zh';
  }
  if (timezone.startsWith('Asia/Tokyo')) return 'ja';
  return 'en';
};

const pickCustom = (
  label: ProviderLabelInput['providerLabel'],
  locale: ProviderLabelLocale
): string | undefined => {
  if (!label) return undefined;
  const value = label[locale];
  if (typeof value === 'string' && value.trim().length > 0) return value;
  return undefined;
};

/**
 * 解析商家「服務人員」稱呼。
 * @example resolveProviderLabel({ providerLabel: { zh: '醫師' }, timezone: 'Asia/Taipei' }, 'zh') → '醫師'
 * @example resolveProviderLabel({ providerLabel: {}, timezone: 'Asia/Taipei' }, 'en') → 'Provider'
 * @example resolveProviderLabel({ providerLabel: { zh: '醫師' }, timezone: 'Asia/Taipei' }, 'en') → '醫師'（fallback 商家偏好語）
 */
export const resolveProviderLabel = (
  merchant: ProviderLabelInput,
  locale: ProviderLabelLocale
): string => {
  const direct = pickCustom(merchant.providerLabel, locale);
  if (direct) return direct;

  const merchantLocale = inferMerchantLocale(merchant.timezone);
  if (merchantLocale !== locale) {
    const fallbackToMerchantLocale = pickCustom(merchant.providerLabel, merchantLocale);
    if (fallbackToMerchantLocale) return fallbackToMerchantLocale;
  }

  return I18N_DEFAULT[locale];
};

/**
 * 把 Provider 顯示名稱與商家自訂稱呼組合成完整文字。
 * - providerName 為空（null / undefined / 空字串）→ 回 null（呼叫端應跳過 dom 渲染）
 * - 商家有當前語系自訂稱呼：採「{providerName}{label}」（例：'王' + '醫師' → '王醫師'，zh / ja 直覺）
 * - 商家有商家偏好語自訂稱呼（fallback 命中）：同上採 suffix
 * - 全無自訂稱呼（走 i18n 預設）：採「{label} {providerName}」（例：'Provider Wang'，en 直覺）
 */
export const formatProviderDisplay = (
  merchant: ProviderLabelInput | null | undefined,
  locale: ProviderLabelLocale,
  providerName: string | null | undefined
): string | null => {
  if (!providerName) return null;
  if (!merchant) return `${I18N_DEFAULT[locale]} ${providerName}`;
  const direct = pickCustom(merchant.providerLabel, locale);
  if (direct) return `${providerName}${direct}`;
  const merchantLocale = inferMerchantLocale(merchant.timezone);
  const fallbackDirect =
    merchantLocale !== locale ? pickCustom(merchant.providerLabel, merchantLocale) : undefined;
  if (fallbackDirect) return `${providerName}${fallbackDirect}`;
  return `${I18N_DEFAULT[locale]} ${providerName}`;
};
