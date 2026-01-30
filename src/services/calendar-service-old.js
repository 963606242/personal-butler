/**
 * 日历服务 - 提供农历、节假日等功能
 */
import dayjs from 'dayjs';
import { getLogger } from './logger-client';

const logger = getLogger();

// 导入 lunar-javascript
// Vite 会自动处理 CommonJS 模块
let Solar, Lunar, HolidayUtil;
let lunarModuleLoading = false;
let lunarModuleLoaded = false;

// 加载 lunar-javascript 模块
async function loadLunarModule() {
  if (lunarModuleLoading || lunarModuleLoaded) return;
  
  lunarModuleLoading = true;
  try {
    const LunarModule = await import('lunar-javascript');
    // 处理不同的导出方式
    if (LunarModule.default) {
      Solar = LunarModule.default.Solar;
      Lunar = LunarModule.default.Lunar;
      HolidayUtil = LunarModule.default.HolidayUtil;
    } else {
      Solar = LunarModule.Solar;
      Lunar = LunarModule.Lunar;
      HolidayUtil = LunarModule.HolidayUtil;
    }
    
    if (Solar) {
      lunarModuleLoaded = true;
      logger.info('CalendarService', 'lunar-javascript 加载成功');
    } else {
      logger.warn('CalendarService', 'lunar-javascript 模块结构异常');
    }
  } catch (e) {
    logger.error('CalendarService', '加载 lunar-javascript 失败:', e);
  } finally {
    lunarModuleLoading = false;
  }
}

// 立即开始加载
loadLunarModule();

/**
 * 农历转换服务
 * 使用 lunar-javascript 库进行农历转换
 */
class LunarCalendarService {
  /**
   * 将公历日期转换为农历
   * @param {Date|dayjs.Dayjs} date 公历日期
   * @returns {Object} 农历信息 {year, month, day, isLeapMonth, ganZhi, fullText, jieQi}
   */
  /**
   * 同步版本的农历转换（如果模块已加载）
   */
  solarToLunarSync(date) {
    if (!Solar || !lunarModuleLoaded) {
      return null;
    }
    return this._solarToLunarInternal(date);
  }

  /**
   * 异步版本的农历转换
   */
  async solarToLunar(date) {
    // 确保模块已加载
    if (!lunarModuleLoaded) {
      await loadLunarModule();
    }
    return this._solarToLunarInternal(date);
  }

  /**
   * 内部农历转换实现
   */
  _solarToLunarInternal(date) {
    try {
      if (!Solar) {
        logger.warn('LunarCalendarService', 'lunar-javascript 未加载');
        return null;
      }

      const d = dayjs(date);
      const year = d.year();
      const month = d.month() + 1;
      const day = d.date();

      // 使用 lunar-javascript 库：Solar.fromYmd() -> getLunar()
      const solar = Solar.fromYmd(year, month, day);
      if (!solar) {
        logger.warn('LunarCalendarService', 'Solar.fromYmd 返回空值');
        return null;
      }

      const lunar = solar.getLunar();
      if (!lunar) {
        logger.warn('LunarCalendarService', 'getLunar 返回空值');
        return null;
      }

      const lunarYear = lunar.getYear();
      const lunarMonth = lunar.getMonth();
      const lunarDay = lunar.getDay();
      const isLeapMonth = lunar.isLeapMonth();
      
      // 获取农历月份名称（lunar-javascript 返回的是中文，如"正月"）
      const monthName = lunar.getMonthInChinese().replace('月', '');
      const dayName = lunar.getDayInChinese();

      // 获取24节气信息
      const jieQi = lunar.getJieQi(); // 当前节气（如果当天是节气）
      const jie = lunar.getJie(); // 当前节
      const qi = lunar.getQi(); // 当前气

      return {
        year: lunarYear,
        month: lunarMonth,
        day: lunarDay,
        monthName: monthName,
        dayName: dayName,
        isLeapMonth: isLeapMonth,
        ganZhi: {
          year: lunar.getYearInGanZhi(),
        },
        fullText: `${isLeapMonth ? '闰' : ''}${monthName}月${dayName}`,
        simpleText: `${monthName}.${lunarDay}`,
        jieQi: jieQi || jie || qi || null, // 节气信息
      };
    } catch (error) {
      logger.error('LunarCalendarService', '农历转换失败:', error);
      return null;
    }
  }
}

/**
 * 节假日服务
 */
class HolidayService {
  constructor() {
    // 固定节假日（公历）
    this.fixedHolidays = {
      '01-01': '元旦',
      '02-14': '情人节',
      '03-08': '妇女节',
      '03-12': '植树节',
      '04-01': '愚人节',
      '05-01': '劳动节',
      '05-04': '青年节',
      '06-01': '儿童节',
      '07-01': '建党节',
      '08-01': '建军节',
      '09-10': '教师节',
      '10-01': '国庆节',
      '12-25': '圣诞节',
    };

    // 24节气列表
    this.jieQiList = [
      '立春', '雨水', '惊蛰', '春分', '清明', '谷雨',
      '立夏', '小满', '芒种', '夏至', '小暑', '大暑',
      '立秋', '处暑', '白露', '秋分', '寒露', '霜降',
      '立冬', '小雪', '大雪', '冬至', '小寒', '大寒'
    ];
  }

