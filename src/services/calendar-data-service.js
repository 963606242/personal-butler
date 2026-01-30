/**
 * 日历数据服务
 * 管理农历、节假日、24节气等数据
 * 支持从API获取或使用本地数据
 */
import dayjs from 'dayjs';
import { getLogger } from './logger-client';

const logger = getLogger();

/**
 * 日历数据服务
 * 使用本地数据文件，避免每次计算
 */
class CalendarDataService {
  constructor() {
    this.dataCache = new Map(); // 缓存日期数据
    this.yearData = {}; // 按年份存储的数据
    this.initialized = false;
  }

  /**
   * 初始化数据服务
   * 可以加载本地数据文件或从API获取
   */
  async initialize() {
    if (this.initialized) return;

    try {
      // 尝试加载本地数据文件
      // 如果不存在，可以调用API获取并保存
      await this.loadLocalData();
      this.initialized = true;
      logger.log('CalendarDataService', '数据服务初始化成功');
    } catch (error) {
      logger.error('CalendarDataService', '初始化失败:', error);
      // 如果加载失败，使用备用方案（实时计算）
      this.initialized = true; // 标记为已初始化，但使用备用方案
    }
  }

  /**
   * 加载本地数据文件
   */
  async loadLocalData() {
    // 这里可以加载预先生成的数据文件
    // 暂时返回空，后续可以添加数据文件
    return {};
  }

  /**
   * 从API获取数据并保存到本地
   * 使用 holiday.ailcc.com API - 获取整年数据（包含农历、节气、节假日）
   * 通过 Electron IPC 在主进程中请求，避免 CORS 问题
   * 缓存：同一年仅请求一次，优先读 localStorage，命中则不再调 API
   */
  async fetchAndSaveData(year) {
    try {
      const cached = this.loadFromLocalStorage(year);
      if (cached && Object.keys(cached).length > 0) {
        logger.log('CalendarDataService', `使用缓存 ${year} 年数据，跳过 API 请求`);
        return cached;
      }

      const apiUrl = `https://holiday.ailcc.com/api/holiday/allyear/${year}`;
      logger.log('CalendarDataService', `开始从API获取 ${year} 年数据: ${apiUrl}`);
      
      let result;
      
      // 尝试通过 Electron IPC 在主进程中请求（避免 CORS）
      if (typeof window !== 'undefined' && window.electronAPI && window.electronAPI.fetchCalendarData) {
        try {
          logger.log('CalendarDataService', '使用 IPC 请求 API');
          const response = await window.electronAPI.fetchCalendarData(apiUrl);
          logger.log('CalendarDataService', 'IPC 响应:', {
            success: response.success,
            hasData: !!response.data,
            dataKeys: response.data ? Object.keys(response.data).slice(0, 10) : [],
            dataSample: response.data ? JSON.stringify(response.data).substring(0, 500) : null,
          });
          
          if (response.success) {
            result = response.data;
          } else {
            throw new Error(response.error || '请求失败');
          }
        } catch (ipcError) {
          logger.warn('CalendarDataService', 'IPC 请求失败，尝试直接 fetch:', ipcError?.message);
          // 如果 IPC 失败，尝试直接 fetch（可能会遇到 CORS）
          const response = await fetch(apiUrl);
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          result = await response.json();
        }
      } else {
        // 非 Electron 环境，直接 fetch（可能会遇到 CORS）
        logger.log('CalendarDataService', '非 Electron 环境，直接 fetch');
        const response = await fetch(apiUrl);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        result = await response.json();
      }
      
      // 输出获取到的数据格式
      logger.log('CalendarDataService', 'API 返回数据格式:', {
        code: result.code,
        year: result.year,
        count: result.count,
        hasData: !!result.data,
        dataLength: result.data ? result.data.length : 0,
        firstItem: result.data && result.data.length > 0 ? result.data[0] : null,
        sampleKeys: result.data && result.data.length > 0 ? Object.keys(result.data[0]) : [],
      });
      
      if (result.code !== 0) {
        throw new Error(`API返回错误: code=${result.code}`);
      }

      // 转换API数据格式为内部格式
      const convertedData = this.convertApiData(result, year);
      
      // 保存到本地存储
      await this.saveToLocalStorage(year, convertedData);
      
      logger.log('CalendarDataService', `从 ${apiUrl} 获取数据成功，共 ${result.count || 0} 天`);
      return convertedData;
      
    } catch (error) {
      logger.error('CalendarDataService', '获取数据失败:', {
        message: error?.message || String(error),
        stack: error?.stack
      });
      throw error;
    }
  }

