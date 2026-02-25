/**
 * 同步服务：导出 → 加密 → 上传 / 下载 → 解密 → 导入
 * 存储目标由 sync_provider 决定（onedrive / googledrive / dropbox / webdav），通过适配器统一接口
 * 本地优先：Windows 用 Electron+SQLite，iOS/Web 用 sql.js+IndexedDB；均支持同一套网盘同步，无需自建服务器
 */
import { getLogger } from '../logger-client';
import { getConfigStr } from '../config';
import useSettingsStore from '../../stores/settingsStore';
import { syncExportData, syncImportData, syncGetEncryptionPassword, isElectron } from '../../platform';
import { encryptPayloadWithPassword, decryptPayloadWithPassword } from './sync-crypto';
import { getAdapter } from './adapters';
import { BUILTIN_ONEDRIVE_CLIENT_ID } from '../../constants/sync';
import { getDatabase } from '../database';
import * as webDb from '../database-web-sqlite';

const logger = getLogger();
const SYNC_INTERVAL_MS = 15 * 60 * 1000; // 15 分钟
let syncIntervalId = null;

function getProvider() {
  return getConfigStr('sync_provider') || 'onedrive';
}

function getAdapterConfig() {
  const get = useSettingsStore.getState().get;
  const provider = getProvider();
  const config = {};
  if (provider === 'onedrive') config.client_id = get('sync_onedrive_client_id') || BUILTIN_ONEDRIVE_CLIENT_ID || '';
  if (provider === 'googledrive') config.client_id = get('sync_googledrive_client_id') || '';
  if (provider === 'dropbox') config.client_id = get('sync_dropbox_client_id') || '';
  if (provider === 'webdav') {
    config.url = (get('sync_webdav_url') || '').trim();
    config.user = get('sync_webdav_user') || '';
    config.password = get('sync_webdav_password') || '';
    config.token = get('sync_webdav_token') || '';
  }
  return config;
}

function getStoredTokens() {
  const get = useSettingsStore.getState().get;
  return {
    refreshToken: get('sync_refresh_token') || '',
    accessToken: get('sync_access_token') || '',
    expiresAt: parseInt(get('sync_expires_at') || '0', 10),
  };
}

function setStoredTokens({ accessToken, refreshToken, expiresAt }) {
  const set = useSettingsStore.getState().set;
  if (accessToken != null) set('sync_access_token', accessToken);
  if (refreshToken != null) set('sync_refresh_token', refreshToken);
  if (expiresAt != null) set('sync_expires_at', String(expiresAt));
}

/** 获取当前可用的上传/下载凭证（OAuth 则刷新 token 后返回 accessToken，WebDAV 则返回 url/user/password） */
async function ensureCredentials() {
  const provider = getProvider();
  const adapter = getAdapter(provider);
  if (!adapter) return { success: false, error: `不支持的同步目标: ${provider}` };

  if (!adapter.needsOAuth) {
    const config = getAdapterConfig();
    return { success: true, credentials: { url: config.url, user: config.user, password: config.password, token: config.token } };
  }

  const config = getAdapterConfig();
  let { accessToken, refreshToken, expiresAt } = getStoredTokens();
  const now = Date.now();
  if (accessToken && expiresAt > now + 60 * 1000) return { success: true, credentials: { accessToken } };
  if (!refreshToken) return { success: false, error: `请先登录${adapter.name}` };
  const res = await adapter.refreshToken(config, refreshToken);
  if (!res.success) return res;
  setStoredTokens({
    accessToken: res.accessToken,
    refreshToken: res.refreshToken,
    expiresAt: res.expiresAt,
  });
  return { success: true, credentials: { accessToken: res.accessToken } };
}

/** 导出本地数据（Electron 走 IPC，Web/iOS 走 sql.js+IndexedDB） */
export async function exportData() {
  if (isElectron()) return syncExportData();
  await getDatabase();
  const payload = webDb.exportForSync();
  return { success: true, payload };
}

/** 导入到本地（Electron 走 IPC，Web/iOS 走 sql.js+IndexedDB） */
export async function importData(payload) {
  if (isElectron()) return syncImportData(payload);
  await getDatabase();
  await webDb.importFromSync(payload);
  return { success: true };
}

/**
 * 上传同步：导出 → 加密 → 上传
 */
