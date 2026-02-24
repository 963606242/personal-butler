/**
 * WebDAV 适配器：通用协议，无需 OAuth，适合 Nextcloud、坚果云、iCloud 等
 * 配置：url（WebDAV 根地址，如 https://nextcloud.example.com/remote.php/dav/files/用户名/）、user、password；或 url + token（Bearer）
 */
import { SYNC_FILE_NAME } from './types';

const FILE_PATH = `Personal Butler/${SYNC_FILE_NAME}`;

export const id = 'webdav';
export const name = 'WebDAV（Nextcloud / 坚果云 / iCloud 等）';
export const needsOAuth = false;

function base64Utf8(s) {
  const bytes = new TextEncoder().encode(s);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function getAuthHeader(credentials) {
  if (credentials.token) return `Bearer ${credentials.token}`;
  if (credentials.user != null && credentials.password != null)
    return `Basic ${base64Utf8(`${credentials.user}:${credentials.password}`)}`;
  return null;
}

function resolveUrl(credentials) {
  const base = (credentials.url || '').replace(/\/$/, '');
  const path = FILE_PATH.replace(/^\/+/, '');
  return `${base}/${path}`;
}

export async function upload(credentials, content) {
  const url = resolveUrl(credentials);
  const auth = getAuthHeader(credentials);
  const headers = { 'Content-Type': 'application/octet-stream' };
  if (auth) headers.Authorization = auth;
  const res = await fetch(url, {
    method: 'PUT',
    headers,
    body: new TextEncoder().encode(content),
  });
  if (!res.ok) {
    const err = await res.text();
    return { success: false, error: err.slice(0, 300) || `HTTP ${res.status}` };
  }
  return { success: true };
}

export async function download(credentials) {
  const url = resolveUrl(credentials);
  const auth = getAuthHeader(credentials);
  const headers = {};
  if (auth) headers.Authorization = auth;
  const res = await fetch(url, { method: 'GET', headers });
  if (!res.ok) {
    if (res.status === 404) return { success: false, error: '云端尚无同步文件', notFound: true };
    const err = await res.text();
    return { success: false, error: err.slice(0, 300) || `HTTP ${res.status}` };
  }
  const content = await res.text();
  return { success: true, content };
}
