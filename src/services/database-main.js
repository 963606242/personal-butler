// 数据库服务 - Electron主进程版本
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { app } = require('electron');

class DatabaseService {
  constructor() {
    this.db = null;
    this.dbPath = null;
    this.initialized = false;
    this.initPromise = null;
    // 不在构造函数中自动初始化，等待显式调用
  }

  async init() {
    // 如果正在初始化，返回现有的 Promise
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this._doInit();
    return this.initPromise;
  }

  async _doInit() {
    try {
      console.log('[DB] 开始初始化数据库服务...');
      console.log('[DB] App 状态 - isReady:', app?.isReady?.());
      
      // 检查 app 是否就绪
      if (!app || !app.isReady || !app.isReady()) {
        console.warn('[DB] App 未就绪，等待 app ready...');
        if (app && app.whenReady) {
          await app.whenReady();
          console.log('[DB] App ready，继续初始化数据库...');
        } else {
          console.error('[DB] ❌ App 对象不可用');
          throw new Error('App 对象不可用');
        }
      }

      // 获取用户数据目录
      const userDataPath = app.getPath('userData');
      console.log('[DB] 用户数据目录:', userDataPath);
      
      const dbDir = path.join(userDataPath, 'personal-butler');
      console.log('[DB] 数据库目录:', dbDir);

      // 确保目录存在
      if (!fs.existsSync(dbDir)) {
        console.log('[DB] 创建数据库目录...');
        fs.mkdirSync(dbDir, { recursive: true });
      }

      this.dbPath = path.join(dbDir, 'personal-butler.db');
      console.log('[DB] 数据库文件路径:', this.dbPath);

      // 创建数据库连接
      console.log('[DB] 创建数据库连接...');
      this.db = new Database(this.dbPath);
      console.log('[DB] 数据库连接创建成功');

      // 启用外键约束
      this.db.pragma('foreign_keys = ON');
      console.log('[DB] 外键约束已启用');

      // 创建表
      console.log('[DB] 开始创建表结构...');
      this.createTables();
      console.log('[DB] 表结构创建完成');

      this.migrateHabitsSchema();
      this.migrateUserProfilesSchema();
      this.migrateCountdownSchema();

      this.initialized = true;
      console.log('[DB] ✅ 数据库初始化成功:', this.dbPath);
    } catch (error) {
      console.error('[DB] ❌ 数据库初始化失败:', error);
      console.error('[DB] 错误堆栈:', error.stack);
      this.initialized = false;
      throw error;
    }
  }