export async function pushSync(password) {
  if (!password) return { success: false, error: '请输入同步加密密码' };
  try {
    const exportRes = await exportData();
    if (!exportRes.success) return { success: false, error: exportRes.error || '导出失败' };
    const encrypted = await encryptPayloadWithPassword(exportRes.payload, password);
    const credRes = await ensureCredentials();
    if (!credRes.success) return credRes;
    const adapter = getAdapter(getProvider());
    const uploadRes = await adapter.upload(credRes.credentials, encrypted);
    if (!uploadRes.success) return uploadRes;
    useSettingsStore.getState().set('sync_last_sync_at', String(Date.now()));
    logger.log('Sync', '上传同步成功');
    return { success: true };
  } catch (e) {
    logger.error('Sync', '上传同步失败', e);
    return { success: false, error: e?.message || '上传同步失败' };
  }
}

/**
 * 拉取同步：下载 → 解密 → 导入
 */
export async function pullSync(password) {
  let pwd = password;
  if (!pwd) {
    const stored = await syncGetEncryptionPassword();
    pwd = stored.success ? stored.password : null;
  }
  if (!pwd) return { success: false, error: '请输入同步加密密码，或在此设备上勾选「记住密码」后重试' };
  try {
    const credRes = await ensureCredentials();
    if (!credRes.success) return credRes;
    const adapter = getAdapter(getProvider());
    const downRes = await adapter.download(credRes.credentials);
    if (!downRes.success) return { success: false, error: downRes.error, notFound: downRes.notFound };
    const payload = await decryptPayloadWithPassword(downRes.content, pwd);
    const importRes = await importData(payload);
    if (!importRes.success) return importRes;
    useSettingsStore.getState().set('sync_last_sync_at', String(Date.now()));
    logger.log('Sync', '拉取同步成功');
    return { success: true };
  } catch (e) {
    logger.error('Sync', '拉取同步失败', e);
    return { success: false, error: e?.message || '拉取同步失败' };
  }
}

/**
 * 执行一次「先拉取再上传」
 */
export async function runSyncOnce(password) {
  const pull = await pullSync(password);
  if (!pull.success && !pull.notFound) return pull;
  return pushSync(password);
}

export async function runSyncOnStartup() {
  const enabled = getConfigStr('sync_enabled') === '1';
  if (!enabled) return;
  const pull = await pullSync('');
  if (pull.success) logger.log('Sync', '启动时拉取同步成功');
  else if (!pull.notFound) logger.warn('Sync', '启动时拉取同步跳过或失败', pull.error);
}

export function startSyncInterval() {
  if (syncIntervalId) return;
  const enabled = getConfigStr('sync_enabled') === '1';
  if (!enabled) return;
  syncIntervalId = setInterval(async () => {
    const pull = await pullSync('');
    if (!pull.success && !pull.notFound) return;
    const r = await syncGetEncryptionPassword();
    await pushSync(r.password || '');
  }, SYNC_INTERVAL_MS);
  logger.log('Sync', '定时同步已启动，间隔', SYNC_INTERVAL_MS / 60000, '分钟');
}

export function stopSyncInterval() {
  if (syncIntervalId) {
    clearInterval(syncIntervalId);
    syncIntervalId = null;
    logger.log('Sync', '定时同步已停止');
  }
}

/** 当前 provider 的适配器：用于设置页登录/上传下载 */
export function getCurrentAdapter() {
  return getAdapter(getProvider());
}

/** 所有适配器列表（设置页下拉用） */
export { getAllAdapters } from './adapters';

/** 兼容旧调用：openLogin / exchangeCode 委托给当前 OAuth 适配器 */
export async function openLoginWindow(clientId) {
  const provider = getProvider();
  const adapter = getAdapter(provider);
  if (!adapter?.needsOAuth) return { success: false, error: '当前同步目标无需浏览器登录' };
  const config = provider === 'onedrive' ? { client_id: clientId || getConfigStr('sync_onedrive_client_id') || BUILTIN_ONEDRIVE_CLIENT_ID }
    : provider === 'googledrive' ? { client_id: clientId || getConfigStr('sync_googledrive_client_id') }
    : provider === 'dropbox' ? { client_id: clientId || getConfigStr('sync_dropbox_client_id') }
    : {};
  return adapter.openLogin(config);
}

export async function exchangeCodeForTokens(clientId, code, codeVerifier) {
  const provider = getProvider();
  const adapter = getAdapter(provider);
  if (!adapter?.exchangeCode) return { success: false, error: '当前适配器不支持' };
  const config = provider === 'onedrive' ? { client_id: clientId } : provider === 'googledrive' ? { client_id: clientId } : provider === 'dropbox' ? { client_id: clientId } : {};
  const res = await adapter.exchangeCode(config, code, codeVerifier);
  if (!res.success) return res;
  setStoredTokens({
    accessToken: res.accessToken,
    refreshToken: res.refreshToken,
    expiresAt: res.expiresAt,
  });
  return res;
}
