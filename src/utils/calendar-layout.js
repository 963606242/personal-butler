/**
 * 日历布局计算工具
 * 用于日视图中日程块的位置和冲突检测
 */

// 每小时高度（像素）
export const HOUR_HEIGHT = 60;

// 总高度（24小时）
export const TOTAL_HEIGHT = HOUR_HEIGHT * 24;

/**
 * 将时间转换为分钟数（从00:00开始计算）
 * @param {Date|number} time - Date 对象或时间戳
 * @returns {number} 分钟数 (0-1439)
 */
export function timeToMinutes(time) {
  if (!time) return 0;
  const date = time instanceof Date ? time : new Date(time);
  return date.getHours() * 60 + date.getMinutes();
}

/**
 * 计算日程块的垂直位置和高度
 * @param {Date|number} startTime - 开始时间
 * @param {Date|number} endTime - 结束时间
 * @returns {{ top: number, height: number }}
 */
export function calculateEventPosition(startTime, endTime) {
  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);
  
  // 确保结束时间大于开始时间
  const duration = endMinutes > startMinutes 
    ? endMinutes - startMinutes 
    : (endMinutes + 1440) - startMinutes; // 跨天情况
  
  const top = (startMinutes / 60) * HOUR_HEIGHT;
  const height = Math.max((duration / 60) * HOUR_HEIGHT, 24); // 最小高度 24px
  
  return { top, height };
}

/**
 * 判断两个日程是否时间重叠
 * @param {Object} event1 - 日程1，包含 start_time 和 end_time
 * @param {Object} event2 - 日程2，包含 start_time 和 end_time
 * @returns {boolean}
 */
export function isOverlapping(event1, event2) {
  // 全天事件不参与重叠计算
  if (!event1.start_time || !event2.start_time) return false;
  
  const start1 = timeToMinutes(event1.start_time);
  const end1 = event1.end_time ? timeToMinutes(event1.end_time) : start1 + 60;
  const start2 = timeToMinutes(event2.start_time);
  const end2 = event2.end_time ? timeToMinutes(event2.end_time) : start2 + 60;
  
  return start1 < end2 && start2 < end1;
}

/**
 * 检测并分组冲突的日程
 * @param {Array} events - 日程数组
 * @returns {Array<Array>} 冲突分组数组
 */
export function detectConflictGroups(events) {
  if (!events || events.length === 0) return [];
  
  // 过滤掉全天事件，只处理有时间的日程
  const timedEvents = events.filter(e => e.start_time);
  
  // 按开始时间排序
  const sorted = [...timedEvents].sort((a, b) => {
    return timeToMinutes(a.start_time) - timeToMinutes(b.start_time);
  });
  
  const groups = [];
  const processed = new Set();
  
  for (let i = 0; i < sorted.length; i++) {
    if (processed.has(sorted[i].id)) continue;
    
    const group = [sorted[i]];
    processed.add(sorted[i].id);
    
    // 找出所有与当前组重叠的日程
    let maxEnd = sorted[i].end_time ? timeToMinutes(sorted[i].end_time) : timeToMinutes(sorted[i].start_time) + 60;
    
    for (let j = i + 1; j < sorted.length; j++) {
      if (processed.has(sorted[j].id)) continue;
      
      const startJ = timeToMinutes(sorted[j].start_time);
      
      // 如果与组内任一日程重叠
      if (startJ < maxEnd) {
        group.push(sorted[j]);
        processed.add(sorted[j].id);
        const endJ = sorted[j].end_time ? timeToMinutes(sorted[j].end_time) : startJ + 60;
        maxEnd = Math.max(maxEnd, endJ);
      }
    }
    
    groups.push(group);
  }
  
  return groups;
}

/**
 * 计算冲突日程的水平布局
 * @param {Array} conflictGroup - 冲突日程组
 * @returns {Array} 带有布局信息的日程数组
 */
