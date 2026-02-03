/**
 * 统一 GET JSON 请求
 * - Electron：走平台 API（主进程 fetch-url），绕过系统/代理
 * - 其他环境：使用 fetch
 */
import { isElectron, fetchUrl as platformFetchUrl } from '../platform';

/**
 * @param {string} url
 * @returns {Promise<any>} 解析后的 JSON
 * @throws {Error}
 */
export async function fetchJson(url) {
  if (isElectron()) {
    const res = await platformFetchUrl(url);
    if (res.success) return res.data;
    const err = new Error(`HTTP ${res.status}: ${res.errorBody || ''}`);
    err.status = res.status;
    throw err;
  }

  const response = await fetch(url);
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    const err = new Error(`HTTP ${response.status}: ${body.slice(0, 300)}`);
    err.status = response.status;
    throw err;
  }
  return response.json();
}
