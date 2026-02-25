/**
 * scheduleStore Unit Tests
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from '@testing-library/react';
import dayjs from 'dayjs';

// Mock dependencies before importing the store
vi.mock('../../services/database', () => ({
  getDatabase: vi.fn(),
}));

vi.mock('../../services/crypto', () => ({
  getCryptoService: vi.fn(() => ({
    generateUUID: vi.fn(() => 'test-schedule-uuid-' + Date.now()),
  })),
}));

vi.mock('../../services/logger-client', () => ({
  getLogger: vi.fn(() => ({
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
}));

vi.mock('../userStore', () => ({
  default: {
    getState: vi.fn(() => ({
      currentUser: { id: 'test-user-id', name: 'Test User' },
    })),
  },
}));

vi.mock('../../utils/schedule-repeat', () => ({
  expandScheduleForDateRange: vi.fn((schedule) => [schedule]),
}));

// Import after mocks are set up
import useScheduleStore from '../scheduleStore';
import { getDatabase } from '../../services/database';
import useUserStore from '../userStore';

describe('scheduleStore', () => {
  let mockDb;

  beforeEach(() => {
    // Reset store state
    useScheduleStore.setState({
      schedules: [],
      loading: false,
      selectedDate: new Date(),
    });

    // Setup mock database
    mockDb = {
      query: vi.fn(),
      execute: vi.fn(),
    };
    vi.mocked(getDatabase).mockResolvedValue(mockDb);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const state = useScheduleStore.getState();
      expect(state.schedules).toEqual([]);
      expect(state.loading).toBe(false);
      expect(state.selectedDate).toBeInstanceOf(Date);
    });
  });

  describe('loadSchedules', () => {
    it('should load schedules from database', async () => {
      const mockSchedules = [
        {
          id: 'schedule-1',
          title: '团队会议',
          date: Date.now(),
          start_time: Date.now(),
          end_time: Date.now() + 3600000,
          repeat_rule: null,
          tags: '["工作"]',
          reminder_settings: null,
        },
        {
          id: 'schedule-2',
          title: '午餐',
          date: Date.now(),
          start_time: null,
          end_time: null,
          repeat_rule: '{"type":"daily"}',
          tags: null,
          reminder_settings: '{"minutes":30}',
        },
      ];
      mockDb.query.mockResolvedValue(mockSchedules);

      await act(async () => {
        await useScheduleStore.getState().loadSchedules();
      });

      const state = useScheduleStore.getState();
      expect(state.schedules).toHaveLength(2);
      expect(state.schedules[0].title).toBe('团队会议');
      expect(state.schedules[0].tags).toEqual(['工作']);
      expect(state.schedules[1].repeat_rule).toEqual({ type: 'daily' });
      expect(state.schedules[1].reminder_settings).toEqual({ minutes: 30 });
      expect(state.loading).toBe(false);
    });

    it('should handle date range filtering', async () => {
      mockDb.query.mockResolvedValue([]);

      const startDate = '2024-01-01';
      const endDate = '2024-01-31';

      await act(async () => {
        await useScheduleStore.getState().loadSchedules(startDate, endDate);
      });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('date >= ? AND date <= ?'),
        expect.arrayContaining(['test-user-id'])
      );
    });

    it('should return empty array when user not logged in', async () => {
      vi.mocked(useUserStore.getState).mockReturnValue({ currentUser: null });

      await act(async () => {
        await useScheduleStore.getState().loadSchedules();
      });

      const state = useScheduleStore.getState();
      expect(state.schedules).toEqual([]);
    });

    it('should handle database errors', async () => {
      vi.mocked(useUserStore.getState).mockReturnValue({
        currentUser: { id: 'test-user-id', name: 'Test User' },
      });
      mockDb.query.mockRejectedValue(new Error('Database error'));

      await expect(useScheduleStore.getState().loadSchedules()).rejects.toThrow('Database error');

      const state = useScheduleStore.getState();
      expect(state.schedules).toEqual([]);
      expect(state.loading).toBe(false);
    });

    it('should handle malformed JSON fields gracefully', async () => {
      vi.mocked(useUserStore.getState).mockReturnValue({
        currentUser: { id: 'test-user-id', name: 'Test User' },
      });
      const mockSchedules = [
        {
          id: 'schedule-1',
          title: 'Test',
          date: Date.now(),
          repeat_rule: 'invalid-json',
          tags: 'also-invalid',
          reminder_settings: '{broken}',
        },
      ];
      mockDb.query.mockResolvedValue(mockSchedules);

      await act(async () => {
        await useScheduleStore.getState().loadSchedules();
      });

      const state = useScheduleStore.getState();
      expect(state.schedules[0].repeat_rule).toBeNull();
      expect(state.schedules[0].tags).toEqual([]);
      expect(state.schedules[0].reminder_settings).toBeNull();
    });
  });

  describe('createSchedule', () => {
    it('should create a new schedule', async () => {
      vi.mocked(useUserStore.getState).mockReturnValue({
        currentUser: { id: 'test-user-id', name: 'Test User' },
      });
      mockDb.execute.mockResolvedValue(undefined);
      mockDb.query.mockResolvedValue([]);

      const scheduleData = {
        title: '新会议',
        date: new Date(),
        startTime: new Date(),
        endTime: new Date(Date.now() + 3600000),
        location: '会议室A',
        notes: '准备演示文稿',
        priority: 1,
        tags: ['工作', '重要'],
      };

      await act(async () => {
        const id = await useScheduleStore.getState().createSchedule(scheduleData);
        expect(id).toMatch(/^test-schedule-uuid-/);
      });

      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO schedules'),
        expect.arrayContaining(['test-user-id', '新会议'])
      );
    });

    it('should throw error when user not logged in', async () => {
      vi.mocked(useUserStore.getState).mockReturnValue({ currentUser: null });

      await expect(useScheduleStore.getState().createSchedule({ title: 'Test' })).rejects.toThrow('用户未登录');
    });
  });

  describe('updateSchedule', () => {
    it('should update an existing schedule', async () => {
      vi.mocked(useUserStore.getState).mockReturnValue({
        currentUser: { id: 'test-user-id', name: 'Test User' },
      });
      mockDb.execute.mockResolvedValue(undefined);
      mockDb.query.mockResolvedValue([]);

      await act(async () => {
        await useScheduleStore.getState().updateSchedule('schedule-1', {
          title: '更新后的标题',
          priority: 2,
        });
      });

      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE schedules SET'),
        expect.arrayContaining(['更新后的标题', 2])
      );
    });

    it('should not execute if no fields to update', async () => {
      vi.mocked(useUserStore.getState).mockReturnValue({
        currentUser: { id: 'test-user-id', name: 'Test User' },
      });
      
      await act(async () => {
        await useScheduleStore.getState().updateSchedule('schedule-1', {});
      });

      expect(mockDb.execute).not.toHaveBeenCalled();
    });
  });

  describe('deleteSchedule', () => {
    it('should delete a schedule', async () => {
      vi.mocked(useUserStore.getState).mockReturnValue({
        currentUser: { id: 'test-user-id', name: 'Test User' },
      });
      mockDb.execute.mockResolvedValue(undefined);
      mockDb.query.mockResolvedValue([]);

      await act(async () => {
        await useScheduleStore.getState().deleteSchedule('schedule-1');
      });

      expect(mockDb.execute).toHaveBeenCalledWith(
        'DELETE FROM schedules WHERE id = ? AND user_id = ?',
        ['schedule-1', 'test-user-id']
      );
    });
  });

  describe('setSelectedDate', () => {
    it('should update selected date', () => {
      const newDate = new Date('2024-06-15');
      
      act(() => {
        useScheduleStore.getState().setSelectedDate(newDate);
      });

      const state = useScheduleStore.getState();
      expect(state.selectedDate).toEqual(newDate);
    });
  });

  describe('getSchedulesByDate', () => {
    it('should return schedules for specific date', () => {
      const today = dayjs().startOf('day');
      const todayMs = today.valueOf();

      useScheduleStore.setState({
        schedules: [
          {
            id: 'schedule-1',
            title: '今天的会议',
            date: todayMs,
            start_time: todayMs + 36000000,
            end_time: todayMs + 39600000,
          },
        ],
      });

      const schedules = useScheduleStore.getState().getSchedulesByDate(today.toDate());
      expect(schedules).toHaveLength(1);
      expect(schedules[0].title).toBe('今天的会议');
    });
  });
});
