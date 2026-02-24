import React, { memo } from 'react';
import { HOUR_HEIGHT } from '../../utils/calendar-layout';

/**
 * 时间轴组件
 * 显示 24 小时的时间刻度线和标签
 */
const TimeAxis = memo(function TimeAxis() {
  const hours = Array.from({ length: 24 }, (_, i) => i);

  return (
    <>
      {hours.map(hour => (
        <React.Fragment key={hour}>
          {/* 整点刻度线 */}
          <div
            className="time-slot-line"
            style={{ top: hour * HOUR_HEIGHT }}
          />
          {/* 时间标签 */}
          <div
            className="time-slot-label"
            style={{ top: hour * HOUR_HEIGHT }}
          >
            {hour.toString().padStart(2, '0')}:00
          </div>
          {/* 半小时刻度线 */}
          {hour < 23 && (
            <div
              className="time-slot-line time-slot-line-half"
              style={{ top: hour * HOUR_HEIGHT + HOUR_HEIGHT / 2 }}
            />
          )}
        </React.Fragment>
      ))}
      {/* 最后一条线（24:00） */}
      <div
        className="time-slot-line"
        style={{ top: 24 * HOUR_HEIGHT }}
      />
    </>
  );
});

export default TimeAxis;
