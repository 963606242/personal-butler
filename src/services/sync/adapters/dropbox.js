/**
 * Dropbox 适配器：OAuth2 PKCE，文件存于 /Personal Butler/sync.enc
 * 配置：client_id（Dropbox 应用 App key，重定向 URI http://localhost:3848/callback，权限 files.metadata.write files.content.write files.content.read）
 */
import { syncOpenOAuthLogin } from '../../../platform';
import { generatePkce } from '../pkce';

const REDIRECT_PORT = 3848;
const REDIRECT_URI = `http://localhost:${REDIRECT_PORT}/callback`;
const AUTH_BASE = 'https://www.dropbox.com/oauth2/authorize';
const TOKEN_URL = 'https://api.dropboxapi.com/oauth2/token';
const UPLOAD_URL = 'https://content.dropboxapi.com/2/files/upload';
const DOWNLOAD_URL = 'https://content.dropboxapi.com/2/files/download';
const FILE_PATH = '/Personal Butler/sync.enc';

export const id = 'dropbox';
export const name = 'Dropbox';
export const needsOAuth = true;

export async function openLogin(config) {
  const clientId = (config?.client_id || '').trim();
  if (!clientId) return { success: false, error: '请先填写 Dropbox App key' };
  const { codeVerifier, codeChallenge } = await generatePkce();
  const params = new URLSearchParams({
    client_id: clientId,
    token_access_type: 'offline',
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });
  const authUrl = `${AUTH_BASE}?${params.toString()}`;
  const result = await syncOpenOAuthLogin({ authUrl, redirectPort: REDIRECT_PORT });
  if (!result.success || !result.code) return { success: false, error: result.error || '未获取到授权码' };
  return { success: true, code: result.code, codeVerifier };
}

export async function exchangeCode(config, code, codeVerifier) {
  const clientId = (config?.client_id || '').trim();
  const body = new URLSearchParams({
    code,
    grant_type: 'authorization_code',
    code_verifier: codeVerifier,
    client_id: clientId,
    redirect_uri: REDIRECT_URI,
  });
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { success: false, error: data.error_description || data.error || `HTTP ${res.status}` };
  return {
    success: true,
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: data.expires_in ? Date.now() + data.expires_in * 1000 : null,
  };
}

export async function refreshToken(config, refreshToken) {
  const clientId = (config?.client_id || '').trim();
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: clientId,
  });
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { success: false, error: data.error_description || data.error || `HTTP ${res.status}` };
  return {
    success: true,
    accessToken: data.access_token,
    refreshToken: data.refresh_token || refreshToken,
    expiresAt: data.expires_in ? Date.now() + data.expires_in * 1000 : null,
  };
}

export async function upload(credentials, content) {
  const res = await fetch(UPLOAD_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${credentials.accessToken}`,
      'Content-Type': 'application/octet-stream',
      'Dropbox-API-Arg': JSON.stringify({ path: FILE_PATH, mode: 'overwrite' }),
    },
    body: new TextEncoder().encode(content),
  });
  if (!res.ok) {
    const err = await res.text();
    return { success: false, error: err.slice(0, 300) || `HTTP ${res.status}` };
  }
  return { success: true };
}

export async function download(credentials) {
  const res = await fetch(DOWNLOAD_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${credentials.accessToken}`,
      'Dropbox-API-Arg': JSON.stringify({ path: FILE_PATH }),
    },
  });
  if (!res.ok) {
    if (res.status === 409) {
      const err = await res.json().catch(() => ({}));
      if (err?.error?.path?.['.tag'] === 'not_found') return { success: false, error: '云端尚无同步文件', notFound: true };
    }
    const err = await res.text();
    return { success: false, error: err.slice(0, 300) || `HTTP ${res.status}` };
  }
  const content = await res.text();
  return { success: true, content };
}
