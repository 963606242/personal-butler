/**
 * 星座工具：根据生日（月-日）计算西方星座
 * 非必填，由生日推导。按阳历。
 */

/** [月, 日] 为该星座结束日（含），顺序：摩羯(跨年)、水瓶…射手、摩羯(12月) */
const SIGN_END = [
  [1, 19, '摩羯座'],
  [2, 18, '水瓶座'],
  [3, 20, '双鱼座'],
  [4, 19, '白羊座'],
  [5, 20, '金牛座'],
  [6, 21, '双子座'],
  [7, 22, '巨蟹座'],
  [8, 22, '狮子座'],
  [9, 22, '处女座'],
  [10, 23, '天秤座'],
  [11, 22, '天蝎座'],
  [12, 21, '射手座'],
  [12, 31, '摩羯座'],
];

function beforeOrEqual(m, d, endM, endD) {
  if (m < endM) return true;
  if (m > endM) return false;
  return d <= endD;
}

/**
 * @param {Date|number|string|import('dayjs').Dayjs} birth - 生日
 * @returns {string|null} 星座名称，无法解析则 null
 */
export function getZodiacFromBirthday(birth) {
  if (birth == null) return null;
  let month = 0;
  let day = 0;
  if (typeof birth === 'number') {
    const d = new Date(birth);
    month = d.getMonth() + 1;
    day = d.getDate();
  } else if (birth instanceof Date) {
    month = birth.getMonth() + 1;
    day = birth.getDate();
  } else if (typeof birth === 'string') {
    const d = new Date(birth);
    if (Number.isNaN(d.getTime())) return null;
    month = d.getMonth() + 1;
    day = d.getDate();
  } else if (birth && typeof birth.month === 'function' && typeof birth.date === 'function') {
    month = birth.month() + 1;
    day = birth.date();
  } else {
    return null;
  }
  for (const [endM, endD, name] of SIGN_END) {
    if (beforeOrEqual(month, day, endM, endD)) return name;
  }
  return '摩羯座';
}
