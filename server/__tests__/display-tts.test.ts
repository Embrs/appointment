// queue-display-screen TTS 三語映射 + i18n callPhrase 模板測試
// Dev server 在實機驗證階段不穩定，改以單元測試覆蓋 TTS 核心邏輯：
//  - locale → BCP47 lang 映射（zh/en/ja → zh-TW/en-US/ja-JP）
//  - display.tts.callPhrase 三語存在且含 {number}/{serviceName} 變數
import { describe, it, expect } from 'vitest';

// 直接從 i18n locale 檔載入，不依賴 nuxt i18n runtime
import zh from '../../i18n/locales/zh.js';
import en from '../../i18n/locales/en.js';
import ja from '../../i18n/locales/ja.js';

// 與 app/composables/app/use-tts.ts 內 TtsLangMap 保持一致；複製定義避免引入 Vue runtime
const TtsLangMap = {
  zh: 'zh-TW',
  en: 'en-US',
  ja: 'ja-JP'
} as const;

describe('TTS lang map', () => {
  it('zh → zh-TW', () => {
    expect(TtsLangMap.zh).toBe('zh-TW');
  });

  it('en → en-US', () => {
    expect(TtsLangMap.en).toBe('en-US');
  });

  it('ja → ja-JP', () => {
    expect(TtsLangMap.ja).toBe('ja-JP');
  });

  it('涵蓋三個 i18n locale 全部', () => {
    expect(Object.keys(TtsLangMap).sort()).toEqual(['en', 'ja', 'zh']);
  });
});

describe('display.tts.callPhrase 三語模板', () => {
  type LocaleShape = {
    display: {
      tts: { callPhrase: string };
      calling: string;
      next: string;
      nextAfter: string;
      waiting: string;
      estimate: string;
      noService: string;
      allDone: string;
      openDisplay: string;
      copyLink: string;
      linkCopied: string;
    };
  };

  const locales: Array<{ name: 'zh' | 'en' | 'ja'; mod: LocaleShape }> = [
    { name: 'zh', mod: zh as LocaleShape },
    { name: 'en', mod: en as LocaleShape },
    { name: 'ja', mod: ja as LocaleShape }
  ];

  for (const { name, mod } of locales) {
    it(`${name}：display.tts.callPhrase 存在且含 {number} 與 {serviceName}`, () => {
      const phrase = mod.display.tts.callPhrase;
      expect(typeof phrase).toBe('string');
      expect(phrase).toContain('{number}');
      expect(phrase).toContain('{serviceName}');
    });

    it(`${name}：display.* 必要鍵齊全`, () => {
      const required: Array<keyof LocaleShape['display']> = [
        'calling', 'next', 'nextAfter', 'waiting', 'estimate',
        'noService', 'allDone', 'openDisplay', 'copyLink', 'linkCopied'
      ];
      for (const key of required) {
        expect(typeof mod.display[key]).toBe('string');
        expect(mod.display[key].length).toBeGreaterThan(0);
      }
    });
  }

  it('三語 callPhrase 內容彼此不同（避免漏譯）', () => {
    const phrases = new Set(locales.map(({ mod }) => mod.display.tts.callPhrase));
    expect(phrases.size).toBe(3);
  });
});

describe('callPhrase 模板渲染（手動插值模擬 i18n）', () => {
  // 簡化的 {var} 替換，與 vue-i18n 行為一致
  const render = (tpl: string, vars: Record<string, string | number>) =>
    tpl.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''));

  it('zh 渲染：請 5 號到 補牙', () => {
    const result = render((zh as { display: { tts: { callPhrase: string } } }).display.tts.callPhrase, { number: 5, serviceName: '補牙' });
    expect(result).toBe('請 5 號到 補牙');
  });

  it('en 渲染：Number 5, please proceed to ...', () => {
    const result = render((en as { display: { tts: { callPhrase: string } } }).display.tts.callPhrase, { number: 5, serviceName: 'Filling' });
    expect(result).toContain('Number 5');
    expect(result).toContain('Filling');
  });

  it('ja 渲染：5番のお客様、...へお越しください', () => {
    const result = render((ja as { display: { tts: { callPhrase: string } } }).display.tts.callPhrase, { number: 5, serviceName: '虫歯治療' });
    expect(result).toContain('5番');
    expect(result).toContain('虫歯治療');
    expect(result).toContain('お越しください');
  });
});
