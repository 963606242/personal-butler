// 加密服务 - 使用Web Crypto API (浏览器) 或 Node.js crypto (Electron主进程)

class CryptoService {
  constructor() {
    this.algorithm = 'AES-GCM';
    this.keyLength = 256;
    this.ivLength = 12; // 96 bits for GCM
  }

  // 生成加密密钥（从密码派生）
  async deriveKey(password, salt) {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      'PBKDF2',
      false,
      ['deriveBits', 'deriveKey']
    );

    const key = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 100000,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: this.algorithm, length: this.keyLength },
      false,
      ['encrypt', 'decrypt']
    );

    return key;
  }

  // 生成随机盐
  generateSalt() {
    return crypto.getRandomValues(new Uint8Array(16));
  }

  // 生成随机IV
  generateIV() {
    return crypto.getRandomValues(new Uint8Array(this.ivLength));
  }

  // 加密数据
  async encrypt(data, key) {
    try {
      const encoder = new TextEncoder();
      const iv = this.generateIV();
      const dataBuffer = encoder.encode(JSON.stringify(data));

      const encrypted = await crypto.subtle.encrypt(
        {
          name: this.algorithm,
          iv: iv,
        },
        key,
        dataBuffer
      );

      // 返回加密数据和IV（需要一起存储）
      return {
        encrypted: Array.from(new Uint8Array(encrypted)),
        iv: Array.from(iv),
      };
    } catch (error) {
      console.error('加密错误:', error);
      throw error;
    }
  }

  // 解密数据
  async decrypt(encryptedData, iv, key) {
    try {
      const decrypted = await crypto.subtle.decrypt(
        {
          name: this.algorithm,
          iv: new Uint8Array(iv),
        },
        key,
        new Uint8Array(encryptedData)
      );

      const decoder = new TextDecoder();
      const decryptedText = decoder.decode(decrypted);
      return JSON.parse(decryptedText);
    } catch (error) {
      console.error('解密错误:', error);
      throw error;
    }
  }

  // 加密字符串（简化版，用于简单字段）
  async encryptString(text, key) {
    const data = { text };
    const encrypted = await this.encrypt(data, key);
    return {
      encrypted: encrypted.encrypted,
      iv: encrypted.iv,
    };
  }

  // 解密字符串
  async decryptString(encryptedData, iv, key) {
    const decrypted = await this.decrypt(encryptedData, iv, key);
    return decrypted.text;
  }

  // 生成UUID
  generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
}

// 单例模式
let cryptoInstance = null;

export function getCryptoService() {
  if (!cryptoInstance) {
    cryptoInstance = new CryptoService();
  }
  return cryptoInstance;
}

export default CryptoService;
