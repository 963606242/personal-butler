const { app, BrowserWindow, Menu, ipcMain, Notification, dialog, protocol, safeStorage, session } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');
const url = require('url');

// 检测开发模式：检查环境变量或 dist 目录是否存在
const isDev = process.env.NODE_ENV === 'development' || 
              !fs.existsSync(path.join(__dirname, 'dist', 'index.html'));

let mainWindow;

function createWindow() {
  // 开发模式加载 localhost 时有正常 origin，可启用 webSecurity；生产模式 loadFile 时需关闭以支持跨域请求（如 RSS）
  const needsWebSecurityOff = !isDev;

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: !needsWebSecurityOff,
      allowRunningInsecureContent: false,
    },
    icon: path.join(__dirname, 'build/icon.png'),
  });

  if (isDev) {
    // 开发模式：加载 Vite 开发服务器
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
    
    // 如果开发服务器还没启动，监听加载失败并重试
    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
      if (errorCode === -106) { // ERR_INTERNET_DISCONNECTED 或连接失败
        setTimeout(() => {
          mainWindow.loadURL('http://localhost:3000');
        }, 1000);
      }
    });
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// 数据库服务（主进程）
const DatabaseService = require('./src/services/database-main');
const { createServer: createApiBridgeServer } = require('./src/services/ai-bridge-server');
let dbService = null;
let apiBridge = null;

// 初始化数据库服务（在 app ready 之后）
async function initDatabase() {
  try {
    console.log('[Main] 初始化数据库服务...');
    if (!dbService) {
      dbService = new DatabaseService();
    }
    // 等待数据库初始化完成
    await dbService.init();
    console.log('[Main] ✅ 数据库服务初始化完成');
  } catch (error) {
    console.error('[Main] ❌ 数据库服务初始化失败:', error);
    console.error('[Main] 错误堆栈:', error.stack);
  }
}

// 在 app ready 之前注册协议
app.whenReady().then(async () => {
  console.log('[Main] App ready，开始初始化...');

  if (process.platform === 'win32') {
    app.setAppUserModelId('com.personalbutler.app');
  }

  // 先初始化数据库（等待完成）
  await initDatabase();

  // 启动「可被 AI 调用」本地 API（若在设置中已开启）
  try {
    apiBridge = createApiBridgeServer(dbService);
    apiBridge.start();
  } catch (e) {
    console.error('[Main] AI-Bridge 启动失败:', e);
  }

  // 隐藏顶部默认菜单栏（File / Edit / View / Window 等）
  Menu.setApplicationMenu(null);

  // 生产环境：设置 Content-Security-Policy 降低安全风险（开发模式 Vite 需 unsafe-eval，不设置）
  if (!isDev) {
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [
            "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https: http:; connect-src 'self' https: http:; font-src 'self' data:",
          ],
        },
      });
    });
  }

  // 然后创建窗口
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (apiBridge) {
    apiBridge.stop();
    apiBridge = null;
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// 「可被 AI 调用」API 服务：保存设置后由渲染进程触发重启
ipcMain.handle('api-bridge-restart', async () => {
  try {
    if (apiBridge) {
      apiBridge.stop();
      apiBridge = null;
    }
    if (dbService && dbService.initialized) {
      apiBridge = createApiBridgeServer(dbService);
      apiBridge.start();
    }
    return { success: true };
  } catch (e) {
    console.error('[Main] api-bridge-restart 失败:', e);
    return { success: false, error: e.message };
  }
});

ipcMain.handle('read-api-bridge-doc', async () => {
  try {
    const docPath = path.join(__dirname, 'docs', 'api-bridge.md');
    const content = await fs.promises.readFile(docPath, 'utf-8');
    return { success: true, content };
  } catch (e) {
    return { success: false, content: '' };
  }
});

// IPC handlers
ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

ipcMain.handle('get-user-data-path', () => {
  return app.getPath('userData');
});

// 数据库文件路径（供设置页展示与备份说明）
ipcMain.handle('get-database-path', () => {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'personal-butler', 'personal-butler.db');
});

// 日志处理（接收渲染进程的日志并写入文件）
// 注意：logger.js 使用 CommonJS，需要 require
const Logger = require('./src/services/logger');
let logger = null;

// 初始化主进程日志服务
function initLogger() {
  if (!logger) {
    logger = new Logger();
  }
  return logger;
}

