// shared/i18n/provider-label.ts 純函式單元測試
// 涵蓋三層 fallback：自訂 label[locale] → 自訂 label[商家偏好語] → i18n 預設
import { describe, it, expect } from 'vitest';
import {
  resolveProviderLabel,
  inferMerchantLocale,
  formatProviderDisplay
} from '~shared/i18n/provider-label';

describe('inferMerchantLocale', () => {
  it('Asia/Taipei → zh', () => {
    expect(inferMerchantLocale('Asia/Taipei')).toBe('zh');
  });

  it('Asia/Tokyo → ja', () => {
    expect(inferMerchantLocale('Asia/Tokyo')).toBe('ja');
  });

  it('America/New_York → en', () => {
    expect(inferMerchantLocale('America/New_York')).toBe('en');
  });

  it('null / undefined → zh（預設）', () => {
    expect(inferMerchantLocale(null)).toBe('zh');
    expect(inferMerchantLocale(undefined)).toBe('zh');
  });
});

describe('resolveProviderLabel — 第一層：自訂 label[locale]', () => {
  it('locale=zh 且自訂 zh 有值 → 直接回自訂', () => {
    const merchant = { providerLabel: { zh: '醫師', en: 'Doctor', ja: '医師' }, timezone: 'Asia/Taipei' };
    expect(resolveProviderLabel(merchant, 'zh')).toBe('醫師');
    expect(resolveProviderLabel(merchant, 'en')).toBe('Doctor');
    expect(resolveProviderLabel(merchant, 'ja')).toBe('医師');
  });

  it('自訂 label 為空字串 / 空白 → 視為未填', () => {
    const merchant = { providerLabel: { zh: '   ', en: '' }, timezone: 'Asia/Taipei' };
    expect(resolveProviderLabel(merchant, 'zh')).toBe('服務人員');
    expect(resolveProviderLabel(merchant, 'en')).toBe('Provider');
  });
});

describe('resolveProviderLabel — 第二層：自訂 label[商家偏好語]', () => {
  it('locale=en 但只填 zh、商家在台北 → fallback 到 zh 自訂', () => {
    const merchant = { providerLabel: { zh: '醫師' }, timezone: 'Asia/Taipei' };
    expect(resolveProviderLabel(merchant, 'en')).toBe('醫師');
    expect(resolveProviderLabel(merchant, 'ja')).toBe('醫師');
  });

  it('locale=zh 但只填 ja、商家在東京 → fallback 到 ja 自訂', () => {
    const merchant = { providerLabel: { ja: 'セラピスト' }, timezone: 'Asia/Tokyo' };
    expect(resolveProviderLabel(merchant, 'zh')).toBe('セラピスト');
    expect(resolveProviderLabel(merchant, 'en')).toBe('セラピスト');
  });

  it('當 locale === 商家偏好語且無自訂 → 直接 fallback 至預設（不重覆查）', () => {
    const merchant = { providerLabel: {}, timezone: 'Asia/Taipei' };
    expect(resolveProviderLabel(merchant, 'zh')).toBe('服務人員');
  });
});

describe('resolveProviderLabel — 第三層：i18n 預設', () => {
  it('完全空 providerLabel → 各 locale 走預設', () => {
    const merchant = { providerLabel: {}, timezone: 'Asia/Taipei' };
    expect(resolveProviderLabel(merchant, 'zh')).toBe('服務人員');
    expect(resolveProviderLabel(merchant, 'en')).toBe('Provider');
    expect(resolveProviderLabel(merchant, 'ja')).toBe('スタッフ');
  });

  it('null providerLabel → 走預設', () => {
    const merchant = { providerLabel: null, timezone: 'Asia/Taipei' };
    expect(resolveProviderLabel(merchant, 'zh')).toBe('服務人員');
  });

  it('沒有 providerLabel 欄位 → 走預設', () => {
    const merchant = { timezone: 'Asia/Taipei' };
    expect(resolveProviderLabel(merchant, 'en')).toBe('Provider');
  });

  it('商家偏好語也無自訂 → 預設', () => {
    const merchant = { providerLabel: { zh: '醫師' }, timezone: 'America/New_York' };
    // 商家偏好語=en、無自訂 en、無自訂偏好語 → 走 i18n 預設
    expect(resolveProviderLabel(merchant, 'ja')).toBe('スタッフ');
  });
});

describe('formatProviderDisplay — providerName 與 label 組合', () => {
  it('providerName 為 null / undefined / 空字串 → 回 null', () => {
    const m = { providerLabel: { zh: '醫師' }, timezone: 'Asia/Taipei' };
    expect(formatProviderDisplay(m, 'zh', null)).toBeNull();
    expect(formatProviderDisplay(m, 'zh', undefined)).toBeNull();
    expect(formatProviderDisplay(m, 'zh', '')).toBeNull();
  });

  it('merchant 缺失 → 用 i18n 預設 prefix', () => {
    expect(formatProviderDisplay(null, 'zh', '王')).toBe('服務人員 王');
    expect(formatProviderDisplay(undefined, 'en', 'Wang')).toBe('Provider Wang');
    expect(formatProviderDisplay(null, 'ja', '王')).toBe('スタッフ 王');
  });

  it('商家有當前語系自訂稱呼 → 採 suffix（zh / ja 直覺）', () => {
    const m = { providerLabel: { zh: '醫師', en: 'Doctor', ja: '医師' }, timezone: 'Asia/Taipei' };
    expect(formatProviderDisplay(m, 'zh', '王')).toBe('王醫師');
    expect(formatProviderDisplay(m, 'en', 'Wang')).toBe('WangDoctor');
    expect(formatProviderDisplay(m, 'ja', '王')).toBe('王医師');
  });

  it('當前語系自訂稱呼為空字串 → 走 fallback', () => {
    const m = { providerLabel: { zh: '醫師', en: '   ' }, timezone: 'Asia/Taipei' };
    // en 自訂為空白 → fallback 商家偏好語 zh 的自訂稱呼，採 suffix
    expect(formatProviderDisplay(m, 'en', 'Wang')).toBe('Wang醫師');
  });

  it('全無自訂稱呼 → 採 prefix（i18n 預設）', () => {
    const m = { providerLabel: {}, timezone: 'Asia/Taipei' };
    expect(formatProviderDisplay(m, 'zh', '王')).toBe('服務人員 王');
    expect(formatProviderDisplay(m, 'en', 'Wang')).toBe('Provider Wang');
    expect(formatProviderDisplay(m, 'ja', '王')).toBe('スタッフ 王');
  });

  it('商家偏好語不同於當前 locale 且只填了偏好語 → 採 suffix', () => {
    // 商家偏好語=zh（Asia/Taipei）、僅填 zh、瀏覽 locale=ja
    const m = { providerLabel: { zh: '醫師' }, timezone: 'Asia/Taipei' };
    expect(formatProviderDisplay(m, 'ja', '王')).toBe('王醫師');
  });
});
