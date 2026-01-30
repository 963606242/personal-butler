/**
 * 日程重复规则扩展工具
 * 将带 repeat_rule 的日程展开为具体日期范围内的实例
 */
import dayjs from 'dayjs';

/**
 * 判断某日期是否在重复规则的结束日期之前（含当天）
 * @param {Object} rule - { endDate: 'YYYY-MM-DD' | null }
 * @param {Date|dayjs.Dayjs} date
 */
function beforeOrOnEndDate(rule, date) {
  if (!rule || !rule.endDate) return true;
  return dayjs(date).isBefore(dayjs(rule.endDate)) || dayjs(date).isSame(dayjs(rule.endDate), 'day');
}

/**
 * 判断某日期是否在日程起始日期当天或之后
 * @param {Object} schedule - 含 date 时间戳
 * @param {Date|dayjs.Dayjs} d
 */
function onOrAfterScheduleStart(schedule, d) {
  const start = dayjs(schedule.date).startOf('day');
  return d.isAfter(start) || d.isSame(start, 'day');
}

/**
 * 为日程的某次发生生成当天的 start/end 时间戳（沿用原有时分）
 * @param {Object} schedule - 含 date, start_time, end_time
 * @param {dayjs.Dayjs} occurrenceDate - 发生日期（当天 00:00）
 */
function alignTimeToDate(schedule, occurrenceDate) {
  const base = schedule.start_time ? dayjs(schedule.start_time) : dayjs(schedule.date);
  const endBase = schedule.end_time ? dayjs(schedule.end_time) : null;
  const start = occurrenceDate
    .hour(base.hour())
    .minute(base.minute())
    .second(0)
    .millisecond(0);
  const end = endBase
    ? occurrenceDate
        .hour(endBase.hour())
        .minute(endBase.minute())
        .second(0)
        .millisecond(0)
    : null;
  return { startMs: start.valueOf(), endMs: end ? end.valueOf() : null };
}

/**
 * 展开日程在日期范围内的所有发生日期
 * @param {Object} schedule - 日程对象，含 id, date, start_time, end_time, repeat_rule, ...
 * @param {Date|string} rangeStart - 范围开始
 * @param {Date|string} rangeEnd - 范围结束
 * @returns {Array<Object>} 实例列表，每项 { ...schedule, _instanceDate, _instanceStartMs, _instanceEndMs, _isRepeatInstance }
 */
export function expandScheduleForDateRange(schedule, rangeStart, rangeEnd) {
  const start = dayjs(rangeStart).startOf('day');
  const end = dayjs(rangeEnd).endOf('day');
  const rule = schedule.repeat_rule;
  const instances = [];

  if (!rule || !rule.type || rule.type === 'none') {
    const d = dayjs(schedule.date).startOf('day');
    if ((d.isAfter(start) || d.isSame(start, 'day')) && (d.isBefore(end) || d.isSame(end, 'day'))) {
      const { startMs, endMs } = alignTimeToDate(schedule, d);
      instances.push({
        ...schedule,
        _instanceDate: d.valueOf(),
        _instanceStartMs: startMs,
        _instanceEndMs: endMs,
        _isRepeatInstance: false,
      });
    }
    return instances;
  }

  const interval = Math.max(1, rule.interval || 1);
  const scheduleStart = dayjs(schedule.date).startOf('day');
  const weekdays = rule.weekdays; // [0-6] 0=周日

  const addInstance = (d) => {
    if (!onOrAfterScheduleStart(schedule, d)) return;
    if (!beforeOrOnEndDate(rule, d)) return;
    if (d.isBefore(start) || d.isAfter(end)) return;

    const { startMs, endMs } = alignTimeToDate(schedule, d);
    instances.push({
      ...schedule,
      _instanceDate: d.valueOf(),
      _instanceStartMs: startMs,
      _instanceEndMs: endMs,
      _isRepeatInstance: true,
    });
  };

  if (rule.type === 'daily') {
    let d = scheduleStart;
    if (d.isBefore(start)) {
      const days = start.diff(d, 'day');
      const steps = Math.floor(days / interval) + (days % interval ? 1 : 0);
      d = d.add(steps * interval, 'day');
    }
    while (d.isBefore(end) || d.isSame(end, 'day')) {
      if (!beforeOrOnEndDate(rule, d)) break;
      addInstance(d);
      d = d.add(interval, 'day');
    }
    return instances;
  }

  if (rule.type === 'weekly') {
    const dow = (d) => d.day(); // 0=Sun, 6=Sat
    const targetDows = Array.isArray(weekdays) && weekdays.length ? weekdays : [dow(scheduleStart)];
    let d = scheduleStart;
    if (d.isBefore(start)) d = start;
    const limit = end.add(1, 'day');
    while (d.isBefore(limit)) {
      if (!beforeOrOnEndDate(rule, d)) break;
      if (d.isBefore(scheduleStart)) {
        d = d.add(1, 'day');
        continue;
      }
      if (targetDows.includes(dow(d))) {
        addInstance(d);
      }
      d = d.add(1, 'day');
    }
    if (interval > 1) {
      const baseWeekStart = scheduleStart.startOf('week');
      return instances.filter((inst) => {
        const weeksDiff = dayjs(inst._instanceDate).diff(baseWeekStart, 'week');
        return weeksDiff % interval === 0;
      });
    }
    return instances;
  }

  if (rule.type === 'monthly') {
    const dayOfMonth = scheduleStart.date();
    let curr = scheduleStart.startOf('day');
    while (curr.isBefore(start)) {
      curr = curr.add(interval, 'month');
      const last = curr.endOf('month').date();
      curr = curr.date(Math.min(dayOfMonth, last)).startOf('day');
    }
    let count = 0;
    const maxMonths = 24 * 12;
    while (count < maxMonths && (curr.isBefore(end) || curr.isSame(end, 'day'))) {
      if (!beforeOrOnEndDate(rule, curr)) break;
      addInstance(curr);
      curr = curr.add(interval, 'month');
      const last = curr.endOf('month').date();
      curr = curr.date(Math.min(dayOfMonth, last)).startOf('day');
      count++;
    }
    return instances;
  }

  if (rule.type === 'yearly') {
    let curr = scheduleStart.startOf('day');
    while (curr.isBefore(start)) {
      curr = curr.add(interval, 'year');
    }
    let count = 0;
    while (count < 20 && (curr.isBefore(end) || curr.isSame(end, 'day'))) {
      if (!beforeOrOnEndDate(rule, curr)) break;
      addInstance(curr);
      curr = curr.add(interval, 'year');
      count++;
    }
    return instances;
  }

  return instances;
}

/**
 * 按日期聚合实例：date -> instances[]
 * @param {Array<Object>} instances - expandScheduleForDateRange 的结果
 */
export function groupInstancesByDate(instances) {
  const byDate = new Map();
  for (const inst of instances) {
    const key = dayjs(inst._instanceDate).format('YYYY-MM-DD');
    if (!byDate.has(key)) byDate.set(key, []);
    byDate.get(key).push(inst);
  }
  return byDate;
}
