/**
 * Web 端数据库：sql.js + IndexedDB 持久化
 * 与 Electron 主进程共用同一套 SQL/schema，供浏览器、iPad Safari、PWA 使用
 */

import { CREATE_TABLES_SQL } from './database-schema';

const IDB_NAME = 'PersonalButlerDB';
const IDB_STORE = 'sqlite';
const IDB_KEY = 'db';

let SQL = null;
let db = null;
let initPromise = null;

function getWasmPath() {
  if (typeof window === 'undefined') return '';
  const base = window.__BASE__ || (import.meta.env?.BASE_URL ?? '/');
  return `${base}sql-wasm-browser.wasm`.replace(/\/+/g, '/');
}

async function loadSqlJs() {
  if (SQL) return SQL;
  const initSqlJs = (await import('sql.js')).default;
  SQL = await initSqlJs({
    locateFile: (file) => (file.endsWith('.wasm') ? getWasmPath() : file),
  });
  return SQL;
}

function openIndexedDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = (e) => {
      const idb = e.target.result;
      if (!idb.objectStoreNames.contains(IDB_STORE)) {
        idb.createObjectStore(IDB_STORE);
      }
    };
  });
}

function readFromIndexedDB(idb) {
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(IDB_STORE, 'readonly');
    const store = tx.objectStore(IDB_STORE);
    const req = store.get(IDB_KEY);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
  });
}

function writeToIndexedDB(idb, data) {
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(IDB_STORE, 'readwrite');
    const store = tx.objectStore(IDB_STORE);
    const req = store.put(data, IDB_KEY);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve();
  });
}

/**
 * 初始化 Web 端 SQLite（从 IndexedDB 恢复或新建并建表）
 */
export async function initWebDb() {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    await loadSqlJs();
    const idb = await openIndexedDB();
    const buffer = await readFromIndexedDB(idb);
    if (buffer && buffer.byteLength > 0) {
      db = new SQL.Database(new Uint8Array(buffer));
    } else {
      db = new SQL.Database();
      db.run('PRAGMA foreign_keys = ON');
      for (const sql of CREATE_TABLES_SQL) {
        try {
          db.run(sql);
        } catch (e) {
          console.warn('[DB-Web] createTables:', sql.slice(0, 60), e?.message);
        }
      }
      await persist(idb);
    }
    return db;
  })();
  return initPromise;
}

/**
 * 将当前 DB 导出并写入 IndexedDB
 */
export async function persist(idb) {
  if (!db) return;
  const idbConn = idb || (await openIndexedDB());
  const data = db.export();
  await writeToIndexedDB(idbConn, data);
}

/**
 * 查询（SELECT），返回行数组
 */
export function query(sql, params = []) {
  if (!db) throw new Error('Web DB 未初始化');
  const stmt = db.prepare(sql);
  try {
    stmt.bind(params);
    const rows = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject());
    }
    return rows;
  } finally {
    stmt.free();
  }
}

/**
 * 执行（INSERT/UPDATE/DELETE），持久化到 IndexedDB，返回 { changes, lastInsertRowid }
 */
export async function execute(sql, params = []) {
  if (!db) throw new Error('Web DB 未初始化');
  db.run(sql, params);
  const changes = db.getRowsModified();
  let lastInsertRowid = undefined;
  try {
    const r = db.exec('SELECT last_insert_rowid() as id');
    if (r?.length && r[0].values?.length) lastInsertRowid = r[0].values[0][0];
  } catch (_) {}
  const idb = await openIndexedDB();
  await persist(idb);
  return { changes, lastInsertRowid };
}

export function getDb() {
  return db;
}

/** 仅执行不持久化（用于 importFromSync 批量写完后统一 persist） */
function runWithoutPersist(sql, params = []) {
  if (!db) throw new Error('Web DB 未初始化');
  db.run(sql, params);
}

/**
 * 导出所有同步用表（与主进程 exportForSync 结构一致，供加密后上传网盘）
 */
export function exportForSync() {
  if (!db) throw new Error('Web DB 未初始化');
  const tables = [
    'users',
    'user_profiles',
    'schedules',
    'habits',
    'habit_logs',
    'equipment',
    'clothing',
    'outfits',
    'settings',
    'diary_entries',
    'ai_chat_messages',
    'countdown_events',
    'cache',
  ];
  const out = { version: 1, exportedAt: Date.now(), data: {} };
  for (const table of tables) {
    try {
      const rows = query(`SELECT * FROM ${table}`);
      out.data[table] = rows;
    } catch (e) {
      console.warn('[DB-Web] exportForSync 跳过表', table, e?.message);
      out.data[table] = [];
    }
  }
  return out;
}

/**
 * 从同步包导入（先清空再插入，与主进程 importFromSync 顺序一致）
 */
export async function importFromSync(payload) {
  if (!db) throw new Error('Web DB 未初始化');
  if (!payload?.data || typeof payload.data !== 'object') throw new Error('无效的同步数据');
  const tables = [
    'cache',
    'countdown_events',
    'ai_chat_messages',
    'diary_entries',
    'settings',
    'outfits',
    'clothing',
    'equipment',
    'habit_logs',
    'habits',
    'schedules',
    'user_profiles',
    'users',
  ];
  try {
    db.run('PRAGMA foreign_keys = OFF');
    for (const table of tables) {
      const rows = payload.data[table];
      if (!Array.isArray(rows) || rows.length === 0) continue;
      const cols = Object.keys(rows[0]).filter((k) => k !== undefined);
      if (cols.length === 0) continue;
      const placeholders = cols.map(() => '?').join(', ');
      const colList = cols.join(', ');
      runWithoutPersist(`DELETE FROM ${table}`);
      for (const row of rows) {
        const vals = cols.map((c) => row[c] ?? null);
        runWithoutPersist(`INSERT OR REPLACE INTO ${table} (${colList}) VALUES (${placeholders})`, vals);
      }
    }
  } finally {
    db.run('PRAGMA foreign_keys = ON');
    const idb = await openIndexedDB();
    await persist(idb);
  }
}
