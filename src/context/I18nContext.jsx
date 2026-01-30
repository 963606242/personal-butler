import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
import 'dayjs/locale/en';
import zhCN from '../i18n/locales/zh-CN.json';
import enUS from '../i18n/locales/en-US.json';
import useSettingsStore from '../stores/settingsStore';

const I18nContext = createContext({
  locale: 'zh-CN',
  t: (key, fallback) => fallback || key,
  setLocale: () => {},
});

export function useI18n() {
  return useContext(I18nContext);
}

const RESOURCES = {
  'zh-CN': zhCN,
  'en-US': enUS,
};

const DEFAULT_LOCALE = 'zh-CN';

function getBrowserLocale() {
  if (typeof navigator === 'undefined') return DEFAULT_LOCALE;
  const lang = (navigator.language || navigator.userLanguage || '').toLowerCase();
  if (lang.startsWith('en')) return 'en-US';
  if (lang.startsWith('zh')) return 'zh-CN';
  return DEFAULT_LOCALE;
}

function getNested(obj, path) {
  if (!obj || !path) return undefined;
  return path.split('.').reduce((acc, key) => {
    if (acc && Object.prototype.hasOwnProperty.call(acc, key)) {
      return acc[key];
    }
    return undefined;
  }, obj);
}

export function I18nProvider({ children }) {
  const { loaded, loadFromDb, get, set } = useSettingsStore();
  const [locale, setLocaleState] = useState(DEFAULT_LOCALE);

  useEffect(() => {
    loadFromDb();
  }, [loadFromDb]);

  useEffect(() => {
    if (!loaded) return;
    const saved = get('language');
    if (saved && RESOURCES[saved]) {
      setLocaleState(saved);
    } else {
      setLocaleState(getBrowserLocale());
    }
  }, [loaded, get]);

  useEffect(() => {
    // 同步 dayjs 与 html lang
    if (locale === 'en-US') {
      dayjs.locale('en');
    } else {
      dayjs.locale('zh-cn');
    }
    if (typeof document !== 'undefined') {
      document.documentElement.lang = locale === 'en-US' ? 'en' : 'zh-CN';
    }
  }, [locale]);

  const changeLocale = useCallback(
    async (next) => {
      const normalized = RESOURCES[next] ? next : DEFAULT_LOCALE;
      setLocaleState(normalized);
      try {
        await set('language', normalized);
      } catch (e) {
        // 语言切换失败不阻塞前端展示
        console.error('保存语言设置失败', e);
      }
    },
    [set]
  );

  const t = useCallback(
    (key, fallback, params) => {
      const dict = RESOURCES[locale] || RESOURCES[DEFAULT_LOCALE];
      let value = getNested(dict, key);
      if (value == null) value = fallback ?? key;
      if (typeof value === 'string' && params && typeof params === 'object') {
        return value.replace(/\{\{(\w+)\}\}/g, (_, k) => (params[k] != null ? String(params[k]) : `{{${k}}}`));
      }
      return value;
    },
    [locale]
  );

  const value = useMemo(
    () => ({
      locale,
      t,
      setLocale: changeLocale,
    }),
    [locale, t, changeLocale]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

