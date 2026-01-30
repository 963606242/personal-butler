/**
 * AI 聊天记录 Store
 * 持久化到 ai_chat_messages，切换模块后保留历史
 */
import { create } from 'zustand';
import { getDatabase } from '../services/database';
import { getCryptoService } from '../services/crypto';
import { getLogger } from '../services/logger-client';
import useUserStore from './userStore';

const logger = getLogger();

const useAiChatStore = create((set, get) => ({
  messages: [],
  loading: false,

  async loadMessages() {
    const { currentUser } = useUserStore.getState();
    if (!currentUser) {
      set({ messages: [] });
      return [];
    }
    set({ loading: true });
    try {
      const db = await getDatabase();
      const rows = await db.query(
        'SELECT id, role, content, created_at FROM ai_chat_messages WHERE user_id = ? ORDER BY created_at ASC',
        [currentUser.id]
      );
      const list = (rows || []).map((r) => ({
        id: r.id,
        role: r.role,
        content: r.content,
        created_at: r.created_at,
      }));
      set({ messages: list, loading: false });
      return list;
    } catch (e) {
      logger.error('AiChatStore', '加载聊天记录失败', e);
      set({ messages: [], loading: false });
      return [];
    }
  },

  async appendMessage(role, content) {
    const { currentUser } = useUserStore.getState();
    if (!currentUser) return null;
    const id = getCryptoService().generateUUID();
    const now = Date.now();
    try {
      const db = await getDatabase();
      await db.execute(
        'INSERT INTO ai_chat_messages (id, user_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)',
        [id, currentUser.id, role, content, now]
      );
      const msg = { id, role, content, created_at: now };
      set((s) => ({ messages: [...s.messages, msg] }));
      return id;
    } catch (e) {
      logger.error('AiChatStore', '保存消息失败', e);
      throw e;
    }
  },

  async clearMessages() {
    const { currentUser } = useUserStore.getState();
    if (!currentUser) return;
    try {
      const db = await getDatabase();
      await db.execute('DELETE FROM ai_chat_messages WHERE user_id = ?', [currentUser.id]);
      set({ messages: [] });
    } catch (e) {
      logger.error('AiChatStore', '清空记录失败', e);
      throw e;
    }
  },
}));

export default useAiChatStore;
