// 日志服务 - 主进程版本（同时输出到控制台和文件）
const fs = require('fs');
const path = require('path');
const { app } = require('electron');

class Logger {
  constructor() {
    this.logDir = null;
    this.logFile = null;
    this.init();
  }

  init() {
    try {
      if (typeof app !== 'undefined' && app && app.getPath) {
        const userDataPath = app.getPath('userData');
        this.logDir = path.join(userDataPath, 'personal-butler', 'logs');
        
        // 确保日志目录存在
        if (!fs.existsSync(this.logDir)) {
          fs.mkdirSync(this.logDir, { recursive: true });
        }

        // 创建日志文件（按日期命名）
        const today = new Date().toISOString().split('T')[0];
        this.logFile = path.join(this.logDir, `app-${today}.log`);
      }
    } catch (error) {
      console.error('日志服务初始化失败:', error);
    }
  }

  formatMessage(level, prefix, message, ...args) {
    const timestamp = new Date().toISOString();
    const argsStr = args.length > 0 ? ' ' + args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ') : '';
    return `[${timestamp}] [${level}] ${prefix} ${message}${argsStr}\n`;
  }

  writeToFile(message) {
    if (this.logFile) {
      try {
        fs.appendFileSync(this.logFile, message, 'utf8');
      } catch (error) {
        console.error('写入日志文件失败:', error);
      }
    }
  }

  log(prefix, message, ...args) {
    const formatted = this.formatMessage('INFO', prefix, message, ...args);
    console.log(`[${prefix}] ${message}`, ...args);
    this.writeToFile(formatted);
  }

  warn(prefix, message, ...args) {
    const formatted = this.formatMessage('WARN', prefix, message, ...args);
    console.warn(`[${prefix}] ⚠️ ${message}`, ...args);
    this.writeToFile(formatted);
  }

  error(prefix, message, ...args) {
    const formatted = this.formatMessage('ERROR', prefix, message, ...args);
    console.error(`[${prefix}] ❌ ${message}`, ...args);
    this.writeToFile(formatted);
  }

  debug(prefix, message, ...args) {
    if (process.env.NODE_ENV === 'development') {
      const formatted = this.formatMessage('DEBUG', prefix, message, ...args);
      console.debug(`[${prefix}] 🔍 ${message}`, ...args);
      this.writeToFile(formatted);
    }
  }
}

// 浏览器环境的简化日志服务
class BrowserLogger {
  log(prefix, message, ...args) {
    console.log(`[${prefix}] ${message}`, ...args);
  }

  warn(prefix, message, ...args) {
    console.warn(`[${prefix}] ⚠️ ${message}`, ...args);
  }

  error(prefix, message, ...args) {
    console.error(`[${prefix}] ❌ ${message}`, ...args);
  }

  debug(prefix, message, ...args) {
    if (process.env.NODE_ENV === 'development') {
      console.debug(`[${prefix}] 🔍 ${message}`, ...args);
    }
  }
}

// CommonJS 导出（主进程使用）
module.exports = Logger;