ipcMain.handle('log', (event, level, message) => {
  try {
    const log = initLogger();
    
    // 根据日志级别调用相应方法
    const prefix = 'Renderer';
    switch (level) {
      case 'INFO':
        log.log(prefix, message);
        break;
      case 'WARN':
        log.warn(prefix, message);
        break;
      case 'ERROR':
        log.error(prefix, message);
        break;
      case 'DEBUG':
        log.debug(prefix, message);
        break;
      default:
        log.log(prefix, message);
    }
    
    return { success: true };
  } catch (error) {
    console.error('写入日志失败:', error);
    return { success: false, error: error.message };
  }
});

// 数据库操作
ipcMain.handle('db-init', async () => {
  try {
    console.log('[IPC] db-init 调用');
    if (!dbService) {
      console.log('[IPC] 数据库服务不存在，初始化...');
      await initDatabase();
    } else if (!dbService.initialized) {
      console.log('[IPC] 数据库服务存在但未初始化，等待初始化...');
      await dbService.init();
    }
    
    if (!dbService || !dbService.db || !dbService.initialized) {
      console.error('[IPC] ❌ 数据库服务初始化失败');
      return { success: false, error: '数据库服务未初始化' };
    }
    
    console.log('[IPC] ✅ db-init 成功');
    return { success: true };
  } catch (error) {
    console.error('[IPC] ❌ db-init 失败:', error);
    console.error('[IPC] 错误堆栈:', error.stack);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('db-query', async (event, sql, params = []) => {
  try {
    console.log('[IPC] db-query 调用:', sql);
    
    // 确保数据库服务已初始化
    if (!dbService) {
      console.log('[IPC] 数据库服务不存在，初始化...');
      await initDatabase();
    } else if (!dbService.initialized) {
      console.log('[IPC] 数据库服务未初始化，等待初始化...');
      await dbService.init();
    }
    
    if (!dbService || !dbService.db || !dbService.initialized) {
      console.error('[IPC] ❌ 数据库对象不存在或未初始化');
      return { success: false, error: '数据库未初始化' };
    }
    
    const result = dbService.query(sql, params);
    console.log('[IPC] db-query 成功，返回', result.length, '条记录');
    return { success: true, data: result };
  } catch (error) {
    console.error('[IPC] ❌ db-query 失败:', error);
    console.error('[IPC] SQL:', sql);
    console.error('[IPC] 参数:', params);
    console.error('[IPC] 错误堆栈:', error.stack);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('db-execute', async (event, sql, params = []) => {
  try {
    console.log('[IPC] db-execute 调用:', sql);
    
    // 确保数据库服务已初始化
    if (!dbService) {
      console.log('[IPC] 数据库服务不存在，初始化...');
      await initDatabase();
    } else if (!dbService.initialized) {
      console.log('[IPC] 数据库服务未初始化，等待初始化...');
      await dbService.init();
    }
    
    if (!dbService || !dbService.db || !dbService.initialized) {
      console.error('[IPC] ❌ 数据库对象不存在或未初始化');
      return { success: false, error: '数据库未初始化' };
    }
    
    const result = dbService.execute(sql, params);
    console.log('[IPC] db-execute 成功');
    return { success: true, data: result };
  } catch (error) {
    console.error('[IPC] ❌ db-execute 失败:', error);
    console.error('[IPC] SQL:', sql);
    console.error('[IPC] 参数:', params);
    console.error('[IPC] 错误堆栈:', error.stack);
    return { success: false, error: error.message };
  }
});

// 日程提醒 - Windows 10/11 原生系统通知（Toast）
ipcMain.handle('show-reminder-notification', async (event, { title, body = '' }) => {
  try {
    if (!Notification.isSupported()) {
      console.warn('[Main] 系统通知不可用');
      return { success: false, error: 'Notification not supported' };
    }
    const n = new Notification({
      title: title || '日程提醒',
      body,
      silent: false,
    });
    n.on('click', () => {
      n.close();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.focus();
        mainWindow.show();
      }
    });
    n.show();
    return { success: true };
  } catch (e) {
    console.error('[Main] 系统通知失败:', e);
    return { success: false, error: e.message };
  }
});

// 日历数据 API 请求（在主进程中请求，避免 CORS 问题）
ipcMain.handle('fetch-calendar-data', async (event, url) => {
  return new Promise((resolve, reject) => {
    try {
      const urlObj = new URL(url);
      const client = urlObj.protocol === 'https:' ? https : http;
      
      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
        path: urlObj.pathname + urlObj.search,
        method: 'GET',
        headers: {
          'User-Agent': 'Personal-Butler/1.0.0',
          'Accept': 'application/json',
        },
      };

      console.log('[IPC] fetch-calendar-data 请求:', url);

      const req = client.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            if (res.statusCode >= 200 && res.statusCode < 300) {
              const jsonData = JSON.parse(data);
              console.log('[IPC] fetch-calendar-data 成功');
              resolve({ success: true, data: jsonData });
            } else {
              console.error('[IPC] fetch-calendar-data 失败:', res.statusCode, res.statusMessage);
              reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
            }
          } catch (parseError) {
            console.error('[IPC] fetch-calendar-data 解析失败:', parseError);
            reject(new Error(`解析响应失败: ${parseError.message}`));
          }
        });
      });

      req.on('error', (error) => {
        console.error('[IPC] fetch-calendar-data 请求错误:', error);
        reject(error);
      });

      req.setTimeout(10000, () => {
        req.destroy();
        console.error('[IPC] fetch-calendar-data 请求超时');
        reject(new Error('请求超时'));
      });

      req.end();
    } catch (error) {
      console.error('[IPC] fetch-calendar-data 异常:', error);
      reject(error);
    }
  });
});

