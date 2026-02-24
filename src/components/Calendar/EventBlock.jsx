import React, { memo } from 'react';
import { Tooltip } from 'antd';
import { EnvironmentOutlined } from '@ant-design/icons';
import { getPriorityClassName, formatTime } from '../../utils/calendar-layout';

/**
 * 日程块组件
 * 在日视图中显示单个日程
 */
const EventBlock = memo(function EventBlock({
  event,
  onClick,
}) {
  const {
    title,
    start_time,
    end_time,
    location,
    priority = 0,
    layoutTop,
    layoutHeight,
    layoutWidth = '100%',
    layoutLeft = '0%',
  } = event;

  const startTimeStr = formatTime(start_time);
  const endTimeStr = formatTime(end_time);
  const timeText = startTimeStr && endTimeStr 
    ? `${startTimeStr} - ${endTimeStr}` 
    : startTimeStr || '';

  const priorityClass = getPriorityClassName(priority);

  // 根据高度决定显示内容
  const showTime = layoutHeight >= 36;
  const showLocation = layoutHeight >= 52 && location;

  const handleClick = (e) => {
    e.stopPropagation();
    onClick?.(event);
  };

  const tooltipContent = (
    <div style={{ maxWidth: 280 }}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{title || '未命名日程'}</div>
      {timeText && (
        <div style={{ fontSize: 12, color: '#999', marginBottom: 2 }}>
          {timeText}
        </div>
      )}
      {location && (
        <div style={{ fontSize: 12, color: '#999' }}>
          <EnvironmentOutlined style={{ marginRight: 4 }} />
          {location}
        </div>
      )}
    </div>
  );

  return (
    <Tooltip title={tooltipContent} placement="left" mouseEnterDelay={0.5}>
      <div
        className={`event-block ${priorityClass}`}
        style={{
          top: layoutTop,
          height: layoutHeight,
          width: `calc(${layoutWidth} - 4px)`,
          left: `calc(64px + ${layoutLeft})`,
          right: 'auto',
        }}
        onClick={handleClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleClick(e);
          }
        }}
      >
        <div className="event-block-title">
          {title || '未命名日程'}
        </div>
        {showTime && (
          <div className="event-block-time">{timeText}</div>
        )}
        {showLocation && (
          <div className="event-block-location">
            <EnvironmentOutlined style={{ marginRight: 4, fontSize: 10 }} />
            {location}
          </div>
        )}
      </div>
    </Tooltip>
  );
});

export default EventBlock;
