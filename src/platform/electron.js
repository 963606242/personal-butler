/**
 * 平台 API - Electron 实现
 * 委托给 preload 暴露的 window.electronAPI
 */

const api = () => {
  if (typeof window === 'undefined' || !window.electronAPI) return null;
  return window.electronAPI;
};

export const getAppVersion = () => api()?.getAppVersion?.() ?? Promise.resolve('');
export const getUserDataPath = () => api()?.getUserDataPath?.() ?? Promise.resolve('');
export const getDatabasePath = () => api()?.getDatabasePath?.() ?? Promise.resolve('');

export const dbInit = () => api()?.dbInit?.() ?? Promise.resolve({ success: false, error: 'Electron API 不可用' });
export const dbQuery = (sql, params) => api()?.dbQuery?.(sql, params) ?? Promise.resolve({ success: false, error: 'Electron API 不可用' });
export const dbExecute = (sql, params) => api()?.dbExecute?.(sql, params) ?? Promise.resolve({ success: false, error: 'Electron API 不可用' });

export const log = (level, message) => api()?.log?.(level, message) ?? Promise.resolve();

export const fetchCalendarData = (url) => api()?.fetchCalendarData?.(url) ?? Promise.resolve({ success: false, error: 'Electron API 不可用' });
export const fetchUrl = (url) => api()?.fetchUrl?.(url) ?? Promise.resolve({ success: false, errorBody: 'Electron API 不可用' });
export const fetchJsonPost = (opts) => api()?.fetchJsonPost?.(opts) ?? Promise.resolve({ success: false, errorBody: 'Electron API 不可用' });

export const showReminderNotification = (payload) => api()?.showReminderNotification?.(payload) ?? Promise.resolve();
export const selectImageFile = () => api()?.selectImageFile?.() ?? Promise.resolve(null);

export const apiBridgeRestart = () => api()?.apiBridgeRestart?.() ?? Promise.resolve({ success: false });
export const readApiBridgeDoc = () => api()?.readApiBridgeDoc?.() ?? Promise.resolve({ success: false, content: '' });

/** 当前是否为有效的 Electron 环境（有 electronAPI） */
export const isElectron = () => typeof window !== 'undefined' && !!window.electronAPI;
