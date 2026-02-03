// 日志服务 - 渲染进程版本（浏览器环境）
// 通过平台 API 将日志发送到主进程（Electron）或仅控制台（Web）
import { log as platformLog } from '../platform';

class BrowserLogger {
  constructor() {
    this.logs = [];
    this.maxLogs = 1000; // 最多缓存1000条日志
  }

  formatMessage(level, prefix, message, ...args) {
    const timestamp = new Date().toISOString();
    const argsStr = args.length > 0 ? ' ' + args.map(arg => {
      if (arg === null || arg === undefined) {
        return String(arg);
      }
      if (arg instanceof Error) {
        return JSON.stringify({
          message: arg.message,
          stack: arg.stack,
          name: arg.name
        }, null, 2);
      }
      if (typeof arg === 'object') {
        try {
          return JSON.stringify(arg, null, 2);
        } catch (e) {
          return String(arg);
        }
      }
      return String(arg);
    }).join(' ') : '';
    return `[${timestamp}] [${level}] ${prefix} ${message}${argsStr}`;
  }

  async sendToMain(level, prefix, message, ...args) {
    const logMessage = this.formatMessage(level, prefix, message, ...args);
    
    // 缓存日志
    this.logs.push(logMessage);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift(); // 移除最旧的日志
    }

    try {
      await platformLog(level, logMessage);
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('平台日志发送失败:', error);
      }
    }
  }

  log(prefix, message, ...args) {
    const formatted = this.formatMessage('INFO', prefix, message, ...args);
    console.log(`[${prefix}] ${message}`, ...args);
    this.sendToMain('INFO', prefix, message, ...args);
  }

  warn(prefix, message, ...args) {
    const formatted = this.formatMessage('WARN', prefix, message, ...args);
    console.warn(`[${prefix}] ⚠️ ${message}`, ...args);
    this.sendToMain('WARN', prefix, message, ...args);
  }

  error(prefix, message, ...args) {
    const formatted = this.formatMessage('ERROR', prefix, message, ...args);
    console.error(`[${prefix}] ❌ ${message}`, ...args);
    this.sendToMain('ERROR', prefix, message, ...args);
  }

  debug(prefix, message, ...args) {
    if (process.env.NODE_ENV === 'development') {
      const formatted = this.formatMessage('DEBUG', prefix, message, ...args);
      console.debug(`[${prefix}] 🔍 ${message}`, ...args);
      this.sendToMain('DEBUG', prefix, message, ...args);
    }
  }

  // 获取缓存的日志
  getLogs() {
    return this.logs;
  }

  // 清空日志缓存
  clearLogs() {
    this.logs = [];
  }
}

// 单例模式
let loggerInstance = null;

export function getLogger() {
  if (!loggerInstance) {
    loggerInstance = new BrowserLogger();
  }
  return loggerInstance;
}

export default BrowserLogger;
