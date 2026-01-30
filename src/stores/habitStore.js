/**
 * 习惯追踪 Store
 * 习惯 CRUD、打卡、时段、周/月/年报统计
 */
import { create } from 'zustand';
import { getDatabase } from '../services/database';
import { getCryptoService } from '../services/crypto';
import { getLogger } from '../services/logger-client';
import useUserStore from './userStore';
import dayjs from 'dayjs';
import { FREQUENCY_OPTIONS, PERIOD_OPTIONS } from '../constants/habits';
import { getCurrentPeriod } from '../utils/period-helper';

const logger = getLogger();
const PERIOD_ORDER = Object.fromEntries(PERIOD_OPTIONS.map((p) => [p.value, p.order]));

function startOfDay(date) {
  return dayjs(date).startOf('day').valueOf();
}

function parseTargetDays(targetDays) {
  if (!targetDays) return null;
  try {
    const v = typeof targetDays === 'string' ? JSON.parse(targetDays) : targetDays;
    return Array.isArray(v) ? v : null;
  } catch {
    return null;
  }
}

const useHabitStore = create((set, get) => ({
  habits: [],
  logsByHabit: {},
  loading: false,

  async loadHabits() {
    try {
      set({ loading: true });
      const db = await getDatabase();
      const { currentUser } = useUserStore.getState();
      if (!currentUser) {
        set({ habits: [], loading: false });
        return [];
      }
      const rows = await db.query(
        `SELECT * FROM habits WHERE user_id = ? ORDER BY sort_order ASC, period ASC, created_at ASC`,
        [currentUser.id]
      );
      const parsed = rows.map((h) => ({
        ...h,
        target_days: parseTargetDays(h.target_days),
        period: h.period || 'morning',
        sort_order: h.sort_order ?? 0,
      }));
      set({ habits: parsed, loading: false });
      logger.log('HabitStore', `加载 ${parsed.length} 个习惯`);
      return parsed;
    } catch (e) {
      logger.error('HabitStore', '加载习惯失败', e);
      set({ habits: [], loading: false });
      throw e;
    }
  },

  async createHabit(data) {
    const db = await getDatabase();
    const { currentUser } = useUserStore.getState();
    if (!currentUser) throw new Error('用户未登录');
    const id = getCryptoService().generateUUID();
    const now = Date.now();
    const targetDays = data.target_days?.length ? JSON.stringify(data.target_days) : null;
    const order = data.sort_order ?? (PERIOD_ORDER[data.period] ?? 0);
    await db.execute(
      `INSERT INTO habits (id, user_id, name, frequency, reminder_time, target_days, period, sort_order, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        currentUser.id,
        data.name || '',
        data.frequency || 'daily',
        data.reminder_time || null,
        targetDays,
        data.period || 'morning',
        order,
        now,
      ]
    );
    await get().loadHabits();
    return id;
  },

  async updateHabit(id, data) {
    const db = await getDatabase();
    const { currentUser } = useUserStore.getState();
    if (!currentUser) throw new Error('用户未登录');
    const targetDays = data.target_days?.length ? JSON.stringify(data.target_days) : null;
    const order = data.sort_order ?? (data.period != null ? PERIOD_ORDER[data.period] : undefined);
    const updates = [
      'name = ?', 'frequency = ?', 'reminder_time = ?', 'target_days = ?',
    ];
    const values = [
      data.name ?? '',
      data.frequency ?? 'daily',
      data.reminder_time ?? null,
      targetDays,
    ];
    if (data.period != null) {
      updates.push('period = ?');
      values.push(data.period);
    }
    if (order != null) {
      updates.push('sort_order = ?');
      values.push(order);
    }
    values.push(id, currentUser.id);
    await db.execute(
      `UPDATE habits SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`,
      values
    );
    await get().loadHabits();
  },

  async deleteHabit(id) {
    const db = await getDatabase();
    const { currentUser } = useUserStore.getState();
    if (!currentUser) throw new Error('用户未登录');
    await db.execute('DELETE FROM habit_logs WHERE habit_id = ? AND user_id = ?', [id, currentUser.id]);
    await db.execute('DELETE FROM habits WHERE id = ? AND user_id = ?', [id, currentUser.id]);
    await get().loadHabits();
    const { logsByHabit } = get();
    const next = { ...logsByHabit };
    delete next[id];
    set({ logsByHabit: next });
  },

  async loadLogs(habitId, startDate, endDate) {
    const db = await getDatabase();
    const { currentUser } = useUserStore.getState();
    if (!currentUser) return [];
    const start = startDate ? startOfDay(startDate) : startOfDay(dayjs().subtract(366, 'day'));
    const end = endDate ? dayjs(endDate).endOf('day').valueOf() : dayjs().endOf('day').valueOf();
    let sql = `SELECT * FROM habit_logs WHERE user_id = ? AND date >= ? AND date <= ?`;
    const params = [currentUser.id, start, end];
    if (habitId) {
      sql += ` AND habit_id = ?`;
      params.push(habitId);
    }
    sql += ` ORDER BY date DESC`;
    const rows = await db.query(sql, params);
    const byHabit = {};
    for (const r of rows) {
      if (!byHabit[r.habit_id]) byHabit[r.habit_id] = {};
      byHabit[r.habit_id][r.date] = { completed: !!r.completed, notes: r.notes || null };
    }
    set((s) => ({ logsByHabit: { ...s.logsByHabit, ...byHabit } }));
    return rows;
  },

  async checkIn(habitId, date, completed, notes = null) {
    const db = await getDatabase();
    const { currentUser } = useUserStore.getState();
    if (!currentUser) throw new Error('用户未登录');
    const dateMs = startOfDay(date);
    const logId = getCryptoService().generateUUID();
    const now = Date.now();
    await db.execute(
      `INSERT INTO habit_logs (id, habit_id, user_id, date, completed, notes, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(habit_id, date) DO UPDATE SET completed = excluded.completed, notes = excluded.notes`,
      [logId, habitId, currentUser.id, dateMs, completed ? 1 : 0, notes, now]
    );
    const { logsByHabit } = get();
    const next = { ...logsByHabit };
    if (!next[habitId]) next[habitId] = {};
    next[habitId][dateMs] = { completed: !!completed, notes };
    set({ logsByHabit: next });
  },

  getLog(habitId, date) {
    const d = startOfDay(date);
    const byHabit = get().logsByHabit[habitId] || {};
    return byHabit[d] || null;
  },

  isTargetDay(habit, date) {
    const d = dayjs(date);
    const dow = d.day();
    const target = parseTargetDays(habit.target_days);
    if (habit.frequency === 'daily') return true;
    if (habit.frequency === 'weekdays') return dow >= 1 && dow <= 5;
    if (habit.frequency === 'weekends') return dow === 0 || dow === 6;
    if (habit.frequency === 'weekly') {
      return Array.isArray(target) && target.length ? target.includes(dow) : false;
    }
    return true;
  },

  getStreak(habitId, asOfDate = new Date()) {
    const { habits, logsByHabit } = get();
    const habit = habits.find((h) => h.id === habitId);
    if (!habit) return 0;
    const byDate = logsByHabit[habitId] || {};
    let d = dayjs(asOfDate).startOf('day');
    let streak = 0;
    let checked = 0;
    for (let i = 0; i < 366; i++) {
      const ms = d.valueOf();
      const log = byDate[ms];
      const isTarget = get().isTargetDay(habit, d);
      if (!isTarget) {
        d = d.subtract(1, 'day');
        continue;
      }
      checked++;
      if (log?.completed) {
        streak++;
        d = d.subtract(1, 'day');
        continue;
      }
      if (checked === 1) return 0;
      break;
    }
    return streak;
  },

  getStats(habitId, days = 30) {
    const { habits, logsByHabit } = get();
    const habit = habits.find((h) => h.id === habitId);
    if (!habit) return { targetDays: 0, completed: 0, rate: 0 };
    const byDate = logsByHabit[habitId] || {};
    const end = dayjs().endOf('day');
    let targetDays = 0;
    let completed = 0;
    for (let i = 0; i < days; i++) {
      const d = end.subtract(i, 'day');
      if (!get().isTargetDay(habit, d)) continue;
      targetDays++;
      const log = byDate[d.startOf('day').valueOf()];
      if (log?.completed) completed++;
    }
    const rate = targetDays ? Math.round((completed / targetDays) * 100) : 0;
    return { targetDays, completed, rate };
  },

  /** 周报：指定周的起止日期 */
  getWeeklyReport(weekStart) {
    const start = dayjs(weekStart).startOf('day');
    const end = start.add(6, 'day').endOf('day');
    return get().getReportForRange(start, end, 'week');
  },

  /** 月报 */
  getMonthlyReport(year, month) {
    const start = dayjs().year(year).month(month - 1).startOf('month');
    const end = start.endOf('month');
    return get().getReportForRange(start, end, 'month');
  },

  /** 年报 */
  getYearlyReport(year) {
    const start = dayjs().year(year).startOf('year');
    const end = start.endOf('year');
    return get().getReportForRange(start, end, 'year');
  },

  /** 通用报表：按日期范围聚合 */
  getReportForRange(start, end, scope = 'week') {
    const { habits, logsByHabit } = get();
    const byHabit = {};
    const byPeriod = {}; // { period: { target, completed } }
    const dailyCompletion = [];
    let totalTarget = 0;
    let totalCompleted = 0;

    let cur = start.startOf('day');
    const endDay = end.startOf('day');
    while (cur.isBefore(endDay) || cur.isSame(endDay, 'day')) {
      const dateMs = cur.valueOf();
      let dayTarget = 0;
      let dayDone = 0;
      for (const h of habits) {
        if (!get().isTargetDay(h, cur)) continue;
        dayTarget++;
        totalTarget++;
        const p = h.period || 'morning';
        if (!byPeriod[p]) {
          byPeriod[p] = { target: 0, completed: 0 };
        }
        byPeriod[p].target++;
        const log = (logsByHabit[h.id] || {})[dateMs];
        if (log?.completed) {
          dayDone++;
          totalCompleted++;
          byHabit[h.id] = (byHabit[h.id] || 0) + 1;
          byPeriod[p].completed++;
        }
      }
      dailyCompletion.push({
        date: cur.format('YYYY-MM-DD'),
        label: cur.format('M/D'),
        target: dayTarget,
        completed: dayDone,
        rate: dayTarget ? Math.round((dayDone / dayTarget) * 100) : 0,
      });
      cur = cur.add(1, 'day');
    }

    const habitDetails = habits.map((h) => {
      let target = 0;
      let completed = 0;
      let c = start.startOf('day');
      while (c.isBefore(endDay) || c.isSame(endDay, 'day')) {
        if (get().isTargetDay(h, c)) {
          target++;
          const log = (logsByHabit[h.id] || {})[c.valueOf()];
          if (log?.completed) completed++;
        }
        c = c.add(1, 'day');
      }
      return {
        habit: h,
        target,
        completed,
        rate: target ? Math.round((completed / target) * 100) : 0,
        streak: get().getStreak(h.id, end.toDate()),
      };
    });

    const rate = totalTarget ? Math.round((totalCompleted / totalTarget) * 100) : 0;
    return {
      scope,
      start: start.format('YYYY-MM-DD'),
      end: end.format('YYYY-MM-DD'),
      totalTarget,
      totalCompleted,
      rate,
      byHabit,
      byPeriod,
      dailyCompletion,
      habitDetails,
    };
  },

  /** 获取当前时段的推荐习惯（未完成的） */
  getCurrentPeriodHabits(date = null) {
    const { habits, logsByHabit } = get();
    const period = getCurrentPeriod(date);
    const today = date ? dayjs(date) : dayjs();
    const todayMs = today.startOf('day').valueOf();

    const periodHabits = habits.filter((h) => (h.period || 'morning') === period);
    const recommendations = [];

    for (const habit of periodHabits) {
      if (!get().isTargetDay(habit, today)) continue;
      const log = (logsByHabit[habit.id] || {})[todayMs];
      const completed = !!(log && log.completed);
      if (!completed) {
        recommendations.push({
          habit,
          completed: false,
          log: log || null,
        });
      }
    }

    return recommendations;
  },
}));

export default useHabitStore;
export { FREQUENCY_OPTIONS, PERIOD_OPTIONS, PERIOD_ORDER };