// 通用 GET 请求（主进程 Node https，绕过系统/代理，用于新闻等 API，返回 JSON）
ipcMain.handle('fetch-url', async (event, url) => {
  return new Promise((resolve, reject) => {
    try {
      const urlObj = new URL(url);
      const client = urlObj.protocol === 'https:' ? https : http;
      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
        path: urlObj.pathname + urlObj.search,
        method: 'GET',
        headers: {
          'User-Agent': 'Personal-Butler/1.0 (Electron)',
          'Accept': 'application/json',
        },
        timeout: 20000, // 连接超时 20 秒
      };

      const req = client.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve({ success: true, data: JSON.parse(data) });
            } else {
              resolve({
                success: false,
                status: res.statusCode,
                errorBody: data.slice(0, 500),
              });
            }
          } catch (e) {
            reject(new Error(`解析响应失败: ${e.message}`));
          }
        });
      });

      req.on('error', (err) => {
        const errMsg = err.code === 'ETIMEDOUT' || err.code === 'ECONNRESET'
          ? `网络连接失败 (${err.code}): ${err.message}。请检查网络连接或稍后重试。`
          : `请求错误: ${err.message}`;
        console.error('[IPC] fetch-url 请求错误:', urlObj.hostname, errMsg);
        reject(new Error(errMsg));
      });

      req.setTimeout(20000, () => {
        req.destroy();
        reject(new Error('请求超时（20秒）'));
      });

      req.end();
    } catch (err) {
      reject(err);
    }
  });
});

// GET 请求返回原始文本（用于 RSS/XML 等非 JSON 内容）
ipcMain.handle('fetch-url-text', async (event, url) => {
  return new Promise((resolve, reject) => {
    try {
      const urlObj = new URL(url);
      const client = urlObj.protocol === 'https:' ? https : http;
      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
        path: urlObj.pathname + urlObj.search,
        method: 'GET',
        headers: {
          'User-Agent': 'Personal-Butler/1.0 (Electron)',
          'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
        },
        timeout: 20000,
      };

      const req = client.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ success: true, data });
          } else {
            resolve({
              success: false,
              status: res.statusCode,
              errorBody: data.slice(0, 500),
            });
          }
        });
      });

      req.on('error', (err) => {
        const errMsg = err.code === 'ETIMEDOUT' || err.code === 'ECONNRESET'
          ? `网络连接失败 (${err.code}): ${err.message}`
          : `请求错误: ${err.message}`;
        console.error('[IPC] fetch-url-text 请求错误:', urlObj.hostname, errMsg);
        reject(new Error(errMsg));
      });

      req.setTimeout(20000, () => {
        req.destroy();
        reject(new Error('请求超时（20秒）'));
      });

      req.end();
    } catch (err) {
      reject(err);
    }
  });
});

// POST JSON（供 AI 请求等使用，绕过代理）
ipcMain.handle('fetch-json-post', async (event, { url, body, headers = {} }) => {
  return new Promise((resolve, reject) => {
    try {
      const urlObj = new URL(url);
      const client = urlObj.protocol === 'https:' ? https : http;
      const bodyStr = typeof body === 'string' ? body : JSON.stringify(body || {});
      const opts = {
        hostname: urlObj.hostname,
        port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
        path: urlObj.pathname + urlObj.search,
        method: 'POST',
        headers: {
          'User-Agent': 'Personal-Butler/1.0 (Electron)',
          'Content-Type': 'application/json',
          ...headers,
          'Content-Length': Buffer.byteLength(bodyStr, 'utf8'),
        },
        timeout: 60000,
      };
      const req = client.request(opts, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve({ success: true, data: JSON.parse(data) });
            } else {
              resolve({ success: false, status: res.statusCode, errorBody: data.slice(0, 500) });
            }
          } catch (e) {
            reject(new Error(`解析响应失败: ${e.message}`));
          }
        });
      });
      req.on('error', (err) => {
        const msg = err.code === 'ETIMEDOUT' || err.code === 'ECONNRESET'
          ? `网络连接失败 (${err.code}): ${err.message}`
          : err.message;
        reject(new Error(msg));
      });
      req.setTimeout(60000, () => { req.destroy(); reject(new Error('请求超时（60秒）')); });
      req.write(bodyStr);
      req.end();
    } catch (err) {
      reject(err);
    }
  });
});

