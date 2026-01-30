/**
 * 每日签到逻辑（localStorage，不落库）- 供仪表盘与趣味页共用
 */
import dayjs from 'dayjs';
import { YI_LIST, JI_LIST } from '../constants/fun-tools';

function seededPick(list, dateSeed, count) {
  const arr = [...list];
  const out = [];
  for (let i = 0; i < count && arr.length; i++) {
    const idx = (dateSeed + i * 17) % arr.length;
    out.push(arr[idx]);
    arr.splice(idx, 1);
  }
  return out;
}

export function getCheckinKey() {
  return `fun-checkin-${dayjs().format('YYYY-MM-DD')}`;
}

/** 从 localStorage 读取今日是否已签到及数据 */
export function getTodayCheckin() {
  const key = getCheckinKey();
  try {
    const cached = localStorage.getItem(key);
    if (cached) return JSON.parse(cached);
  } catch (_) {}
  return null;
}

/** 执行签到，写入 localStorage 并返回 { score, yi, ji } */
export function performCheckin() {
  const key = getCheckinKey();
  const dateStr = dayjs().format('YYYYMMDD');
  const seed = parseInt(dateStr, 10) % 100000;
  const score = 60 + (seed % 40);
  const yiCount = 4 + (seed % 2);
  const jiCount = 2 + (seed % 2);
  const yi = seededPick(YI_LIST, seed, yiCount);
  const ji = seededPick(JI_LIST, seed + 1, jiCount);
  const data = { score, yi, ji };
  localStorage.setItem(key, JSON.stringify(data));
  return data;
}
