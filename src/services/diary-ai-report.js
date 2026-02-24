/**
 * 日记 AI 回顾：根据自然语言日期（如「上周五做了什么」）查询日程+日记并生成报告
 */
import dayjs from 'dayjs';
import { chat } from './ai-providers';
import { getLogger } from './logger-client';
import useScheduleStore from '../stores/scheduleStore';
import useDiaryStore from '../stores/diaryStore';
import { expandScheduleForDateRange } from '../utils/schedule-repeat';

const logger = getLogger();

const WEEKDAY_NAMES = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

/**
 * 解析自然语言日期为 [start, end]（当天 00:00 - 23:59）
 * @param {string} text - 如 "昨天" "上周五" "本周一" "3月1日"
 * @returns {{ start: dayjs.Dayjs, end: dayjs.Dayjs } | null}
 */
export function parseDateQuery(text) {
  if (!text || typeof text !== 'string') return null;
  const t = text.trim();
  const today = dayjs().startOf('day');

  // 今天、昨天、前天
  if (/^今天$/.test(t)) return { start: today, end: today.endOf('day') };
  if (/^昨天$/.test(t)) {
    const d = today.subtract(1, 'day');
    return { start: d, end: d.endOf('day') };
  }
  if (/^前天$/.test(t)) {
    const d = today.subtract(2, 'day');
    return { start: d, end: d.endOf('day') };
  }

  // 上周五、上周日、本周一 等
  const weekMatch = t.match(/^(上|本)周([一二三四五六日])$/);
  if (weekMatch) {
    const [, which, w] = weekMatch;
    const map = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 日: 0 };
    const dow = map[w] ?? 0; // 0=周日
    let d = today;
    const currentDow = d.day();
    if (which === '上周') {
      d = d.subtract(1, 'week');
    }
    d = d.day(dow);
    if (which === '上周' && currentDow >= dow) d = d.subtract(1, 'week');
    if (which === '本周' && currentDow < dow) d = d.subtract(1, 'week');
    return { start: d.startOf('day'), end: d.endOf('day') };
  }

  // 上周、本周（整周）
  if (/^上周$/.test(t)) {
    const start = today.subtract(1, 'week').startOf('week').add(1, 'day'); // 周一
    const end = start.add(6, 'day').endOf('day');
    return { start, end };
  }
  if (/^本周$/.test(t)) {
    const start = today.startOf('week').add(1, 'day');
    const end = today.endOf('day');
    return { start, end };
  }

  // 3月1日、2024年3月1日
  const dateMatch = t.match(/^(\d{4})年?(\d{1,2})月(\d{1,2})日?$/);
  if (dateMatch) {
    const [, y, m, day] = dateMatch;
    const year = y ? parseInt(y, 10) : today.year();
    const d = dayjs().year(year).month(parseInt(m, 10) - 1).date(parseInt(day, 10)).startOf('day');
    if (!d.isValid()) return null;
    return { start: d, end: d.endOf('day') };
  }

  return null;
}

/**
 * 获取指定日期范围内的日程实例（含重复展开）
 */
function getSchedulesInRange(start, end) {
  const { loadSchedules, schedules } = useScheduleStore.getState();
  return loadSchedules(start.toDate(), end.toDate()).then(() => {
    const list = useScheduleStore.getState().schedules || [];
    const instances = [];
    list.forEach((s) => {
      const expanded = expandScheduleForDateRange(s, start.toDate(), end.toDate());
      expanded.forEach((inst) => {
        instances.push({
          date: dayjs(inst._instanceDate).format('YYYY-MM-DD'),
          time: dayjs(inst._instanceStartMs).format('HH:mm'),
          title: s.title,
          location: s.location,
          notes: s.notes,
        });
      });
    });
    return instances.sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
  });
}

/**
 * 获取指定日期范围内的日记
 */
function getDiaryInRange(start, end) {
  return useDiaryStore.getState().loadEntries(start.toDate(), end.toDate()).then((entries) => {
    return (entries || []).map((e) => ({
      date: dayjs(e.date).format('YYYY-MM-DD'),
      title: e.title,
      content: e.content,
      mood: e.mood,
      tags: e.tags,
      image_analysis: e.image_analysis,
      audio_transcript: e.audio_transcript,
    }));
  });
}

/**
 * 根据自然语言问题生成「某天/某段时间做了什么」的报告
 * @param {string} userQuestion - 如 "上周五做了什么"
 * @returns {Promise<string>} AI 生成的报告
 */
export async function generateDiaryReport(userQuestion) {
  const range = parseDateQuery(userQuestion);
  if (!range) {
    throw new Error('无法识别日期，可试试：昨天、上周五、本周一、3月1日');
  }

  const [schedules, diaries] = await Promise.all([
    getSchedulesInRange(range.start, range.end),
    getDiaryInRange(range.start, range.end),
  ]);

  const dateLabel = range.start.isSame(range.end, 'day')
    ? range.start.format('YYYY年MM月DD日')
    : `${range.start.format('YYYY-MM-DD')} 至 ${range.end.format('YYYY-MM-DD')}`;

  const scheduleText =
    schedules.length > 0
      ? schedules
          .map(
            (s) => `- ${s.date} ${s.time} ${s.title}${s.location ? ` @ ${s.location}` : ''}${s.notes ? `（${s.notes}）` : ''}`
          )
          .join('\n')
      : '（无日程记录）';

  const diaryText =
    diaries.length > 0
      ? diaries
          .map(
            (d) =>
              `- ${d.date} ${d.title || '无标题'}\n  内容：${(d.content || '').slice(0, 200)}${(d.content || '').length > 200 ? '...' : ''}\n  ${d.mood ? `心情：${d.mood}` : ''} ${(d.tags || []).length ? `标签：${d.tags.join(', ')}` : ''}${d.image_analysis ? `\n  图片分析：${d.image_analysis}` : ''}${d.audio_transcript ? `\n  录音转写：${d.audio_transcript.slice(0, 150)}...` : ''}`
          )
          .join('\n\n')
      : '（无日记记录）';

  const systemPrompt = `你是一个个人助理。根据用户提供的「日程」和「日记」数据，用简洁、有条理的中文总结该时间段用户做了什么、有什么安排与记录。可以按时间线或按类别归纳，语气友好。若数据为空，就说明该时间段暂无记录。`;
  const userPrompt = `时间范围：${dateLabel}\n\n【日程】\n${scheduleText}\n\n【日记】\n${diaryText}\n\n请根据以上数据总结：${userQuestion}`;

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];

  logger.log('DiaryAIReport', '生成报告中', dateLabel);
  const report = await chat(messages);
  return report;
}
