/**
 * 新闻管理 Store
 * 新闻数据管理、缓存、早报/晚报生成
 */
import { create } from 'zustand';
import { getLogger } from '../services/logger-client';
import useUserStore from './userStore';
import * as newsAPI from '../services/news-api';
import { getCache, setCache } from '../services/cache-service';
import dayjs from 'dayjs';

const logger = getLogger();

/**
 * 获取当前时间段标识（用于缓存）
 * 早上：6:00-12:00 -> "morning"
 * 下午：12:00-18:00 -> "afternoon"
 * 晚上：18:00-次日6:00 -> "evening"
 * @returns {string} 时间段标识
 */
function getTimePeriod() {
  const hour = dayjs().hour();
  if (hour >= 6 && hour < 12) {
    return 'morning';
  } else if (hour >= 12 && hour < 18) {
    return 'afternoon';
  } else {
    return 'evening';
  }
}

/**
 * 获取当前时间段的过期时间（下一个时间段开始时间）
 * @returns {number} 时间戳
 */
function getTimePeriodExpiry() {
  const now = dayjs();
  const hour = now.hour();
  let nextPeriodStart;
  
  if (hour >= 6 && hour < 12) {
    // 早上 -> 下午12:00
    nextPeriodStart = now.hour(12).minute(0).second(0).millisecond(0);
  } else if (hour >= 12 && hour < 18) {
    // 下午 -> 晚上18:00
    nextPeriodStart = now.hour(18).minute(0).second(0).millisecond(0);
  } else {
    // 晚上 -> 次日早上6:00
    nextPeriodStart = now.add(1, 'day').hour(6).minute(0).second(0).millisecond(0);
  }
  
  return nextPeriodStart.valueOf();
}

