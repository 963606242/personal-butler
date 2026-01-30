/**
 * 本地 API 服务：允许外部 AI / 脚本调用本应用，读取和写入习惯、日程、倒数等数据。
 * 仅监听 localhost，可选 API Key 校验。用于扩展语音助手、ChatGPT 插件、自动化等场景。
 */
const http = require('http');
const { randomUUID } = require('crypto');

const DEFAULT_PORT = 3847;
const PREFIX = '/api/v1';

function getSettings(db) {
  const rows = db.query('SELECT key, value FROM settings') || [];
  const map = {};
  rows.forEach((r) => { map[r.key] = r.value; });
  return map;
}

function getCurrentUserId(db) {
  const users = db.query('SELECT id FROM users LIMIT 1');
  if (!users || users.length === 0) return null;
  return users[0].id;
}

function startOfDayMs(dateStrOrMs) {
  if (typeof dateStrOrMs === 'number') {
    const d = new Date(dateStrOrMs);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }
  const match = String(dateStrOrMs).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return NaN;
  const d = new Date(parseInt(match[1], 10), parseInt(match[2], 10) - 1, parseInt(match[3], 10));
  return d.getTime();
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => { data += chunk; });
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

function send(res, statusCode, body) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.writeHead(statusCode);
  res.end(JSON.stringify(body));
}

function sendCorsPreflight(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Key, Authorization');
  res.writeHead(204);
  res.end();
}

/**
 * @param {object} db - DatabaseService instance (with query, execute)
 * @returns {object} { start(port?), stop() }
 */