export function layoutConflictingEvents(conflictGroup) {
  if (!conflictGroup || conflictGroup.length === 0) return [];
  
  if (conflictGroup.length === 1) {
    return [{
      ...conflictGroup[0],
      layoutWidth: '100%',
      layoutLeft: '0%',
      layoutIndex: 0,
      layoutTotal: 1,
    }];
  }
  
  // 按开始时间排序
  const sorted = [...conflictGroup].sort((a, b) => {
    return timeToMinutes(a.start_time) - timeToMinutes(b.start_time);
  });
  
  // 计算每个日程占据的列
  const columns = [];
  
  sorted.forEach(event => {
    const startMinutes = timeToMinutes(event.start_time);
    
    // 找到第一个可用的列
    let columnIndex = 0;
    for (let i = 0; i < columns.length; i++) {
      const lastEventInColumn = columns[i][columns[i].length - 1];
      const lastEndMinutes = lastEventInColumn.end_time 
        ? timeToMinutes(lastEventInColumn.end_time) 
        : timeToMinutes(lastEventInColumn.start_time) + 60;
      
      if (startMinutes >= lastEndMinutes) {
        columnIndex = i;
        break;
      }
      columnIndex = i + 1;
    }
    
    if (!columns[columnIndex]) {
      columns[columnIndex] = [];
    }
    columns[columnIndex].push(event);
  });
  
  const totalColumns = columns.length;
  const result = [];
  
  columns.forEach((column, columnIndex) => {
    column.forEach(event => {
      result.push({
        ...event,
        layoutWidth: `${100 / totalColumns}%`,
        layoutLeft: `${(columnIndex / totalColumns) * 100}%`,
        layoutIndex: columnIndex,
        layoutTotal: totalColumns,
      });
    });
  });
  
  return result;
}

/**
 * 处理所有日程的布局
 * @param {Array} events - 日程数组
 * @returns {Array} 带有完整布局信息的日程数组
 */
export function processEventsLayout(events) {
  if (!events || events.length === 0) return [];
  
  const groups = detectConflictGroups(events);
  const layoutedEvents = [];
  
  groups.forEach(group => {
    const layouted = layoutConflictingEvents(group);
    layoutedEvents.push(...layouted);
  });
  
  // 添加位置信息
  return layoutedEvents.map(event => {
    const { top, height } = calculateEventPosition(event.start_time, event.end_time);
    return {
      ...event,
      layoutTop: top,
      layoutHeight: height,
    };
  });
}

/**
 * 获取全天事件
 * @param {Array} events - 日程数组
 * @returns {Array} 全天事件数组
 */
export function getAllDayEvents(events) {
  if (!events || events.length === 0) return [];
  return events.filter(e => !e.start_time);
}

/**
 * 获取有时间的事件
 * @param {Array} events - 日程数组
 * @returns {Array} 有时间的事件数组
 */
export function getTimedEvents(events) {
  if (!events || events.length === 0) return [];
  return events.filter(e => e.start_time);
}

/**
 * 根据优先级获取样式类名
 * @param {number} priority - 优先级 (0-3)
 * @returns {string} CSS 类名
 */
export function getPriorityClassName(priority) {
  switch (priority) {
    case 3:
      return 'event-block-high';
    case 2:
      return 'event-block-medium';
    case 1:
      return 'event-block-low';
    default:
      return 'event-block-normal';
  }
}

/**
 * 格式化时间显示
 * @param {Date|number} time - 时间
 * @returns {string} 格式化的时间字符串 (HH:mm)
 */
export function formatTime(time) {
  if (!time) return '';
  const date = time instanceof Date ? time : new Date(time);
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * 计算当前时间指示器的位置
 * @returns {number} top 值（像素）
 */
export function getCurrentTimePosition() {
  const now = new Date();
  const minutes = now.getHours() * 60 + now.getMinutes();
  return (minutes / 60) * HOUR_HEIGHT;
}

/**
 * 根据点击位置计算时间
 * @param {number} y - 点击的 Y 坐标
 * @param {number} containerTop - 容器的 top 偏移
 * @returns {{ hours: number, minutes: number }}
 */
export function calculateTimeFromPosition(y, containerTop = 0) {
  const relativeY = y - containerTop;
  const totalMinutes = Math.floor((relativeY / HOUR_HEIGHT) * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = Math.floor(totalMinutes % 60 / 15) * 15; // 15分钟为单位
  return { hours: Math.max(0, Math.min(23, hours)), minutes };
}
