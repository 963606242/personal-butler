/**
 * countdownStore Unit Tests
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
    generateUUID: vi.fn(() => 'test-countdown-uuid-' + Date.now()),
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
import useCountdownStore, { getNextOccurrence, COUNTDOWN_TYPES } from '../countdownStore';
import { getDatabase } from '../../services/database';
import useUserStore from '../userStore';

describe('countdownStore', () => {
  let mockDb;

  beforeEach(() => {
    // Reset store state
    useCountdownStore.setState({
      events: [],
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

  describe('Constants', () => {
    it('should export COUNTDOWN_TYPES', () => {
      expect(COUNTDOWN_TYPES).toBeDefined();
      expect(COUNTDOWN_TYPES).toHaveLength(3);
      expect(COUNTDOWN_TYPES.map(t => t.value)).toEqual(['anniversary', 'countdown', 'birthday_holiday']);
    });
  });

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const state = useCountdownStore.getState();
      expect(state.events).toEqual([]);
      expect(state.loading).toBe(false);
    });
  });

  describe('loadEvents', () => {
    it('should load events from database', async () => {
      const mockEvents = [
        {
          id: 'event-1',
          title: '结婚纪念日',
          type: 'anniversary',
          target_date: dayjs().add(30, 'day').valueOf(),
          is_annual: 1,
          repeat_interval: 1,
          repeat_unit: 'year',
        },
        {
          id: 'event-2',
          title: '项目截止日期',
          type: 'countdown',
          target_date: dayjs().add(7, 'day').valueOf(),
          is_annual: 0,
          repeat_interval: 0,
          repeat_unit: null,
        },
      ];
      mockDb.query.mockResolvedValue(mockEvents);

      await act(async () => {
        await useCountdownStore.getState().loadEvents();
      });

      const state = useCountdownStore.getState();
      expect(state.events).toHaveLength(2);
      expect(state.events[0].title).toBe('结婚纪念日');
      expect(state.loading).toBe(false);
    });

    it('should return empty array when user not logged in', async () => {
      vi.mocked(useUserStore.getState).mockReturnValue({ currentUser: null });

      await act(async () => {
        await useCountdownStore.getState().loadEvents();
      });

      const state = useCountdownStore.getState();
      expect(state.events).toEqual([]);
    });

    it('should handle database errors', async () => {
      vi.mocked(useUserStore.getState).mockReturnValue({
        currentUser: { id: 'test-user-id', name: 'Test User' },
      });
      mockDb.query.mockRejectedValue(new Error('Database error'));

      await expect(useCountdownStore.getState().loadEvents()).rejects.toThrow('Database error');

      const state = useCountdownStore.getState();
      expect(state.events).toEqual([]);
      expect(state.loading).toBe(false);
    });
  });

  describe('createEvent', () => {
    it('should create a new event', async () => {
      vi.mocked(useUserStore.getState).mockReturnValue({
        currentUser: { id: 'test-user-id', name: 'Test User' },
      });
      mockDb.execute.mockResolvedValue(undefined);
      mockDb.query.mockResolvedValue([]);

      const eventData = {
        title: '生日',
        type: 'birthday_holiday',
        target_date: new Date('2024-12-25'),
        is_annual: true,
        reminder_days_before: 7,
        repeat_interval: 1,
        repeat_unit: 'year',
        notes: '准备礼物',
      };

      await act(async () => {
        const id = await useCountdownStore.getState().createEvent(eventData);
        expect(id).toMatch(/^test-countdown-uuid-/);
      });

      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO countdown_events'),
        expect.arrayContaining(['test-user-id', 'birthday_holiday', '生日'])
      );
    });

    it('should throw error when user not logged in', async () => {
      vi.mocked(useUserStore.getState).mockReturnValue({ currentUser: null });

      await expect(useCountdownStore.getState().createEvent({ title: 'Test' })).rejects.toThrow('用户未登录');
    });
  });

  describe('updateEvent', () => {
    it('should update an existing event', async () => {
      vi.mocked(useUserStore.getState).mockReturnValue({
        currentUser: { id: 'test-user-id', name: 'Test User' },
      });
      mockDb.execute.mockResolvedValue(undefined);
      mockDb.query.mockResolvedValue([]);

      await act(async () => {
        await useCountdownStore.getState().updateEvent('event-1', {
          title: '更新后的标题',
          reminder_days_before: 14,
        });
      });

      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE countdown_events SET'),
        expect.arrayContaining(['更新后的标题', 14])
      );
    });

    it('should not execute if no fields to update', async () => {
      vi.mocked(useUserStore.getState).mockReturnValue({
        currentUser: { id: 'test-user-id', name: 'Test User' },
      });
      
      await act(async () => {
        await useCountdownStore.getState().updateEvent('event-1', {});
      });

      expect(mockDb.execute).not.toHaveBeenCalled();
    });
  });

  describe('deleteEvent', () => {
    it('should delete an event', async () => {
      vi.mocked(useUserStore.getState).mockReturnValue({
        currentUser: { id: 'test-user-id', name: 'Test User' },
      });
      mockDb.execute.mockResolvedValue(undefined);
      mockDb.query.mockResolvedValue([]);

      await act(async () => {
        await useCountdownStore.getState().deleteEvent('event-1');
      });

      expect(mockDb.execute).toHaveBeenCalledWith(
        'DELETE FROM countdown_events WHERE id = ? AND user_id = ?',
        ['event-1', 'test-user-id']
      );
    });
  });

  describe('daysUntil', () => {
    it('should calculate positive days for future events', () => {
      const futureEvent = {
        target_date: dayjs().add(10, 'day').startOf('day').valueOf(),
        is_annual: 0,
        repeat_interval: 0,
      };

      const days = useCountdownStore.getState().daysUntil(futureEvent);
      expect(days).toBe(10);
    });

    it('should return 0 for today', () => {
      const todayEvent = {
        target_date: dayjs().startOf('day').valueOf(),
        is_annual: 0,
        repeat_interval: 0,
      };

      const days = useCountdownStore.getState().daysUntil(todayEvent);
      expect(days).toBe(0);
    });

    it('should calculate next occurrence for annual events', () => {
      // Create an event that was yesterday, with annual repeat
      const pastEvent = {
        target_date: dayjs().subtract(1, 'day').startOf('day').valueOf(),
        is_annual: 1,
        repeat_interval: 0,
        repeat_unit: null,
      };

      const days = useCountdownStore.getState().daysUntil(pastEvent);
      // Should be ~364 days (next year's occurrence)
      expect(days).toBeGreaterThan(300);
    });
  });

  describe('getEventsByType', () => {
    it('should filter events by type', () => {
      useCountdownStore.setState({
        events: [
          { id: '1', type: 'anniversary', title: 'Anniversary' },
          { id: '2', type: 'countdown', title: 'Countdown' },
          { id: '3', type: 'anniversary', title: 'Another Anniversary' },
        ],
      });

      const anniversaries = useCountdownStore.getState().getEventsByType('anniversary');
      expect(anniversaries).toHaveLength(2);
      expect(anniversaries.every(e => e.type === 'anniversary')).toBe(true);
    });

    it('should return all events when type is not specified', () => {
      useCountdownStore.setState({
        events: [
          { id: '1', type: 'anniversary' },
          { id: '2', type: 'countdown' },
        ],
      });

      const allEvents = useCountdownStore.getState().getEventsByType(null);
      expect(allEvents).toHaveLength(2);
    });
  });

  describe('hasRepeat', () => {
    it('should return true for events with repeat_interval', () => {
      const event = { repeat_interval: 1, repeat_unit: 'month', is_annual: 0 };
      const result = useCountdownStore.getState().hasRepeat(event);
      expect(result).toBe(true);
    });

    it('should return true for annual events', () => {
      const event = { repeat_interval: 0, repeat_unit: null, is_annual: 1 };
      const result = useCountdownStore.getState().hasRepeat(event);
      expect(result).toBe(true);
    });

    it('should return false for non-repeating events', () => {
      const event = { repeat_interval: 0, repeat_unit: null, is_annual: 0 };
      const result = useCountdownStore.getState().hasRepeat(event);
      expect(result).toBe(false);
    });
  });

  describe('formatRepeatLabel', () => {
    it('should format yearly repeat', () => {
      const event = { repeat_interval: 1, repeat_unit: 'year', is_annual: 0 };
      const label = useCountdownStore.getState().formatRepeatLabel(event);
      expect(label).toBe('每 1 年');
    });

    it('should format monthly repeat', () => {
      const event = { repeat_interval: 2, repeat_unit: 'month', is_annual: 0 };
      const label = useCountdownStore.getState().formatRepeatLabel(event);
      expect(label).toBe('每 2 月');
    });

    it('should return empty string for non-repeating events', () => {
      const event = { repeat_interval: 0, repeat_unit: null, is_annual: 0 };
      const label = useCountdownStore.getState().formatRepeatLabel(event);
      expect(label).toBe('');
    });

    it('should handle annual events without explicit repeat_interval', () => {
      const event = { repeat_interval: 0, repeat_unit: null, is_annual: 1 };
      const label = useCountdownStore.getState().formatRepeatLabel(event);
      expect(label).toBe('每 1 年');
    });
  });

  describe('getNextOccurrence (exported function)', () => {
    it('should return target date for non-repeating events', () => {
      const futureDate = dayjs().add(30, 'day').startOf('day');
      const event = {
        target_date: futureDate.valueOf(),
        is_annual: 0,
        repeat_interval: 0,
        repeat_unit: null,
      };

      const next = getNextOccurrence(event);
      expect(next.valueOf()).toBe(futureDate.valueOf());
    });

    it('should calculate next occurrence for repeating events', () => {
      // Event was 5 days ago, repeats every week
      const pastDate = dayjs().subtract(5, 'day').startOf('day');
      const event = {
        target_date: pastDate.valueOf(),
        is_annual: 0,
        repeat_interval: 1,
        repeat_unit: 'week',
      };

      const next = getNextOccurrence(event);
      // Should be 2 days from now (7 - 5 = 2)
      expect(next.diff(dayjs().startOf('day'), 'day')).toBe(2);
    });
  });
});
