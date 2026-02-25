/**
 * 通用缓存服务
 * 统一处理 cache 表的读写操作，替代各 Store 中重复的缓存逻辑
 */
import { getDatabase } from './database';
import { getLogger } from './logger-client';

const logger = getLogger();

/**
 * 从缓存读取数据（自动检查过期）
 * @param {string} key - 缓存 key（完整 key，含前缀）
 * @returns {Promise<any|null>} 解析后的缓存值，过期或不存在返回 null
 */
export async function getCache(key) {
  try {
    const db = await getDatabase();
    const rows = await db.query(
      'SELECT value, expires_at FROM cache WHERE key = ?',
      [key]
    );
    const cached = rows.length > 0 ? rows[0] : null;
    if (cached && cached.expires_at > Date.now()) {
      return JSON.parse(cached.value);
    }
    return null;
  } catch (e) {
    logger.warn('CacheService', '读取缓存失败', e);
    return null;
  }
}

/**
 * 写入缓存
 * @param {string} key - 缓存 key（完整 key，含前缀）
 * @param {any} value - 要缓存的值（会 JSON.stringify）
 * @param {number} expiresAt - 过期时间戳（毫秒）
 */
export async function setCache(key, value, expiresAt) {
  try {
    const db = await getDatabase();
    await db.execute(
      `INSERT OR REPLACE INTO cache (key, value, expires_at, created_at)
       VALUES (?, ?, ?, ?)`,
      [key, JSON.stringify(value), expiresAt, Date.now()]
    );
  } catch (e) {
    logger.warn('CacheService', '写入缓存失败', e);
  }
}
