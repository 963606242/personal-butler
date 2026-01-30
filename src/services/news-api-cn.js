/**
 * 国内新闻 API 服务
 * 支持多个国内新闻API源，自动切换
 * 1. 天聚数行API（主要）
 * 2. 极速数据API（备选）
 * Electron 下使用主进程 fetchUrl，绕过代理，避免 ERR_PROXY_CONNECTION_FAILED
 *
 * 提醒：天聚数行免费 QPS 为 3，请勿频繁请求。头条/分类已做时间段缓存（早/午/晚）。
 */

import { fetchJson } from './fetch-json';
import { getConfigStr } from './config';

const logger = console;

function getTianKey() {
  return getConfigStr('tianapi_key') || (import.meta.env.VITE_TIANAPI_KEY ?? '');
}
function getJisuKey() {
  return getConfigStr('jisuapi_key') || (import.meta.env.VITE_JISUAPI_KEY ?? '');
}

const TIANAPI_BASE = 'https://apis.tianapi.com';
const JISUAPI_BASE = 'https://api.jisuapi.com';

// 天聚数行频道ID映射（NewsAPI分类 -> 天聚数行频道ID）
// 常见频道ID：科技=5, 财经=6, 体育=8, 娱乐=9, 健康=10, 国内=7, 国际=2
// 如果频道列表接口可用，会动态更新此映射
let TIANAPI_CHANNEL_MAP = {
  general: 7,    // 国内新闻
  technology: 5, // 科技
  business: 6,   // 财经
  entertainment: 9, // 娱乐
  sports: 8,     // 体育
  science: 5,    // 科学 -> 科技
  health: 10,    // 健康
};

// 频道列表缓存（避免频繁查询）
let channelListCache = null;
let channelListCacheTime = 0;
const CHANNEL_LIST_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24小时
/** 正在请求频道列表的 Promise，避免并发重复请求 */
let channelListFetching = null;

/** nameid -> colid，从 catelist 填充，用于按 nameid 拉分类新闻 */
const NAMEID_COLID_MAP = {};

/** 天聚数行 QPS≈3 限流：上次请求完成时间，最小间隔毫秒数 */
let _tianApiNextAllowed = 0;
const TIANAPI_MIN_GAP_MS = 380;

function _sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * 限流后的天聚数行请求，避免「API调用频率超限」
 */
async function tianApiFetch(url) {
  const now = Date.now();
  if (now < _tianApiNextAllowed) {
    await _sleep(_tianApiNextAllowed - now);
  }
  const out = await fetchJson(url);
  _tianApiNextAllowed = Date.now() + TIANAPI_MIN_GAP_MS;
  return out;
}

/** 调试日志：输出到控制台，便于排查。无需在 Console 粘贴代码。 */
function newsDebugLog(msg, detail) {
  let s = '';
  if (detail != null) {
    try {
      s = typeof detail === 'object' ? ' ' + JSON.stringify(detail) : ' ' + String(detail);
    } catch {
      s = ' [无法序列化]';
    }
  }
  console.log(`[NewsAPI 调试] ${msg}${s}`);
}

/**
 * 检查国内API Key是否配置
 */
export function isCnApiKeyConfigured() {
  const tian = getTianKey();
  const jisu = getJisuKey();
  return !!(tian?.length || jisu?.length);
}

/**
 * 获取天聚数行频道列表（带缓存，且并发请求复用同一 Promise）
 */
