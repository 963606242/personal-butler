/**
 * 平台 API - Web 实现
 * 用于浏览器 / PWA / 未来 Capacitor 等；数据库部分占位，后续可接 IndexedDB(Dexie) 等
 */

const notSupported = (name) => Promise.reject(new Error(`平台 API [${name}] 在 Web 环境下尚未实现`));

export const getAppVersion = () => Promise.resolve('0.0.0-web');
export const getUserDataPath = () => Promise.resolve('');
export const getDatabasePath = () => Promise.resolve('');

export const dbInit = () => notSupported('dbInit');
export const dbQuery = () => notSupported('dbQuery');
export const dbExecute = () => notSupported('dbExecute');

export const log = () => Promise.resolve(); // 仅控制台，不写文件

export const fetchCalendarData = (url) =>
  fetch(url).then((res) => (res.ok ? res.json().then((data) => ({ success: true, data })) : Promise.resolve({ success: false, error: res.statusText })));
export const fetchUrl = (url) =>
  fetch(url).then((res) => (res.ok ? res.json().then((data) => ({ success: true, data })) : res.text().then((errorBody) => ({ success: false, status: res.status, errorBody }))));
export const fetchJsonPost = (opts) =>
  fetch(opts.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    body: JSON.stringify(opts.body || {}),
  }).then((res) =>
    res.ok ? res.json().then((data) => ({ success: true, data })) : res.text().then((errorBody) => ({ success: false, status: res.status, errorBody }))
  );

export const showReminderNotification = async (payload) => {
  if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    new Notification(payload.title || '', { body: payload.body, tag: `pb-${Date.now()}` });
  }
};
export const scheduleLocalNotification = async () => ({ success: false, error: 'Web 定时通知依赖 Service Worker/Push，暂未实现' });
export const cancelLocalNotification = async () => ({ success: false });
export const requestPermission = async (scope) => {
  if (scope === 'notifications') {
    if (typeof Notification === 'undefined') return { success: false, status: 'denied', error: 'Notification API 不可用' };
    if (Notification.permission === 'granted') return { success: true, status: 'granted' };
    if (Notification.permission === 'denied') return { success: false, status: 'denied' };
    const r = await Notification.requestPermission().catch(() => 'denied');
    return { success: r === 'granted', status: r };
  }
  return { success: false, status: 'prompt', error: `permission(${scope}) 需要平台原生能力` };
};

export const upsertTodo = () => notSupported('upsertTodo');
export const deleteTodo = () => notSupported('deleteTodo');
export const upsertCalendarEvent = () => notSupported('upsertCalendarEvent');
export const deleteCalendarEvent = () => notSupported('deleteCalendarEvent');
export const selectImageFile = () => Promise.resolve(null); // Web 需用 <input type="file">，由调用方实现

export const apiBridgeRestart = () => Promise.resolve({ success: false });
export const readApiBridgeDoc = () => Promise.resolve({ success: false, content: '' });

export const isElectron = () => false;
