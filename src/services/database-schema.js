/**
 * 共享数据库 schema（供 Web/IndexedDB 端建表，与 Electron 主进程表结构一致）
 * 已包含迁移后的完整列（habits.period/sort_order、user_profiles.city/mbti、
 * countdown_events.repeat_interval/repeat_unit、diary_entries.image_analysis/audio_transcript）
 */

export const CREATE_TABLES_SQL = [
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE,
    password_hash TEXT,
    encryption_key_encrypted TEXT,
    created_at INTEGER,
    updated_at INTEGER,
    sync_enabled INTEGER DEFAULT 0,
    last_sync_at INTEGER
  )`,
  `CREATE TABLE IF NOT EXISTS user_profiles (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id),
    gender TEXT,
    height INTEGER,
    weight REAL,
    age INTEGER,
    birthday INTEGER,
    occupation TEXT,
    work_location TEXT,
    work_schedule TEXT,
    interests TEXT,
    city TEXT,
    mbti TEXT,
    created_at INTEGER,
    updated_at INTEGER
  )`,
  `CREATE TABLE IF NOT EXISTS schedules (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id),
    title TEXT,
    start_time INTEGER,
    end_time INTEGER,
    date INTEGER,
    repeat_rule TEXT,
    location TEXT,
    notes TEXT,
    priority INTEGER,
    tags TEXT,
    reminder_settings TEXT,
    created_at INTEGER,
    updated_at INTEGER
  )`,
  `CREATE TABLE IF NOT EXISTS habits (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id),
    name TEXT,
    frequency TEXT,
    reminder_time TEXT,
    target_days TEXT,
    period TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at INTEGER
  )`,
  `CREATE TABLE IF NOT EXISTS habit_logs (
    id TEXT PRIMARY KEY,
    habit_id TEXT REFERENCES habits(id),
    user_id TEXT REFERENCES users(id),
    date INTEGER,
    completed INTEGER DEFAULT 0,
    notes TEXT,
    created_at INTEGER,
    UNIQUE(habit_id, date)
  )`,
  `CREATE TABLE IF NOT EXISTS equipment (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id),
    name TEXT,
    category TEXT,
    brand TEXT,
    model TEXT,
    purchase_date INTEGER,
    price REAL,
    status TEXT,
    image_path TEXT,
    notes TEXT,
    created_at INTEGER,
    updated_at INTEGER
  )`,
  `CREATE TABLE IF NOT EXISTS clothing (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id),
    name TEXT,
    category TEXT,
    color TEXT,
    material TEXT,
    season TEXT,
    style TEXT,
    image_path TEXT,
    purchase_date INTEGER,
    price REAL,
    wash_status TEXT,
    created_at INTEGER,
    updated_at INTEGER
  )`,
  `CREATE TABLE IF NOT EXISTS outfits (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id),
    name TEXT,
    clothing_ids TEXT,
    occasion TEXT,
    weather_condition TEXT,
    rating INTEGER,
    worn_date INTEGER,
    image_path TEXT,
    created_at INTEGER
  )`,
  `CREATE TABLE IF NOT EXISTS cache (
    key TEXT PRIMARY KEY,
    value TEXT,
    expires_at INTEGER,
    created_at INTEGER
  )`,
  `CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at INTEGER
  )`,
  `CREATE TABLE IF NOT EXISTS diary_entries (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id),
    date INTEGER NOT NULL,
    title TEXT,
    content TEXT,
    images TEXT,
    audio_path TEXT,
    video_path TEXT,
    mood TEXT,
    tags TEXT,
    location TEXT,
    weather TEXT,
    image_analysis TEXT,
    audio_transcript TEXT,
    created_at INTEGER,
    updated_at INTEGER
  )`,
  `CREATE INDEX IF NOT EXISTS idx_diary_date ON diary_entries(user_id, date DESC)`,
  `CREATE TABLE IF NOT EXISTS ai_chat_messages (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS countdown_events (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    target_date INTEGER NOT NULL,
    is_annual INTEGER NOT NULL DEFAULT 0,
    reminder_days_before INTEGER NOT NULL DEFAULT 0,
    repeat_interval INTEGER NOT NULL DEFAULT 0,
    repeat_unit TEXT,
    notes TEXT,
    created_at INTEGER,
    updated_at INTEGER
  )`,
];