async function getTianApiChannelList() {
  if (!getTianKey()) return null;

  if (channelListCache && Date.now() - channelListCacheTime < CHANNEL_LIST_CACHE_DURATION) {
    return channelListCache;
  }

  if (channelListFetching) {
    await channelListFetching;
    return channelListCache;
  }

  channelListFetching = (async () => {
    try {
      const url = `${TIANAPI_BASE}/allnews/catelist?key=${getTianKey()}`;
      newsDebugLog('天聚数行 获取频道列表', { urlHint: `${TIANAPI_BASE}/allnews/catelist?key=***` });
      const data = await tianApiFetch(url);

      if (data.code !== 200 || !data.result) return;

      const raw = data.result.list;
      let channels = [];
      if (Array.isArray(raw)) {
        channels = Array.isArray(raw[0]) ? raw[0] : raw;
      }

      if (!Array.isArray(channels) || channels.length === 0) {
        newsDebugLog('天聚数行 频道列表 格式异常', { hasList: !!raw, isArr: Array.isArray(raw) });
        return;
      }

      channelListCache = channels;
      channelListCacheTime = Date.now();
      channels.forEach((item) => {
        const nameid = item.nameid;
        const colid = item.colid;
        if (nameid != null && colid != null) NAMEID_COLID_MAP[nameid] = colid;
        if (nameid === 'guonei') TIANAPI_CHANNEL_MAP.general = colid;
        else if (nameid === 'keji') TIANAPI_CHANNEL_MAP.technology = colid;
        else if (nameid === 'caijing') TIANAPI_CHANNEL_MAP.business = colid;
        else if (nameid === 'huabian' || nameid === 'yule') TIANAPI_CHANNEL_MAP.entertainment = colid;
        else if (nameid === 'tiyu') TIANAPI_CHANNEL_MAP.sports = colid;
        else if (nameid === 'health') TIANAPI_CHANNEL_MAP.health = colid;
      });
      newsDebugLog('天聚数行 频道列表已更新', { 频道数: channels.length });
    } catch (e) {
      newsDebugLog('天聚数行 获取频道列表失败', { error: e.message });
    } finally {
      channelListFetching = null;
    }
  })();

  await channelListFetching;
  return channelListCache;
}

/** nameid -> 中文标签（catelist 无 name 时兜底） */
const NAMEID_LABEL_FALLBACK = {
  guonei: '国内',
  keji: '科技',
  caijing: '财经',
  yule: '娱乐',
  tiyu: '体育',
  jiankang: '健康',
  world: '国际',
  dongman: '动漫',
  junshi: '军事',
  other: '其他',
};

/**
 * 获取国内新闻分类列表（来自天聚数行 catelist，动态展示）
 * @returns {Promise<Array<{ value: string, label: string, colid: number }>>}
 */
export async function getCnCategories() {
  const raw = await getTianApiChannelList();
  if (raw && Array.isArray(raw) && raw.length > 0) {
    const list = raw
      .filter((item) => item.nameid && item.colid != null)
      .map((item) => ({
        value: item.nameid,
        label: item.name || NAMEID_LABEL_FALLBACK[item.nameid] || item.nameid,
        colid: item.colid,
      }));
    const guonei = list.find((c) => c.value === 'guonei');
    const rest = list.filter((c) => c.value !== 'guonei');
    const ordered = guonei ? [guonei, ...rest] : list;
    newsDebugLog('国内分类 动态列表', { 数量: ordered.length, 列表: ordered.map((c) => c.value) });
    return ordered;
  }
  const fallback = [
    { value: 'guonei', label: '国内新闻', colid: null },
    { value: 'social', label: '社会新闻', colid: 5 },
    { value: 'world', label: '国际新闻', colid: 8 },
    { value: 'huabian', label: '娱乐新闻', colid: 10 },
    { value: 'tiyu', label: '体育新闻', colid: 12 },
    { value: 'keji', label: '科技新闻', colid: 13 },
    { value: 'caijing', label: '财经新闻', colid: 32 },
    { value: 'health', label: '健康知识', colid: 17 },
  ];
  fallback.forEach((c) => {
    if (c.colid != null) NAMEID_COLID_MAP[c.value] = c.colid;
  });
  newsDebugLog('国内分类 使用兜底列表（catelist 未返回时）', { 数量: fallback.length });
  return fallback;
}

/**
 * 按 nameid 拉取天聚数行分类新闻（guonei 走 /guonei/index，其余 /allnews/index?col=colid）
 */
