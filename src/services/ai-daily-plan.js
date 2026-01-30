/**
 * AI 每日计划建议
 * 参考 每日计划.md；支持结构化 JSON 输出，便于批量保存日程/习惯
 */

import dayjs from 'dayjs';
import { getAssistantName } from '../utils/assistant-name';

const PERIODS = 'dawn,morning,noon,afternoon,dusk,evening,night';
const FREQUENCIES = 'daily,weekdays,weekends,weekly';

const DAILY_PLAN_TEMPLATE_BASE = `你是一位贴心的「{{NAME}}」助手。请根据以下每日计划模板，为用户生成**今日**的日程与习惯建议。

## 模板摘要

**身体与目标**：身高约 173cm，体重约 75kg，BMI 略高；目标为优化体态、体重、身材。

**工作日大致安排**：
- 早晨(8:30-9:30)：起床→喝温水→晨间运动/拉伸(15min)→洗漱→早餐
- 工作时间(9:30-18:30)：每 50 分钟起身活动 5 分钟，每小时补水；午休 13:00-13:30
- 午餐 12:00-13:00，下午 15:30 加餐；下班后晚餐、运动 19:30-21:00、娱乐、23:30-1:30 洗漱睡觉

**习惯**：早晨喝水、晨间运动、午间站立、下午防久坐、晚间运动、定点上床等。

请结合**今天星期几、当前时段**，生成今日的日程与习惯。`;

function getDailyPlanTemplate() {
  return DAILY_PLAN_TEMPLATE_BASE.replace('{{NAME}}', getAssistantName());
}

/** 结构化输出：仅 JSON，便于程序解析并批量保存 */
const STRUCTURED_SYSTEM = `你只能输出一个 JSON 对象，不要 markdown 代码块、不要 \`\`\`、不要任何说明或多余文字。

格式 strictly：
{"schedules":[{"title":"字符串","startTime":"HH:mm","endTime":"HH:mm","notes":"可选"}],"habits":[{"name":"字符串","period":"${PERIODS} 之一","frequency":"${FREQUENCIES} 之一，默认 daily","reminder_time":"HH:mm 或 null"}]}

- schedules：今日日程，按时间排序。startTime/endTime 必填，notes 可选。
- habits：今日建议习惯。period 必填；frequency 默认 daily；reminder_time 可选。
- 今日日期：`;

/**
 * 构建「生成每日计划建议」的 system message（结构化 JSON 输出）
 * 配合用户消息「请生成今日的日程与习惯建议（结构化格式）。」使用
 */
export function buildStructuredDailyPlanMessages() {
  const today = dayjs().format('YYYY-MM-DD');
  const system = STRUCTURED_SYSTEM + today + '。\n\n' + getDailyPlanTemplate();
  return [{ role: 'system', content: system }];
}

/**
 * 兼容旧版：自然语言输出（不强制 JSON）
 */
export function buildDailyPlanMessages(userPrompt = '请根据每日计划模板生成今日的日程与习惯建议（含具体时间段）。') {
  return [
    { role: 'system', content: getDailyPlanTemplate() + '\n\n输出请分段、条理清晰，方便用户参考。' },
    { role: 'user', content: userPrompt },
  ];
}

function stripJsonBlock(s) {
  if (!s || typeof s !== 'string') return s;
  let t = s.trim();
  const m = t.match(/^```(?:json)?\s*([\s\S]*?)```$/);
  if (m) t = m[1].trim();
  else {
    const first = t.indexOf('{');
    const last = t.lastIndexOf('}');
    if (first !== -1 && last > first) t = t.slice(first, last + 1);
  }
  return t;
}

function parseTime(v) {
  if (v == null) return null;
  const s = String(v).trim();
  const match = s.match(/^(\d{1,2}):(\d{2})$/);
  if (match) return `${match[1].padStart(2, '0')}:${match[2]}`;
  return null;
}

const VALID_PERIODS = new Set(PERIODS.split(','));
const VALID_FREQ = new Set(FREQUENCIES.split(','));

/**
 * 解析 AI 返回的「每日计划」JSON
 * @param {string} text - 上一条 assistant 回复
 * @returns {{ schedules: Array<{title,startTime,endTime,notes}>, habits: Array<{name,period,frequency,reminder_time}> } | { error: string }}
 */
export function parseDailyPlanJson(text) {
  const raw = stripJsonBlock(text);
  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    return { error: 'JSON 解析失败' };
  }
  if (!data || typeof data !== 'object') return { error: '无效格式' };

  const schedules = [];
  const habits = [];

  if (Array.isArray(data.schedules)) {
    for (const s of data.schedules) {
      const title = (s.title != null ? String(s.title) : '').trim();
      if (!title) continue;
      const startTime = parseTime(s.startTime);
      const endTime = parseTime(s.endTime);
      schedules.push({
        title,
        startTime: startTime || '09:00',
        endTime: endTime || '09:30',
        notes: (s.notes != null ? String(s.notes) : '').trim() || null,
      });
    }
  }

  if (Array.isArray(data.habits)) {
    for (const h of data.habits) {
      const name = (h.name != null ? String(h.name) : '').trim();
      if (!name) continue;
      const period = VALID_PERIODS.has(h.period) ? h.period : 'morning';
      const frequency = VALID_FREQ.has(h.frequency) ? h.frequency : 'daily';
      const rt = h.reminder_time != null ? parseTime(h.reminder_time) : null;
      habits.push({
        name,
        period,
        frequency,
        reminder_time: rt,
      });
    }
  }

  return { schedules, habits };
}