const useNewsStore = create((set, get) => ({
  headlines: [],
  newsByCategory: {},
  /** 国内/国外拆分：头条与分类独立，便于按业务展示 */
  headlinesCn: [],
  headlinesIntl: [],
  newsByCategoryCn: {},
  newsByCategoryIntl: {},
  /** 头条加载中：'cn' | 'intl' | null。仅该 tab 内容区转圈，不挡整页 */
  headlineLoading: null,
  /** 分类加载中：'cn_科技' | 'intl_entertainment' | null */
  categoryLoading: null,
  dailyReport: null, // 早报/晚报
  loading: false, // 仅早报/晚报等通用操作使用
  searchResults: [],
  searchLoading: false,

  /** 获取头条新闻。options.skipCache === true 时跳过缓存，强制请求 API。 */
  async fetchHeadlines(options = {}) {
    const { skipCache = false, ...apiOpts } = options;
    try {
      set({ loading: true });
      // 时间段缓存：相同请求参数在不同时间段使用不同的缓存
      const timePeriod = getTimePeriod();
      const cacheKey = `headlines_${timePeriod}_${JSON.stringify(apiOpts)}`;

      if (!skipCache) {
        const cached = await getCache(`news_${cacheKey}`);
        if (cached) {
          logger.debug('NewsStore', '头条来自缓存，未请求API', { 
            cacheKey, 
            时间段: timePeriod,
            条数: cached?.length ?? 0 
          });
          set({ headlines: cached, loading: false });
          return cached;
        }
      } else {
        logger.debug('NewsStore', '头条跳过缓存，强制请求API', { apiOpts, 时间段: timePeriod });
      }

      const news = await newsAPI.getTopHeadlines(apiOpts);
      // 使用时间段缓存（过期时间为下一个时间段开始）
      await setCache(`news_${cacheKey}`, news, getTimePeriodExpiry());
      set({ headlines: news, loading: false });
      return news;
    } catch (e) {
      logger.error('NewsStore', '获取头条新闻失败', e);
      set({ loading: false });
      throw e;
    }
  },

  /** 获取分类新闻。options.skipCache === true 时跳过缓存。 */
  async fetchNewsByCategory(category = 'general', country = 'cn', pageSize = 10, options = {}) {
    const { skipCache = false } = options;
    try {
      set({ loading: true });
      const timePeriod = getTimePeriod();
      const cacheKey = `category_${timePeriod}_${category}_${country}_${pageSize}`;

      if (!skipCache) {
        const cached = await getCache(`news_${cacheKey}`);
        if (cached) {
          set((state) => ({
            newsByCategory: { ...state.newsByCategory, [category]: cached },
            loading: false,
          }));
          return cached;
        }
      }

      const news = await newsAPI.getNewsByCategory(category, country, pageSize);
      await setCache(`news_${cacheKey}`, news, getTimePeriodExpiry());
      set((state) => ({
        newsByCategory: { ...state.newsByCategory, [category]: news },
        loading: false,
      }));
      return news;
    } catch (e) {
      logger.error('NewsStore', `获取分类 ${category} 新闻失败`, e);
      set({ loading: false });
      throw e;
    }
  },

  /** 按来源获取头条（国内/国外独立，有缓存）。用于 国内新闻/国外新闻 tab。 */
  async fetchHeadlinesBySource(options = {}) {
    const { source = 'cn', skipCache = false, category = 'general', pageSize = 20 } = options;
    const key = source === 'cn' ? 'headlinesCn' : 'headlinesIntl';
    const loadingKey = 'headlineLoading';
    try {
      set({ [loadingKey]: source });
      const timePeriod = getTimePeriod();
      const cacheKey = `headlines_${source}_${timePeriod}_${category}_${pageSize}`;

      if (!skipCache) {
        const cached = await getCache(`news_${cacheKey}`);
        if (cached && Array.isArray(cached)) {
          set({ [key]: cached, [loadingKey]: null });
          return cached;
        }
      }

      const fetchFn = source === 'cn' ? newsAPI.getTopHeadlinesCn : newsAPI.getTopHeadlinesIntl;
      const news = await fetchFn({ category, pageSize });
      await setCache(`news_${cacheKey}`, news, getTimePeriodExpiry());
      set({ [key]: news, [loadingKey]: null });
      return news;
    } catch (e) {
      logger.error('NewsStore', `获取${source === 'cn' ? '国内' : '国外'}头条失败`, e);
      set({ [loadingKey]: null });
      throw e;
    }
  },

  /** 按来源获取分类新闻（国内/国外独立，有缓存）。仅列表区 loading，不挡整页。 */
  async fetchNewsByCategoryBySource(category, source, pageSize = 20, options = {}) {
    const { skipCache = false } = options || {};
    const catKey = source === 'cn' ? 'newsByCategoryCn' : 'newsByCategoryIntl';
    const loadingVal = `${source}_${category}`;
    try {
      set({ categoryLoading: loadingVal });
      const timePeriod = getTimePeriod();
      const cacheKey = `category_${source}_${timePeriod}_${category}_${pageSize}`;

      if (!skipCache) {
        const cached = await getCache(`news_${cacheKey}`);
        if (cached && Array.isArray(cached)) {
          set((s) => ({
            [catKey]: { ...s[catKey], [category]: cached },
            categoryLoading: null,
          }));
          return cached;
        }
      }

      const fetchFn = source === 'cn' ? newsAPI.getNewsByCategoryCn : newsAPI.getNewsByCategoryIntl;
      const news = await fetchFn(category, pageSize);
      await setCache(`news_${cacheKey}`, news, getTimePeriodExpiry());
      set((s) => ({
        [catKey]: { ...s[catKey], [category]: news },
        categoryLoading: null,
      }));
      return news;
    } catch (e) {
      logger.error('NewsStore', `获取${source === 'cn' ? '国内' : '国外'}分类 ${category} 失败`, e);
      set({ categoryLoading: null });
      throw e;
    }
  },

  /** 搜索新闻 */
  async searchNews(query, options = {}) {
    if (!query || query.trim().length === 0) {
      set({ searchResults: [] });
      return [];
    }

    try {
      set({ searchLoading: true });
      const results = await newsAPI.searchNews({ q: query, ...options });
      set({ searchResults: results, searchLoading: false });
      return results;
    } catch (e) {
      logger.error('NewsStore', '搜索新闻失败', e);
      set({ searchResults: [], searchLoading: false });
      throw e;
    }
  },

  /** 生成早报（仅国内 API，避免国外 API 超时） */
  async generateMorningReport() {
    try {
      const { userProfile } = useUserStore.getState();
      const interests = userProfile?.interests || {};
      
      const categories = ['general'];
      if (interests.sports && interests.sports.length > 0) categories.push('sports');
      categories.push('technology', 'business');

      let newsByCategory = {};
      const country = 'cn';
      
      try {
        newsByCategory = await newsAPI.getNewsByCategories(categories, 'cn', 3);
      } catch (e) {
        logger.warn('NewsStore', '早报获取国内新闻失败', e);
      }

      // 组织早报内容
      const report = {
        type: 'morning',
        date: dayjs().format('YYYY-MM-DD'),
        generatedAt: Date.now(),
        categories: newsByCategory,
        country,
        summary: {
          totalNews: Object.values(newsByCategory).reduce((sum, news) => sum + (Array.isArray(news) ? news.length : 0), 0),
          categories: Object.keys(newsByCategory).filter((k) => {
            const news = newsByCategory[k];
            return Array.isArray(news) && news.length > 0;
          }),
        },
      };

      set({ dailyReport: report });
      return report;
    } catch (e) {
      logger.error('NewsStore', '生成早报失败', e);
      throw e;
    }
  },

  /** 生成晚报（仅国内 API，避免国外 API 超时） */
  async generateEveningReport() {
    try {
      let headlines = [];
      const country = 'cn';
      
      try {
        headlines = await newsAPI.getTopHeadlinesCn({ category: 'general', pageSize: 10 });
      } catch (e) {
        logger.warn('NewsStore', '晚报获取国内头条失败', e);
      }

      // 组织晚报内容
      const report = {
        type: 'evening',
        date: dayjs().format('YYYY-MM-DD'),
        generatedAt: Date.now(),
        headlines: headlines.slice(0, 5), // 取前5条
        country,
        summary: {
          totalNews: headlines.length,
        },
      };

      set({ dailyReport: report });
      return report;
    } catch (e) {
      logger.error('NewsStore', '生成晚报失败', e);
      throw e;
    }
  },

  /** 获取或生成今日早报 */
  async getTodayMorningReport() {
    try {
      const today = dayjs().format('YYYY-MM-DD');
      const cacheKey = `morning_report_${today}`;
      
      // 先尝试从缓存获取
      const cached = await getCache(`news_${cacheKey}`);
      if (cached) {
        set({ dailyReport: cached });
        return cached;
      }

      // 生成新的早报
      const report = await get().generateMorningReport();
      
      // 保存到缓存（即使数据为空也保存，避免重复请求）
      await setCache(`news_${cacheKey}`, report, getTimePeriodExpiry());

      return report;
    } catch (e) {
      logger.error('NewsStore', '获取今日早报失败', e);
      // 即使失败也返回一个空报告，避免页面显示错误
      const emptyReport = {
        type: 'morning',
        date: dayjs().format('YYYY-MM-DD'),
        generatedAt: Date.now(),
        categories: {},
        summary: { totalNews: 0, categories: [] },
      };
      set({ dailyReport: emptyReport });
      throw e;
    }
  },

  /** 获取或生成今日晚报 */
  async getTodayEveningReport() {
    try {
      const today = dayjs().format('YYYY-MM-DD');
      const cacheKey = `evening_report_${today}`;
      
      // 先尝试从缓存获取
      const cached = await getCache(`news_${cacheKey}`);
      if (cached) {
        set({ dailyReport: cached });
        return cached;
      }

      // 生成新的晚报
      const report = await get().generateEveningReport();
      
      // 保存到缓存（即使数据为空也保存，避免重复请求）
      await setCache(`news_${cacheKey}`, report, getTimePeriodExpiry());

      return report;
    } catch (e) {
      logger.error('NewsStore', '获取今日晚报失败', e);
      // 即使失败也返回一个空报告，避免页面显示错误
      const emptyReport = {
        type: 'evening',
        date: dayjs().format('YYYY-MM-DD'),
        generatedAt: Date.now(),
        headlines: [],
        summary: { totalNews: 0 },
      };
      set({ dailyReport: emptyReport });
      throw e;
    }
  },
}));

export default useNewsStore;
