/**
 * OneDrive 适配器：Microsoft Graph API，OAuth2 PKCE
 * 配置：client_id（Azure 应用注册，重定向 URI http://localhost:3848/callback，权限 Files.ReadWrite、offline_access）
 */
import { syncOpenOAuthLogin } from '../../../platform';
import { generatePkce } from '../pkce';

const REDIRECT_PORT = 3848;
const REDIRECT_URI = `http://localhost:${REDIRECT_PORT}/callback`;
const AUTH_BASE = 'https://login.microsoftonline.com/common/oauth2/v2.0';
const TOKEN_URL = `${AUTH_BASE}/token`;
const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';
const SCOPES = 'Files.ReadWrite offline_access';
const FILE_PATH = 'Personal Butler/sync.enc';

export const id = 'onedrive';
export const name = 'OneDrive';
export const needsOAuth = true;

export async function openLogin(config) {
  const clientId = (config?.client_id || '').trim();
  if (!clientId) return { success: false, error: '请先填写 OneDrive 客户端 ID' };
  const { codeVerifier, codeChallenge } = await generatePkce();
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    response_mode: 'query',
    scope: SCOPES,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });
  const authUrl = `${AUTH_BASE}/authorize?${params.toString()}`;
  const result = await syncOpenOAuthLogin({ authUrl, redirectPort: REDIRECT_PORT });
  if (!result.success || !result.code) return { success: false, error: result.error || '未获取到授权码' };
  return { success: true, code: result.code, codeVerifier };
}

export async function exchangeCode(config, code, codeVerifier) {
  const clientId = (config?.client_id || '').trim();
  const body = new URLSearchParams({
    client_id: clientId,
    code,
    redirect_uri: REDIRECT_URI,
    grant_type: 'authorization_code',
    code_verifier: codeVerifier,
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
    client_id: clientId,
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
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
  const url = `${GRAPH_BASE}/me/drive/root:/${encodeURIComponent(FILE_PATH)}:/content`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${credentials.accessToken}`,
      'Content-Type': 'application/octet-stream',
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
  const url = `${GRAPH_BASE}/me/drive/root:/${encodeURIComponent(FILE_PATH)}:/content`;
  const res = await fetch(url, {
    method: 'GET',
    headers: { Authorization: `Bearer ${credentials.accessToken}` },
  });
  if (!res.ok) {
    if (res.status === 404) return { success: false, error: '云端尚无同步文件', notFound: true };
    const err = await res.text();
    return { success: false, error: err.slice(0, 300) || `HTTP ${res.status}` };
  }
  const content = await res.text();
  return { success: true, content };
}
