/**
 * habitStore Unit Tests
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
    generateUUID: vi.fn(() => 'test-uuid-' + Date.now()),
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

// Import after mocks are set up
import useHabitStore from '../habitStore';
import { getDatabase } from '../../services/database';
import useUserStore from '../userStore';

describe('habitStore', () => {
  let mockDb;

  beforeEach(() => {
    // Reset store state
    useHabitStore.setState({
      habits: [],
      logsByHabit: {},
      loading: false,
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
    it('should have empty initial state', () => {
      const state = useHabitStore.getState();
      expect(state.habits).toEqual([]);
      expect(state.logsByHabit).toEqual({});
      expect(state.loading).toBe(false);
    });
  });

  describe('loadHabits', () => {
    it('should load habits from database', async () => {
      const mockHabits = [
        { id: 'habit-1', name: '晨跑', frequency: 'daily', period: 'morning', target_days: null },
        { id: 'habit-2', name: '阅读', frequency: 'daily', period: 'evening', target_days: '[1,2,3]' },
      ];
      mockDb.query.mockResolvedValue(mockHabits);

      await act(async () => {
        await useHabitStore.getState().loadHabits();
      });

      const state = useHabitStore.getState();
      expect(state.habits).toHaveLength(2);
      expect(state.habits[0].name).toBe('晨跑');
      expect(state.habits[1].target_days).toEqual([1, 2, 3]);
      expect(state.loading).toBe(false);
    });

    it('should return empty array when user not logged in', async () => {
      vi.mocked(useUserStore.getState).mockReturnValue({ currentUser: null });

      await act(async () => {
        await useHabitStore.getState().loadHabits();
      });

      const state = useHabitStore.getState();
      expect(state.habits).toEqual([]);
    });

    it('should handle database errors', async () => {
      vi.mocked(useUserStore.getState).mockReturnValue({
        currentUser: { id: 'test-user-id', name: 'Test User' },
      });
      mockDb.query.mockRejectedValue(new Error('Database error'));

      await expect(useHabitStore.getState().loadHabits()).rejects.toThrow('Database error');

      const state = useHabitStore.getState();
      expect(state.habits).toEqual([]);
      expect(state.loading).toBe(false);
    });
  });

  describe('isTargetDay', () => {
    it('should return true for daily habits', () => {
      const habit = { frequency: 'daily', target_days: null };
      const result = useHabitStore.getState().isTargetDay(habit, new Date());
      expect(result).toBe(true);
    });

    it('should return true for weekdays on Monday', () => {
      const habit = { frequency: 'weekdays', target_days: null };
      const monday = dayjs().day(1).toDate(); // Monday = 1
      const result = useHabitStore.getState().isTargetDay(habit, monday);
      expect(result).toBe(true);
    });

    it('should return false for weekdays on Sunday', () => {
      const habit = { frequency: 'weekdays', target_days: null };
      const sunday = dayjs().day(0).toDate(); // Sunday = 0
      const result = useHabitStore.getState().isTargetDay(habit, sunday);
      expect(result).toBe(false);
    });

    it('should return true for weekends on Saturday', () => {
      const habit = { frequency: 'weekends', target_days: null };
      const saturday = dayjs().day(6).toDate(); // Saturday = 6
      const result = useHabitStore.getState().isTargetDay(habit, saturday);
      expect(result).toBe(true);
    });

    it('should check target_days for weekly frequency', () => {
      const habit = { frequency: 'weekly', target_days: [1, 3, 5] }; // Mon, Wed, Fri
      const monday = dayjs().day(1).toDate();
      const tuesday = dayjs().day(2).toDate();

      expect(useHabitStore.getState().isTargetDay(habit, monday)).toBe(true);
      expect(useHabitStore.getState().isTargetDay(habit, tuesday)).toBe(false);
    });
  });

  describe('getStats', () => {
    it('should calculate completion rate correctly', () => {
      const habitId = 'habit-1';
      const todayMs = dayjs().startOf('day').valueOf();
      const yesterdayMs = dayjs().subtract(1, 'day').startOf('day').valueOf();

      // Set up state with habits and logs
      useHabitStore.setState({
        habits: [{ id: habitId, frequency: 'daily', target_days: null }],
        logsByHabit: {
          [habitId]: {
            [todayMs]: { completed: true, notes: null },
            [yesterdayMs]: { completed: true, notes: null },
          },
        },
      });

      const stats = useHabitStore.getState().getStats(habitId, 2);
      expect(stats.targetDays).toBe(2);
      expect(stats.completed).toBe(2);
      expect(stats.rate).toBe(100);
    });

    it('should return zero rate for non-existent habit', () => {
      const stats = useHabitStore.getState().getStats('non-existent', 30);
      expect(stats.targetDays).toBe(0);
      expect(stats.completed).toBe(0);
      expect(stats.rate).toBe(0);
    });
  });

  describe('getStreak', () => {
    it('should calculate streak correctly', () => {
      const habitId = 'habit-1';
      const today = dayjs().startOf('day');
      
      // Create logs for the past 5 days
      const logs = {};
      for (let i = 0; i < 5; i++) {
        logs[today.subtract(i, 'day').valueOf()] = { completed: true, notes: null };
      }

      useHabitStore.setState({
        habits: [{ id: habitId, frequency: 'daily', target_days: null }],
        logsByHabit: { [habitId]: logs },
      });

      const streak = useHabitStore.getState().getStreak(habitId);
      expect(streak).toBe(5);
    });

    it('should return 0 when today is not completed', () => {
      const habitId = 'habit-1';
      const yesterday = dayjs().subtract(1, 'day').startOf('day').valueOf();

      useHabitStore.setState({
        habits: [{ id: habitId, frequency: 'daily', target_days: null }],
        logsByHabit: {
          [habitId]: {
            [yesterday]: { completed: true, notes: null },
          },
        },
      });

      const streak = useHabitStore.getState().getStreak(habitId);
      expect(streak).toBe(0);
    });
  });

  describe('getLog', () => {
    it('should return log for specific date', () => {
      const habitId = 'habit-1';
      const todayMs = dayjs().startOf('day').valueOf();

      useHabitStore.setState({
        logsByHabit: {
          [habitId]: {
            [todayMs]: { completed: true, notes: 'Great!' },
          },
        },
      });

      const log = useHabitStore.getState().getLog(habitId, new Date());
      expect(log).toEqual({ completed: true, notes: 'Great!' });
    });

    it('should return null for missing log', () => {
      const log = useHabitStore.getState().getLog('habit-1', new Date());
      expect(log).toBeNull();
    });
  });
});
