/**
 * 日历服务 V2 - 重构版本
 * 统一管理农历、节假日、24节气等信息
 * 使用本地数据 + 实时计算备用方案
 */
import dayjs from 'dayjs';
import { getLogger } from './logger-client';
import { getCalendarDataService } from './calendar-data-service';

const logger = getLogger();

// 导入 lunar-javascript（备用方案）
let Solar, Lunar, HolidayUtil;
let lunarModuleLoaded = false;
let lunarModuleLoadingPromise = null; // 模块加载 Promise

// 加载 lunar-javascript 模块（备用方案）
function loadLunarModule() {
  // 如果已经在加载或已加载，返回现有的 Promise
  if (lunarModuleLoadingPromise) {
    return lunarModuleLoadingPromise;
  }

  if (lunarModuleLoaded) {
    return Promise.resolve();
  }

  // 创建加载 Promise
  lunarModuleLoadingPromise = (async () => {
    try {
      logger.log('CalendarService', '开始加载 lunar-javascript 模块...');
      
      // 在 Vite 环境中，CommonJS 模块会被包装在 default 中
      const LunarModule = await import('lunar-javascript');
      
      logger.debug('CalendarService', '模块导入结果:', {
        hasDefault: !!LunarModule.default,
        hasSolar: !!LunarModule.Solar,
        keys: Object.keys(LunarModule).slice(0, 10) // 只显示前10个键
      });

      // Vite 会将 CommonJS 模块包装在 default 中
      const moduleExports = LunarModule.default || LunarModule;
      
      if (moduleExports && moduleExports.Solar) {
        Solar = moduleExports.Solar;
        Lunar = moduleExports.Lunar;
        HolidayUtil = moduleExports.HolidayUtil;
        
        logger.debug('CalendarService', '从 default 导出获取模块成功');
      } else if (LunarModule.Solar) {
        // 直接命名导出（某些情况下）
        Solar = LunarModule.Solar;
        Lunar = LunarModule.Lunar;
        HolidayUtil = LunarModule.HolidayUtil;
        
        logger.debug('CalendarService', '从命名导出获取模块成功');
      } else {
        throw new Error('无法找到 Solar 对象，模块结构: ' + JSON.stringify(Object.keys(LunarModule)));
      }
      
      if (Solar && typeof Solar.fromYmd === 'function') {
        lunarModuleLoaded = true;
        logger.log('CalendarService', 'lunar-javascript 加载成功（备用方案）');
        
        // 测试转换
        try {
          const testSolar = Solar.fromYmd(2026, 1, 27);
          const testLunar = testSolar?.getLunar();
          if (testLunar) {
            logger.log('CalendarService', `lunar-javascript 测试转换成功: ${testLunar.getMonthInChinese()}${testLunar.getDayInChinese()}`);
          } else {
            logger.warn('CalendarService', 'lunar-javascript 测试转换返回空值');
          }
        } catch (testError) {
          logger.error('CalendarService', 'lunar-javascript 测试转换失败:', {
            message: testError?.message,
            stack: testError?.stack
          });
        }
      } else {
        throw new Error(`Solar 对象无效: hasSolar=${!!Solar}, type=${typeof Solar}, hasFromYmd=${Solar && typeof Solar.fromYmd === 'function'}`);
      }
    } catch (e) {
      logger.error('CalendarService', 'lunar-javascript 加载失败:', {
        message: e?.message || String(e),
        stack: e?.stack,
        name: e?.name
      });
      // 即使加载失败，也标记为已尝试，避免重复加载
      lunarModuleLoaded = false;
    }
  })();

  return lunarModuleLoadingPromise;
}

// 立即开始加载
loadLunarModule();

/**
 * 农历转换服务（备用方案）
 */
class LunarCalendarService {
  /**
   * 同步版本的农历转换（如果模块已加载）
   * 如果模块未加载，静默返回 null（优先使用 API 数据）
   */
  solarToLunarSync(date) {
    if (!lunarModuleLoaded || !Solar) {
      // 静默返回，不记录日志（这是正常情况，优先使用 API 数据）
      return null;
    }
    return this._solarToLunarInternal(date);
  }