  /**
   * 获取指定日期的节假日信息
   * @param {Date|dayjs.Dayjs} date 日期
   * @param {Object} lunarInfo 农历信息（可选）
   * @returns {Array} 节假日列表
   */
  getHolidays(date, lunarInfo = null) {
    const holidays = [];
    const d = dayjs(date);
    const monthDay = d.format('MM-DD');

    // 检查固定节假日
    if (this.fixedHolidays[monthDay]) {
      holidays.push({
        name: this.fixedHolidays[monthDay],
        type: 'fixed',
        isOffDay: this.isOffDay(monthDay),
      });
    }

    // 检查农历节假日
    if (lunarInfo) {
      const lunarHoliday = this.getLunarHoliday(lunarInfo);
      if (lunarHoliday) {
        holidays.push(lunarHoliday);
      }
    }

    // 检查24节气
    if (lunarInfo && lunarInfo.jieQi) {
      holidays.push({
        name: lunarInfo.jieQi,
        type: 'jieqi',
        isOffDay: false,
      });
    }

    // 使用 HolidayUtil 检查节假日（如果可用）
    if (HolidayUtil) {
      try {
        const solar = Solar.fromYmd(d.year(), d.month() + 1, d.date());
        const holiday = HolidayUtil.getHoliday(solar.toYmd());
        if (holiday) {
          holidays.push({
            name: holiday.getName(),
            type: 'official',
            isOffDay: holiday.isWork() === false,
          });
        }
      } catch (e) {
        // 忽略错误
      }
    }

    return holidays;
  }

  /**
   * 获取农历节假日
   * @param {Object} lunarInfo 农历信息
   * @returns {Object|null} 节假日信息
   */
  getLunarHoliday(lunarInfo) {
    if (!lunarInfo) return null;

    const { month, day, monthName, dayName, isLeapMonth } = lunarInfo;
    
    // 跳过闰月
    if (isLeapMonth) return null;

    // 春节（正月初一）
    if (month === 1 && day === 1) {
      return {
        name: '春节',
        type: 'lunar',
        isOffDay: true,
      };
    }

    // 元宵节（正月十五）
    if (month === 1 && day === 15) {
      return {
        name: '元宵节',
        type: 'lunar',
        isOffDay: false,
      };
    }

    // 端午节（五月初五）
    if (month === 5 && day === 5) {
      return {
        name: '端午节',
        type: 'lunar',
        isOffDay: true,
      };
    }

    // 七夕（七月初七）
    if (month === 7 && day === 7) {
      return {
        name: '七夕',
        type: 'lunar',
        isOffDay: false,
      };
    }

    // 中秋节（八月十五）
    if (month === 8 && day === 15) {
      return {
        name: '中秋节',
        type: 'lunar',
        isOffDay: true,
      };
    }

    // 重阳节（九月初九）
    if (month === 9 && day === 9) {
      return {
        name: '重阳节',
        type: 'lunar',
        isOffDay: false,
      };
    }

    // 除夕（腊月三十或二十九）
    if (month === 12) {
      // 需要检查是否是腊月的最后一天
      // 这里简化处理，检查是否是腊月三十或二十九
      if (day === 30 || day === 29) {
        // 更准确的判断需要检查下一天是否是正月初一
        return {
          name: '除夕',
          type: 'lunar',
          isOffDay: true,
        };
      }
    }

    return null;
  }

  /**
   * 判断是否为法定节假日
   */
  isOffDay(monthDay) {
    const offDays = ['01-01', '05-01', '10-01'];
    return offDays.includes(monthDay);
  }

  /**
   * 加载节假日数据（从本地或API）
   */
  async loadHolidayData(year) {
    // 可以从本地文件或API加载
    // 返回该年的节假日数据
    return {};
  }
}

/**
 * 日历服务主类
 */
class CalendarService {
  constructor() {
    this.lunarService = new LunarCalendarService();
    this.holidayService = new HolidayService();
  }

  /**
   * 获取日期详细信息（同步版本，如果模块未加载则返回基础信息）
   * @param {Date|dayjs.Dayjs} date 日期
   * @param {Object} options 选项 {showLunar, showHoliday}
   */
  getDateInfoSync(date, options = {}) {
    const { showLunar = true, showHoliday = true } = options;
    const info = {
      solar: dayjs(date).format('YYYY-MM-DD'),
      weekday: dayjs(date).format('dddd'),
      lunar: null,
      holidays: [],
      jieQi: null, // 24节气
    };

    // 如果模块未加载，返回基础信息
    if (!lunarModuleLoaded) {
      return info;
    }

    let lunarInfo = null;
    if (showLunar && Solar) {
      try {
        lunarInfo = this.lunarService.solarToLunarSync(date);
        info.lunar = lunarInfo;
        
        // 提取节气信息
        if (lunarInfo && lunarInfo.jieQi) {
          info.jieQi = lunarInfo.jieQi;
        }
      } catch (e) {
        logger.warn('CalendarService', '同步获取农历信息失败:', e);
      }
    }

    if (showHoliday) {
      // 传递农历信息以便检查农历节假日
      info.holidays = this.holidayService.getHolidays(date, lunarInfo);
    }

    return info;
  }

  /**
   * 获取日期详细信息（异步版本）
   * @param {Date|dayjs.Dayjs} date 日期
   * @param {Object} options 选项 {showLunar, showHoliday}
   */
  async getDateInfo(date, options = {}) {
    // 确保模块已加载
    if (!lunarModuleLoaded) {
      await loadLunarModule();
    }
    return this.getDateInfoSync(date, options);
  }
}

// 单例导出
let calendarServiceInstance = null;

export function getCalendarService() {
  if (!calendarServiceInstance) {
    calendarServiceInstance = new CalendarService();
  }
  return calendarServiceInstance;
}

export default CalendarService;
