/**
 * Google Drive 适配器：应用数据文件夹（appDataFolder），用户不可见，OAuth2 PKCE
 * 配置：client_id（Google Cloud 应用，重定向 URI http://localhost:3848/callback，范围 https://www.googleapis.com/auth/drive.appdata）
 */
import { syncOpenOAuthLogin } from '../../../platform';
import { generatePkce } from '../pkce';
import { SYNC_FILE_NAME } from './types';

const REDIRECT_PORT = 3848;
const REDIRECT_URI = `http://localhost:${REDIRECT_PORT}/callback`;
const AUTH_BASE = 'https://accounts.google.com/o/oauth2/v2';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
const SCOPE = 'https://www.googleapis.com/auth/drive.appdata';

export const id = 'googledrive';
export const name = 'Google Drive';
export const needsOAuth = true;

export async function openLogin(config) {
  const clientId = (config?.client_id || '').trim();
  if (!clientId) return { success: false, error: '请先填写 Google 客户端 ID' };
  const { codeVerifier, codeChallenge } = await generatePkce();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: SCOPE,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    access_type: 'offline',
    prompt: 'consent',
  });
  const authUrl = `${AUTH_BASE}/auth?${params.toString()}`;
  const result = await syncOpenOAuthLogin({ authUrl, redirectPort: REDIRECT_PORT });
  if (!result.success || !result.code) return { success: false, error: result.error || '未获取到授权码' };
  return { success: true, code: result.code, codeVerifier };
}

export async function exchangeCode(config, code, codeVerifier) {
  const clientId = (config?.client_id || '').trim();
  const body = new URLSearchParams({
    client_id: clientId,
    code,
    code_verifier: codeVerifier,
    grant_type: 'authorization_code',
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
    refreshToken: refreshToken,
    expiresAt: data.expires_in ? Date.now() + data.expires_in * 1000 : null,
  };
}

async function getFileId(accessToken) {
  const q = encodeURIComponent(`name='${SYNC_FILE_NAME}' and 'appDataFolder' in parents`);
  const res = await fetch(`${DRIVE_API}/files?spaces=appDataFolder&q=${q}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  const data = await res.json();
  const file = data.files?.[0];
  return file?.id || null;
}

export async function upload(credentials, content) {
  const token = credentials.accessToken;
  const fileId = await getFileId(token);
  const body = new TextEncoder().encode(content);
  if (fileId) {
    const res = await fetch(`${DRIVE_UPLOAD}/files/${fileId}?uploadType=media`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/octet-stream',
        'Content-Length': String(body.length),
      },
      body,
    });
    if (!res.ok) {
      const err = await res.text();
      return { success: false, error: err.slice(0, 300) || `HTTP ${res.status}` };
    }
    return { success: true };
  }
  const boundary = '-------pb_' + Math.random().toString(36).slice(2);
  const meta = JSON.stringify({ name: SYNC_FILE_NAME, parents: ['appDataFolder'] });
  const multipart = [
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n`,
    `--${boundary}\r\nContent-Type: application/octet-stream\r\n\r\n`,
    body,
    `\r\n--${boundary}--\r\n`,
  ];
  const blob = new Blob(multipart, { type: `multipart/related; boundary=${boundary}` });
  const res = await fetch(`${DRIVE_UPLOAD}/files?uploadType=multipart`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: blob,
  });
  if (!res.ok) {
    const err = await res.text();
    return { success: false, error: err.slice(0, 300) || `HTTP ${res.status}` };
  }
  return { success: true };
}

export async function download(credentials) {
  const fileId = await getFileId(credentials.accessToken);
  if (!fileId) return { success: false, error: '云端尚无同步文件', notFound: true };
  const res = await fetch(`${DRIVE_API}/files/${fileId}?alt=media`, {
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
