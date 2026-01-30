/**
 * AI 对话「携带数据」服务
 * 按用户多选类型聚合习惯打卡、日程、天气、服装、用户信息等，供与 AI 对话时注入上下文
 */
import dayjs from 'dayjs';
import useUserStore from '../stores/userStore';
import useScheduleStore from '../stores/scheduleStore';
import useHabitStore from '../stores/habitStore';
import useWeatherStore from '../stores/weatherStore';
import useOutfitStore from '../stores/outfitStore';
import useClothingStore from '../stores/clothingStore';
import useEquipmentStore from '../stores/equipmentStore';
import useCountdownStore, { COUNTDOWN_TYPES } from '../stores/countdownStore';
import { getLogger } from './logger-client';
import { EQUIPMENT_CATEGORIES } from '../stores/equipmentStore';
import { getZodiacFromBirthday } from '../utils/zodiac';

const logger = getLogger();

const CATEGORY_LABELS = {
  top: '上衣',
  bottom: '下装',
  outerwear: '外套',
  accessories: '配饰',
  shoes: '鞋类',
};

const CAT_LABELS = Object.fromEntries((EQUIPMENT_CATEGORIES || []).map((c) => [c.value, c.label]));

const COUNTDOWN_TYPE_LABELS = Object.fromEntries((COUNTDOWN_TYPES || []).map((t) => [t.value, t.label]));

/** 可携带的数据类型 */
export const DATA_CARRY_OPTIONS = [
  { id: 'habit_logs', label: '习惯打卡', desc: '习惯列表、近 30 天打卡与连续天数，适合请 AI 总结规律与不足' },
  { id: 'schedule', label: '日程', desc: '今日及近期日程' },
  { id: 'weather', label: '天气', desc: '当前城市天气' },
  { id: 'clothing', label: '服装与搭配', desc: '衣橱与搭配记录' },
  { id: 'equipment', label: '装备', desc: '装备列表，可请 AI 再分类、补充信息' },
  { id: 'countdown', label: '倒数纪念日', desc: '倒数日、纪念日、生日节日，可请 AI 提醒或给建议' },
  { id: 'profile', label: '用户信息', desc: '性别、城市、生日、星座、MBTI 等基础信息' },
];

async function loadStores() {
  const today = dayjs();
  const user = useUserStore.getState();
  const schedule = useScheduleStore.getState();
  const habit = useHabitStore.getState();
  const weather = useWeatherStore.getState();
  const outfit = useOutfitStore.getState();
  const clothing = useClothingStore.getState();
  const equipment = useEquipmentStore.getState();
  const countdown = useCountdownStore.getState();

  await Promise.all([
    schedule.loadSchedules(today.subtract(1, 'day').startOf('day').toDate(), today.add(7, 'day').endOf('day').toDate()),
    habit.loadHabits(),
    habit.loadLogs(null, today.subtract(60, 'day').toDate(), today.toDate()),
    (async () => {
      const ws = useWeatherStore.getState();
      await ws.loadUserCity().catch(() => {});
      const s = useWeatherStore.getState();
      if (!s.currentWeather) await (s.fetchCurrentWeather?.() ?? Promise.resolve()).catch(() => {});
    })(),
    outfit.loadOutfits().catch(() => {}),
    clothing.loadClothing().catch(() => {}),
    equipment.loadEquipment().catch(() => {}),
    countdown.loadEvents().catch(() => []),
  ]);

  const u = useUserStore.getState();
  const sc = useScheduleStore.getState();
  const h = useHabitStore.getState();
  const w = useWeatherStore.getState();
  const o = useOutfitStore.getState();
  const c = useClothingStore.getState();
  const e = useEquipmentStore.getState();
  const cd = useCountdownStore.getState();
  return { today, user: u, schedule: sc, habit: h, weather: w, outfit: o, clothing: c, equipment: e, countdown: cd };
}

function buildHabitLogs(ctx) {
  const { habit, today } = ctx;
  const lines = [];
  for (const h of habit.habits) {
    const stat = habit.getStats(h.id, 30);
    const streak = habit.getStreak(h.id);
    const todayLog = habit.getLog(h.id, today.toDate());
    const done = !!(todayLog && todayLog.completed);
    lines.push(
      `· ${h.name}（${h.reminder_time || '-'}，${h.period || 'morning'}）` +
        `近 30 天打卡 ${stat.completed}/${stat.targetDays}，连续 ${streak} 天` +
        (done ? '，今日已打卡' : '，今日未打卡')
    );
  }
  return lines.length ? lines.join('\n') : '暂无习惯或打卡记录。';
}

function buildSchedule(ctx) {
  const { schedule, today } = ctx;
  const list = schedule.getSchedulesByDate(today.toDate());
  const next = [];
  for (let i = 1; i <= 3; i++) {
    const d = today.add(i, 'day');
    next.push(...schedule.getSchedulesByDate(d.toDate()).map((s) => ({ ...s, _date: d.format('YYYY-MM-DD') })));
  }
  const lines = [];
  if (list.length) {
    lines.push('今日：');
    list.slice(0, 15).forEach((s) => {
      const start = s.start_time ? dayjs(s.start_time).format('HH:mm') : '全天';
      const end = s.end_time ? ` - ${dayjs(s.end_time).format('HH:mm')}` : '';
      lines.push(`  · ${start}${end} ${s.title || '无标题'}${s.location ? ` @ ${s.location}` : ''}`);
    });
  }
  if (next.length) {
    lines.push('');
    lines.push('未来几日：');
    next.slice(0, 10).forEach((s) => {
      const start = s.start_time ? dayjs(s.start_time).format('HH:mm') : '全天';
      lines.push(`  · ${s._date} ${start} ${s.title || '无标题'}`);
    });
  }
  return lines.length ? lines.join('\n') : '暂无日程。';
}

