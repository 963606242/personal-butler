/**
 * AI 今日建议服务
 * 聚合用户信息、日程、习惯、天气、服装/搭配、倒数纪念日，调用 AI 生成当日金句与管家建议
 */
import dayjs from 'dayjs';
import { getDatabase } from './database';
import { chat, isAIConfigured } from './ai-providers';
import useUserStore from '../stores/userStore';
import useScheduleStore from '../stores/scheduleStore';
import useHabitStore from '../stores/habitStore';
import useWeatherStore from '../stores/weatherStore';
import useOutfitStore from '../stores/outfitStore';
import useClothingStore from '../stores/clothingStore';
import useCountdownStore, { COUNTDOWN_TYPES } from '../stores/countdownStore';
import { getAssistantName } from '../utils/assistant-name';
import { PERIOD_LABELS } from '../constants/habits';
import { getCurrentPeriod } from '../utils/period-helper';
import { getLogger } from './logger-client';

const logger = getLogger();
const TYPE_LABELS = Object.fromEntries((COUNTDOWN_TYPES || []).map((t) => [t.value, t.label]));

const CATEGORY_LABELS = {
  top: '上衣',
  bottom: '下装',
  outerwear: '外套',
  accessories: '配饰',
  shoes: '鞋类',
};

async function gatherContext() {
  const today = dayjs();
  const user = useUserStore.getState();
  const schedule = useScheduleStore.getState();
  const habit = useHabitStore.getState();
  const weather = useWeatherStore.getState();
  const outfit = useOutfitStore.getState();
  const clothing = useClothingStore.getState();
  const countdown = useCountdownStore.getState();

  await Promise.all([
    schedule.loadSchedules(today.startOf('day').toDate(), today.endOf('day').toDate()),
    habit.loadHabits(),
    habit.loadLogs(null, today.subtract(60, 'day').toDate(), today.toDate()),
    outfit.loadOutfits().catch(() => {}),
    clothing.loadClothing().catch(() => {}),
    countdown.loadEvents().catch(() => []),
  ]);

  const profile = user.userProfile || {};
  const gender = profile.gender === 'male' ? '男' : profile.gender === 'female' ? '女' : '';
  const occupation = profile.occupation || '用户';
  const interests = profile.interests || '';
  const city = weather.currentCity
    ? (weather.currentCity.displayName || `${weather.currentCity.name}, ${weather.currentCity.country}`)
    : (profile.city ? (typeof profile.city === 'string' ? profile.city : profile.city?.name) : null) || '未设置';

  const schedules = schedule.getSchedulesByDate(today.toDate());
  const scheduleText =
    schedules.length === 0
      ? '今日暂无日程'
      : schedules
          .slice(0, 10)
          .map((s) => {
            const start = s.start_time ? dayjs(s.start_time).format('HH:mm') : '全天';
            const end = s.end_time ? ` - ${dayjs(s.end_time).format('HH:mm')}` : '';
            return `· ${start}${end} ${s.title || '无标题'}${s.location ? ` @ ${s.location}` : ''}`;
          })
          .join('\n');

  const period = getCurrentPeriod(today.toDate());
  const periodLabel = PERIOD_LABELS[period] || period;
  const periodHabits = habit.getCurrentPeriodHabits(today.toDate());
  const habitLines = [];
  for (const h of habit.habits) {
    const stat = habit.getStats(h.id, 7);
    const streak = habit.getStreak(h.id);
    const todayLog = habit.getLog(h.id, today.toDate());
    const done = !!(todayLog && todayLog.completed);
    habitLines.push(
      `· ${h.name}（${h.reminder_time || '-'}）近7天 ${stat.completed}/${stat.targetDays}，连续${streak}天${done ? '，今日已打卡' : '，今日未打卡'}`
    );
  }
  let habitText = habitLines.length === 0 ? '暂无习惯' : habitLines.join('\n');
  if (periodHabits.length > 0) {
    const pending = periodHabits.map((ph) => ph.habit.name).join('、');
    habitText += `\n\n当前时段（${periodLabel}）待打卡：${pending}`;
  }

  let weatherText = '未配置城市或未获取天气';
  if (weather.currentWeather) {
    const w = weather.currentWeather;
    weatherText = `${city} ${w.temp}°C ${w.description || ''}，体感${w.feelsLike}°C，湿度${w.humidity}%`;
  }

  const hasOutfits = outfit.outfits && outfit.outfits.length > 0;
  const hasClothing = clothing.clothing && clothing.clothing.length > 0;
  let wearText = '';
  if (hasOutfits || hasClothing) {
    const parts = [];
    if (hasOutfits) {
      parts.push(
        `搭配（${outfit.outfits.length} 套）：` +
          outfit.outfits
            .slice(0, 5)
            .map((o) => `${o.name}${o.occasion ? `（${o.occasion}）` : ''}`)
            .join('、')
      );
    }
    if (hasClothing) {
      const byCat = {};
      clothing.clothing.forEach((c) => {
        const label = CATEGORY_LABELS[c.category] || c.category || '其他';
        byCat[label] = (byCat[label] || 0) + 1;
      });
      parts.push('服装：' + Object.entries(byCat).map(([k, v]) => `${k}${v}件`).join('、'));
    }
    wearText = parts.join('；');
  } else {
    wearText = '未配置服装与搭配，请按默认场景给穿搭建议（如通勤、休闲等）。';
  }

  const countdownState = useCountdownStore.getState();
  const events = (countdownState.events || []).slice();
  const upcoming = events
    .map((e) => ({ e, d: countdownState.daysUntil(e) }))
    .filter(({ d }) => d >= 0)
    .sort((a, b) => a.d - b.d)
    .slice(0, 15);
  const countdownLines = upcoming.map(({ e, d }) => {
    const label = TYPE_LABELS[e.type] || e.type || '其他';
    const when = d === 0 ? '今天' : d === 1 ? '明天' : `还有 ${d} 天`;
    return `· ${e.title}（${label}）${when}`;
  });
  const countdownText = countdownLines.length === 0 ? '暂无倒数或纪念日' : countdownLines.join('\n');

  return {
    date: today.format('YYYY-MM-DD dddd'),
    period: periodLabel,
    profile: { gender, occupation, city, interests },
    scheduleText,
    habitText,
    weatherText,
    wearText,
    countdownText,
    hasOutfits: !!hasOutfits,
    hasClothing: !!hasClothing,
  };
}

