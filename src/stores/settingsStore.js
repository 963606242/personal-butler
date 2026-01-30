/**
 * 设置 Store
 * 持久化到 settings 表，供配置服务与设置页使用
 */
import { create } from 'zustand';
import { getDatabase } from '../services/database';
import { getLogger } from '../services/logger-client';

const logger = getLogger();

const DEFAULT_KEYS = [
  'tianapi_key',
  'jisuapi_key',
  'news_api_key',
  'weather_api_key',
  'ai_provider',
  'ollama_base_url',
  'ollama_model',
  'openai_base_url',
  'openai_api_key',
  'openai_model',
  'anthropic_base_url',
  'anthropic_api_key',
  'anthropic_model',
];

const useSettingsStore = create((set, get) => ({
  settings: {},
  loaded: false,

  async loadFromDb() {
    try {
      const db = await getDatabase();
      const rows = await db.query('SELECT key, value FROM settings');
      const map = {};
      (rows || []).forEach((r) => {
        try {
          map[r.key] = r.value == null ? '' : String(r.value);
        } catch {
          map[r.key] = '';
        }
      });
      set({ settings: map, loaded: true });
      return map;
    } catch (e) {
      logger.error('SettingsStore', '加载设置失败', e);
      set({ loaded: true });
      return {};
    }
  },

  get(key) {
    const v = get().settings[key];
    return v != null && v !== '' ? v : null;
  },

  async set(key, value) {
    const val = value == null ? '' : String(value).trim();
    set((s) => ({ settings: { ...s.settings, [key]: val } }));
    try {
      const db = await getDatabase();
      await db.execute(
        `INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)`,
        [key, val, Date.now()]
      );
    } catch (e) {
      logger.error('SettingsStore', '保存设置失败', e);
      throw e;
    }
  },

  async setMany(entries) {
    const next = { ...get().settings };
    for (const [k, v] of Object.entries(entries)) {
      next[k] = v == null ? '' : String(v).trim();
    }
    set({ settings: next });
    try {
      const db = await getDatabase();
      for (const [k, v] of Object.entries(entries)) {
        const val = v == null ? '' : String(v).trim();
        await db.execute(
          `INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)`,
          [k, val, Date.now()]
        );
      }
    } catch (e) {
      logger.error('SettingsStore', '批量保存设置失败', e);
      throw e;
    }
  },

  getDefaultKeys: () => DEFAULT_KEYS,
}));

export default useSettingsStore;
