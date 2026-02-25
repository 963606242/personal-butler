const { contextBridge, ipcRenderer } = require('electron');

// 暴露受保护的方法给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getUserDataPath: () => ipcRenderer.invoke('get-user-data-path'),
  getDatabasePath: () => ipcRenderer.invoke('get-database-path'),
  // 数据库操作
  dbInit: () => ipcRenderer.invoke('db-init'),
  dbQuery: (sql, params) => ipcRenderer.invoke('db-query', sql, params),
  dbExecute: (sql, params) => ipcRenderer.invoke('db-execute', sql, params),
  // 日志操作
  log: (level, message) => ipcRenderer.invoke('log', level, message),
  // 日历数据 API 请求（在主进程中请求，避免 CORS）
  fetchCalendarData: (url) => ipcRenderer.invoke('fetch-calendar-data', url),
  // 日程提醒 - Windows 10/11 系统通知
  showReminderNotification: (payload) => ipcRenderer.invoke('show-reminder-notification', payload),
  // 图片文件选择
  selectImageFile: () => ipcRenderer.invoke('select-image-file'),
  // 读取本地图片为 base64（webSecurity 开启时替代 file://）
  readImageFile: (filePath) => ipcRenderer.invoke('read-image-file', filePath),
  // 媒体文件选择（图片/视频）
  selectMediaFile: (opts) => ipcRenderer.invoke('select-media-file', opts),
  // 录音
  startAudioRecording: () => ipcRenderer.invoke('start-audio-recording'),
  stopAudioRecording: () => ipcRenderer.invoke('stop-audio-recording'),
  cancelAudioRecording: () => ipcRenderer.invoke('cancel-audio-recording'),
  // 录音转写（OpenAI Whisper），参数 { base64, apiKey }
  transcribeAudio: (opts) => ipcRenderer.invoke('transcribe-audio', opts),
  // 主进程 GET 请求（绕过代理，用于新闻 API，返回 JSON）
  fetchUrl: (url) => ipcRenderer.invoke('fetch-url', url),
  // 主进程 GET 请求返回原始文本（用于 RSS/XML）
  fetchUrlText: (url) => ipcRenderer.invoke('fetch-url-text', url),
  // 主进程 POST JSON（绕过代理，用于 AI API）
  fetchJsonPost: (opts) => ipcRenderer.invoke('fetch-json-post', opts),
  // 「可被 AI 调用」本地 API：保存设置后重启服务
  apiBridgeRestart: () => ipcRenderer.invoke('api-bridge-restart'),
  readApiBridgeDoc: () => ipcRenderer.invoke('read-api-bridge-doc'),
  // 同步：导出/导入全量数据（主进程执行）
  syncExportData: () => ipcRenderer.invoke('sync-export-data'),
  syncImportData: (payload) => ipcRenderer.invoke('sync-import-data', payload),
  // OAuth 登录（OneDrive/Google Drive/Dropbox 等）：主进程打开登录窗口并监听 redirect，返回 code
  syncOpenOAuthLogin: (opts) => ipcRenderer.invoke('sync-open-oauth-login', opts),
  syncOnedriveOpenLogin: (opts) => ipcRenderer.invoke('sync-open-oauth-login', opts),
  syncSaveEncryptionPassword: (pwd) => ipcRenderer.invoke('sync-save-encryption-password', pwd),
  syncGetEncryptionPassword: () => ipcRenderer.invoke('sync-get-encryption-password'),
  syncClearEncryptionPassword: () => ipcRenderer.invoke('sync-clear-encryption-password'),
});
