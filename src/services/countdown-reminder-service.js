/**
 * 倒数纪念日提醒服务
 * 检查今日是否为某事件的提醒日，触发系统通知
 */
import dayjs from 'dayjs';
import { getLogger } from './logger-client';
import { getNextOccurrence } from '../stores/countdownStore';

const logger = getLogger();
const STORAGE_PREFIX = 'pb_countdown_reminder_done_';
const POLL_INTERVAL_MS = 60 * 1000;

let pollTimer = null;
/** @type {() => Promise<Array<{ id: string; type: string; title: string; target_date: number; is_annual: number; reminder_days_before: number }>>} */
let getEventsFn = null;

function storageKey(eventId, dateStr) {
  return `${STORAGE_PREFIX}${eventId}_${dateStr}`;
}

function isDone(eventId, dateStr) {
  try {
    return localStorage.getItem(storageKey(eventId, dateStr)) === '1';
  } catch {
    return false;
  }
}

function markDone(eventId, dateStr) {
  try {
    localStorage.setItem(storageKey(eventId, dateStr), '1');
  } catch (e) {
    logger.warn('CountdownReminder', '标记已提醒失败', e?.message);
  }
}

async function showNotification(title, body) {
  const api = typeof window !== 'undefined' && window.electronAPI;
  if (api && typeof api.showReminderNotification === 'function') {
    try {
      await api.showReminderNotification({ title, body });
      return;
    } catch (e) {
      logger.warn('CountdownReminder', 'Electron 通知失败', e?.message);
    }
  }
  if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    try {
      new Notification(title, { body, tag: `countdown-${Date.now()}` });
    } catch (e) {
      logger.error('CountdownReminder', 'Notification 失败', e?.message);
    }
  }
}

async function runCheck() {
  try {
    if (!getEventsFn) return;
    const rows = await getEventsFn();
    const today = dayjs().startOf('day');
    const todayStr = today.format('YYYY-MM-DD');

    for (const e of rows || []) {
      const n = Math.max(0, parseInt(e.reminder_days_before, 10) || 0);
      if (n < 0) continue;
      const nextOcc = getNextOccurrence(e);
      const reminderDate = nextOcc.subtract(n, 'day');

      if (!reminderDate.isSame(today, 'day')) continue;
      if (isDone(e.id, todayStr)) continue;

      const typeLabels = { anniversary: '纪念日', countdown: '倒数日', birthday_holiday: '生日·节日' };
      const typeLabel = typeLabels[e.type] || e.type;
      const body = n === 0 ? '就是今天' : `提前 ${n} 天提醒`;
      await showNotification(`倒数纪念日：${e.title}`, `${typeLabel} · ${body}`);
      markDone(e.id, todayStr);
      logger.log('CountdownReminder', `已提醒: ${e.title}`);
    }
  } catch (err) {
    logger.error('CountdownReminder', '检查失败', err);
  }
}

/**
 * @param {() => Promise<Array>} getEvents - 返回倒数纪念日列表
 */
export function startCountdownReminderPolling(getEvents) {
  if (pollTimer) return;
  getEventsFn = typeof getEvents === 'function' ? getEvents : null;
  runCheck();
  pollTimer = setInterval(runCheck, POLL_INTERVAL_MS);
  logger.log('CountdownReminder', '轮询已启动');
}

export function stopCountdownReminderPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
    getEventsFn = null;
    logger.log('CountdownReminder', '轮询已停止');
  }
}
