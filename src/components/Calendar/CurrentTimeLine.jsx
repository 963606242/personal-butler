import React, { memo, useEffect, useState } from 'react';
import dayjs from 'dayjs';
import { getCurrentTimePosition } from '../../utils/calendar-layout';

/**
 * 当前时间指示器组件
 * 显示一条红线表示当前时间位置
 */
const CurrentTimeLine = memo(function CurrentTimeLine({ date }) {
  const [top, setTop] = useState(getCurrentTimePosition());
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // 检查是否是今天
    const checkIsToday = () => {
      const isToday = dayjs(date).isSame(dayjs(), 'day');
      setVisible(isToday);
      if (isToday) {
        setTop(getCurrentTimePosition());
      }
    };

    checkIsToday();

    // 每分钟更新位置
    const timer = setInterval(() => {
      checkIsToday();
    }, 60000);

    return () => clearInterval(timer);
  }, [date]);

  if (!visible) return null;

  return (
    <div
      className="current-time-line"
      style={{ top }}
    >
      <div className="current-time-dot" />
    </div>
  );
});

export default CurrentTimeLine;