async function getTianApiNewsByNameid(nameid, num = 20) {
  if (!getTianKey()) throw new Error('天聚数行API Key未配置');

  await getTianApiChannelList();

  if (nameid === 'guonei') {
    const url = `${TIANAPI_BASE}/guonei/index?key=${getTianKey()}&num=${Math.min(num, 50)}`;
    newsDebugLog('天聚数行 国内新闻', { nameid, num });
    const data = await tianApiFetch(url);
    if (data.code !== 200) throw new Error(data.msg || `code ${data.code}`);
    const raw = data.newslist || data.result || [];
    const list = (Array.isArray(raw) ? raw : [])
      .filter((a) => a.title && a.url)
      .map((a) => ({
        title: a.title,
        description: a.description || '',
        url: a.url,
        urlToImage: a.picUrl || null,
        publishedAt: a.ctime || new Date().toISOString(),
        source: a.source || '未知来源',
        author: null,
        category: nameid,
      }));
    return list;
  }

  const colid = NAMEID_COLID_MAP[nameid];
  if (colid == null) throw new Error(`未知国内分类: ${nameid}`);

  const url = `${TIANAPI_BASE}/allnews/index?key=${getTianKey()}&col=${colid}&num=${Math.min(num, 50)}&form=1`;
  newsDebugLog('天聚数行 分类新闻', { nameid, colid, num });
  const data = await tianApiFetch(url);
  if (data.code !== 200) throw new Error(data.msg || `code ${data.code}`);

  let raw = data.newslist || data.result;
  if (raw && !Array.isArray(raw)) raw = raw.list || raw.newslist || [];
  const list = (Array.isArray(raw) ? raw : [])
    .filter((a) => a.title && a.url)
    .map((a) => ({
      title: a.title,
      description: a.description || '',
      url: a.url,
      urlToImage: a.picUrl || null,
      publishedAt: a.ctime || new Date().toISOString(),
      source: a.source || '未知来源',
      author: null,
      category: nameid,
    }));
  return list;
}

/**
 * 按 nameid 获取国内分类新闻（供新闻页动态分类使用）
 */
export async function getNewsByCategoryCnByNameid(nameid, pageSize = 20) {
  if (!getTianKey()) throw new Error('国内 API 未配置，请在设置中配置天聚数行 Key');
  return getTianApiNewsByNameid(nameid, pageSize);
}

/**
 * 天聚数行API - 获取国内新闻（支持分类新闻接口）
 * @param {Object} options - 选项
 * @param {string} options.type - 新闻类型（guonei: 国内, world: 国际, tech: 科技, finance: 财经, etc.）
 * @param {string} options.category - NewsAPI分类（general, technology, business, etc.）
 * @param {number} options.num - 数量（默认10，最大50）
 * @returns {Promise<Array>} 新闻列表
 */
async function getTianApiNews(options = {}) {
  if (!getTianKey()) {
    throw new Error('天聚数行API Key未配置');
  }

  const { type = 'guonei', category, num = 20 } = options;
  const useCategoryApi = category && category !== 'general';
  
  let url;
  if (useCategoryApi && TIANAPI_CHANNEL_MAP[category]) {
    // 使用分类新闻接口 /allnews/index?col={频道ID}
    const colId = TIANAPI_CHANNEL_MAP[category];
    url = `${TIANAPI_BASE}/allnews/index?key=${getTianKey()}&col=${colId}&num=${Math.min(num, 50)}&form=1`;
    newsDebugLog('天聚数行 分类新闻请求', { category, colId, num, urlHint: `${TIANAPI_BASE}/allnews/index?key=***&col=${colId}` });
  } else {
    // 使用国内新闻接口 /guonei/index
    url = `${TIANAPI_BASE}/guonei/index?key=${getTianKey()}&num=${Math.min(num, 50)}`;
    newsDebugLog('天聚数行 国内新闻请求', { type, num, urlHint: `${TIANAPI_BASE}/guonei/index?key=***` });
  }

  try {
    let data;
    try {
      data = await tianApiFetch(url);
    } catch (e) {
      newsDebugLog('天聚数行 HTTP 失败', { status: e.status, error: e.message });
      throw new Error(`天聚数行API错误: ${e.message}`);
    }

    if (!data || typeof data !== 'object') {
      newsDebugLog('天聚数行 返回格式异常', { hasData: !!data });
      throw new Error('天聚数行API返回数据格式异常');
    }

    if (data.code !== 200) {
      newsDebugLog('天聚数行 API 错误码', { code: data.code, msg: data.msg });
      throw new Error(data.msg || `天聚数行API错误: code ${data.code}`);
    }

    // 天聚数行返回数据：分类新闻接口返回 result（数组），国内新闻接口返回 newslist（数组）
    let newsList = null;
    if (data.newslist && Array.isArray(data.newslist)) {
      newsList = data.newslist; // 国内新闻接口
    } else if (data.result) {
      if (Array.isArray(data.result)) {
        newsList = data.result; // 分类新闻接口直接返回数组
      } else if (data.result.list && Array.isArray(data.result.list)) {
        newsList = data.result.list;
      } else if (data.result.newslist && Array.isArray(data.result.newslist)) {
        newsList = data.result.newslist;
      }
    }

    if (!newsList || newsList.length === 0) {
      newsDebugLog('天聚数行 列表为空或格式异常', { 
        type, 
        num,
        hasNewslist: !!data.newslist,
        hasResult: !!data.result,
        resultType: data.result ? typeof data.result : 'none',
      });
      return [];
    }

    const list = newsList
      .filter((article) => article.title && article.url)
      .map((article) => ({
        title: article.title || '',
        description: article.description || '',
        url: article.url || '',
        urlToImage: article.picUrl || null,
        publishedAt: article.ctime || new Date().toISOString(),
        source: article.source || '未知来源',
        author: null,
        category: category || type, // 使用传入的 category，如果没有则使用 type
      }));

    newsDebugLog('天聚数行 成功', { 条数: list.length, type });
    return list;
  } catch (error) {
    newsDebugLog('天聚数行 异常', { error: error.message });
    logger.error('TianAPI', '获取新闻失败', error);
    throw error;
  }
}

