// 数据库服务 - 渲染进程版本（通过平台 API：Electron IPC 或 Web IndexedDB）
import { getLogger } from './logger-client';
import { isElectron, dbInit as platformDbInit, dbQuery as platformDbQuery, dbExecute as platformDbExecute } from '../platform';

class DatabaseService {
  constructor() {
    this.initialized = false;
    this.logger = getLogger();
  }

  async init() {
    try {
      this.logger.log('DB-Client', '开始初始化数据库客户端...');

      if (isElectron()) {
        this.logger.log('DB-Client', 'Electron 环境，通过平台 API 初始化');
        const result = await platformDbInit();
        this.logger.log('DB-Client', '平台初始化结果', result);

        if (result.success) {
          this.initialized = true;
          this.logger.log('DB-Client', '✅ 数据库客户端初始化成功');
          return true;
        } else {
          this.logger.error('DB-Client', '❌ 平台初始化失败:', result.error);
          throw new Error(result.error);
        }
      } else {
        this.logger.log('DB-Client', 'Web 环境，使用 IndexedDB');
        await this.initIndexedDB();
        this.initialized = true;
        this.logger.log('DB-Client', '✅ IndexedDB 初始化成功');
        return true;
      }
    } catch (error) {
      this.logger.error('DB-Client', '❌ 数据库初始化失败:', error);
      this.logger.error('DB-Client', '错误堆栈:', error.stack);
      throw error;
    }
  }

  async initIndexedDB() {
    // Web环境使用IndexedDB（后续实现）
    this.logger.log('DB-Client', 'Web环境，使用IndexedDB');
  }

  // 通用查询方法
  async query(sql, params = []) {
    try {
      this.logger.log('DB-Client', '执行查询:', sql, '参数:', params);
      
      if (!this.initialized) {
        this.logger.warn('DB-Client', '⚠️ 数据库未初始化，先初始化...');
        await this.init();
      }
      
      if (isElectron()) {
        this.logger.log('DB-Client', '通过平台 API 调用查询');
        const result = await platformDbQuery(sql, params);
        this.logger.log('DB-Client', '平台查询结果:', result);

        if (result.success) {
          this.logger.log('DB-Client', '✅ 查询成功，返回', result.data?.length || 0, '条记录');
          return result.data;
        } else {
          this.logger.error('DB-Client', '❌ 平台查询失败:', result.error);
          throw new Error(result.error);
        }
      } else {
        this.logger.log('DB-Client', '使用 IndexedDB 查询');
        return await this.queryIndexedDB(sql, params);
      }
    } catch (error) {
      this.logger.error('DB-Client', '❌ 查询错误:', error);
      this.logger.error('DB-Client', 'SQL:', sql);
      this.logger.error('DB-Client', '参数:', params);
      this.logger.error('DB-Client', '错误堆栈:', error.stack);
      throw error;
    }
  }

  // 通用执行方法
  async execute(sql, params = []) {
    try {
      this.logger.log('DB-Client', '执行更新:', sql, '参数:', params);
      
      if (!this.initialized) {
        this.logger.warn('DB-Client', '⚠️ 数据库未初始化，先初始化...');
        await this.init();
      }
      
      if (isElectron()) {
        this.logger.log('DB-Client', '通过平台 API 调用更新');
        const result = await platformDbExecute(sql, params);
        this.logger.log('DB-Client', '平台更新结果:', result);

        if (result.success) {
          this.logger.log('DB-Client', '✅ 更新成功');
          return result.data;
        } else {
          this.logger.error('DB-Client', '❌ 平台更新失败:', result.error);
          throw new Error(result.error);
        }
      } else {
        this.logger.log('DB-Client', '使用 IndexedDB 更新');
        return await this.executeIndexedDB(sql, params);
      }
    } catch (error) {
      this.logger.error('DB-Client', '❌ 执行错误:', error);
      this.logger.error('DB-Client', 'SQL:', sql);
      this.logger.error('DB-Client', '参数:', params);
      this.logger.error('DB-Client', '错误堆栈:', error.stack);
      throw error;
    }
  }

  // IndexedDB查询（Web环境）
  async queryIndexedDB(sql, params) {
    // TODO: 实现IndexedDB查询
    throw new Error('IndexedDB查询未实现');
  }

  // IndexedDB执行（Web环境）
  async executeIndexedDB(sql, params) {
    // TODO: 实现IndexedDB执行
    throw new Error('IndexedDB执行未实现');
  }
}

// 单例模式
let dbInstance = null;

export async function getDatabase() {
  if (!dbInstance) {
    dbInstance = new DatabaseService();
    await dbInstance.init();
  }
  return dbInstance;
}

export default DatabaseService;
