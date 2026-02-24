import React, { memo, useRef, useEffect, useMemo } from 'react';
import { Button, Space, Tag, Empty } from 'antd';
import { LeftOutlined, RightOutlined, CalendarOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import TimeAxis from './TimeAxis';
import EventBlock from './EventBlock';
import CurrentTimeLine from './CurrentTimeLine';
import {
  HOUR_HEIGHT,
  TOTAL_HEIGHT,
  processEventsLayout,
  getAllDayEvents,
  getTimedEvents,
  calculateTimeFromPosition,
} from '../../utils/calendar-layout';

/**
 * 日视图组件
 * 显示选定日期的 24 小时时间轴和日程块
 */
const DayView = memo(function DayView({
  date,
  schedules,
  onDateChange,
  onEventClick,
  onCreateEvent,
  calendarService,
  showLunar,
  showHoliday,
}) {
  const containerRef = useRef(null);
  const currentDate = useMemo(() => dayjs(date), [date]);

  // 获取当天的日程
  const daySchedules = useMemo(() => {
    if (!schedules || schedules.length === 0) return [];
    return schedules.filter(s => {
      const scheduleDate = dayjs(s.date);
      return scheduleDate.isSame(currentDate, 'day');
    });
  }, [schedules, currentDate]);

  // 处理有时间的日程布局
  const layoutedEvents = useMemo(() => {
    const timedEvents = getTimedEvents(daySchedules);
    return processEventsLayout(timedEvents);
  }, [daySchedules]);

  // 获取全天事件
  const allDayEvents = useMemo(() => {
    return getAllDayEvents(daySchedules);
  }, [daySchedules]);

  // 获取日期信息（农历、节假日）
  const dateInfo = useMemo(() => {
    if (!calendarService) return null;
    return calendarService.getDateInfo(currentDate.toDate(), {
      showLunar,
      showHoliday,
    });
  }, [currentDate, calendarService, showLunar, showHoliday]);

  // 初始滚动到当前时间附近
  useEffect(() => {
    if (containerRef.current) {
      const isToday = currentDate.isSame(dayjs(), 'day');
      if (isToday) {
        const now = dayjs();
        const scrollTop = Math.max(0, (now.hour() - 1) * HOUR_HEIGHT);
        containerRef.current.scrollTop = scrollTop;
      } else {
        // 非今日滚动到上午 8 点
        containerRef.current.scrollTop = 8 * HOUR_HEIGHT;
      }
    }
  }, [currentDate]);

  // 处理容器点击（创建新日程）
  const handleContainerClick = (e) => {
    // 确保点击的是容器本身，而非日程块
    if (e.target.closest('.event-block')) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const scrollTop = containerRef.current.scrollTop;
    const y = e.clientY - rect.top + scrollTop;
    
    const { hours, minutes } = calculateTimeFromPosition(y);
    
    onCreateEvent?.({
      date: currentDate.toDate(),
      startTime: currentDate.hour(hours).minute(minutes).toDate(),
    });
  };

  // 导航到前一天
  const goToPrevDay = () => {
    onDateChange?.(currentDate.subtract(1, 'day').toDate());
  };

  // 导航到后一天
  const goToNextDay = () => {
    onDateChange?.(currentDate.add(1, 'day').toDate());
  };

  // 导航到今天
  const goToToday = () => {
    onDateChange?.(dayjs().toDate());
  };

  const isToday = currentDate.isSame(dayjs(), 'day');
  const weekdayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const weekday = weekdayNames[currentDate.day()];
  const lunarText = dateInfo?.lunar?.simpleText || '';

  return (
    <div>
      {/* 头部：日期显示和导航 */}
      <div className="day-view-header">
        <div className="day-view-date-display">
          <div 
            className="day-view-date-number"
            style={{
              color: isToday ? 'var(--accent-primary, #1677ff)' : 'var(--calendar-text-primary)',
            }}
          >
            {currentDate.date()}
          </div>
          <div className="day-view-date-info">
            <div className="day-view-weekday">
              {currentDate.format('YYYY年M月')} {weekday}
              {isToday && (
                <Tag 
                  color="blue" 
                  style={{ 
                    marginLeft: 8, 
                    fontSize: 11,
                    lineHeight: '18px',
                    height: 20,
                  }}
                >
                  今天
                </Tag>
              )}
            </div>
            {showLunar && lunarText && (
              <div className="day-view-lunar">{lunarText}</div>
            )}
          </div>
        </div>
        <Space>
          {!isToday && (
            <Button size="small" onClick={goToToday}>
              回到今天
            </Button>
          )}
          <Button 
            className="day-view-nav-btn"
            icon={<LeftOutlined />} 
            onClick={goToPrevDay}
          />
          <Button 
            className="day-view-nav-btn"
            icon={<RightOutlined />} 
            onClick={goToNextDay}
          />
        </Space>
      </div>

      {/* 全天事件区域 */}
      {allDayEvents.length > 0 && (
        <div className="all-day-events">
          <span style={{ 
            fontSize: 12, 
            color: 'var(--calendar-text-secondary)',
            marginRight: 8,
          }}>
            全天
          </span>
          {allDayEvents.map(event => (
            <span
              key={event.id}
              className="all-day-event-tag"
              onClick={() => onEventClick?.(event)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onEventClick?.(event);
                }
              }}
            >
              {event.title || '未命名日程'}
            </span>
          ))}
        </div>
      )}

      {/* 时间轴容器 */}
      <div
        ref={containerRef}
        className="day-view-container"
        onClick={handleContainerClick}
      >
        <div className="day-view-time-grid" style={{ height: TOTAL_HEIGHT }}>
          {/* 时间轴 */}
          <TimeAxis />

          {/* 当前时间指示器 */}
          <CurrentTimeLine date={currentDate.toDate()} />

          {/* 日程块 */}
          {layoutedEvents.map(event => (
            <EventBlock
              key={event.id}
              event={event}
              onClick={onEventClick}
            />
          ))}

          {/* 空状态提示 */}
          {daySchedules.length === 0 && (
            <div className="day-view-empty">
              <CalendarOutlined className="day-view-empty-icon" />
              <div>暂无日程</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>
                点击时间轴创建新日程
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

export default DayView;
