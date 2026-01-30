/**
 * 统一 GET JSON 请求
 * - Electron：走主进程 fetch-url（Node https），绕过系统/代理，避免 ERR_PROXY_CONNECTION_FAILED
 * - 其他环境：使用 fetch
 */

/**
 * @param {string} url
 * @returns {Promise<any>} 解析后的 JSON
 * @throws {Error}
 */
export async function fetchJson(url) {
  const isElectron = typeof window !== 'undefined' && window.electronAPI?.fetchUrl;

  if (isElectron) {
    const res = await window.electronAPI.fetchUrl(url);
    if (res.success) return res.data;
    const err = new Error(`HTTP ${res.status}: ${res.errorBody || ''}`);
    err.status = res.status;
    throw err;
  }

  // 非 Electron（如纯 Web）使用 fetch

  const response = await fetch(url);
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    const err = new Error(`HTTP ${response.status}: ${body.slice(0, 300)}`);
    err.status = response.status;
    throw err;
  }
  return response.json();
}
