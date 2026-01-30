/** 习惯相关常量 */

export const FREQUENCY_OPTIONS = ['daily', 'weekdays', 'weekends', 'weekly'];

export const PERIOD_OPTIONS = [
  { value: 'dawn', label: '早晨', order: 0, hint: '起床、晨间' },
  { value: 'morning', label: '上午', order: 1, hint: '工作、学习' },
  { value: 'noon', label: '中午', order: 2, hint: '就餐、午休' },
  { value: 'afternoon', label: '下午', order: 3, hint: '办公、活动' },
  { value: 'dusk', label: '傍晚', order: 4, hint: '下班、运动' },
  { value: 'evening', label: '晚上', order: 5, hint: '晚餐、休闲' },
  { value: 'night', label: '睡前', order: 6, hint: '洗漱、就寝' },
];

export const PERIOD_LABELS = Object.fromEntries(PERIOD_OPTIONS.map((p) => [p.value, p.label]));

export const WEEKDAY_OPTIONS = [
  { value: 0, label: '周日' }, { value: 1, label: '周一' }, { value: 2, label: '周二' },
  { value: 3, label: '周三' }, { value: 4, label: '周四' }, { value: 5, label: '周五' },
  { value: 6, label: '周六' },
];
