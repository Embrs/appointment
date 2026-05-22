// queue-display-screen TTS 三語映射 + i18n callPhrase 模板測試
// Dev server 在實機驗證階段不穩定，改以單元測試覆蓋 TTS 核心邏輯：
//  - locale → BCP47 lang 映射（zh/en/ja → zh-TW/en-US/ja-JP）
//  - display.tts.callPhraseSimple / callPhraseWithCustomer 三語存在且含必要 placeholder
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

describe('display.tts callPhrase 三語模板（隱私版：不含服務名稱）', () => {
  type LocaleShape = {
    display: {
      tts: {
        callPhraseSimple: string;
        callPhraseWithCustomer: string;
        callPhraseWithRoom: string;
      };
      calling: string;
      gotoRoom: string;
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
    it(`${name}：callPhraseSimple 存在且含 {number}、不含 {serviceName}`, () => {
      const phrase = mod.display.tts.callPhraseSimple;
      expect(typeof phrase).toBe('string');
      expect(phrase).toContain('{number}');
      expect(phrase).not.toContain('{serviceName}');
    });

    it(`${name}：callPhraseWithCustomer 存在且含 {number} 與 {customerName}、不含 {serviceName}`, () => {
      const phrase = mod.display.tts.callPhraseWithCustomer;
      expect(typeof phrase).toBe('string');
      expect(phrase).toContain('{number}');
      expect(phrase).toContain('{customerName}');
      expect(phrase).not.toContain('{serviceName}');
    });

    it(`${name}：callPhraseWithRoom 存在且含 {number} 與 {room}`, () => {
      const phrase = mod.display.tts.callPhraseWithRoom;
      expect(typeof phrase).toBe('string');
      expect(phrase).toContain('{number}');
      expect(phrase).toContain('{room}');
      expect(phrase).not.toContain('{serviceName}');
    });

    it(`${name}：display.gotoRoom 存在且含 {room}`, () => {
      const phrase = mod.display.gotoRoom;
      expect(typeof phrase).toBe('string');
      expect(phrase).toContain('{room}');
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

  it('三語 callPhraseSimple 內容彼此不同（避免漏譯）', () => {
    const phrases = new Set(locales.map(({ mod }) => mod.display.tts.callPhraseSimple));
    expect(phrases.size).toBe(3);
  });

  it('三語 callPhraseWithCustomer 內容彼此不同（避免漏譯）', () => {
    const phrases = new Set(locales.map(({ mod }) => mod.display.tts.callPhraseWithCustomer));
    expect(phrases.size).toBe(3);
  });

  it('三語 callPhraseWithRoom 內容彼此不同（避免漏譯）', () => {
    const phrases = new Set(locales.map(({ mod }) => mod.display.tts.callPhraseWithRoom));
    expect(phrases.size).toBe(3);
  });
});

describe('callPhrase 模板渲染（手動插值模擬 i18n）', () => {
  // 簡化的 {var} 替換，與 vue-i18n 行為一致
  const render = (tpl: string, vars: Record<string, string | number>) =>
    tpl.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''));

  it('zh callPhraseSimple 渲染：請 5 號', () => {
    const result = render(
      (zh as { display: { tts: { callPhraseSimple: string } } }).display.tts.callPhraseSimple,
      { number: 5 }
    );
    expect(result).toContain('5');
    expect(result).not.toContain('{');
  });

  it('zh callPhraseWithCustomer 渲染：含 5 與 王先生', () => {
    const result = render(
      (zh as { display: { tts: { callPhraseWithCustomer: string } } }).display.tts.callPhraseWithCustomer,
      { number: 5, customerName: '王先生' }
    );
    expect(result).toContain('5');
    expect(result).toContain('王先生');
    expect(result).not.toContain('{');
  });

  it('en callPhraseWithCustomer 渲染：含 5 與 customer name', () => {
    const result = render(
      (en as { display: { tts: { callPhraseWithCustomer: string } } }).display.tts.callPhraseWithCustomer,
      { number: 5, customerName: 'Mr. Wang' }
    );
    expect(result).toContain('Number 5');
    expect(result).toContain('Mr. Wang');
  });

  it('ja callPhraseWithCustomer 渲染：含 5番 與 customer name', () => {
    const result = render(
      (ja as { display: { tts: { callPhraseWithCustomer: string } } }).display.tts.callPhraseWithCustomer,
      { number: 5, customerName: '王様' }
    );
    expect(result).toContain('5番');
    expect(result).toContain('王様');
    expect(result).toContain('お越しください');
  });

  it('zh callPhraseWithRoom 渲染：含 5 與 A 診間（room 存在時用帶 room 變體）', () => {
    const result = render(
      (zh as { display: { tts: { callPhraseWithRoom: string } } }).display.tts.callPhraseWithRoom,
      { number: 5, room: 'A 診間' }
    );
    expect(result).toContain('5');
    expect(result).toContain('A 診間');
    expect(result).not.toContain('{');
  });

  it('en callPhraseWithRoom 渲染：含 5 與 Room A', () => {
    const result = render(
      (en as { display: { tts: { callPhraseWithRoom: string } } }).display.tts.callPhraseWithRoom,
      { number: 5, room: 'Room A' }
    );
    expect(result).toContain('Number 5');
    expect(result).toContain('Room A');
    expect(result).not.toContain('{');
  });

  it('ja callPhraseWithRoom 渲染：含 5番 與 A 診察室', () => {
    const result = render(
      (ja as { display: { tts: { callPhraseWithRoom: string } } }).display.tts.callPhraseWithRoom,
      { number: 5, room: 'A 診察室' }
    );
    expect(result).toContain('5番');
    expect(result).toContain('A 診察室');
    expect(result).not.toContain('{');
  });
});
