/**
 * 统一配置服务
 * 优先读设置表，其次 .env；设置可在设置页修改，无需改 .env
 */
import useSettingsStore from '../stores/settingsStore';

const ENV_MAP = {
  tianapi_key: () => import.meta.env.VITE_TIANAPI_KEY || '',
  jisuapi_key: () => import.meta.env.VITE_JISUAPI_KEY || '',
  news_api_key: () => import.meta.env.VITE_NEWS_API_KEY || '',
  weather_api_key: () => import.meta.env.VITE_WEATHER_API_KEY || '',
};

export function getConfig(key) {
  const store = useSettingsStore.getState();
  const fromStore = store.get(key);
  if (fromStore != null && fromStore !== '') return fromStore;
  const fn = ENV_MAP[key];
  if (fn) {
    try {
      const v = fn();
      return v != null && String(v).trim() !== '' ? String(v).trim() : null;
    } catch {
      return null;
    }
  }
  return null;
}

export function getConfigStr(key, defaultVal = '') {
  const v = getConfig(key);
  return v != null && v !== '' ? v : defaultVal;
}

export function isConfigLoaded() {
  return useSettingsStore.getState().loaded;
}
