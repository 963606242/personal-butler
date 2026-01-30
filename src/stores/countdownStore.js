/**
 * 倒数纪念日 Store
 * 类型：纪念日、倒数日、生日节日；支持提醒
 */
import { create } from 'zustand';
import { getDatabase } from '../services/database';
import { getCryptoService } from '../services/crypto';
import { getLogger } from '../services/logger-client';
import useUserStore from './userStore';
import dayjs from 'dayjs';

const logger = getLogger();

export const COUNTDOWN_TYPES = [
  { value: 'anniversary', label: '纪念日', desc: '如结婚纪念日' },
  { value: 'countdown', label: '倒数日', desc: '如距离高考' },
  { value: 'birthday_holiday', label: '生日、节日', desc: '如特殊民族、信仰节日' },
];

export const REMINDER_DAYS_OPTIONS = [
  { value: 0, label: '当天' },
  { value: 1, label: '提前 1 天' },
  { value: 3, label: '提前 3 天' },
  { value: 7, label: '提前 7 天' },
  { value: 30, label: '提前 30 天' },
];

export const REPEAT_UNIT_OPTIONS = [
  { value: 'day', label: '天' },
  { value: 'week', label: '周' },
  { value: 'month', label: '月' },
  { value: 'year', label: '年' },
];

/** 是否有重复：repeat_interval > 0，或兼容 is_annual */
function hasRepeat(e) {
  const n = parseInt(e.repeat_interval, 10) || 0;
  if (n > 0) return true;
  return !!e.is_annual;
}

/** 重复间隔与单位；无重复时返回 null */
function getRepeatRule(e) {
  const n = parseInt(e.repeat_interval, 10) || 0;
  if (n > 0 && e.repeat_unit) return { interval: n, unit: e.repeat_unit };
  if (e.is_annual) return { interval: 1, unit: 'year' };
  return null;
}

/** 下一个 occurrence 的 dayjs（含当天），无重复则返回 target 当天 */
export function getNextOccurrence(event) {
  const target = dayjs(event.target_date).startOf('day');
  const rule = getRepeatRule(event);
  const today = dayjs().startOf('day');
  if (!rule) return target;
  const { interval, unit } = rule;
  let next = target;
  while (next.isBefore(today)) {
    next = next.add(interval, unit);
  }
  return next;
}

const useCountdownStore = create((set, get) => ({
  events: [],
  loading: false,

  async loadEvents() {
    const { currentUser } = useUserStore.getState();
    if (!currentUser) {
      set({ events: [] });
      return [];
    }
    set({ loading: true });
    try {
      const db = await getDatabase();
      const rows = await db.query(
        'SELECT * FROM countdown_events WHERE user_id = ? ORDER BY target_date ASC',
        [currentUser.id]
      );
      set({ events: rows || [], loading: false });
      return rows || [];
    } catch (e) {
      logger.error('CountdownStore', '加载失败', e);
      set({ events: [], loading: false });
      throw e;
    }
  },

  async createEvent(data) {
    const db = await getDatabase();
    const { currentUser } = useUserStore.getState();
    if (!currentUser) throw new Error('用户未登录');
    const id = getCryptoService().generateUUID();
    const now = Date.now();
    const targetDate = data.target_date instanceof Date
      ? data.target_date.getTime()
      : typeof data.target_date === 'number'
        ? data.target_date
        : dayjs(data.target_date).startOf('day').valueOf();
    const isAnnual = data.is_annual ? 1 : 0;
    const reminder = Math.max(0, parseInt(data.reminder_days_before, 10) || 0);
    const repeatInterval = Math.max(0, parseInt(data.repeat_interval, 10) || 0);
    const repeatUnit = repeatInterval > 0 && data.repeat_unit ? data.repeat_unit : null;

    await db.execute(
      `INSERT INTO countdown_events (id, user_id, type, title, target_date, is_annual, reminder_days_before, repeat_interval, repeat_unit, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        currentUser.id,
        data.type || 'countdown',
        data.title || '',
        targetDate,
        isAnnual,
        reminder,
        repeatInterval,
        repeatUnit,
        data.notes || null,
        now,
        now,
      ]
    );
    await get().loadEvents();
    return id;
  },

  async updateEvent(id, data) {
    const db = await getDatabase();
    const { currentUser } = useUserStore.getState();
    if (!currentUser) throw new Error('用户未登录');
    const fields = [];
    const values = [];
    if (data.type !== undefined) { fields.push('type = ?'); values.push(data.type); }
    if (data.title !== undefined) { fields.push('title = ?'); values.push(data.title); }
    if (data.target_date !== undefined) {
      const t = data.target_date instanceof Date
        ? data.target_date.getTime()
        : typeof data.target_date === 'number'
          ? data.target_date
          : dayjs(data.target_date).startOf('day').valueOf();
      fields.push('target_date = ?');
      values.push(t);
    }
    if (data.is_annual !== undefined) { fields.push('is_annual = ?'); values.push(data.is_annual ? 1 : 0); }
    if (data.reminder_days_before !== undefined) {
      fields.push('reminder_days_before = ?');
      values.push(Math.max(0, parseInt(data.reminder_days_before, 10) || 0));
    }
    if (data.repeat_interval !== undefined) {
      const v = Math.max(0, parseInt(data.repeat_interval, 10) || 0);
      fields.push('repeat_interval = ?');
      values.push(v);
    }
    if (data.repeat_unit !== undefined) {
      const ri = data.repeat_interval !== undefined ? data.repeat_interval : get().events?.find((x) => x.id === id)?.repeat_interval;
      const v = (parseInt(ri, 10) || 0) > 0 && data.repeat_unit ? data.repeat_unit : null;
      fields.push('repeat_unit = ?');
      values.push(v);
    }
    if (data.notes !== undefined) { fields.push('notes = ?'); values.push(data.notes); }
    if (fields.length === 0) return;
    fields.push('updated_at = ?');
    values.push(Date.now());
    values.push(id, currentUser.id);
    await db.execute(
      `UPDATE countdown_events SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`,
      values
    );
    await get().loadEvents();
  },

  async deleteEvent(id) {
    const db = await getDatabase();
    const { currentUser } = useUserStore.getState();
    if (!currentUser) throw new Error('用户未登录');
    await db.execute('DELETE FROM countdown_events WHERE id = ? AND user_id = ?', [id, currentUser.id]);
    await get().loadEvents();
  },

  getEventsByType(type) {
    return (get().events || []).filter((e) => !type || e.type === type);
  },

  /** 距离目标日天数：正数=未来，0=当天，负数=已过 */
  daysUntil(event) {
    const next = getNextOccurrence(event);
    const today = dayjs().startOf('day');
    return next.diff(today, 'day');
  },

  hasRepeat,
  getRepeatRule,

  /** 展示用：每 N 年/月/周/天，无重复则空串 */
  formatRepeatLabel(event) {
    const rule = getRepeatRule(event);
    if (!rule) return '';
    const u = { day: '天', week: '周', month: '月', year: '年' }[rule.unit] || rule.unit;
    return `每 ${rule.interval} ${u}`;
  },
}));

export default useCountdownStore;
