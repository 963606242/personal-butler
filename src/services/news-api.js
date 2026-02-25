/**
 * 新闻 API 服务
 * 支持自动切换API源：
 * 1. 优先使用国内API（天聚数行/极速数据）
 * 2. 国内API失败时自动切换到国际API（NewsAPI）
 * 注意：需要配置至少一个API_KEY，可以通过环境变量设置
 * 免费版限制：100次/天，仅限开发使用
 */

import { getLogger } from './logger-client';

const logger = getLogger();

import * as cnNewsAPI from './news-api-cn';
import { fetchJson } from './fetch-json';
import { getConfigStr } from './config';

const NEWS_API_BASE = 'https://newsapi.org/v2';

function getNewsApiKey() {
  return getConfigStr('news_api_key') || (import.meta.env.VITE_NEWS_API_KEY ?? '');
}

/** 调试日志：始终输出到控制台，便于排查 API 切换问题。无需在 Console 粘贴任何代码。 */
function newsDebugLog(msg, detail) {
  let detailStr = '';
  if (detail != null) {
    try {
      detailStr = typeof detail === 'object' ? ' ' + JSON.stringify(detail) : ' ' + String(detail);
    } catch {
      detailStr = ' [无法序列化]';
    }
  }
  logger.debug('NewsAPI', `调试: ${msg}${detailStr}`);
}

/**
 * 检查 API Key 是否配置（国内或国际）
 */
export function isApiKeyConfigured() {
  return !!(getNewsApiKey()?.length) || cnNewsAPI.isCnApiKeyConfigured();
}

/** 是否已配置国际 API（NewsAPI） */
export function isIntlApiConfigured() {
  return !!(getNewsApiKey()?.length);
}

/**
 * 获取头条新闻（国际API - NewsAPI）
 * @param {Object} options - 选项
 * @param {string} options.country - 国家代码（如：cn, us）
 * @param {string} options.category - 分类（business, entertainment, general, health, science, sports, technology）
 * @param {number} options.pageSize - 每页数量（默认20，最大100）
 * @returns {Promise<Array>} 新闻列表
 */
async function getTopHeadlinesInternational(options = {}) {
  const key = getNewsApiKey();
  if (!key) {
    throw new Error('国际API Key 未配置，请在设置中配置 NewsAPI Key');
  }

  const { country = 'cn', category = 'general', pageSize = 20 } = options;

  try {
    const params = new URLSearchParams({
      country,
      category,
      pageSize: Math.min(pageSize, 100).toString(),
      apiKey: key,
    });
    const url = `${NEWS_API_BASE}/top-headlines?${params.toString()}`;

    let data;
    try {
      data = await fetchJson(url);
    } catch (e) {
      if (e.status === 401) {
        throw new Error(`API Key 无效。请检查：1) API Key 是否正确 2) 是否已激活 3) 是否超过了免费额度限制（100次/天）。错误详情: ${e.message || 'Unauthorized'}`);
      }
      throw e;
    }
    
    // 检查返回的数据
    if (!data || typeof data !== 'object') {
      logger.warn('NewsAPI', '返回数据格式异常', data);
      throw new Error('API 返回数据格式异常');
    }
    
    // 检查是否有错误信息
    if (data.status === 'error') {
      const errorMsg = data.message || '未知错误';
      logger.error('NewsAPI', 'API 返回错误', errorMsg);
      throw new Error(`NewsAPI 错误: ${errorMsg}`);
    }
    
    if (!data.articles || !Array.isArray(data.articles)) {
      logger.warn('NewsAPI', '返回数据格式异常，articles 不是数组', data);
      return [];
    }
    
    if (data.articles.length === 0) {
      logger.warn('NewsAPI', '返回的新闻列表为空', { country, category, totalResults: data.totalResults });
      return [];
    }
    
    return data.articles
      .filter((article) => article.title && article.url) // 过滤掉无效数据
      .map((article) => ({
        title: article.title,
        description: article.description || '',
        url: article.url,
        urlToImage: article.urlToImage || null,
        publishedAt: article.publishedAt,
        source: article.source?.name || '未知来源',
        author: article.author || null,
        category: category,
      }));
  } catch (error) {
    logger.error('NewsAPI', '获取头条新闻失败', error);
    throw error;
  }
}

