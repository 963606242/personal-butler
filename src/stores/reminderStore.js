/**
 * 提醒弹窗状态
 * 用于日程提醒的 in-app 弹窗队列
 */
import { create } from 'zustand';

const useReminderStore = create((set, get) => ({
  /** @type {Array<{ id: string, title: string, body?: string, timeStr: string, location?: string, scheduleId: string, instanceStartMs: number }>} */
  queue: [],

  pushReminder(item) {
    const id = `reminder-${item.scheduleId}-${item.instanceStartMs}-${Date.now()}`;
    set((state) => ({
      queue: [...state.queue, { ...item, id }],
    }));
  },

  dismissReminder(id) {
    set((state) => ({
      queue: state.queue.filter((r) => r.id !== id),
    }));
  },

  dismissAll() {
    set({ queue: [] });
  },

  getCurrent() {
    return get().queue[0] ?? null;
  },
}));

export default useReminderStore;