// 读取本地图片为 base64 data URL（用于 webSecurity 开启时无法直接加载 file://）
ipcMain.handle('read-image-file', async (event, filePath) => {
  try {
    if (!filePath || typeof filePath !== 'string') return null;
    const p = filePath.replace(/^file:\/\//, '').replace(/^\/([A-Za-z]:)/, '$1');
    const normalized = path.resolve(p);
    if (!fs.existsSync(normalized)) return null;
    const ext = path.extname(normalized).toLowerCase();
    const mime = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp', '.bmp': 'image/bmp' }[ext] || 'image/jpeg';
    const buf = fs.readFileSync(normalized);
    return `data:${mime};base64,${buf.toString('base64')}`;
  } catch (e) {
    console.error('[IPC] read-image-file 失败:', e?.message);
    return null;
  }
});

// 图片文件选择
ipcMain.handle('select-image-file', async () => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: '选择图片',
      filters: [
        { name: '图片文件', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'] },
        { name: '所有文件', extensions: ['*'] },
      ],
      properties: ['openFile'],
    });

    if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
      return { success: false, canceled: true };
    }

    const filePath = result.filePaths[0];
    // 返回文件路径（Electron环境下可以直接使用本地路径）
    return { success: true, filePath };
  } catch (error) {
    console.error('[IPC] select-image-file 失败:', error);
    return { success: false, error: error.message };
  }
});

// 媒体文件选择（图片/视频）
ipcMain.handle('select-media-file', async (event, opts = {}) => {
  try {
    const accept = opts.accept || 'all';
    let filters = [];
    if (accept === 'image') {
      filters = [{ name: '图片文件', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'] }];
    } else if (accept === 'video') {
      filters = [{ name: '视频文件', extensions: ['mp4', 'mov', 'avi', 'mkv', 'webm'] }];
    } else {
      filters = [
        { name: '图片文件', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'] },
        { name: '视频文件', extensions: ['mp4', 'mov', 'avi', 'mkv', 'webm'] },
        { name: '所有文件', extensions: ['*'] },
      ];
    }

    const result = await dialog.showOpenDialog(mainWindow, {
      title: accept === 'image' ? '选择图片' : accept === 'video' ? '选择视频' : '选择媒体文件',
      filters,
      properties: ['openFile'],
    });

    if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
      return { success: false, canceled: true };
    }

    return { success: true, filePath: result.filePaths[0] };
  } catch (error) {
    console.error('[IPC] select-media-file 失败:', error);
    return { success: false, error: error.message };
  }
});

// 录音状态（主进程暂不实现录音，由渲染进程用 Web Audio API）
let audioRecordingState = null;
ipcMain.handle('start-audio-recording', async () => {
  // Electron 主进程暂不实现录音，建议渲染进程使用 Web Audio API（MediaRecorder）
  // 未来可集成 node-record-lpcm16 等库
  return { success: false, error: 'Electron 主进程录音暂未实现，请使用渲染进程 Web Audio API' };
});

ipcMain.handle('stop-audio-recording', async () => {
  return { success: false, error: 'Electron 主进程录音暂未实现' };
});

ipcMain.handle('cancel-audio-recording', async () => {
  audioRecordingState = null;
  return { success: true };
});

// 录音转写（OpenAI Whisper），供日记模块使用
ipcMain.handle('transcribe-audio', async (event, { base64, apiKey }) => {
  if (!apiKey || !base64) {
    return { success: false, error: '缺少 API Key 或音频数据' };
  }
  try {
    const buffer = Buffer.from(base64, 'base64');
    const form = new FormData();
    form.append('file', new Blob([buffer], { type: 'audio/webm' }), 'audio.webm');
    form.append('model', 'whisper-1');

    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });

    if (!res.ok) {
      const errText = await res.text();
      return { success: false, error: `Whisper API ${res.status}: ${errText.slice(0, 200)}` };
    }
    const data = await res.json();
    return { success: true, text: data.text || '' };
  } catch (error) {
    console.error('[IPC] transcribe-audio 失败:', error);
    return { success: false, error: error.message };
  }
});

