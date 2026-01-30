import { create } from 'zustand';
import { getLogger } from '../services/logger-client';

const logger = getLogger();

// 从 localStorage 加载配置
const loadConfig = () => {
  if (typeof window === 'undefined') return {};
  try {
    const saved = localStorage.getItem('calendar-config-storage');
    return saved ? JSON.parse(saved) : {};
  } catch (e) {
    logger.error('CalendarConfigStore', '加载配置失败:', e);
    return {};
  }
};

// 保存配置到 localStorage
const saveConfig = (state) => {
  if (typeof window === 'undefined') return;
  try {
    const persistState = {
      showLunar: state.showLunar,
      showHoliday: state.showHoliday,
      showWeekend: state.showWeekend,
      showToday: state.showToday,
      lunarFormat: state.lunarFormat,
      holidaySource: state.holidaySource,
      holidayAPI: state.holidayAPI,
      customHolidays: state.customHolidays,
      thirdPartySources: state.thirdPartySources,
    };
    localStorage.setItem('calendar-config-storage', JSON.stringify(persistState));
  } catch (e) {
    logger.error('CalendarConfigStore', '保存配置失败:', e);
  }
};

const savedConfig = loadConfig();

const useCalendarConfigStore = create((set, get) => ({
  // 显示配置
  showLunar: savedConfig.showLunar !== undefined ? savedConfig.showLunar : true,
  showHoliday: savedConfig.showHoliday !== undefined ? savedConfig.showHoliday : true,
  showWeekend: savedConfig.showWeekend !== undefined ? savedConfig.showWeekend : true,
  showToday: savedConfig.showToday !== undefined ? savedConfig.showToday : true,
  
  // 农历配置
  lunarFormat: savedConfig.lunarFormat || 'full',
  
  // 节假日配置
  holidaySource: savedConfig.holidaySource || 'local',
  holidayAPI: savedConfig.holidayAPI || '',
  customHolidays: savedConfig.customHolidays || [],
  
  // 第三方信息源配置
  thirdPartySources: savedConfig.thirdPartySources || [
    {
      id: 'default',
      name: '默认节假日',
      type: 'holiday',
      enabled: true,
      url: '',
      config: {},
    },
  ],
  
  // 更新配置
  updateConfig: (config) => {
    logger.log('CalendarConfigStore', '更新配置:', config);
    set(config);
    saveConfig({ ...get(), ...config });
  },
  
  // 添加第三方信息源
  addThirdPartySource: (source) => {
    const sources = [...get().thirdPartySources, source];
    set({ thirdPartySources: sources });
    saveConfig(get());
    logger.log('CalendarConfigStore', '添加第三方信息源:', source);
  },
  
  // 删除第三方信息源
  removeThirdPartySource: (sourceId) => {
    const sources = get().thirdPartySources.filter(s => s.id !== sourceId);
    set({ thirdPartySources: sources });
    saveConfig(get());
    logger.log('CalendarConfigStore', '删除第三方信息源:', sourceId);
  },
  
  // 更新第三方信息源
  updateThirdPartySource: (sourceId, updates) => {
    const sources = get().thirdPartySources.map(s => 
      s.id === sourceId ? { ...s, ...updates } : s
    );
    set({ thirdPartySources: sources });
    saveConfig(get());
    logger.log('CalendarConfigStore', '更新第三方信息源:', sourceId, updates);
  },
  
  // 添加自定义节假日
  addCustomHoliday: (holiday) => {
    const holidays = [...get().customHolidays, holiday];
    set({ customHolidays: holidays });
    saveConfig(get());
    logger.log('CalendarConfigStore', '添加自定义节假日:', holiday);
  },
  
  // 删除自定义节假日
  removeCustomHoliday: (holidayId) => {
    const holidays = get().customHolidays.filter(h => h.id !== holidayId);
    set({ customHolidays: holidays });
    saveConfig(get());
    logger.log('CalendarConfigStore', '删除自定义节假日:', holidayId);
  },
}));

export default useCalendarConfigStore;