  /**
   * 异步版本的农历转换（等待模块加载）
   */
  async solarToLunar(date) {
    // 如果模块未加载，等待加载完成
    if (!lunarModuleLoaded) {
      try {
        await loadLunarModule();
      } catch (e) {
        logger.warn('LunarCalendarService', '等待模块加载失败:', e?.message);
        return null;
      }
    }

    if (!Solar) {
      return null;
    }

    return this._solarToLunarInternal(date);
  }

  /**
   * 内部转换实现
   */
  _solarToLunarInternal(date) {
    if (!Solar) {
      return null;
    }

    try {
      const d = dayjs(date);
      const year = d.year();
      const month = d.month() + 1;
      const day = d.date();

      logger.debug('LunarCalendarService', `转换日期: ${year}-${month}-${day}`);

      // 调用 Solar.fromYmd
      const solar = Solar.fromYmd(year, month, day);
      if (!solar) {
        logger.warn('LunarCalendarService', `Solar.fromYmd(${year}, ${month}, ${day}) 返回 null`);
        return null;
      }

      const lunar = solar.getLunar();
      if (!lunar) {
        logger.warn('LunarCalendarService', 'solar.getLunar() 返回 null');
        return null;
      }

      // 调试：输出 lunar 对象的所有方法
      logger.debug('LunarCalendarService', 'lunar 对象方法:', {
        hasGetYear: typeof lunar.getYear === 'function',
        hasGetMonth: typeof lunar.getMonth === 'function',
        hasGetDay: typeof lunar.getDay === 'function',
        hasIsLeap: typeof lunar.isLeap === 'function',
        hasIsLeapMonth: typeof lunar.isLeapMonth === 'function',
        lunarMethods: Object.getOwnPropertyNames(Object.getPrototypeOf(lunar)).filter(name => typeof lunar[name] === 'function').slice(0, 20),
      });

      const monthName = lunar.getMonthInChinese().replace('月', '');
      const dayName = lunar.getDayInChinese();
      const jieQi = lunar.getJieQi() || lunar.getJie() || lunar.getQi();
      
      // 检查闰月：lunar-javascript 使用 isLeap() 方法，而不是 isLeapMonth()
      const isLeap = typeof lunar.isLeap === 'function' ? lunar.isLeap() : false;

      const result = {
        year: lunar.getYear(),
        month: lunar.getMonth(),
        day: lunar.getDay(),
        monthName,
        dayName,
        isLeapMonth: isLeap,
        fullText: `${isLeap ? '闰' : ''}${monthName}月${dayName}`,
        simpleText: `${monthName}.${lunar.getDay()}`,
        jieQi: jieQi || null,
      };

      logger.debug('LunarCalendarService', `转换成功: ${result.fullText}`, {
        year: result.year,
        month: result.month,
        day: result.day,
        isLeapMonth: result.isLeapMonth,
      });
      return result;
    } catch (error) {
      // 改进错误日志，显示详细信息
      const errorMsg = error?.message || String(error);
      const errorStack = error?.stack || '';
      logger.error('LunarCalendarService', '农历转换失败:', {
        message: errorMsg,
        stack: errorStack,
        date: dayjs(date).format('YYYY-MM-DD'),
        error: error
      });
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
      '01-01': { name: '元旦', type: 'fixed', isOffDay: true },
      '02-14': { name: '情人节', type: 'fixed', isOffDay: false },
      '03-08': { name: '妇女节', type: 'fixed', isOffDay: false },
      '03-12': { name: '植树节', type: 'fixed', isOffDay: false },
      '04-01': { name: '愚人节', type: 'fixed', isOffDay: false },
      '05-01': { name: '劳动节', type: 'fixed', isOffDay: true },
      '05-04': { name: '青年节', type: 'fixed', isOffDay: false },
      '06-01': { name: '儿童节', type: 'fixed', isOffDay: false },
      '07-01': { name: '建党节', type: 'fixed', isOffDay: false },
      '08-01': { name: '建军节', type: 'fixed', isOffDay: false },
      '09-10': { name: '教师节', type: 'fixed', isOffDay: false },
      '10-01': { name: '国庆节', type: 'fixed', isOffDay: true },
      '12-25': { name: '圣诞节', type: 'fixed', isOffDay: false },
    };
  }

