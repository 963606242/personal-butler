/**
 * 日记/小记 Store
 * 支持文字、图片、语音、视频记录
 */
import { create } from 'zustand';
import { getDatabase } from '../services/database';
import { getCryptoService } from '../services/crypto';
import { getLogger } from '../services/logger-client';
import useUserStore from './userStore';
import dayjs from 'dayjs';

const logger = getLogger();

const useDiaryStore = create((set, get) => ({
  entries: [],
  loading: false,

  async loadEntries(startDate, endDate) {
    const { currentUser } = useUserStore.getState();
    if (!currentUser) {
      set({ entries: [] });
      return [];
    }
    set({ loading: true });
    try {
      const db = await getDatabase();
      const start = startDate ? dayjs(startDate).startOf('day').valueOf() : null;
      const end = endDate ? dayjs(endDate).endOf('day').valueOf() : null;

      let sql = 'SELECT * FROM diary_entries WHERE user_id = ?';
      const params = [currentUser.id];

      if (start && end) {
        sql += ' AND date >= ? AND date <= ?';
        params.push(start, end);
      } else if (start) {
        sql += ' AND date >= ?';
        params.push(start);
      } else if (end) {
        sql += ' AND date <= ?';
        params.push(end);
      }

      sql += ' ORDER BY date DESC, created_at DESC';

      const rows = await db.query(sql, params);
      const parsed = rows.map((e) => ({
        ...e,
        images: e.images ? (typeof e.images === 'string' ? JSON.parse(e.images) : e.images) : [],
        tags: e.tags ? (typeof e.tags === 'string' ? JSON.parse(e.tags) : e.tags) : [],
      }));
      set({ entries: parsed, loading: false });
      logger.log('DiaryStore', `加载 ${parsed.length} 条日记`);
      return parsed;
    } catch (e) {
      logger.error('DiaryStore', '加载日记失败', e);
      set({ entries: [], loading: false });
      throw e;
    }
  },

  async loadEntriesByDate(date) {
    const start = dayjs(date).startOf('day').valueOf();
    const end = dayjs(date).endOf('day').valueOf();
    return get().loadEntries(new Date(start), new Date(end));
  },

  async createEntry(data) {
    const db = await getDatabase();
    const { currentUser } = useUserStore.getState();
    if (!currentUser) throw new Error('用户未登录');

    const id = getCryptoService().generateUUID();
    const now = Date.now();
    const date = data.date ? dayjs(data.date).startOf('day').valueOf() : now;
    const images = Array.isArray(data.images) ? JSON.stringify(data.images) : (data.images || null);
    const tags = Array.isArray(data.tags) ? JSON.stringify(data.tags) : (data.tags || null);

    await db.execute(
      `INSERT INTO diary_entries (
        id, user_id, date, title, content, images, audio_path, video_path,
        mood, tags, location, weather, image_analysis, audio_transcript, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        currentUser.id,
        date,
        data.title || null,
        data.content || null,
        images,
        data.audio_path || null,
        data.video_path || null,
        data.mood || null,
        tags,
        data.location || null,
        data.weather || null,
        data.image_analysis || null,
        data.audio_transcript || null,
        now,
        now,
      ]
    );
    await get().loadEntries();
    logger.log('DiaryStore', '创建日记成功', id);
    return id;
  },

  async updateEntry(id, data) {
    const db = await getDatabase();
    const { currentUser } = useUserStore.getState();
    if (!currentUser) throw new Error('用户未登录');

    const now = Date.now();
    const date = data.date ? dayjs(data.date).startOf('day').valueOf() : undefined;
    const images = Array.isArray(data.images) ? JSON.stringify(data.images) : (data.images || null);
    const tags = Array.isArray(data.tags) ? JSON.stringify(data.tags) : (data.tags || null);

    const updates = [];
    const params = [];

    if (data.date !== undefined) {
      updates.push('date = ?');
      params.push(date);
    }
    if (data.title !== undefined) {
      updates.push('title = ?');
      params.push(data.title || null);
    }
    if (data.content !== undefined) {
      updates.push('content = ?');
      params.push(data.content || null);
    }
    if (data.images !== undefined) {
      updates.push('images = ?');
      params.push(images);
    }
    if (data.audio_path !== undefined) {
      updates.push('audio_path = ?');
      params.push(data.audio_path || null);
    }
    if (data.video_path !== undefined) {
      updates.push('video_path = ?');
      params.push(data.video_path || null);
    }
    if (data.mood !== undefined) {
      updates.push('mood = ?');
      params.push(data.mood || null);
    }
    if (data.tags !== undefined) {
      updates.push('tags = ?');
      params.push(tags);
    }
    if (data.location !== undefined) {
      updates.push('location = ?');
      params.push(data.location || null);
    }
    if (data.weather !== undefined) {
      updates.push('weather = ?');
      params.push(data.weather || null);
    }
    if (data.image_analysis !== undefined) {
      updates.push('image_analysis = ?');
      params.push(data.image_analysis || null);
    }
    if (data.audio_transcript !== undefined) {
      updates.push('audio_transcript = ?');
      params.push(data.audio_transcript || null);
    }

    updates.push('updated_at = ?');
    params.push(now);
    params.push(id, currentUser.id);

    await db.execute(
      `UPDATE diary_entries SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`,
      params
    );
    await get().loadEntries();
    logger.log('DiaryStore', '更新日记成功', id);
  },

  async deleteEntry(id) {
    const db = await getDatabase();
    const { currentUser } = useUserStore.getState();
    if (!currentUser) throw new Error('用户未登录');

    await db.execute('DELETE FROM diary_entries WHERE id = ? AND user_id = ?', [id, currentUser.id]);
    await get().loadEntries();
    logger.log('DiaryStore', '删除日记成功', id);
  },

  getEntryById(id) {
    return get().entries.find((e) => e.id === id);
  },

  /** 关键词搜索：标题、内容、图片分析、录音转写、标签 */
  async searchEntries(keyword) {
    const { currentUser } = useUserStore.getState();
    if (!currentUser || !keyword || !String(keyword).trim()) {
      return get().entries;
    }
    set({ loading: true });
    try {
      const db = await getDatabase();
      const k = `%${String(keyword).trim()}%`;
      const rows = await db.query(
        `SELECT * FROM diary_entries WHERE user_id = ?
         AND (title LIKE ? OR content LIKE ? OR image_analysis LIKE ? OR audio_transcript LIKE ? OR tags LIKE ?)
         ORDER BY date DESC, created_at DESC`,
        [currentUser.id, k, k, k, k, k]
      );
      const parsed = rows.map((e) => ({
        ...e,
        images: e.images ? (typeof e.images === 'string' ? JSON.parse(e.images) : e.images) : [],
        tags: e.tags ? (typeof e.tags === 'string' ? JSON.parse(e.tags) : e.tags) : [],
      }));
      set({ entries: parsed, loading: false });
      return parsed;
    } catch (e) {
      logger.error('DiaryStore', '搜索失败', e);
      set({ loading: false });
      throw e;
    }
  },
}));

export default useDiaryStore;
