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
export const fetchUrlText = (url) => api()?.fetchUrlText?.(url) ?? Promise.resolve({ success: false, errorBody: 'Electron API 不可用' });
export const fetchJsonPost = (opts) => api()?.fetchJsonPost?.(opts) ?? Promise.resolve({ success: false, errorBody: 'Electron API 不可用' });

export const showReminderNotification = (payload) => api()?.showReminderNotification?.(payload) ?? Promise.resolve();
export const scheduleLocalNotification = async (payload) => {
  // Electron 侧暂不做“定时”系统通知：先退化为到点由业务轮询触发的即时通知
  // 未来如需可在主进程做任务调度（node-cron）或用系统通知 schedule 能力（不同 OS 支持不同）
  return { success: true };
};
export const cancelLocalNotification = async () => ({ success: true });
export const requestPermission = async (scope) => {
  // Electron 桌面端一般无需显式请求；这里统一返回 granted
  return { success: true, status: 'granted' };
};

export const upsertTodo = async () => ({ success: false, error: 'Electron 暂不支持写入系统代办/提醒事项' });
export const deleteTodo = async () => ({ success: false, error: 'Electron 暂不支持写入系统代办/提醒事项' });
export const upsertCalendarEvent = async () => ({ success: false, error: 'Electron 暂不支持写入系统日历' });
export const deleteCalendarEvent = async () => ({ success: false, error: 'Electron 暂不支持写入系统日历' });
export const selectImageFile = () => api()?.selectImageFile?.() ?? Promise.resolve(null);
export const readImageFile = (filePath) => api()?.readImageFile?.(filePath) ?? Promise.resolve(null);
export const selectMediaFile = (opts) => api()?.selectMediaFile?.(opts) ?? Promise.resolve(null);

// Electron 渲染进程内用 Web Audio API（MediaRecorder）录音，与 Web 一致
let electronMediaRecorder = null;
let electronAudioChunks = [];
export const startAudioRecording = async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    electronMediaRecorder = new MediaRecorder(stream);
    electronAudioChunks = [];
    electronMediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) electronAudioChunks.push(e.data);
    };
    electronMediaRecorder.start();
    return { success: true };
  } catch (e) {
    return { success: false, error: e?.message || '录音失败' };
  }
};
export const stopAudioRecording = async () => {
  if (!electronMediaRecorder) return { success: false, error: '未开始录音' };
  return new Promise((resolve) => {
    electronMediaRecorder.onstop = () => {
      const blob = new Blob(electronAudioChunks, { type: 'audio/webm' });
      const url = URL.createObjectURL(blob);
      electronMediaRecorder.stream.getTracks().forEach((t) => t.stop());
      electronMediaRecorder = null;
      electronAudioChunks = [];
      resolve({ success: true, filePath: url });
    };
    electronMediaRecorder.stop();
  });
};
export const cancelAudioRecording = async () => {
  if (!electronMediaRecorder) return { success: false };
  electronMediaRecorder.stream.getTracks().forEach((t) => t.stop());
  electronMediaRecorder = null;
  electronAudioChunks = [];
  return { success: true };
};

export const apiBridgeRestart = () => api()?.apiBridgeRestart?.() ?? Promise.resolve({ success: false });
export const readApiBridgeDoc = () => api()?.readApiBridgeDoc?.() ?? Promise.resolve({ success: false, content: '' });

export const syncExportData = () => api()?.syncExportData?.() ?? Promise.resolve({ success: false, error: 'Electron API 不可用' });
export const syncImportData = (payload) => api()?.syncImportData?.(payload) ?? Promise.resolve({ success: false, error: 'Electron API 不可用' });
export const syncOpenOAuthLogin = (opts) => api()?.syncOpenOAuthLogin?.(opts) ?? api()?.syncOnedriveOpenLogin?.(opts) ?? Promise.resolve({ success: false, error: 'Electron API 不可用' });
export const syncOnedriveOpenLogin = (opts) => api()?.syncOnedriveOpenLogin?.(opts) ?? api()?.syncOpenOAuthLogin?.(opts) ?? Promise.resolve({ success: false, error: 'Electron API 不可用' });
export const syncSaveEncryptionPassword = (pwd) => api()?.syncSaveEncryptionPassword?.(pwd) ?? Promise.resolve({ success: false });
export const syncGetEncryptionPassword = () => api()?.syncGetEncryptionPassword?.() ?? Promise.resolve({ success: false, password: null });
export const syncClearEncryptionPassword = () => api()?.syncClearEncryptionPassword?.() ?? Promise.resolve({ success: false });

/** 当前是否为有效的 Electron 环境（有 electronAPI） */
export const isElectron = () => typeof window !== 'undefined' && !!window.electronAPI;