  /**
   * 获取节假日信息
   */
  getHolidays(date, lunarInfo = null) {
    const holidays = [];
    const d = dayjs(date);
    const monthDay = d.format('MM-DD');

    // 固定节假日
    if (this.fixedHolidays[monthDay]) {
      holidays.push(this.fixedHolidays[monthDay]);
    }

    // 农历节假日
    if (lunarInfo) {
      const lunarHoliday = this.getLunarHoliday(lunarInfo);
      if (lunarHoliday) {
        holidays.push(lunarHoliday);
      }
    }

    // 使用 HolidayUtil（如果可用）
    if (HolidayUtil && Solar) {
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
   */
  getLunarHoliday(lunarInfo) {
    if (!lunarInfo || lunarInfo.isLeapMonth) return null;

    const { month, day } = lunarInfo;
    
    const lunarHolidays = {
      '1-1': { name: '春节', type: 'lunar', isOffDay: true },
      '1-15': { name: '元宵节', type: 'lunar', isOffDay: false },
      '5-5': { name: '端午节', type: 'lunar', isOffDay: true },
      '7-7': { name: '七夕', type: 'lunar', isOffDay: false },
      '8-15': { name: '中秋节', type: 'lunar', isOffDay: true },
      '9-9': { name: '重阳节', type: 'lunar', isOffDay: false },
      '12-30': { name: '除夕', type: 'lunar', isOffDay: true },
      '12-29': { name: '除夕', type: 'lunar', isOffDay: true }, // 小年可能只有29天
    };

    const key = `${month}-${day}`;
    return lunarHolidays[key] || null;
  }
}

/**
 * 日历服务主类（重构版）
 */
class CalendarService {
  constructor() {
    this.dataService = getCalendarDataService();
    this.lunarService = new LunarCalendarService();
    this.holidayService = new HolidayService();
  }

  /**
   * 获取日期详细信息（统一接口）
   * @param {Date|dayjs.Dayjs} date 日期
   * @param {Object} options 选项 {showLunar, showHoliday}
   */
  getDateInfo(date, options = {}) {
    const { showLunar = true, showHoliday = true } = options;
    const d = dayjs(date);

    // 先从数据服务获取（优先使用API数据）
    let dateInfo = this.dataService.getDateInfo(date);

    // 如果数据服务没有农历信息，使用备用方案（同步版本，如果模块已加载）
    if (showLunar && !dateInfo.lunar) {
      try {
        // 使用同步版本，如果模块未加载则返回null（不会阻塞）
        dateInfo.lunar = this.lunarService.solarToLunarSync(date);
        if (dateInfo.lunar && dateInfo.lunar.jieQi) {
          dateInfo.jieQi = dateInfo.lunar.jieQi;
        }
      } catch (error) {
        logger.warn('CalendarService', '获取农历信息失败:', error?.message || error);
        dateInfo.lunar = null;
      }
    }

    // 如果数据服务没有节假日信息，使用备用方案
    if (showHoliday && (!dateInfo.holidays || dateInfo.holidays.length === 0)) {
      try {
        dateInfo.holidays = this.holidayService.getHolidays(date, dateInfo.lunar);
      } catch (error) {
        logger.warn('CalendarService', '获取节假日信息失败:', error?.message || error);
        dateInfo.holidays = [];
      }
    }

    // 如果有节气信息，添加到节假日列表
    if (dateInfo.jieQi && showHoliday) {
      const jieQiExists = dateInfo.holidays.some(h => h.name === dateInfo.jieQi);
      if (!jieQiExists) {
        dateInfo.holidays.unshift({
          name: dateInfo.jieQi,
          type: 'jieqi',
          isOffDay: false,
        });
      }
    }

    return dateInfo;
  }

  /**
   * 预加载年份数据
   */
  async preloadYearData(year) {
    try {
      // 尝试从API获取数据
      const data = await this.dataService.fetchAndSaveData(year);
      logger.log('CalendarService', `预加载 ${year} 年数据成功`);
      return data;
    } catch (error) {
      logger.warn('CalendarService', `预加载 ${year} 年数据失败，将使用实时计算:`, error.message);
      return null;
    }
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
