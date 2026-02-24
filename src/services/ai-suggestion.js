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
import { getCalendarService } from './calendar-service';

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

  // 临近重要节日时的额外关怀提示（不仅限于春节）
  let festivalText = '';
  try {
    const cal = getCalendarService();
    const todayInfo = cal.getDateInfo(today.toDate(), { showLunar: true, showHoliday: true });
    const todayLunar = todayInfo.lunar;
    const inSpringPeriod = todayLunar && todayLunar.month === 1 && todayLunar.day >= 1 && todayLunar.day <= 15;

    if (inSpringPeriod) {
      const dayNum = todayLunar.day;
      if (dayNum === 1) {
        festivalText = '今天就是农历春节，新的一年辛苦也要好好犒劳自己，记得和家人朋友说声新年好～';
      } else if (dayNum <= 7) {
        const dayNames = ['', '初一', '初二', '初三', '初四', '初五', '初六', '初七'];
        festivalText = `农历春节${dayNames[dayNum] || `初${dayNum}`}，还在年味里，好好享受与家人朋友的相聚时光。`;
      } else if (dayNum === 8) {
        festivalText = '今天正月初八，不少地方开工啦，新的一年顺顺利利、步步高升～';
      } else if (dayNum <= 15) {
        festivalText = '还在正月里，年味未散，可以慢慢收心，也别忘了多陪陪家人。';
      }
    } else {
    const maxDays = 60; // 向后看大约两个月
    let nearest = null;

    for (let i = 0; i <= maxDays; i++) {
      const d = today.add(i, 'day');
      const info = cal.getDateInfo(d.toDate(), { showLunar: true, showHoliday: true });
      const lunar = info.lunar;
      const holidays = info.holidays || [];

      let festivalName = null;
      let kind = 'holiday';

      // 1. 优先用节假日里的法定/固定节日（去掉调休等纯工作日标记）
      const mainHoliday = holidays.find(
        (h) =>
          h.name &&
          (h.isOffDay ||
            h.type === 'official' ||
            h.type === 'fixed' ||
            h.type === 'jieqi')
      );
      if (mainHoliday) {
        festivalName = mainHoliday.name;
        if (/春节/.test(festivalName)) kind = 'spring';
      }

      // 2. 若节假日信息缺失，对春节额外兜底：农历正月初一
      if (!festivalName && lunar && lunar.month === 1 && lunar.day === 1) {
        festivalName = '农历春节';
        kind = 'spring';
      }

      if (!festivalName) continue;
      nearest = { offset: i, date: d, lunar, festivalName, kind };
      break;
    }

    if (nearest) {
      const { offset: i, festivalName, kind } = nearest;
      // 春节用更有“年味”的话术
      if (kind === 'spring' || /春节/.test(festivalName)) {
        if (i === 0) {
          festivalText = '今天就是农历春节，新的一年辛苦也要好好犒劳自己，记得和家人朋友说声新年好～';
        } else if (i === 1) {
          festivalText = '明天就是农历春节，可以提前想好给谁发祝福、准备一点小仪式，让自己有被“年味”包围的感觉。';
        } else {
          festivalText = `离农历春节还有 ${i} 天，可以慢慢把该收尾的事安排好，也给自己留一点期待和放松的空间。`;
        }
      } else {
        // 其他节日的通用提示
        if (i === 0) {
          festivalText = `今天是「${festivalName}」，可以给自己安排一点小仪式感，顺便给在乎的人发个问候。`;
        } else if (i === 1) {
          festivalText = `明天就是「${festivalName}」，今天可以简单计划一下想怎么过、想对谁说点什么。`;
        } else {
          festivalText = `离「${festivalName}」还有 ${i} 天，可以提早想想那天要怎么度过，让这段等待也变成一点点期待。`;
        }
      }
    }
    }
  } catch (e) {
    logger.warn('AiSuggestion', '计算节日信息失败', e?.message || e);
  }

  return {
    date: today.format('YYYY-MM-DD dddd'),
    period: periodLabel,
    profile: { gender, occupation, city, interests },
    scheduleText,
    habitText,
    weatherText,
    wearText,
    countdownText,
    festivalText,
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
5. **倒数/纪念日提醒**：仅根据【倒数纪念日】部分列出的事件（如高考、纪念日、生日等）给出提醒与寄语；若该列表为空则省略本部分，**不得凭空创造新的倒数事件（例如“周末还有几天”等）**。
6. **节日与春节等提示**：若【节日与春节等提示】非空，则单独用 1～2 句话说说里面提到的节日/春节相关关怀和提醒；若为空则可以省略本部分。本部分内容应与第 5 部分分开成段或单独小标题，不要混在一起。

若用户资料中有 interests（兴趣/偏好），请在不刻意的前提下自然融入建议（如穿搭、金句或习惯鼓励）。若【节日与春节等提示】中提到了农历春节等重要节日，可以在第 1 部分或第 6 部分自然加入一些带“年味”的祝福和关怀（如还剩几天就放假了、记得给家人朋友发问候等），但不要喧宾夺主，整体保持简洁亲切。请直接输出以上各部分内容（当某一部分无内容时可跳过该部分），用明显的分段（如小标题或空行）分隔，无需多余寒暄。`;

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

【节日与春节等提示】
${ctx.festivalText || '无特别节日提示'}

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
