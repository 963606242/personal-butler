/**
 * 同步存储适配器注册表：按 provider id 获取适配器，统一接口
 */
import * as onedrive from './onedrive';
import * as googledrive from './googledrive';
import * as dropbox from './dropbox';
import * as webdav from './webdav';

const adapters = [onedrive, googledrive, dropbox, webdav];

const byId = Object.fromEntries(adapters.map((a) => [a.id, a]));

export function getAdapter(providerId) {
  return byId[providerId] || null;
}

export function getAllAdapters() {
  return adapters;
}

export { onedrive, googledrive, dropbox, webdav };
