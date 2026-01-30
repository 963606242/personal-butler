import { create } from 'zustand';
import { getDatabase } from '../services/database';
import { getCryptoService } from '../services/crypto';
import { getLogger } from '../services/logger-client';
import useUserStore from './userStore';
import { expandScheduleForDateRange } from '../utils/schedule-repeat';
import dayjs from 'dayjs';

const logger = getLogger();

const useScheduleStore = create((set, get) => ({
  schedules: [],
  loading: false,
  selectedDate: new Date(),

  // 加载日程列表
  async loadSchedules(startDate, endDate) {
    try {
      set({ loading: true });
      logger.log('ScheduleStore', '开始加载日程列表...');
      
      const db = await getDatabase();
      const { currentUser } = useUserStore.getState();
      
      if (!currentUser) {
        logger.warn('ScheduleStore', '用户未登录');
        set({ schedules: [], loading: false });
        return [];
      }

      // 如果没有指定日期范围，加载所有日程
      let sql = 'SELECT * FROM schedules WHERE user_id = ? ORDER BY date ASC, start_time ASC';
      let params = [currentUser.id];

      if (startDate && endDate) {
        const startTimestamp = new Date(startDate).setHours(0, 0, 0, 0);
        const endTimestamp = new Date(endDate).setHours(23, 59, 59, 999);
        sql = 'SELECT * FROM schedules WHERE user_id = ? AND date >= ? AND date <= ? ORDER BY date ASC, start_time ASC';
        params = [currentUser.id, startTimestamp, endTimestamp];
        logger.log('ScheduleStore', `加载日期范围: ${startDate} 到 ${endDate}`);
      }

      const schedules = await db.query(sql, params);
      logger.log('ScheduleStore', `加载到 ${schedules.length} 条日程`);

      // 解析 JSON 字段
      const parsedSchedules = schedules.map(schedule => {
        if (schedule.repeat_rule) {
          try {
            schedule.repeat_rule = JSON.parse(schedule.repeat_rule);
          } catch (e) {
            schedule.repeat_rule = null;
          }
        }
        if (schedule.tags) {
          try {
            schedule.tags = JSON.parse(schedule.tags);
          } catch (e) {
            schedule.tags = [];
          }
        }
        if (schedule.reminder_settings) {
          try {
            schedule.reminder_settings = JSON.parse(schedule.reminder_settings);
          } catch (e) {
            schedule.reminder_settings = null;
          }
        }
        return schedule;
      });

      set({ schedules: parsedSchedules, loading: false });
      logger.log('ScheduleStore', '✅ 日程列表加载成功');
      return parsedSchedules;
    } catch (error) {
      logger.error('ScheduleStore', '❌ 加载日程列表失败:', error);
      set({ schedules: [], loading: false });
      throw error;
    }
  },

  // 创建日程
  async createSchedule(scheduleData) {
    try {
      logger.log('ScheduleStore', '开始创建日程...');
      logger.log('ScheduleStore', '日程数据:', scheduleData);
      
      const db = await getDatabase();
      const { currentUser } = useUserStore.getState();
      
      if (!currentUser) {
        throw new Error('用户未登录');
      }

      const crypto = getCryptoService();
      const scheduleId = crypto.generateUUID();
      const now = Date.now();

      // 处理日期和时间
      let date = now;
      if (scheduleData.date) {
        const dateObj = new Date(scheduleData.date);
        date = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate()).getTime();
      }
      
      const startTime = scheduleData.startTime ? new Date(scheduleData.startTime).getTime() : null;
      const endTime = scheduleData.endTime ? new Date(scheduleData.endTime).getTime() : null;
      
      logger.log('ScheduleStore', '处理后的日期和时间:', {
        date: new Date(date).toISOString(),
        startTime: startTime ? new Date(startTime).toISOString() : null,
        endTime: endTime ? new Date(endTime).toISOString() : null,
      });

      // 处理 JSON 字段
      const repeatRule = scheduleData.repeat_rule ? JSON.stringify(scheduleData.repeat_rule) : null;
      const tags = scheduleData.tags && scheduleData.tags.length > 0 ? JSON.stringify(scheduleData.tags) : null;
      const reminderSettings = scheduleData.reminder_settings ? JSON.stringify(scheduleData.reminder_settings) : null;

      await db.execute(
        `INSERT INTO schedules (
          id, user_id, title, start_time, end_time, date, 
          repeat_rule, location, notes, priority, tags, 
          reminder_settings, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          scheduleId,
          currentUser.id,
          scheduleData.title || '',
          startTime,
          endTime,
          date,
          repeatRule,
          scheduleData.location || null,
          scheduleData.notes || null,
          scheduleData.priority || 0,
          tags,
          reminderSettings,
          now,
          now,
        ]
      );

      logger.log('ScheduleStore', '✅ 日程创建成功');
      
      // 重新加载日程列表
      await get().loadSchedules();
      
      return scheduleId;
    } catch (error) {
      logger.error('ScheduleStore', '❌ 创建日程失败:', error);
      throw error;
    }
  },

  // 更新日程
  async updateSchedule(scheduleId, scheduleData) {
    try {
      logger.log('ScheduleStore', `开始更新日程: ${scheduleId}`);
      logger.log('ScheduleStore', '更新数据:', scheduleData);
      
      const db = await getDatabase();
      const { currentUser } = useUserStore.getState();
      
      if (!currentUser) {
        throw new Error('用户未登录');
      }

      const now = Date.now();
      const updateFields = [];
      const updateValues = [];

      // 处理各个字段
      if (scheduleData.title !== undefined) {
        updateFields.push('title = ?');
        updateValues.push(scheduleData.title);
      }
      if (scheduleData.startTime !== undefined) {
        updateFields.push('start_time = ?');
        updateValues.push(scheduleData.startTime ? new Date(scheduleData.startTime).getTime() : null);
        logger.log('ScheduleStore', '更新 startTime:', scheduleData.startTime ? new Date(scheduleData.startTime).toISOString() : null);
      }
      if (scheduleData.endTime !== undefined) {
        updateFields.push('end_time = ?');
        updateValues.push(scheduleData.endTime ? new Date(scheduleData.endTime).getTime() : null);
        logger.log('ScheduleStore', '更新 endTime:', scheduleData.endTime ? new Date(scheduleData.endTime).toISOString() : null);
      }
      if (scheduleData.date !== undefined) {
        updateFields.push('date = ?');
        if (scheduleData.date) {
          const dateObj = new Date(scheduleData.date);
          const dateTimestamp = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate()).getTime();
          updateValues.push(dateTimestamp);
          logger.log('ScheduleStore', '更新 date:', new Date(dateTimestamp).toISOString());
        } else {
          updateValues.push(null);
        }
      }
      if (scheduleData.repeat_rule !== undefined) {
        updateFields.push('repeat_rule = ?');
        // 如果 repeat_rule 是对象，直接序列化；如果是 'none' 或 null，则不重复
        if (scheduleData.repeat_rule && typeof scheduleData.repeat_rule === 'object') {
          updateValues.push(JSON.stringify(scheduleData.repeat_rule));
        } else if (scheduleData.repeat_rule && scheduleData.repeat_rule !== 'none') {
          // 如果是字符串类型，需要构建对象
          updateValues.push(JSON.stringify({ type: scheduleData.repeat_rule }));
        } else {
          updateValues.push(null);
        }
      }
      if (scheduleData.location !== undefined) {
        updateFields.push('location = ?');
        updateValues.push(scheduleData.location);
      }
      if (scheduleData.notes !== undefined) {
        updateFields.push('notes = ?');
        updateValues.push(scheduleData.notes);
      }
      if (scheduleData.priority !== undefined) {
        updateFields.push('priority = ?');
        updateValues.push(scheduleData.priority);
      }
      if (scheduleData.tags !== undefined) {
        updateFields.push('tags = ?');
        updateValues.push(scheduleData.tags && scheduleData.tags.length > 0 ? JSON.stringify(scheduleData.tags) : null);
      }
      if (scheduleData.reminder_settings !== undefined) {
        updateFields.push('reminder_settings = ?');
        updateValues.push(scheduleData.reminder_settings ? JSON.stringify(scheduleData.reminder_settings) : null);
      }

      if (updateFields.length === 0) {
        logger.warn('ScheduleStore', '没有需要更新的字段');
        return;
      }

      updateFields.push('updated_at = ?');
      updateValues.push(now);
      updateValues.push(scheduleId);
      updateValues.push(currentUser.id);

      const sql = `UPDATE schedules SET ${updateFields.join(', ')} WHERE id = ? AND user_id = ?`;
      logger.log('ScheduleStore', '执行 SQL:', sql);
      logger.log('ScheduleStore', 'SQL 参数:', updateValues);

      await db.execute(sql, updateValues);
      logger.log('ScheduleStore', '✅ 日程更新成功');

      // 重新加载日程列表
      await get().loadSchedules();
    } catch (error) {
      logger.error('ScheduleStore', '❌ 更新日程失败:', error);
      throw error;
    }
  },

  // 删除日程
  async deleteSchedule(scheduleId) {
    try {
      logger.log('ScheduleStore', `开始删除日程: ${scheduleId}`);
      
      const db = await getDatabase();
      const { currentUser } = useUserStore.getState();
      
      if (!currentUser) {
        throw new Error('用户未登录');
      }

      await db.execute(
        'DELETE FROM schedules WHERE id = ? AND user_id = ?',
        [scheduleId, currentUser.id]
      );

      logger.log('ScheduleStore', '✅ 日程删除成功');

      // 重新加载日程列表
      await get().loadSchedules();
    } catch (error) {
      logger.error('ScheduleStore', '❌ 删除日程失败:', error);
      throw error;
    }
  },

  // 获取指定日期的日程（含重复规则展开）
  getSchedulesByDate(date) {
    const { schedules } = get();
    const d = dayjs(date).startOf('day');
    const rangeStart = d.toDate();
    const rangeEnd = d.endOf('day').toDate();
    const instances = [];

    for (const schedule of schedules) {
      const expanded = expandScheduleForDateRange(schedule, rangeStart, rangeEnd);
      for (const inst of expanded) {
        instances.push({
          ...inst,
          start_time: inst._instanceStartMs,
          end_time: inst._instanceEndMs,
        });
      }
    }

    return instances.sort((a, b) => (a.start_time || 0) - (b.start_time || 0));
  },

  // 设置选中的日期
  setSelectedDate(date) {
    set({ selectedDate: date });
  },
}));

export default useScheduleStore;