/**
 * 极速数据API - 获取新闻
 * @param {Object} options - 选项
 * @param {string} options.channel - 频道（headline: 头条, finance: 财经, sports: 体育, entertainment: 娱乐, tech: 科技, etc.）
 * @param {number} options.num - 数量（默认10，最大50）
 * @returns {Promise<Array>} 新闻列表
 */
async function getJisuApiNews(options = {}) {
  if (!getJisuKey()) {
    throw new Error('极速数据API Key未配置');
  }

  const { channel = 'headline', num = 20 } = options;
  const url = `${JISUAPI_BASE}/news/get?channel=${channel}&num=${Math.min(num, 50)}&appkey=${getJisuKey()}`;
  newsDebugLog('极速数据 请求', { channel, num });

  try {
    let data;
    try {
      data = await fetchJson(url);
    } catch (e) {
      newsDebugLog('极速数据 HTTP 失败', { status: e.status, error: e.message });
      throw new Error(`极速数据API错误: ${e.message}`);
    }

    if (!data || typeof data !== 'object') {
      newsDebugLog('极速数据 返回格式异常', { hasData: !!data });
      throw new Error('极速数据API返回数据格式异常');
    }

    if (data.status !== '0') {
      newsDebugLog('极速数据 API 错误', { status: data.status, msg: data.msg });
      throw new Error(`极速数据API错误: ${data.msg || data.status}`);
    }

    if (!data.result || !data.result.list || !Array.isArray(data.result.list)) {
      newsDebugLog('极速数据 result.list 异常', {});
      return [];
    }

    if (data.result.list.length === 0) {
      newsDebugLog('极速数据 列表为空', { channel, num });
      return [];
    }

    const list = data.result.list
      .filter((article) => article.title && article.url)
      .map((article) => ({
        title: article.title || '',
        description: article.content || '',
        url: article.url || '',
        urlToImage: article.pic || null,
        publishedAt: article.time || new Date().toISOString(),
        source: article.src || '未知来源',
        author: null,
        category: channel,
      }));

    newsDebugLog('极速数据 成功', { 条数: list.length, channel });
    return list;
  } catch (error) {
    newsDebugLog('极速数据 异常', { error: error.message });
    logger.error('JisuAPI', '获取新闻失败', error);
    throw error;
  }
}

/**
 * 分类映射：NewsAPI分类 -> 国内API分类
 * 天聚数行现在支持分类新闻接口（/allnews/index），使用频道ID（col参数）
 */
const CATEGORY_MAP = {
  general: { tianapi: 'guonei', jisuapi: 'headline', useCategoryApi: false },
  technology: { tianapi: 'guonei', jisuapi: 'tech', useCategoryApi: true },
  business: { tianapi: 'guonei', jisuapi: 'finance', useCategoryApi: true },
  entertainment: { tianapi: 'guonei', jisuapi: 'entertainment', useCategoryApi: true },
  sports: { tianapi: 'guonei', jisuapi: 'sports', useCategoryApi: true },
  science: { tianapi: 'guonei', jisuapi: 'tech', useCategoryApi: true }, // 科学归入科技
  health: { tianapi: 'guonei', jisuapi: 'health', useCategoryApi: true },
};