function createServer(db) {
  let server = null;

  function auth(req, settings) {
    const secret = (settings.api_bridge_secret || '').trim();
    if (!secret) return true;
    const key = req.headers['x-api-key'] || (req.headers['authorization'] || '').replace(/^Bearer\s+/i, '');
    return key === secret;
  }

  async function handle(req, res) {
    if (req.method === 'OPTIONS') {
      sendCorsPreflight(res);
      return;
    }

    const settings = getSettings(db);
    const enabled = (settings.api_bridge_enabled || '').toLowerCase();
    if (enabled !== '1' && enabled !== 'true') {
      send(res, 503, { error: 'API bridge is disabled. Enable it in Settings.' });
      return;
    }

    if (!auth(req, settings)) {
      send(res, 401, { error: 'Invalid or missing X-API-Key.' });
      return;
    }

    const userId = getCurrentUserId(db);
    if (!userId) {
      send(res, 503, { error: 'No user in app. Please open the app and complete setup first.' });
      return;
    }

    const url = new URL(req.url || '', `http://localhost`);
    const path = url.pathname;
    const method = req.method;

    try {
      // GET /api/v1/health
      if (path === `${PREFIX}/health` && method === 'GET') {
        send(res, 200, { ok: true, service: 'personal-butler', version: '1.0' });
        return;
      }

      // GET /api/v1/me
      if (path === `${PREFIX}/me` && method === 'GET') {
        send(res, 200, { user_id: userId });
        return;
      }

      // GET /api/v1/habits
      if (path === `${PREFIX}/habits` && method === 'GET') {
        const rows = db.query('SELECT id, name, frequency, period, reminder_time, target_days FROM habits WHERE user_id = ? ORDER BY sort_order ASC, name ASC', [userId]);
        send(res, 200, { habits: rows });
        return;
      }

      // GET /api/v1/habits/:id/logs?from=YYYY-MM-DD&to=YYYY-MM-DD
      const habitsLogsMatch = path.match(new RegExp(`^${PREFIX}/habits/([^/]+)/logs$`));
      if (habitsLogsMatch && method === 'GET') {
        const habitId = habitsLogsMatch[1];
        const from = url.searchParams.get('from') || '';
        const to = url.searchParams.get('to') || '';
        let startMs = from ? startOfDayMs(from) : Date.now() - 366 * 24 * 60 * 60 * 1000;
        let endMs = to ? startOfDayMs(to) : Date.now();
        if (Number.isNaN(startMs)) startMs = 0;
        if (Number.isNaN(endMs)) endMs = Date.now();
        const rows = db.query(
          'SELECT habit_id, date, completed, notes FROM habit_logs WHERE habit_id = ? AND user_id = ? AND date >= ? AND date <= ? ORDER BY date ASC',
          [habitId, userId, startMs, endMs]
        );
        send(res, 200, { habit_id: habitId, logs: rows });
        return;
      }

      // POST /api/v1/habits/:id/log
      const habitLogMatch = path.match(new RegExp(`^${PREFIX}/habits/([^/]+)/log$`));
      if (habitLogMatch && method === 'POST') {
        const habitId = habitLogMatch[1];
        const body = await parseBody(req);
        const dateStr = body.date || body.day;
        const dateMs = dateStr ? startOfDayMs(dateStr) : startOfDayMs(Date.now());
        if (Number.isNaN(dateMs)) {
          send(res, 400, { error: 'Invalid date. Use YYYY-MM-DD.' });
          return;
        }
        const completed = body.completed !== false && body.completed !== 0;
        const notes = body.notes || null;
        const logId = randomUUID();
        const now = Date.now();
        db.execute(
          `INSERT INTO habit_logs (id, habit_id, user_id, date, completed, notes, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(habit_id, date) DO UPDATE SET completed = excluded.completed, notes = excluded.notes`,
          [logId, habitId, userId, dateMs, completed ? 1 : 0, notes, now]
        );
        send(res, 200, { habit_id: habitId, date: dateMs, completed, notes });
        return;
      }

      // GET /api/v1/schedule?from=ts&to=ts (timestamps in ms)
      if (path === `${PREFIX}/schedule` && method === 'GET') {
        const from = parseInt(url.searchParams.get('from'), 10) || 0;
        const to = parseInt(url.searchParams.get('to'), 10) || Date.now() + 30 * 24 * 60 * 60 * 1000;
        const rows = db.query(
          'SELECT id, title, start_time, end_time, date, location, notes, priority, tags FROM schedules WHERE user_id = ? AND start_time < ? AND (end_time > ? OR end_time IS NULL) ORDER BY start_time ASC',
          [userId, to, from]
        );
        send(res, 200, { schedule: rows });
        return;
      }

      // POST /api/v1/schedule
      if (path === `${PREFIX}/schedule` && method === 'POST') {
        const body = await parseBody(req);
        const title = body.title || '';
        const startTime = body.start_time != null ? (typeof body.start_time === 'number' ? body.start_time : new Date(body.start_time).getTime()) : Date.now();
        const endTime = body.end_time != null ? (typeof body.end_time === 'number' ? body.end_time : new Date(body.end_time).getTime()) : null;
        const dateMs = startOfDayMs(startTime);
        const scheduleId = randomUUID();
        const now = Date.now();
        const location = body.location || null;
        const notes = body.notes || null;
        const priority = body.priority != null ? body.priority : 0;
        const tags = body.tags && Array.isArray(body.tags) ? JSON.stringify(body.tags) : null;
        db.execute(
          `INSERT INTO schedules (id, user_id, title, start_time, end_time, date, repeat_rule, location, notes, priority, tags, reminder_settings, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [scheduleId, userId, title, startTime, endTime, dateMs, null, location, notes, priority, tags, null, now, now]
        );
        send(res, 200, { id: scheduleId, title, start_time: startTime, end_time: endTime });
        return;
      }

      // GET /api/v1/countdown/events
      if (path === `${PREFIX}/countdown/events` && method === 'GET') {
        const rows = db.query(
          'SELECT id, type, title, target_date, is_annual, reminder_days_before, notes FROM countdown_events WHERE user_id = ? ORDER BY target_date ASC',
          [userId]
        );
        send(res, 200, { events: rows });
        return;
      }

      // GET /api/v1/profile (summary)
      if (path === `${PREFIX}/profile` && method === 'GET') {
        const rows = db.query(
          'SELECT id, user_id, gender, city, occupation, interests FROM user_profiles WHERE user_id = ? LIMIT 1',
          [userId]
        );
        if (rows.length === 0) {
          send(res, 200, { user_id: userId, profile: null });
          return;
        }
        const p = rows[0];
        let city = p.city;
        try {
          if (city) city = JSON.parse(city);
        } catch (_) {}
        send(res, 200, { user_id: userId, profile: { gender: p.gender, city, occupation: p.occupation, interests: p.interests } });
        return;
      }

      // GET /api/v1/summary — 今日摘要/晨报数据（供外部 Cron、Clawdbot 等生成晨报）
      if (path === `${PREFIX}/summary` && method === 'GET') {
        const now = Date.now();
        const todayStart = new Date(now);
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = todayStart.getTime() + 24 * 60 * 60 * 1000 - 1;
        const todayMs = todayStart.getTime();

        const profileRows = db.query(
          'SELECT gender, city, occupation, interests FROM user_profiles WHERE user_id = ? LIMIT 1',
          [userId]
        );
        let profile = null;
        if (profileRows.length > 0) {
          const p = profileRows[0];
          let city = p.city;
          try {
            if (city) city = JSON.parse(city);
          } catch (_) {}
          profile = { gender: p.gender, city, occupation: p.occupation, interests: p.interests };
        }

        const scheduleRows = db.query(
          'SELECT id, title, start_time, end_time, location FROM schedules WHERE user_id = ? AND start_time < ? AND (end_time > ? OR end_time IS NULL) ORDER BY start_time ASC',
          [userId, todayEnd, todayMs]
        );
        const today_schedule = scheduleRows.map((s) => ({
          id: s.id,
          title: s.title,
          start_time: s.start_time,
          end_time: s.end_time,
          location: s.location,
        }));

        const habitRows = db.query(
          'SELECT id, name, reminder_time FROM habits WHERE user_id = ? ORDER BY sort_order ASC, name ASC',
          [userId]
        );
        const logRows = db.query(
          'SELECT habit_id, completed FROM habit_logs WHERE user_id = ? AND date = ?',
          [userId, todayMs]
        );
        const logMap = {};
        logRows.forEach((r) => { logMap[r.habit_id] = !!r.completed; });
        const habits = habitRows.map((h) => ({
          id: h.id,
          name: h.name,
          reminder_time: h.reminder_time,
          today_completed: !!logMap[h.id],
        }));

        const countdownRows = db.query(
          'SELECT id, type, title, target_date FROM countdown_events WHERE user_id = ? ORDER BY target_date ASC',
          [userId]
        );
        const todayStr = todayStart.toISOString().slice(0, 10);
        const upcoming = countdownRows
          .map((e) => {
            const t = new Date(e.target_date).getTime();
            const d = Math.floor((t - todayMs) / (24 * 60 * 60 * 1000));
            return { ...e, days_until: d };
          })
          .filter((e) => e.days_until >= 0)
          .slice(0, 10);

        send(res, 200, {
          date: todayStr,
          profile,
          today_schedule: today_schedule,
          habits,
          countdown_upcoming: upcoming,
        });
        return;
      }

      send(res, 404, { error: 'Not found', path });
    } catch (err) {
      console.error('[AI-Bridge]', err);
      send(res, 500, { error: err.message || 'Internal server error' });
    }
  }

  return {
    start(port) {
      const settings = getSettings(db);
      const p = parseInt(settings.api_bridge_port, 10) || DEFAULT_PORT;
      const actualPort = port != null ? port : p;
      const enabled = (settings.api_bridge_enabled || '').toLowerCase();
      if (enabled !== '1' && enabled !== 'true') {
        console.log('[AI-Bridge] Disabled in settings, not starting.');
        return null;
      }
      if (server) {
        try { server.close(); } catch (_) {}
        server = null;
      }
      server = http.createServer(handle);
      server.listen(actualPort, '127.0.0.1', () => {
        console.log('[AI-Bridge] Listening on http://127.0.0.1:' + actualPort);
      });
      server.on('error', (err) => {
        console.error('[AI-Bridge] Server error:', err.message);
      });
      return server;
    },
    stop() {
      if (server) {
        try { server.close(); } catch (_) {}
        server = null;
        console.log('[AI-Bridge] Stopped.');
      }
    },
  };
}

module.exports = { createServer, DEFAULT_PORT };
