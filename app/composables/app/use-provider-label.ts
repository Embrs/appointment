// 顧客 / 商家端共用：解析「服務人員」稱呼並組合成顯示文字
// 三層 fallback 與 prefix / suffix 組合邏輯封裝自 ~shared/i18n/provider-label
import {
  formatProviderDisplay,
  resolveProviderLabel,
  type ProviderLabelInput,
  type ProviderLabelLocale
} from '~shared/i18n/provider-label';

export const UseProviderLabel = (merchantRef: Ref<ProviderLabelInput | null | undefined>) => {
  const { locale } = useI18n();

  const ResolveLocale = (): ProviderLabelLocale => {
    const l = locale.value;
    if (l.startsWith('en')) return 'en';
    if (l.startsWith('ja')) return 'ja';
    return 'zh';
  };

  /** 商家自訂或 i18n 預設的「服務人員」稱呼字 */
  const Label = computed<string>(() => {
    if (!merchantRef.value) {
      const cur = ResolveLocale();
      return cur === 'zh' ? '服務人員' : cur === 'en' ? 'Provider' : 'スタッフ';
    }
    return resolveProviderLabel(merchantRef.value, ResolveLocale());
  });

  /**
   * 組合 Provider 顯示文字（含商家自訂稱呼前後綴邏輯）。
   * providerName 為空時回 null，呼叫端應跳過 dom 渲染。
   */
  const FormatProviderDisplay = (providerName: string | null | undefined): string | null => {
    return formatProviderDisplay(merchantRef.value, ResolveLocale(), providerName);
  };

  return {
    Label,
    FormatProviderDisplay
  };
};
