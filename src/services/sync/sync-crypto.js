/**
 * 同步用加密：用用户密码加密/解密整包数据（PBKDF2 + AES-GCM）
 * 输出格式：JSON 字符串，包含 salt、iv、ct 的 base64，便于存储为单文件上传云盘
 */
import { getCryptoService } from '../crypto';

const PBKDF2_ITERATIONS = 100000;

function base64ToBytes(b64) {
  let s = b64.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const bin = atob(s);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}

function bytesToBase64(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * 用密码加密同步包，返回可上传的字符串（JSON，含 salt/iv/ct base64）
 * @param {object} payload - 同步数据对象（如 exportForSync 的返回值）
 * @param {string} password
 * @returns {Promise<string>}
 */
export async function encryptPayloadWithPassword(payload, password) {
  if (!password || typeof password !== 'string') throw new Error('请设置同步加密密码');
  const crypto = getCryptoService();
  const salt = crypto.generateSalt();
  const key = await crypto.deriveKey(password, salt);
  const { encrypted, iv } = await crypto.encrypt(payload, key);
  const blob = {
    v: 1,
    salt: bytesToBase64(salt),
    iv: bytesToBase64(new Uint8Array(iv)),
    ct: bytesToBase64(new Uint8Array(encrypted)),
  };
  return JSON.stringify(blob);
}

/**
 * 用密码解密同步包
 * @param {string} encryptedBlob - encryptPayloadWithPassword 返回的字符串
 * @param {string} password
 * @returns {Promise<object>} 解密后的 payload
 */
export async function decryptPayloadWithPassword(encryptedBlob, password) {
  if (!password || typeof password !== 'string') throw new Error('请输入同步加密密码');
  const blob = typeof encryptedBlob === 'string' ? JSON.parse(encryptedBlob) : encryptedBlob;
  if (!blob.salt || !blob.iv || !blob.ct) throw new Error('无效的同步数据格式');
  const crypto = getCryptoService();
  const salt = base64ToBytes(blob.salt);
  const key = await crypto.deriveKey(password, salt);
  const decrypted = await crypto.decrypt(
    Array.from(base64ToBytes(blob.ct)),
    Array.from(base64ToBytes(blob.iv)),
    key
  );
  return decrypted;
}
