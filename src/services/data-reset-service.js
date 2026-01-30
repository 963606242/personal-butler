/**
 * 数据重置服务
 * 清除当前用户的日程、习惯、倒数纪念日、装备、服装、搭配、AI 聊天、缓存等应用数据
 * 不删除：用户账号、个人资料、设置（API Keys 等）
 */
import { getDatabase } from './database';
import { getLogger } from './logger-client';

const logger = getLogger();

/** 清空的应用数据表（按依赖顺序） */
const USER_TABLES = [
  'habit_logs',
  'habits',
  'schedules',
  'countdown_events',
  'equipment',
  'clothing',
  'outfits',
  'ai_chat_messages',
];

/**
 * @param {string} userId - 当前用户 ID
 * @returns {{ cleared: string[], error?: string }}
 */
export async function resetAppData(userId) {
  if (!userId) {
    return { cleared: [], error: '用户未登录' };
  }
  const db = await getDatabase();
  const cleared = [];
  try {
    for (const table of USER_TABLES) {
      const sql = `DELETE FROM ${table} WHERE user_id = ?`;
      await db.execute(sql, [userId]);
      cleared.push(table);
    }
    await db.execute('DELETE FROM cache');
    cleared.push('cache');
    logger.log('DataReset', '已重置应用数据', { userId, cleared });
    return { cleared };
  } catch (e) {
    logger.error('DataReset', '重置失败', e);
    return { cleared, error: e?.message || '重置失败' };
  }
}