// 同步：导出全量数据（主进程执行，返回 JSON 对象）
ipcMain.handle('sync-export-data', async () => {
  try {
    if (!dbService || !dbService.initialized) await initDatabase();
    if (!dbService || !dbService.initialized) return { success: false, error: '数据库未初始化' };
    const payload = dbService.exportForSync();
    return { success: true, payload };
  } catch (error) {
    console.error('[IPC] sync-export-data 失败:', error);
    return { success: false, error: error.message };
  }
});

// 同步：导入全量数据（主进程执行）
ipcMain.handle('sync-import-data', async (event, payload) => {
  try {
    if (!dbService || !dbService.initialized) await initDatabase();
    if (!dbService || !dbService.initialized) return { success: false, error: '数据库未初始化' };
    dbService.importFromSync(payload);
    return { success: true };
  } catch (error) {
    console.error('[IPC] sync-import-data 失败:', error);
    return { success: false, error: error.message };
  }
});

// OneDrive OAuth：临时 HTTP 服务接收 redirect，打开登录窗口并返回 code
let oneDriveLoginResolve = null;
let oneDriveLoginServer = null;
let oneDriveLoginWindow = null;

ipcMain.handle('sync-open-oauth-login', async (event, { authUrl, redirectPort = 3848 }) => {
  return new Promise((resolve) => {
    oneDriveLoginResolve = resolve;
    oneDriveLoginServer = http.createServer((req, res) => {
      const parsed = url.parse(req.url, true);
      if (parsed.pathname === '/callback' && parsed.query && parsed.query.code) {
        const code = parsed.query.code;
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(
          '<!DOCTYPE html><html><body><p>登录成功，请关闭此窗口并返回应用。</p><script>setTimeout(() => window.close(), 1500);</script></body></html>'
        );
        if (oneDriveLoginResolve) {
          oneDriveLoginResolve({ success: true, code });
          oneDriveLoginResolve = null;
        }
        if (oneDriveLoginWindow && !oneDriveLoginWindow.isDestroyed()) oneDriveLoginWindow.close();
        oneDriveLoginWindow = null;
        oneDriveLoginServer.close();
        oneDriveLoginServer = null;
      } else {
        res.writeHead(404);
        res.end();
      }
    });
    oneDriveLoginServer.listen(redirectPort, '127.0.0.1', () => {
      oneDriveLoginWindow = new BrowserWindow({
        width: 500,
        height: 700,
        show: true,
        webPreferences: { nodeIntegration: false },
      });
      oneDriveLoginWindow.loadURL(authUrl);
      oneDriveLoginWindow.on('closed', () => {
        if (oneDriveLoginResolve) {
          oneDriveLoginResolve({ success: false, error: '用户关闭了登录窗口' });
          oneDriveLoginResolve = null;
        }
        if (oneDriveLoginServer) {
          oneDriveLoginServer.close();
          oneDriveLoginServer = null;
        }
        oneDriveLoginWindow = null;
      });
    });
  });
});

// 同步加密密码：使用系统安全存储（仅当前设备），便于启动时自动拉取
const SYNC_PASSWORD_KEY = 'personal-butler-sync-encryption-password';

ipcMain.handle('sync-save-encryption-password', (event, password) => {
  try {
    if (!password || typeof password !== 'string') return { success: false, error: '无效密码' };
    if (!safeStorage.isEncryptionAvailable()) return { success: false, error: '当前系统不支持安全存储' };
    const encrypted = safeStorage.encryptString(password);
    const prefs = app.getPath('userData');
    const file = path.join(prefs, SYNC_PASSWORD_KEY);
    fs.writeFileSync(file, encrypted);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('sync-get-encryption-password', () => {
  try {
    if (!safeStorage.isEncryptionAvailable()) return { success: true, password: null };
    const file = path.join(app.getPath('userData'), SYNC_PASSWORD_KEY);
    if (!fs.existsSync(file)) return { success: true, password: null };
    const encrypted = fs.readFileSync(file);
    const password = safeStorage.decryptString(encrypted);
    return { success: true, password };
  } catch (e) {
    return { success: false, password: null, error: e.message };
  }
});

ipcMain.handle('sync-clear-encryption-password', () => {
  try {
    const file = path.join(app.getPath('userData'), SYNC_PASSWORD_KEY);
    if (fs.existsSync(file)) fs.unlinkSync(file);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});
