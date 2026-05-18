interface AdSlotConfig {
  enabled: boolean;
  html?: string;
}

export const StoreEnv = defineStore('StoreEnv', () => {
  const env = ref({
    apiBase: ''
  });

  // 廣告插槽設定。MVP 永遠空物件，未來可從後端拉取或由管理員後台設定。
  // key 為 AdSlot 元件的 name prop（例：merchant-page-top、queue-status-below）
  const adConfig = ref<Record<string, AdSlotConfig>>({});

  /** 初始化 */
  const Init = () => {
    if (import.meta.server) {
      const runtimeConfig = useRuntimeConfig();
      env.value = runtimeConfig;
    }
  };

  Init();
  return { env, adConfig };
});
