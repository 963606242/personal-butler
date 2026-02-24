/**
 * 同步存储适配器统一接口
 *
 * 配置与凭证由 sync-service 从 settings 读取后传入，各适配器用自己需要的 key（如 client_id、url 等）。
 *
 * OAuth 类：openLogin(config) -> code + codeVerifier；exchangeCode(config, code, codeVerifier) -> tokens；refreshToken(config, refreshToken) -> tokens；upload(credentials, content)；download(credentials)。
 * WebDAV 类：无需 openLogin/exchangeCode/refreshToken；credentials 为 { url, user, password } 或 { url, token }；upload(credentials, content)；download(credentials)。
 */

/** @typedef {'onedrive'|'googledrive'|'dropbox'|'webdav'} SyncProviderId */

/**
 * @typedef {Object} SyncAdapter
 * @property {SyncProviderId} id
 * @property {string} name
 * @property {boolean} needsOAuth - true 需浏览器登录拿 code，false 为 WebDAV 等直接填地址和密码
 */

/**
 * OAuth 登录结果
 * @typedef {{ success: true, code: string, codeVerifier: string } | { success: false, error: string }} OpenLoginResult
 */

/**
 * Token 交换/刷新结果
 * @typedef {{ success: true, accessToken: string, refreshToken?: string, expiresAt?: number } | { success: false, error: string }} TokenResult
 */

/**
 * 上传/下载用凭证（OAuth 为 { accessToken }，WebDAV 为 { url, user, password } 等）
 * @typedef {Object} SyncCredentials
 */

export const SYNC_FILE_NAME = 'sync.enc';
