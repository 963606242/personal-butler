import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { ConfigProvider, theme } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import enUS from 'antd/locale/en_US';
import useSettingsStore from '../stores/settingsStore';
import useUserStore from '../stores/userStore';
import { useI18n } from './I18nContext';

const { defaultAlgorithm, darkAlgorithm } = theme;

const ThemeContext = createContext({ isDark: false, accent: 'neutral' });

export function useTheme() {
  return useContext(ThemeContext);
}

function getSystemDark() {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/** 性别 → 配色倾向：male 偏冷色/蓝，female 偏暖色/玫瑰，other 中性 */
function getAccentFromGender(gender) {
  if (gender === 'male') return 'male';
  if (gender === 'female') return 'female';
  return 'neutral';
}

const ACCENT_TOKENS = {
  male: {
    light: { colorPrimary: '#2563eb', colorLink: '#2563eb', colorPrimaryHover: '#1d4ed8', colorPrimaryActive: '#1e40af' },
    dark: { colorPrimary: '#3b82f6', colorLink: '#60a5fa', colorPrimaryHover: '#60a5fa', colorPrimaryActive: '#93c5fd' },
  },
  female: {
    light: { colorPrimary: '#db2777', colorLink: '#db2777', colorPrimaryHover: '#be185d', colorPrimaryActive: '#9d174d' },
    dark: { colorPrimary: '#ec4899', colorLink: '#f472b6', colorPrimaryHover: '#f472b6', colorPrimaryActive: '#f9a8d4' },
  },
  neutral: {
    light: {},
    dark: {},
  },
};

export function ThemeProvider({ children }) {
  const { loaded, loadFromDb, get } = useSettingsStore();
  const { userProfile } = useUserStore();
  const [systemDark, setSystemDark] = useState(getSystemDark);
  const { locale: language } = useI18n();

  useEffect(() => {
    loadFromDb();
  }, [loadFromDb]);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setSystemDark(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const preference = (loaded && get('theme')) || 'system';
  const isDark = preference === 'dark' || (preference === 'system' && systemDark);
  const accent = getAccentFromGender(userProfile?.gender);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    document.documentElement.setAttribute('data-accent', accent);
    document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
  }, [isDark, accent]);

  const themeConfig = useMemo(
    () => ({
      algorithm: isDark ? darkAlgorithm : defaultAlgorithm,
      token: ACCENT_TOKENS[accent][isDark ? 'dark' : 'light'],
    }),
    [isDark, accent]
  );

  const antdLocale = language === 'en-US' ? enUS : zhCN;

  return (
    <ThemeContext.Provider value={{ isDark, preference, accent }}>
      <ConfigProvider locale={antdLocale} theme={themeConfig}>
        {children}
      </ConfigProvider>
    </ThemeContext.Provider>
  );
}