/**
 * 搜索新闻（国际API - NewsAPI）
 * @param {Object} options - 选项
 * @param {string} options.q - 搜索关键词
 * @param {string} options.language - 语言（zh, en等）
 * @param {string} options.sortBy - 排序方式（relevancy, popularity, publishedAt）
 * @param {number} options.pageSize - 每页数量（默认20，最大100）
 * @returns {Promise<Array>} 新闻列表
 */
async function searchNewsInternational(options = {}) {
  const key = getNewsApiKey();
  if (!key) {
    throw new Error('国际API Key 未配置，请在设置中配置 NewsAPI Key');
  }

  const { q, language = 'zh', sortBy = 'publishedAt', pageSize = 20 } = options;
  
  if (!q || q.trim().length === 0) {
    return [];
  }

  try {
    const params = new URLSearchParams({
      q: q.trim(),
      language,
      sortBy,
      pageSize: Math.min(pageSize, 100).toString(),
      apiKey: key,
    });
    const url = `${NEWS_API_BASE}/everything?${params.toString()}`;

    let data;
    try {
      data = await fetchJson(url);
    } catch (e) {
      if (e.status === 401) {
        throw new Error(`API Key 无效。请检查：1) API Key 是否正确 2) 是否已激活 3) 是否超过了免费额度限制（100次/天）。错误详情: ${e.message || 'Unauthorized'}`);
      }
      throw e;
    }

    // 检查返回的数据
    if (!data || typeof data !== 'object') {
      logger.warn('NewsAPI', '搜索返回数据格式异常', data);
      throw new Error('API 返回数据格式异常');
    }
    
    // 检查是否有错误信息
    if (data.status === 'error') {
      const errorMsg = data.message || '未知错误';
      logger.error('NewsAPI', '搜索 API 返回错误', errorMsg);
      throw new Error(`NewsAPI 错误: ${errorMsg}`);
    }
    
    if (!data.articles || !Array.isArray(data.articles)) {
      logger.warn('NewsAPI', '搜索返回数据格式异常，articles 不是数组', data);
      return [];
    }
    
    return data.articles
      .filter((article) => article.title && article.url) // 过滤掉无效数据
      .map((article) => ({
        title: article.title,
        description: article.description || '',
        url: article.url,
        urlToImage: article.urlToImage || null,
        publishedAt: article.publishedAt,
        source: article.source?.name || '未知来源',
        author: article.author || null,
      }));
  } catch (error) {
    logger.error('NewsAPI', '搜索新闻失败', error);
    throw error;
  }
}

/**
 * 获取头条新闻（自动切换API源）
 * @param {Object} options - 选项
 * @param {string} options.country - 国家代码（如：cn, us）
 * @param {string} options.category - 分类（business, entertainment, general, health, science, sports, technology）
 * @param {number} options.pageSize - 每页数量（默认20，最大100）
 * @returns {Promise<Array>} 新闻列表
 */