  /**
   * 转换API数据格式为内部格式
   */
  convertApiData(apiResult, year) {
    const converted = {};
    
    if (!apiResult.data || !Array.isArray(apiResult.data)) {
      logger.warn('CalendarDataService', 'API数据格式异常');
      return converted;
    }

    apiResult.data.forEach((item) => {
      const dateStr = item.date; // 格式: YYYY-MM-DD
      
      converted[dateStr] = {
        date: dateStr,
        year: parseInt(dateStr.split('-')[0]),
        month: parseInt(dateStr.split('-')[1]),
        day: parseInt(dateStr.split('-')[2]),
        weekday: item.week || 0,
        
        // 农历信息
        lunar: item.lunar ? this.parseLunarText(item.lunar) : null,
        
        // 节气信息
        jieQi: item.extra_info || null,
        
        // 节假日信息
        holidays: item.is_holiday === 1 && item.name ? [{
          name: item.name.replace(/（休）|（班）/g, ''),
          type: item.type === 2 ? 'official' : item.type === 3 ? 'adjust' : 'fixed',
          isOffDay: item.is_holiday === 1,
        }] : [],
        
        // 工作日信息
        isWorkDay: item.is_holiday === 0,
        
        // 原始数据（备用）
        _raw: item,
      };
    });

    return converted;
  }

  /**
   * 解析农历文本（如"冬月十三"）为结构化数据
   */
  parseLunarText(lunarText) {
    if (!lunarText) return null;

    // 农历月份名称映射
    const monthMap = {
      '正': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6,
      '七': 7, '八': 8, '九': 9, '十': 10, '冬': 11, '腊': 12
    };

    // 农历日期名称
    const dayNames = [
      '初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十',
      '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十',
      '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十'
    ];

    try {
      // 匹配格式：如"冬月十三"、"腊月初九"
      const match = lunarText.match(/^(闰?)([正二三四五六七八九十冬腊])月([初十廿三][一二三四五六七八九十]|[一二三四五六七八九十])$/);
      
      if (match) {
        const isLeapMonth = match[1] === '闰';
        const monthName = match[2];
        const dayName = match[3];
        
        const month = monthMap[monthName] || 1;
        const day = dayNames.indexOf(dayName) + 1;
        
        return {
          month,
          day,
          monthName,
          dayName,
          isLeapMonth,
          fullText: lunarText,
          simpleText: `${monthName}.${day}`,
        };
      }
    } catch (e) {
      logger.warn('CalendarDataService', `解析农历文本失败: ${lunarText}`, e.message);
    }

    // 如果解析失败，返回原始文本
    return {
      fullText: lunarText,
      simpleText: lunarText,
    };
  }

  /**
   * 保存数据到本地存储
   */
  async saveToLocalStorage(year, data) {
    try {
      const key = `calendar_data_${year}`;
      localStorage.setItem(key, JSON.stringify(data));
      this.yearData[year] = data;
      logger.log('CalendarDataService', `数据已保存到本地: ${year}`);
    } catch (error) {
      logger.error('CalendarDataService', '保存数据失败:', error);
    }
  }

  /**
   * 从本地存储加载数据
   */
  loadFromLocalStorage(year) {
    try {
      const key = `calendar_data_${year}`;
      const dataStr = localStorage.getItem(key);
      if (dataStr) {
        const data = JSON.parse(dataStr);
        this.yearData[year] = data;
        return data;
      }
    } catch (error) {
      logger.error('CalendarDataService', '加载本地数据失败:', error);
    }
    return null;
  }

  /**
   * 获取日期信息（统一接口）
   * @param {Date|dayjs.Dayjs} date 日期
   * @returns {Object} 日期信息
   */
  getDateInfo(date) {
    const d = dayjs(date);
    const dateStr = d.format('YYYY-MM-DD');
    const year = d.year();

    // 检查缓存
    if (this.dataCache.has(dateStr)) {
      return this.dataCache.get(dateStr);
    }

    // 尝试从本地数据加载
    let yearData = this.yearData[year];
    if (!yearData) {
      yearData = this.loadFromLocalStorage(year);
    }

    // 构建日期信息
    const info = {
      date: dateStr,
      year,
      month: d.month() + 1,
      day: d.date(),
      weekday: d.day(),
      lunar: null,
      jieQi: null,
      holidays: [],
      isWorkDay: null, // 是否工作日
    };

    // 如果有预加载的数据，使用它
    if (yearData && yearData[dateStr]) {
      const cachedInfo = yearData[dateStr];
      info.lunar = cachedInfo.lunar;
      info.jieQi = cachedInfo.jieQi;
      info.holidays = cachedInfo.holidays || [];
      info.isWorkDay = cachedInfo.isWorkDay;
      info.weekday = cachedInfo.weekday !== undefined ? cachedInfo.weekday : info.weekday;
    }

    // 缓存结果
    this.dataCache.set(dateStr, info);
    return info;
  }

  /**
   * 批量获取日期信息（用于预加载）
   */
  async getDateInfoBatch(startDate, endDate) {
    const results = [];
    const current = dayjs(startDate);
    const end = dayjs(endDate);

    while (current.isBefore(end) || current.isSame(end)) {
      results.push(this.getDateInfo(current));
      current.add(1, 'day');
    }

    return results;
  }
}

// 单例导出
let calendarDataServiceInstance = null;

export function getCalendarDataService() {
  if (!calendarDataServiceInstance) {
    calendarDataServiceInstance = new CalendarDataService();
    // 异步初始化
    calendarDataServiceInstance.initialize();
  }
  return calendarDataServiceInstance;
}

export default CalendarDataService;