function buildWeather(ctx) {
  const { weather } = ctx;
  const city = weather.currentCity
    ? (weather.currentCity.displayName || `${weather.currentCity.name}, ${weather.currentCity.country}`)
    : '未设置城市';
  if (!weather.currentWeather) return `${city}：未获取天气。`;
  const w = weather.currentWeather;
  return `${city} ${w.temp}°C ${w.description || ''}，体感 ${w.feelsLike}°C，湿度 ${w.humidity}%`;
}

function buildClothing(ctx) {
  const { outfit, clothing } = ctx;
  const parts = [];
  if (outfit.outfits?.length) {
    parts.push(
      `搭配（${outfit.outfits.length} 套）：` +
        outfit.outfits.slice(0, 8).map((o) => `${o.name}${o.occasion ? `（${o.occasion}）` : ''}`).join('、')
    );
  }
  if (clothing.clothing?.length) {
    const byCat = {};
    clothing.clothing.forEach((c) => {
      const label = CATEGORY_LABELS[c.category] || c.category || '其他';
      byCat[label] = (byCat[label] || 0) + 1;
    });
    parts.push('服装：' + Object.entries(byCat).map(([k, v]) => `${k} ${v} 件`).join('、'));
  }
  return parts.length ? parts.join('；') : '未配置服装与搭配。';
}

function buildEquipment(ctx) {
  const { equipment } = ctx;
  const list = equipment.equipment || [];
  if (!list.length) return '暂无装备。';
  const lines = list.slice(0, 30).map((e) => {
    const cat = CAT_LABELS[e.category] || e.category || '其他';
    return `· ${e.name}（${cat}）${e.brand ? ` ${e.brand}` : ''}${e.model ? ` ${e.model}` : ''}${e.notes ? ` 备注：${e.notes}` : ''}`;
  });
  return lines.join('\n');
}

function buildCountdown(ctx) {
  const { countdown } = ctx;
  const events = (countdown.events || []).slice();
  const upcoming = events
    .map((e) => ({ e, d: countdown.daysUntil(e) }))
    .filter(({ d }) => d >= 0)
    .sort((a, b) => a.d - b.d)
    .slice(0, 20);
  if (!upcoming.length) return '暂无倒数或纪念日。';
  const lines = upcoming.map(({ e, d }) => {
    const label = COUNTDOWN_TYPE_LABELS[e.type] || e.type || '其他';
    const when = d === 0 ? '今天' : d === 1 ? '明天' : `还有 ${d} 天`;
    return `· ${e.title}（${label}）${when}`;
  });
  return lines.join('\n');
}

function buildProfile(ctx) {
  const { user, weather } = ctx;
  const p = user.userProfile || {};
  const gender = p.gender === 'male' ? '男' : p.gender === 'female' ? '女' : '未设置';
  const city = weather.currentCity
    ? (weather.currentCity.displayName || `${weather.currentCity.name}, ${weather.currentCity.country}`)
    : (p.city && (typeof p.city === 'string' ? p.city : p.city?.name)) || '未设置';
  const parts = [`性别：${gender}`, `城市：${city}`];
  if (p.occupation) parts.push(`职业：${p.occupation}`);
  if (p.birthday) {
    parts.push(`生日：${dayjs(p.birthday).format('YYYY-MM-DD')}`);
    const zodiac = getZodiacFromBirthday(p.birthday);
    if (zodiac) parts.push(`星座：${zodiac}`);
  }
  if (p.mbti) parts.push(`MBTI：${p.mbti}`);
  return parts.join('；');
}

const BUILDERS = {
  habit_logs: buildHabitLogs,
  schedule: buildSchedule,
  weather: buildWeather,
  clothing: buildClothing,
  equipment: buildEquipment,
  countdown: buildCountdown,
  profile: buildProfile,
};

const SECTION_LABELS = {
  habit_logs: '习惯打卡',
  schedule: '日程',
  weather: '天气',
  clothing: '服装与搭配',
  equipment: '装备',
  countdown: '倒数纪念日',
  profile: '用户信息',
};

/**
 * 根据所选类型聚合数据，返回用于注入对话的上下文文本
 * @param {string[]} types - 如 ['habit_logs', 'weather']
 * @returns {Promise<string>}
 */
export async function gatherDataForChat(types) {
  if (!Array.isArray(types) || types.length === 0) return '';

  const allowed = new Set(types);
  const order = ['profile', 'habit_logs', 'schedule', 'weather', 'clothing', 'equipment', 'countdown'];
  const toBuild = order.filter((id) => allowed.has(id));

  let ctx;
  try {
    ctx = await loadStores();
  } catch (e) {
    logger.error('AiChatData', '加载数据失败', e);
    return '[携带数据加载失败，请稍后重试]';
  }

  const sections = [];
  for (const id of toBuild) {
    const fn = BUILDERS[id];
    if (!fn) continue;
    try {
      const text = fn(ctx);
      sections.push(`【${SECTION_LABELS[id]}】\n${text}`);
    } catch (e) {
      logger.warn('AiChatData', `构建 ${id} 失败`, e);
      sections.push(`【${SECTION_LABELS[id]}】\n[暂不可用]`);
    }
  }

  return sections.join('\n\n');
}
