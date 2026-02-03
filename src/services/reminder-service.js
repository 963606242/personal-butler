/**
 * 日程提醒服务
 * 定时检查待提醒日程，触发 in-app 弹窗 + 系统通知（Electron / Web Notification）
 */
import dayjs from 'dayjs';
import { getLogger } from './logger-client';
import { expandScheduleForDateRange } from '../utils/schedule-repeat';
import { showReminderNotification } from '../platform';

const logger = getLogger();
const REMINDER_STORAGE_PREFIX = 'pb_reminder_done_';
const POLL_INTERVAL_MS = 60 * 1000; // 每分钟

let pollTimer = null;
/** @type {((p: { title: string; body?: string; timeStr: string; location?: string; scheduleId: string; instanceStartMs: number }) => void) | null} */
let onReminderCallback = null;

/**
 * 生成提醒已发送的存储 key
 * @param {string} scheduleId
 * @param {number} instanceStartMs
 */
function reminderKey(scheduleId, instanceStartMs) {
  return `${REMINDER_STORAGE_PREFIX}${scheduleId}_${instanceStartMs}`;
}

function isReminderDone(scheduleId, instanceStartMs) {
  try {
    return localStorage.getItem(reminderKey(scheduleId, instanceStartMs)) === '1';
  } catch {
    return false;
  }
}

function markReminderDone(scheduleId, instanceStartMs) {
  try {
    localStorage.setItem(reminderKey(scheduleId, instanceStartMs), '1');
  } catch (e) {
    logger.warn('ReminderService', '标记已提醒失败:', e?.message);
  }
}

/**
 * 请求通知权限（Web 环境；Electron 主进程通知无需此处权限）
 */
async function ensureNotificationPermission() {
  if (typeof Notification === 'undefined') return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  try {
    const result = await Notification.requestPermission();
    return result === 'granted';
  } catch {
    return false;
  }
}

/**
 * 系统通知：通过平台 API（Electron 原生 Toast 或 Web Notification）
 * @param {string} title
 * @param {string} [body]
 */
async function showSystemNotification(title, body = '') {
  try {
    await showReminderNotification({ title, body });
    return;
  } catch (e) {
    logger.warn('ReminderService', '平台通知失败，尝试 Web Notification:', e?.message);
  }
  const ok = await ensureNotificationPermission();
  if (!ok) return;
  try {
    const n = new Notification(title, {
      body,
      tag: `pb-reminder-${Date.now()}`,
      requireInteraction: false,
    });
    n.onclick = () => {
      n.close();
      try {
        if (typeof window !== 'undefined' && window.focus) window.focus();
      } catch (_) {}
    };
  } catch (e) {
    logger.error('ReminderService', '显示通知失败:', e?.message);
  }
}

/**
 * 执行一轮提醒检查
 * @param {() => Promise<Array>} getSchedules - 返回原始日程列表（含 reminder_settings）
 */
async function runReminderCheck(getSchedules) {
  try {
    const schedules = await getSchedules();
    const withReminder = schedules.filter(
      (s) => s.reminder_settings?.enabled && s.reminder_settings?.minutes != null
    );
    if (withReminder.length === 0) return;

    const now = Date.now();
    const rangeStart = new Date(now);
    const rangeEnd = new Date(now + 2 * 60 * 60 * 1000); // 未来 2 小时内

    for (const schedule of withReminder) {
      const minutes = schedule.reminder_settings.minutes;
      const expanded = expandScheduleForDateRange(schedule, rangeStart, rangeEnd);

      for (const inst of expanded) {
        const startMs = inst._instanceStartMs;
        const reminderAt = startMs - minutes * 60 * 1000;

        if (now < reminderAt) continue;
        if (now >= startMs) continue;
        if (isReminderDone(schedule.id, startMs)) continue;

        const timeStr = dayjs(startMs).format('HH:mm');
        const body = `将于 ${timeStr} 开始${schedule.location ? ` · ${schedule.location}` : ''}`;
        const payload = {
          title: schedule.title,
          body: `将于 ${timeStr} 开始${schedule.location ? ` · ${schedule.location}` : ''}`,
          timeStr,
          location: schedule.location || undefined,
          scheduleId: schedule.id,
          instanceStartMs: startMs,
        };

        if (typeof onReminderCallback === 'function') {
          onReminderCallback(payload);
        }
        showSystemNotification(`日程提醒：${schedule.title}`, body).catch(() => {});
        markReminderDone(schedule.id, startMs);
        logger.log('ReminderService', `已提醒: ${schedule.title} @ ${timeStr}`);
      }
    }
  } catch (e) {
    logger.error('ReminderService', '提醒检查失败:', e?.message);
  }
}

/**
 * 启动提醒轮询
 * @param {() => Promise<Array>} getSchedules - 返回原始日程列表
 * @param {(payload: { title: string, body?: string, timeStr: string, location?: string, scheduleId: string, instanceStartMs: number }) => void} [onReminder] - 每条提醒触发时回调（用于 in-app 弹窗）
 */
export function startReminderPolling(getSchedules, onReminder) {
  if (pollTimer) return;
  onReminderCallback = typeof onReminder === 'function' ? onReminder : null;
  const fn = () => runReminderCheck(getSchedules);
  fn(); // 立即执行一次
  pollTimer = setInterval(fn, POLL_INTERVAL_MS);
  logger.log('ReminderService', '提醒轮询已启动');
}

/**
 * 停止提醒轮询
 */
export function stopReminderPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
    onReminderCallback = null;
    logger.log('ReminderService', '提醒轮询已停止');
  }
}

export default { startReminderPolling, stopReminderPolling };