  createTables() {
    // 用户表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE,
        password_hash TEXT,
        encryption_key_encrypted TEXT,
        created_at INTEGER,
        updated_at INTEGER,
        sync_enabled INTEGER DEFAULT 0,
        last_sync_at INTEGER
      )
    `);

    // 用户信息表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS user_profiles (
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
        created_at INTEGER,
        updated_at INTEGER
      )
    `);

    // 日程表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS schedules (
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
      )
    `);

    // 习惯表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS habits (
        id TEXT PRIMARY KEY,
        user_id TEXT REFERENCES users(id),
        name TEXT,
        frequency TEXT,
        reminder_time TEXT,
        target_days TEXT,
        created_at INTEGER
      )
    `);

    // 习惯打卡表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS habit_logs (
        id TEXT PRIMARY KEY,
        habit_id TEXT REFERENCES habits(id),
        user_id TEXT REFERENCES users(id),
        date INTEGER,
        completed INTEGER DEFAULT 0,
        notes TEXT,
        created_at INTEGER,
        UNIQUE(habit_id, date)
      )
    `);

    // 装备表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS equipment (
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
      )
    `);

    // 服装表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS clothing (
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
      )
    `);

    // 搭配表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS outfits (
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
      )
    `);

    // 缓存表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS cache (
        key TEXT PRIMARY KEY,
        value TEXT,
        expires_at INTEGER,
        created_at INTEGER
      )
    `);

    // 应用设置表（API Keys、AI 配置等，优先于 .env）
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at INTEGER
      )
    `);

    // AI 聊天记录表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS ai_chat_messages (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at INTEGER NOT NULL
      )
    `);

    // 倒数纪念日表：纪念日、倒数日、生日节日；重复规则 每 N 天/周/月/年
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS countdown_events (
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
      )
    `);
  }

  // 通用查询方法
  query(sql, params = []) {
    try {
      console.log('[DB] 执行查询:', sql, '参数:', params);
      
      if (!this.db) {
        console.error('[DB] ❌ 数据库未初始化，尝试重新初始化...');
        this.init();
        if (!this.db) {
          throw new Error('数据库未初始化，无法执行查询');
        }
      }

      if (!this.initialized) {
        console.warn('[DB] ⚠️ 数据库未完全初始化，等待初始化完成...');
        // 等待初始化完成
        let attempts = 0;
        while (!this.initialized && attempts < 10) {
          attempts++;
          // 简单的等待
          const start = Date.now();
          while (Date.now() - start < 100) {
            // 等待 100ms
          }
        }
        if (!this.initialized) {
          throw new Error('数据库初始化超时');
        }
      }

      const stmt = this.db.prepare(sql);
      const result = stmt.all(params);
      console.log('[DB] ✅ 查询成功，返回', result.length, '条记录');
      return result;
    } catch (error) {
      console.error('[DB] ❌ 查询错误:', error);
      console.error('[DB] SQL:', sql);
      console.error('[DB] 参数:', params);
      console.error('[DB] 错误堆栈:', error.stack);
      throw error;
    }
  }

  // 通用执行方法
  execute(sql, params = []) {
    try {
      console.log('[DB] 执行更新:', sql, '参数:', params);
      
      if (!this.db) {
        console.error('[DB] ❌ 数据库未初始化，尝试重新初始化...');
        this.init();
        if (!this.db) {
          throw new Error('数据库未初始化，无法执行更新');
        }
      }

      if (!this.initialized) {
        console.warn('[DB] ⚠️ 数据库未完全初始化，等待初始化完成...');
        // 等待初始化完成
        let attempts = 0;
        while (!this.initialized && attempts < 10) {
          attempts++;
          const start = Date.now();
          while (Date.now() - start < 100) {
            // 等待 100ms
          }
        }
        if (!this.initialized) {
          throw new Error('数据库初始化超时');
        }
      }

      const stmt = this.db.prepare(sql);
      const result = stmt.run(params);
      console.log('[DB] ✅ 更新成功，影响行数:', result.changes);
      return result;
    } catch (error) {
      console.error('[DB] ❌ 执行错误:', error);
      console.error('[DB] SQL:', sql);
      console.error('[DB] 参数:', params);
      console.error('[DB] 错误堆栈:', error.stack);
      throw error;
    }
  }

  migrateHabitsSchema() {
    if (!this.db) return;
    try {
      const info = this.db.prepare('PRAGMA table_info(habits)').all();
      const cols = info.map((c) => c.name);
      if (!cols.includes('period')) {
        this.db.exec('ALTER TABLE habits ADD COLUMN period TEXT');
        console.log('[DB] habits 表已添加 period 列');
      }
      if (!cols.includes('sort_order')) {
        this.db.exec('ALTER TABLE habits ADD COLUMN sort_order INTEGER DEFAULT 0');
        console.log('[DB] habits 表已添加 sort_order 列');
      }
    } catch (e) {
      console.warn('[DB] habits 迁移跳过或失败:', e.message);
    }
  }

  migrateUserProfilesSchema() {
    if (!this.db) return;
    try {
      const info = this.db.prepare('PRAGMA table_info(user_profiles)').all();
      const cols = info.map((c) => c.name);
      if (!cols.includes('city')) {
        this.db.exec('ALTER TABLE user_profiles ADD COLUMN city TEXT');
        console.log('[DB] user_profiles 表已添加 city 列');
      }
      if (!cols.includes('mbti')) {
        this.db.exec('ALTER TABLE user_profiles ADD COLUMN mbti TEXT');
        console.log('[DB] user_profiles 表已添加 mbti 列');
      }
    } catch (e) {
      console.warn('[DB] user_profiles 迁移跳过或失败:', e.message);
    }
  }

  migrateCountdownSchema() {
    if (!this.db) return;
    try {
      const info = this.db.prepare('PRAGMA table_info(countdown_events)').all();
      const cols = info.map((c) => c.name);
      if (!cols.includes('repeat_interval')) {
        this.db.exec('ALTER TABLE countdown_events ADD COLUMN repeat_interval INTEGER NOT NULL DEFAULT 0');
        console.log('[DB] countdown_events 表已添加 repeat_interval 列');
      }
      if (!cols.includes('repeat_unit')) {
        this.db.exec('ALTER TABLE countdown_events ADD COLUMN repeat_unit TEXT');
        console.log('[DB] countdown_events 表已添加 repeat_unit 列');
      }
    } catch (e) {
      console.warn('[DB] countdown_events 迁移跳过或失败:', e.message);
    }
  }

  // 关闭数据库
  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

module.exports = DatabaseService;
