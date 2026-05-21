// 螢幕顯示頁 TTS 廣播 composable（client-only）
// - isSupported：偵測 window.speechSynthesis 是否存在
// - isEnabled：使用者偏好（localStorage 持久化，預設 false）
// - Toggle()：切換開關，第一次開啟時呼叫空字串 utterance 解鎖 iOS Safari user-gesture 限制
// - Speak(text, lang)：將文字加入 TTS 佇列；不支援或關閉時 no-op

const STORAGE_KEY = 'queueDisplayTts';

type SupportedLang = 'zh-TW' | 'en-US' | 'ja-JP';

export const UseTts = () => {
  const isSupported = ref(false);
  const isEnabled = ref(false);

  if (import.meta.client) {
    isSupported.value = typeof window !== 'undefined' && 'speechSynthesis' in window;
    try {
      isEnabled.value = window.localStorage.getItem(STORAGE_KEY) === '1';
    } catch {
      isEnabled.value = false;
    }
  }

  const Persist = () => {
    if (!import.meta.client) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, isEnabled.value ? '1' : '0');
    } catch { /* ignore quota / private-mode */ }
  };

  const Speak = (text: string, lang: SupportedLang) => {
    if (!import.meta.client || !isSupported.value || !isEnabled.value) return;
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      // 開發時方便 Playwright console 驗證
      console.info(`[tts] lang=${lang} text=${text}`);
      const utter = new window.SpeechSynthesisUtterance(text);
      utter.lang = lang;
      utter.rate = 1.0;
      utter.pitch = 1.0;
      utter.volume = 1.0;
      window.speechSynthesis.speak(utter);
    } catch { /* ignore — TTS 為可選功能 */ }
  };

  /**
   * 切換開關。第一次由關 → 開時，立刻播放一次空字串
   * utterance，以解鎖 iOS Safari 的 user-gesture 限制
   * （之後由 watch 自動觸發的 Speak 即可正常發聲）。
   */
  const Toggle = () => {
    if (!isSupported.value) return;
    const next = !isEnabled.value;
    isEnabled.value = next;
    Persist();
    if (next && import.meta.client && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        const unlock = new window.SpeechSynthesisUtterance('');
        unlock.volume = 0;
        window.speechSynthesis.speak(unlock);
      } catch { /* ignore */ }
    }
  };

  return {
    isSupported,
    isEnabled,
    Speak,
    Toggle
  };
};

/** locale → BCP47 lang 字串映射 */
export const TtsLangMap: Record<'zh' | 'en' | 'ja', SupportedLang> = {
  zh: 'zh-TW',
  en: 'en-US',
  ja: 'ja-JP'
};