export async function getTopHeadlines(options = {}) {
  const { country = 'cn', category = 'general', pageSize = 20 } = options;

  const cnApiConfigured = cnNewsAPI.isCnApiKeyConfigured();
  const intlApiConfigured = !!(getNewsApiKey()?.length);

  newsDebugLog('getTopHeadlines 调用', { country, category, pageSize });
  newsDebugLog('API 配置', { country, cnApiConfigured, intlApiConfigured });

  // 优先使用国内API（仅当country为cn时）
  if (country === 'cn' && cnApiConfigured) {
    newsDebugLog('决定: 优先使用国内API（country=cn 且国内 Key 已配置）');
    try {
      newsDebugLog('正在请求国内API...', { category, pageSize });
      const result = await cnNewsAPI.getTopHeadlines({ category, pageSize });
      newsDebugLog('国内API 成功', { 条数: result?.length ?? 0 });
      return result;
    } catch (e) {
      newsDebugLog('国内API 失败，准备切换国际API', { error: e.message });
      logger.warn('NewsAPI', '国内API失败，切换到国际API', e);
      if (intlApiConfigured) {
        try {
          newsDebugLog('切换到国际API 请求中...', { country, category, pageSize });
          const res = await getTopHeadlinesInternational({ country, category, pageSize });
          newsDebugLog('国际API 成功（国内失败后的备用）', { 条数: res?.length ?? 0 });
          return res;
        } catch (e2) {
          newsDebugLog('国际API 也失败', { error: e2.message });
          logger.error('NewsAPI', '国际API也失败', e2);
          throw new Error(`所有新闻API均失败。国内: ${e.message}；国际: ${e2.message}`);
        }
      }
      throw e;
    }
  }

  if (country !== 'cn') {
    newsDebugLog('决定: 使用国际API（country≠cn）', { country });
  } else if (!cnApiConfigured) {
    newsDebugLog('决定: 使用国际API（国内 Key 未配置）');
  }

  if (!intlApiConfigured) {
    newsDebugLog('错误: 未配置任何可用 API Key');
    throw new Error('API Key 未配置。请在设置中配置国内或国际新闻 API');
  }

  newsDebugLog('正在请求国际API...', { country, category, pageSize });
  const res = await getTopHeadlinesInternational({ country, category, pageSize });
  newsDebugLog('国际API 成功', { 条数: res?.length ?? 0 });
  return res;
}

/**
 * 搜索新闻（自动切换API源）
 * @param {Object} options - 选项
 * @param {string} options.q - 搜索关键词
 * @param {string} options.language - 语言（zh, en等）
 * @param {string} options.sortBy - 排序方式（relevancy, popularity, publishedAt）
 * @param {number} options.pageSize - 每页数量（默认20，最大100）
 * @returns {Promise<Array>} 新闻列表
 */
export async function searchNews(options = {}) {
  const { q, language = 'zh', sortBy = 'publishedAt', pageSize = 20 } = options;

  if (!q || q.trim().length === 0) {
    return [];
  }

  // 优先使用国内API（如果配置了且语言为中文）
  if (language === 'zh' && cnNewsAPI.isCnApiKeyConfigured()) {
    try {
      logger.info('NewsAPI', '使用国内API搜索新闻', { q, language });
      const result = await cnNewsAPI.searchNews({ q, language, pageSize });
      // 如果国内API返回空数组（不支持搜索），切换到国际API
      if (result && result.length > 0) {
        return result;
      }
      logger.warn('NewsAPI', '国内API搜索返回空，切换到国际API');
    } catch (e) {
      logger.warn('NewsAPI', '国内API搜索失败，切换到国际API', e);
    }
  }

  if (!getNewsApiKey()) {
    throw new Error('搜索功能需要配置国际API Key，请在设置中配置');
  }
  return searchNewsInternational({ q, language, sortBy, pageSize });
}

/**
 * 获取分类新闻
 * @param {string} category - 分类（business, entertainment, general, health, science, sports, technology）
 * @param {string} country - 国家代码（默认：cn）
 * @param {number} pageSize - 每页数量（默认10）
 * @returns {Promise<Array>} 新闻列表
 */
export async function getNewsByCategory(category = 'general', country = 'cn', pageSize = 10) {
  return getTopHeadlines({ category, country, pageSize });
}

/** 国内新闻分类（天聚数行）：国内、科技、财经、娱乐、体育、健康 */
export const CN_CATEGORIES = [
  { value: 'general', label: '国内', icon: '📰' },
  { value: 'technology', label: '科技', icon: '💻' },
  { value: 'business', label: '财经', icon: '💼' },
  { value: 'entertainment', label: '娱乐', icon: '🎬' },
  { value: 'sports', label: '体育', icon: '⚽' },
  { value: 'health', label: '健康', icon: '🏥' },
];

