/**
 * 日程冲突检测
 */

/**
 * 检测与候选日程在指定日期发生冲突的日程实例
 * @param {Array<Object>} instancesForDay - 当日日程实例（含 start_time, end_time, id, title, ...）
 * @param {Object} candidate - 候选日程 { start_time, end_time, id? }
 * @param {string} [excludeId] - 编辑时排除的日程 id（不与自己冲突）
 * @returns {Array<Object>} 冲突的日程列表
 */
export function getScheduleConflicts(instancesForDay, candidate, excludeId) {
  const aStart = candidate.start_time;
  const aEnd = candidate.end_time;

  if (aStart == null && aEnd == null) return [];
  const aEndVal = aEnd ?? aStart;
  const aStartVal = aStart ?? 0;

  const conflicts = [];
  for (const s of instancesForDay) {
    if (excludeId && s.id === excludeId) continue;
    const bStart = s.start_time;
    const bEnd = s.end_time;
    if (bStart == null && bEnd == null) continue;
    const bEndVal = bEnd ?? bStart;
    const bStartVal = bStart ?? 0;
    if (aStartVal < bEndVal && aEndVal > bStartVal) conflicts.push(s);
  }
  return conflicts;
}
