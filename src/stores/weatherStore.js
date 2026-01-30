/**
 * 天气管理 Store
 * 城市管理、天气数据缓存、用户城市配置
 */
import { create } from 'zustand';
import { getDatabase } from '../services/database';
import { getLogger } from '../services/logger-client';
import useUserStore from './userStore';
import * as weatherAPI from '../services/weather-api';
import dayjs from 'dayjs';

const logger = getLogger();

/** 当天结束时间戳（次日 00:00:00），用于天气按日缓存 */
function getEndOfTodayTs() {
  return dayjs().add(1, 'day').startOf('day').valueOf();
}

/** 今日日期 YYYY-MM-DD，用于缓存 key */
function getTodayStr() {
  return dayjs().format('YYYY-MM-DD');
}

const useWeatherStore = create((set, get) => ({
  currentCity: null, // { name, lat, lon, country, state }
  currentWeather: null,
  forecast: [],
  loading: false,
  searchResults: [],
  searchLoading: false,

  /** 加载用户配置的城市 */
  async loadUserCity() {
    try {
      const db = await getDatabase();
      const { currentUser } = useUserStore.getState();
      if (!currentUser) return null;

      const profiles = await db.query(
        'SELECT city FROM user_profiles WHERE user_id = ?',
        [currentUser.id]
      );
      const profile = profiles.length > 0 ? profiles[0] : null;

      if (profile?.city) {
        try {
          const cityData = JSON.parse(profile.city);
          set({ currentCity: cityData });
          return cityData;
        } catch (e) {
          logger.warn('WeatherStore', '解析城市配置失败', e);
        }
      }

      return null;
    } catch (e) {
      logger.error('WeatherStore', '加载用户城市失败', e);
      return null;
    }
  },

  /** 保存用户城市配置 */
  async saveUserCity(city) {
    try {
      const db = await getDatabase();
      const { currentUser } = useUserStore.getState();
      if (!currentUser) throw new Error('用户未登录');

      await db.execute(
        'UPDATE user_profiles SET city = ? WHERE user_id = ?',
        [JSON.stringify(city), currentUser.id]
      );

      set({ currentCity: city });
      logger.log('WeatherStore', '已保存用户城市配置', city);
    } catch (e) {
      logger.error('WeatherStore', '保存用户城市失败', e);
      throw e;
    }
  },

  /** 搜索城市 */
  async searchCities(query) {
    if (!query || query.trim().length === 0) {
      set({ searchResults: [] });
      return [];
    }

    try {
      set({ searchLoading: true });
      const results = await weatherAPI.searchCities(query);
      set({ searchResults: results, searchLoading: false });
      return results;
    } catch (e) {
      logger.error('WeatherStore', '搜索城市失败', e);
      set({ searchResults: [], searchLoading: false });
      throw e;
    }
  },

  /** 从缓存获取天气（key 含日期，如 weather_39.9_116.4_2026-01-28） */
  async getWeatherFromCache(fullKey) {
    try {
      const db = await getDatabase();
      const cachedList = await db.query(
        'SELECT value, expires_at FROM cache WHERE key = ?',
        [`weather_${fullKey}`]
      );
      const cached = cachedList.length > 0 ? cachedList[0] : null;

      if (cached && cached.expires_at > Date.now()) {
        return JSON.parse(cached.value);
      }

      return null;
    } catch (e) {
      logger.warn('WeatherStore', '获取缓存失败', e);
      return null;
    }
  },

  /** 保存天气到缓存（同城同日缓存，过期时间当日结束） */
  async saveWeatherToCache(fullKey, weatherData, expiresAt = null) {
    try {
      const db = await getDatabase();
      const exp = expiresAt != null ? expiresAt : getEndOfTodayTs();
      await db.execute(
        `INSERT OR REPLACE INTO cache (key, value, expires_at, created_at)
         VALUES (?, ?, ?, ?)`,
        [`weather_${fullKey}`, JSON.stringify(weatherData), exp, Date.now()]
      );
    } catch (e) {
      logger.warn('WeatherStore', '保存缓存失败', e);
    }
  },

  /** 获取当前天气（同城同日缓存，城市搜索保持实时不缓存）。options.skipCache 强制请求 API。 */
  async fetchCurrentWeather(city = null, options = {}) {
    const targetCity = city || get().currentCity;
    if (!targetCity) {
      const defaultCity = { name: '北京', lat: 39.9042, lon: 116.4074, country: 'CN' };
      return get().fetchCurrentWeather(defaultCity, options);
    }

    const { skipCache = false } = options;
    try {
      set({ loading: true });
      const day = getTodayStr();
      const cacheKey = `current_${targetCity.lat}_${targetCity.lon}_${day}`;

      if (!skipCache) {
        const cached = await get().getWeatherFromCache(cacheKey);
        if (cached) {
          set({ currentWeather: cached, loading: false });
          return cached;
        }
      }

      const weather = await weatherAPI.getWeatherByCoords(targetCity.lat, targetCity.lon);
      await get().saveWeatherToCache(cacheKey, weather);

      set({ currentWeather: weather, loading: false });
      return weather;
    } catch (e) {
      logger.error('WeatherStore', '获取天气失败', e);
      set({ loading: false });
      if (e.message && e.message.includes('401')) {
        const friendlyError = new Error('API Key 无效或未激活。请检查：1) API Key 是否正确 2) 是否已激活（新申请的 Key 可能需要等待几分钟到几小时）3) 是否超过了免费额度限制');
        friendlyError.originalError = e;
        throw friendlyError;
      }
      throw e;
    }
  },

  /** 获取天气预报（同城同日缓存）。options.skipCache 强制请求 API。 */
  async fetchForecast(city = null, options = {}) {
    const targetCity = city || get().currentCity;
    if (!targetCity) {
      const defaultCity = { name: '北京', lat: 39.9042, lon: 116.4074, country: 'CN' };
      return get().fetchForecast(defaultCity, options);
    }

    const { skipCache = false } = options;
    try {
      const day = getTodayStr();
      const cacheKey = `forecast_${targetCity.lat}_${targetCity.lon}_${day}`;

      if (!skipCache) {
        const cached = await get().getWeatherFromCache(cacheKey);
        if (cached && Array.isArray(cached)) {
          set({ forecast: cached });
          return cached;
        }
      }

      const forecast = await weatherAPI.getForecast(targetCity.lat, targetCity.lon);
      await get().saveWeatherToCache(cacheKey, forecast);

      set({ forecast });
      return forecast;
    } catch (e) {
      logger.error('WeatherStore', '获取天气预报失败', e);
      throw e;
    }
  },

  /** 切换城市（会请求新城市天气，走缓存逻辑） */
  async switchCity(city) {
    try {
      await get().saveUserCity(city);
      await get().fetchCurrentWeather(city);
      await get().fetchForecast(city);
    } catch (e) {
      logger.error('WeatherStore', '切换城市失败', e);
      throw e;
    }
  },

  /** 初始化：加载用户城市并获取天气 */
  async initialize() {
    try {
      const userCity = await get().loadUserCity();
      await get().fetchCurrentWeather(userCity);
      await get().fetchForecast(userCity);
    } catch (e) {
      logger.error('WeatherStore', '初始化失败', e);
    }
  },
}));

export default useWeatherStore;