/** 国外新闻分类（NewsAPI）：综合、科技、商业、娱乐、体育、科学、健康 */
export const INTL_CATEGORIES = [
  { value: 'general', label: '综合', icon: '📰' },
  { value: 'technology', label: '科技', icon: '💻' },
  { value: 'business', label: '商业', icon: '💼' },
  { value: 'entertainment', label: '娱乐', icon: '🎬' },
  { value: 'sports', label: '体育', icon: '⚽' },
  { value: 'science', label: '科学', icon: '🔬' },
  { value: 'health', label: '健康', icon: '🏥' },
];

/**
 * 仅国内 API 获取头条（无回退）
 */
export async function getTopHeadlinesCn(options = {}) {
  const { category = 'general', pageSize = 20 } = options;
  if (!cnNewsAPI.isCnApiKeyConfigured()) {
    throw new Error('国内 API 未配置，请在设置中配置天聚数行 Key');
  }
  return cnNewsAPI.getTopHeadlines({ category, pageSize });
}

/**
 * 仅国际 API 获取头条（无回退）
 */
export async function getTopHeadlinesIntl(options = {}) {
  const { category = 'general', pageSize = 20 } = options;
  return getTopHeadlinesInternational({ country: 'us', category, pageSize });
}

/**
 * 仅国内 API 获取分类新闻（无回退）
 * category 为天聚数行 nameid（如 guonei、keji），由 getCnCategories 动态列表提供
 */
export async function getNewsByCategoryCn(category = 'guonei', pageSize = 20) {
  if (!cnNewsAPI.isCnApiKeyConfigured()) {
    throw new Error('国内 API 未配置，请在设置中配置天聚数行 Key');
  }
  return cnNewsAPI.getNewsByCategoryCnByNameid(category, pageSize);
}

/**
 * 仅国际 API 获取分类新闻（无回退）
 */
export async function getNewsByCategoryIntl(category = 'general', pageSize = 20) {
  return getTopHeadlinesInternational({ country: 'us', category, pageSize });
}

/**
 * 获取多个分类的新闻（用于早报/晚报）
 * @param {Array<string>} categories - 分类数组
 * @param {string} country - 国家代码
 * @param {number} perCategory - 每个分类获取的数量
 * @returns {Promise<Object>} 按分类组织的新闻
 */
export async function getNewsByCategories(categories = ['general', 'technology', 'business'], country = 'cn', perCategory = 3) {
  newsDebugLog('getNewsByCategories 调用', { categories, country, perCategory });

  if (country === 'cn' && cnNewsAPI.isCnApiKeyConfigured()) {
    try {
      newsDebugLog('getNewsByCategories 使用国内API', { categories, perCategory });
      return await cnNewsAPI.getNewsByCategories(categories, country, perCategory);
    } catch (e) {
      newsDebugLog('getNewsByCategories 国内API失败，切换国际', { error: e.message });
      logger.warn('NewsAPI', '国内API获取多分类新闻失败，切换到国际API', e);
      if (!getNewsApiKey()) throw e;
    }
  }

  if (!getNewsApiKey()) {
    newsDebugLog('getNewsByCategories 未配置任何 API Key');
    throw new Error('API Key 未配置。请在设置中配置国内或国际新闻 API');
  }

  newsDebugLog('getNewsByCategories 使用国际API', { categories, country, perCategory });
  try {
    const results = {};
    
    // 并发获取多个分类的新闻
    const promises = categories.map(async (category) => {
      try {
        const news = await getTopHeadlines({ category, country, pageSize: perCategory });
        return { category, news: news || [] };
      } catch (e) {
        logger.warn('NewsAPI', `获取分类 ${category} 新闻失败`, e);
        return { category, news: [] };
      }
    });

    const categoryResults = await Promise.all(promises);
    categoryResults.forEach(({ category, news }) => {
      // 只添加有数据的分类
      if (news && Array.isArray(news) && news.length > 0) {
        results[category] = news;
      }
    });

    // 如果所有分类都失败，返回空对象而不是抛出错误
    return results;
  } catch (error) {
    logger.error('NewsAPI', '获取分类新闻失败', error);
    // 返回空对象而不是抛出错误，让调用者可以处理部分失败的情况
    return {};
  }
}