/**
 * 获取头条新闻（国内API）
 * @param {Object} options - 选项
 * @param {string} options.category - 分类（general, technology, business, etc.）
 * @param {number} options.pageSize - 每页数量（默认20）
 * @returns {Promise<Array>} 新闻列表
 */
export async function getTopHeadlines(options = {}) {
  const { category = 'general', pageSize = 20 } = options;
  const categoryMap = CATEGORY_MAP[category] || CATEGORY_MAP.general;

  newsDebugLog('国内 getTopHeadlines', { category, pageSize, 映射: categoryMap });

  // 首次使用时尝试获取频道列表（如果使用分类接口）
  if (getTianKey() && categoryMap.useCategoryApi && !channelListCache) {
    await getTianApiChannelList();
  }

  if (getTianKey()) {
    try {
      newsDebugLog('国内 选用天聚数行', { 
        type: categoryMap.tianapi, 
        category,
        useCategoryApi: categoryMap.useCategoryApi,
        num: pageSize 
      });
      const result = await getTianApiNews({ 
        type: categoryMap.tianapi, 
        category: categoryMap.useCategoryApi ? category : undefined,
        num: pageSize 
      });
      return result;
    } catch (e) {
      newsDebugLog('国内 天聚数行失败，尝试极速数据', { error: e.message });
      if (getJisuKey()) {
        try {
          newsDebugLog('国内 选用极速数据', { channel: categoryMap.jisuapi, num: pageSize });
          const result = await getJisuApiNews({ channel: categoryMap.jisuapi, num: pageSize });
          return result;
        } catch (e2) {
          newsDebugLog('国内 极速数据也失败', { error: e2.message });
          throw new Error(`国内新闻API均失败。天聚数行: ${e.message}；极速数据: ${e2.message}`);
        }
      }
      throw e;
    }
  }

  if (getJisuKey()) {
    newsDebugLog('国内 仅极速数据可用', { channel: categoryMap.jisuapi, num: pageSize });
    return await getJisuApiNews({ channel: categoryMap.jisuapi, num: pageSize });
  }

  newsDebugLog('国内 无可用 Key');
  throw new Error('国内新闻API Key未配置');
}

/**
 * 搜索新闻（国内API）
 * @param {Object} options - 选项
 * @param {string} options.q - 搜索关键词
 * @param {string} options.language - 语言（zh, en等）
 * @param {number} options.pageSize - 每页数量（默认20）
 * @returns {Promise<Array>} 新闻列表
 */
export async function searchNews(options = {}) {
  const { q, language = 'zh', pageSize = 20 } = options;

  if (!q || q.trim().length === 0) {
    return [];
  }

  // 国内API的搜索功能有限，这里使用天聚数行的通用接口
  // 或者返回空数组，让调用者知道需要切换到国际API
  logger.warn('CN NewsAPI', '搜索功能暂不支持，建议使用国际API');
  
  // 如果配置了天聚数行，可以尝试使用其搜索接口（如果有）
  // 这里暂时返回空数组，提示使用国际API
  return [];
}

/**
 * 获取分类新闻（国内API）
 * @param {string} category - 分类
 * @param {string} country - 国家代码（国内API忽略此参数）
 * @param {number} pageSize - 每页数量
 * @returns {Promise<Array>} 新闻列表
 */
export async function getNewsByCategory(category = 'general', country = 'cn', pageSize = 10) {
  return getTopHeadlines({ category, pageSize });
}

/**
 * 获取多个分类的新闻（国内API）
 * @param {Array<string>} categories - 分类数组
 * @param {string} country - 国家代码（国内API忽略此参数）
 * @param {number} perCategory - 每个分类获取的数量
 * @returns {Promise<Object>} 按分类组织的新闻
 */
export async function getNewsByCategories(categories = ['general', 'technology', 'business'], country = 'cn', perCategory = 3) {
  try {
    const results = {};

    // 并发获取多个分类的新闻
    const promises = categories.map(async (category) => {
      try {
        const news = await getTopHeadlines({ category, pageSize: perCategory });
        return { category, news: news || [] };
      } catch (e) {
        logger.warn('CN NewsAPI', `获取分类 ${category} 新闻失败`, e);
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
    logger.error('CN NewsAPI', '获取分类新闻失败', error);
    // 返回空对象而不是抛出错误，让调用者可以处理部分失败的情况
    return {};
  }
}