function buildPrompt(ctx) {
  const name = getAssistantName();
  const sys = `你是用户为其命名的贴心「${name}」助手。根据用户提供的今日信息，生成一份简洁的当日建议，包含以下部分（每部分 2～4 句即可，语气亲切、实用）：

1. **当日金句**：一句励志或温暖的金句，适合今日。
2. **日程提醒**：今日日程摘要与注意事项。
3. **习惯提醒**：当前时段建议完成的习惯与打卡鼓励。
4. **天气与穿戴**：根据天气给穿着建议。若用户已配置服装/搭配，请结合其衣橱给出具体搭配建议；若未配置，则给普适的默认穿搭建议（如通勤、休闲、防暑防寒等）。
5. **倒数/纪念日提醒**：若有即将到来的倒数日或纪念日（如高考、纪念日、生日等），简要提醒与寄语；若无则省略本部分。

若用户资料中有 interests（兴趣/偏好），请在不刻意的前提下自然融入建议（如穿搭、金句或习惯鼓励）。请直接输出以上各部分内容（无倒数纪念日时跳过第 5 部分），用明显的分段（如小标题或空行）分隔，无需多余寒暄。`;

  const user = `【今日数据】
日期：${ctx.date}
当前时段：${ctx.period}
用户：${ctx.profile.occupation}${ctx.profile.gender ? `（${ctx.profile.gender}）` : ''}
城市：${ctx.profile.city}${ctx.profile.interests ? `\n兴趣/偏好：${ctx.profile.interests}` : ''}

【今日日程】
${ctx.scheduleText}

【习惯与打卡】
${ctx.habitText}

【天气】
${ctx.weatherText}

【服装与搭配】
${ctx.wearText}

【倒数纪念日】
${ctx.countdownText}

请根据以上信息，生成今日金句、日程提醒、习惯提醒、天气穿搭建议，以及倒数/纪念日提醒（若有）。`;

  return [
    { role: 'system', content: sys },
    { role: 'user', content: user },
  ];
}

/**
 * 今日建议缓存 key（按日期，当日结束过期）
 */
function suggestionCacheKey() {
  return `suggestion_${dayjs().format('YYYY-MM-DD')}`;
}

function endOfTodayTs() {
  return dayjs().add(1, 'day').startOf('day').valueOf();
}

/**
 * 从缓存读取今日建议（切换页面后恢复）
 * @returns {Promise<string|null>}
 */
export async function getCachedSuggestion() {
  try {
    const db = await getDatabase();
    const rows = await db.query(
      'SELECT value, expires_at FROM cache WHERE key = ?',
      [suggestionCacheKey()]
    );
    const r = rows?.[0];
    if (!r || !r.expires_at || r.expires_at <= Date.now()) return null;
    const { text } = JSON.parse(r.value || '{}');
    return typeof text === 'string' ? text : null;
  } catch (e) {
    logger.warn('AiSuggestion', '读取建议缓存失败', e);
    return null;
  }
}

/**
 * 保存今日建议到缓存
 * @param {string} text
 */
export async function setCachedSuggestion(text) {
  if (!text || typeof text !== 'string') return;
  try {
    const db = await getDatabase();
    await db.execute(
      `INSERT OR REPLACE INTO cache (key, value, expires_at, created_at) VALUES (?, ?, ?, ?)`,
      [suggestionCacheKey(), JSON.stringify({ text }), endOfTodayTs(), Date.now()]
    );
  } catch (e) {
    logger.warn('AiSuggestion', '保存建议缓存失败', e);
  }
}

/**
 * 获取今日管家建议（金句 + 日程 + 习惯 + 天气穿搭）
 * @returns {Promise<string>} AI 回复文本
 */
export async function fetchTodaySuggestion() {
  if (!isAIConfigured()) {
    throw new Error('请先在设置中配置 AI 助手（Ollama / OpenAI 协议 / Anthropic 协议）');
  }

  const ctx = await gatherContext();
  const messages = buildPrompt(ctx);
  const reply = await chat(messages);
  return reply;
}

export { isAIConfigured };
