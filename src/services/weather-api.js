/**
 * 天气 API 服务
 * 使用 OpenWeatherMap API（免费版）
 * 注意：需要配置 API_KEY，可以通过环境变量或配置文件设置
 * 城市搜索：保持实时调用，不缓存。天气/预报：同城同日缓存，见 weatherStore。
 */

const logger = console;

import { getConfigStr } from './config';

function getWeatherKey() {
  return getConfigStr('weather_api_key') || (import.meta.env.VITE_WEATHER_API_KEY ?? '');
}

const WEATHER_API_BASE = 'https://api.openweathermap.org/data/2.5';
const GEO_API_BASE = 'https://api.openweathermap.org/geo/1.0';

/**
 * 搜索城市
 * @param {string} query - 城市名称
 * @returns {Promise<Array>} 城市列表
 */
export async function searchCities(query) {
  if (!query || query.trim().length === 0) {
    return [];
  }

  const key = getWeatherKey();
  if (!key) {
    throw new Error('天气 API Key 未配置，请在设置中配置');
  }

  try {
    const url = `${GEO_API_BASE}/direct?q=${encodeURIComponent(query)}&limit=5&appid=${key}&lang=zh_cn`;
    const response = await fetch(url);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      if (response.status === 401) {
        throw new Error(`API Key 无效或未激活。请检查：1) API Key 是否正确 2) 是否已激活（新申请的 Key 可能需要等待几分钟到几小时）3) 是否超过了免费额度限制。错误详情: ${errorData.message || 'Unauthorized'}`);
      }
      throw new Error(`HTTP error! status: ${response.status}, message: ${errorData.message || 'Unknown error'}`);
    }

    const data = await response.json();
    return data.map((city) => ({
      name: city.name,
      country: city.country,
      state: city.state || '',
      lat: city.lat,
      lon: city.lon,
      displayName: `${city.name}${city.state ? `, ${city.state}` : ''}, ${city.country}`,
    }));
  } catch (error) {
    logger.error('WeatherAPI', '搜索城市失败', error);
    throw error;
  }
}

/**
 * 根据经纬度获取天气
 * @param {number} lat - 纬度
 * @param {number} lon - 经度
 * @returns {Promise<Object>} 天气数据
 */
export async function getWeatherByCoords(lat, lon) {
  const key = getWeatherKey();
  if (!key) {
    throw new Error('天气 API Key 未配置，请在设置中配置');
  }

  try {
    const url = `${WEATHER_API_BASE}/weather?lat=${lat}&lon=${lon}&appid=${key}&units=metric&lang=zh_cn`;
    const response = await fetch(url);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      if (response.status === 401) {
        throw new Error(`API Key 无效或未激活。请检查：1) API Key 是否正确 2) 是否已激活（新申请的 Key 可能需要等待几分钟到几小时）3) 是否超过了免费额度限制。错误详情: ${errorData.message || 'Unauthorized'}`);
      }
      throw new Error(`HTTP error! status: ${response.status}, message: ${errorData.message || 'Unknown error'}`);
    }

    const data = await response.json();
    return {
      city: data.name,
      country: data.sys.country,
      temp: Math.round(data.main.temp),
      feelsLike: Math.round(data.main.feels_like),
      humidity: data.main.humidity,
      pressure: data.main.pressure,
      description: data.weather[0].description,
      icon: data.weather[0].icon,
      windSpeed: data.wind?.speed || 0,
      windDeg: data.wind?.deg || 0,
      visibility: data.visibility ? (data.visibility / 1000).toFixed(1) : null,
      sunrise: data.sys.sunrise * 1000,
      sunset: data.sys.sunset * 1000,
      lat: data.coord.lat,
      lon: data.coord.lon,
    };
  } catch (error) {
    logger.error('WeatherAPI', '获取天气失败', error);
    throw error;
  }
}

/**
 * 根据城市名称获取天气
 * @param {string} cityName - 城市名称
 * @returns {Promise<Object>} 天气数据
 */
export async function getWeatherByCity(cityName) {
  const key = getWeatherKey();
  if (!key) {
    throw new Error('天气 API Key 未配置，请在设置中配置');
  }

  try {
    const url = `${WEATHER_API_BASE}/weather?q=${encodeURIComponent(cityName)}&appid=${key}&units=metric&lang=zh_cn`;
    const response = await fetch(url);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      if (response.status === 404) {
        throw new Error('城市未找到');
      }
      if (response.status === 401) {
        throw new Error(`API Key 无效或未激活。请检查：1) API Key 是否正确 2) 是否已激活（新申请的 Key 可能需要等待几分钟到几小时）3) 是否超过了免费额度限制。错误详情: ${errorData.message || 'Unauthorized'}`);
      }
      throw new Error(`HTTP error! status: ${response.status}, message: ${errorData.message || 'Unknown error'}`);
    }

    const data = await response.json();
    return {
      city: data.name,
      country: data.sys.country,
      temp: Math.round(data.main.temp),
      feelsLike: Math.round(data.main.feels_like),
      humidity: data.main.humidity,
      pressure: data.main.pressure,
      description: data.weather[0].description,
      icon: data.weather[0].icon,
      windSpeed: data.wind?.speed || 0,
      windDeg: data.wind?.deg || 0,
      visibility: data.visibility ? (data.visibility / 1000).toFixed(1) : null,
      sunrise: data.sys.sunrise * 1000,
      sunset: data.sys.sunset * 1000,
      lat: data.coord.lat,
      lon: data.coord.lon,
    };
  } catch (error) {
    logger.error('WeatherAPI', '获取天气失败', error);
    throw error;
  }
}

/**
 * 获取天气预报（5天）
 * @param {number} lat - 纬度
 * @param {number} lon - 经度
 * @returns {Promise<Array>} 天气预报列表
 */
export async function getForecast(lat, lon) {
  const key = getWeatherKey();
  if (!key) {
    throw new Error('天气 API Key 未配置，请在设置中配置');
  }

  try {
    const url = `${WEATHER_API_BASE}/forecast?lat=${lat}&lon=${lon}&appid=${key}&units=metric&lang=zh_cn`;
    const response = await fetch(url);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      if (response.status === 401) {
        throw new Error(`API Key 无效或未激活。请检查：1) API Key 是否正确 2) 是否已激活（新申请的 Key 可能需要等待几分钟到几小时）3) 是否超过了免费额度限制。错误详情: ${errorData.message || 'Unauthorized'}`);
      }
      throw new Error(`HTTP error! status: ${response.status}, message: ${errorData.message || 'Unknown error'}`);
    }

    const data = await response.json();
    return data.list.map((item) => ({
      date: item.dt * 1000,
      temp: Math.round(item.main.temp),
      feelsLike: Math.round(item.main.feels_like),
      description: item.weather[0].description,
      icon: item.weather[0].icon,
      humidity: item.main.humidity,
      windSpeed: item.wind?.speed || 0,
    }));
  } catch (error) {
    logger.error('WeatherAPI', '获取天气预报失败', error);
    throw error;
  }
}

/**
 * 检查 API Key 是否配置
 */
export function isApiKeyConfigured() {
  return !!(getWeatherKey()?.length);
}
