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
  // 主进程 GET 请求（绕过代理，用于新闻 API）
  fetchUrl: (url) => ipcRenderer.invoke('fetch-url', url),
  // 主进程 POST JSON（绕过代理，用于 AI API）
  fetchJsonPost: (opts) => ipcRenderer.invoke('fetch-json-post', opts),
  // 「可被 AI 调用」本地 API：保存设置后重启服务
  apiBridgeRestart: () => ipcRenderer.invoke('api-bridge-restart'),
  readApiBridgeDoc: () => ipcRenderer.invoke('read-api-bridge-doc'),
});
