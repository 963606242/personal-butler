/**
 * 日程分析统计
 */
import dayjs from 'dayjs';
import { expandScheduleForDateRange } from './schedule-repeat';

/**
 * 计算指定日期范围内的日程统计
 * @param {Array<Object>} schedules - 日程列表
 * @param {Date|string} rangeStart - 范围开始
 * @param {Date|string} rangeEnd - 范围结束
 * @returns {Object} { totalMinutes, scheduledMinutes, freeMinutes, byTag, instanceCount }
 */
export function computeScheduleStats(schedules, rangeStart, rangeEnd) {
  const start = dayjs(rangeStart).startOf('day');
  const end = dayjs(rangeEnd).endOf('day');
  const totalMinutes = Math.max(0, end.diff(start, 'minute') + 1);
  const instances = [];
  const byTag = new Map();

  for (const s of schedules) {
    const expanded = expandScheduleForDateRange(s, start.toDate(), end.toDate());
    for (const inst of expanded) {
      const a = inst._instanceStartMs;
      const b = inst._instanceEndMs ?? inst._instanceStartMs;
      const dur = Math.max(0, Math.round((b - a) / 60000));
      instances.push({ ...inst, _durationMinutes: dur });
      const tag = Array.isArray(inst.tags) && inst.tags.length > 0 ? inst.tags[0] : '未分类';
      byTag.set(tag, (byTag.get(tag) || 0) + dur);
    }
  }

  const scheduledMinutes = instances.reduce((sum, i) => sum + (i._durationMinutes || 0), 0);
  const freeMinutes = Math.max(0, totalMinutes - scheduledMinutes);

  return {
    totalMinutes,
    scheduledMinutes,
    freeMinutes,
    byTag: Array.from(byTag.entries()).map(([tag, minutes]) => ({ tag, minutes })),
    instanceCount: instances.length,
  };
}

export default computeScheduleStats;
