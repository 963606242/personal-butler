/**
 * 平台 API - Capacitor 实现（iOS/Android）
 *
 * 说明：
 * - 这里不引入 `@capacitor/*` 依赖，避免在当前未接入 Capacitor 时影响构建。
 * - 在 Capacitor 容器内，`window.Capacitor` / `window.Capacitor.Plugins` 通常存在。
 * - 通知：优先使用 LocalNotifications（若插件存在）。
 * - 日历/提醒事项（代办）：需要自定义原生插件（建议基于 iOS EventKit：EKEventStore）。
 */

const getPlugins = () => {
  if (typeof window === 'undefined') return null;
  const cap = window.Capacitor;
  return cap?.Plugins || null;
};

const notSupported = (name) => Promise.reject(new Error(`平台 API [${name}] 在 Capacitor 环境下尚未安装/实现`));

export const getAppVersion = () => Promise.resolve('0.0.0-capacitor');
export const getUserDataPath = () => Promise.resolve('');
export const getDatabasePath = () => Promise.resolve('');

export const dbInit = () => notSupported('dbInit');
export const dbQuery = () => notSupported('dbQuery');
export const dbExecute = () => notSupported('dbExecute');

export const log = () => Promise.resolve();

export const fetchCalendarData = (url) =>
  fetch(url).then((res) => (res.ok ? res.json().then((data) => ({ success: true, data })) : Promise.resolve({ success: false, error: res.statusText })));
export const fetchUrl = (url) =>
  fetch(url).then((res) => (res.ok ? res.json().then((data) => ({ success: true, data })) : res.text().then((errorBody) => ({ success: false, status: res.status, errorBody }))));
export const fetchJsonPost = (opts) =>
  fetch(opts.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    body: JSON.stringify(opts.body || {}),
  }).then((res) => (res.ok ? res.json().then((data) => ({ success: true, data })) : res.text().then((errorBody) => ({ success: false, status: res.status, errorBody }))));

export const requestPermission = async (scope) => {
  try {
    const plugins = getPlugins();
    if (scope === 'notifications' && plugins?.LocalNotifications?.requestPermissions) {
      const r = await plugins.LocalNotifications.requestPermissions();
      const status = r?.display === 'granted' ? 'granted' : r?.display === 'denied' ? 'denied' : 'prompt';
      return { success: status === 'granted', status };
    }
    // calendar / reminders 需自定义插件
    return { success: false, status: 'prompt', error: `permission(${scope}) 需要原生插件支持` };
  } catch (e) {
    return { success: false, status: 'denied', error: e?.message || String(e) };
  }
};

export const scheduleLocalNotification = async (payload) => {
  const plugins = getPlugins();
  if (!plugins?.LocalNotifications?.schedule) return { success: false, error: 'LocalNotifications 插件不可用' };

  const atDate = new Date(payload.at);
  try {
    await plugins.LocalNotifications.schedule({
      notifications: [
        {
          id: Number(String(payload.id).replace(/\D/g, '').slice(0, 9)) || Date.now() % 1000000000,
          title: payload.title || '',
          body: payload.body || '',
          schedule: { at: atDate },
          sound: payload.sound === false ? null : undefined,
        },
      ],
    });
    return { success: true };
  } catch (e) {
    return { success: false, error: e?.message || String(e) };
  }
};

export const cancelLocalNotification = async (id) => {
  const plugins = getPlugins();
  if (!plugins?.LocalNotifications?.cancel) return { success: false };
  try {
    const numericId = Number(String(id).replace(/\D/g, '').slice(0, 9));
    await plugins.LocalNotifications.cancel({ notifications: [{ id: numericId }] });
    return { success: true };
  } catch {
    return { success: false };
  }
};

export const showReminderNotification = async (payload) => {
  // 立即触发：用 schedule(at=now) 实现
  const at = Date.now() + 100;
  const r = await scheduleLocalNotification({ id: `now-${at}`, title: payload.title, body: payload.body, at });
  if (!r.success) throw new Error(r.error || '通知失败');
};

export const upsertTodo = () => notSupported('upsertTodo'); // iOS Reminders: 需自定义 EventKit 插件
export const deleteTodo = () => notSupported('deleteTodo');
export const upsertCalendarEvent = () => notSupported('upsertCalendarEvent'); // iOS Calendar: 需自定义 EventKit 插件
export const deleteCalendarEvent = () => notSupported('deleteCalendarEvent');

export const selectImageFile = () => Promise.resolve(null); // iOS 建议用相册/相机插件，后续再接

export const apiBridgeRestart = () => Promise.resolve({ success: false });
export const readApiBridgeDoc = () => Promise.resolve({ success: false, content: '' });

export const isElectron = () => false;

