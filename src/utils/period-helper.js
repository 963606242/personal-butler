/**
 * 时段判断工具
 * 根据当前时间判断处于哪个时段
 */
import dayjs from 'dayjs';
import { PERIOD_OPTIONS } from '../constants/habits';

/**
 * 根据当前时间判断时段
 * @param {Date|dayjs.Dayjs} date - 可选，默认为当前时间
 * @returns {string} 时段值：dawn/morning/noon/afternoon/dusk/evening/night
 */
export function getCurrentPeriod(date = null) {
  const now = date ? dayjs(date) : dayjs();
  const hour = now.hour();

  // 早晨：5:00 - 8:59
  if (hour >= 5 && hour < 9) {
    return 'dawn';
  }
  // 上午：9:00 - 11:59
  if (hour >= 9 && hour < 12) {
    return 'morning';
  }
  // 中午：12:00 - 13:59
  if (hour >= 12 && hour < 14) {
    return 'noon';
  }
  // 下午：14:00 - 17:59
  if (hour >= 14 && hour < 18) {
    return 'afternoon';
  }
  // 傍晚：18:00 - 19:59
  if (hour >= 18 && hour < 20) {
    return 'dusk';
  }
  // 晚上：20:00 - 22:59
  if (hour >= 20 && hour < 23) {
    return 'evening';
  }
  // 睡前：23:00 - 4:59
  return 'night';
}

/**
 * 获取时段信息
 * @param {string} period - 时段值
 * @returns {object|null} 时段信息对象
 */
export function getPeriodInfo(period) {
  return PERIOD_OPTIONS.find((p) => p.value === period) || null;
}

/**
 * 获取当前时段信息
 * @param {Date|dayjs.Dayjs} date - 可选，默认为当前时间
 * @returns {object|null} 当前时段信息对象
 */
export function getCurrentPeriodInfo(date = null) {
  const period = getCurrentPeriod(date);
  return getPeriodInfo(period);
}
