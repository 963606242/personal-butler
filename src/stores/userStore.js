import { create } from 'zustand';
import { getDatabase } from '../services/database';
import { getCryptoService } from '../services/crypto';
import { getLogger } from '../services/logger-client';

const logger = getLogger();

const useUserStore = create((set, get) => ({
  currentUser: null,
  userProfile: null,
  isInitialized: false,

  // 初始化用户（首次使用）
  async initializeUser(password) {
    try {
      const db = await getDatabase();
      const crypto = getCryptoService();

      // 检查是否已有用户
      const existingUsers = await db.query('SELECT * FROM users LIMIT 1');
      if (existingUsers.length > 0) {
        throw new Error('用户已存在，请使用登录功能');
      }

      // 生成用户ID
      const userId = crypto.generateUUID();
      const now = Date.now();

      // 派生加密密钥
      const salt = crypto.generateSalt();
      const encryptionKey = await crypto.deriveKey(password, salt);

      // 创建用户记录
      await db.execute(
        `INSERT INTO users (id, password_hash, encryption_key_encrypted, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)`,
        [
          userId,
          'hashed_password_here', // TODO: 使用bcrypt哈希密码
          JSON.stringify({ salt: Array.from(salt) }), // 存储盐
          now,
          now,
        ]
      );

      // 创建用户信息记录
      const profileId = crypto.generateUUID();
      await db.execute(
        `INSERT INTO user_profiles (id, user_id, created_at, updated_at)
         VALUES (?, ?, ?, ?)`,
        [profileId, userId, now, now]
      );

      set({
        currentUser: { id: userId },
        userProfile: { id: profileId, user_id: userId },
        isInitialized: true,
      });

      return { userId, encryptionKey };
    } catch (error) {
      console.error('初始化用户失败:', error);
      throw error;
    }
  },

  // 加载用户信息
  async loadUser() {
    try {
      logger.log('UserStore', '开始加载用户信息...');
      const db = await getDatabase();
      logger.log('UserStore', '数据库实例获取成功');
      
      logger.log('UserStore', '查询用户表...');
      const users = await db.query('SELECT * FROM users LIMIT 1');
      logger.log('UserStore', '查询结果:', users);
      
      if (users.length === 0) {
        // 首次使用，自动创建默认用户
        const crypto = getCryptoService();
        const userId = crypto.generateUUID();
        const now = Date.now();
        
        // 创建用户记录（无密码模式）
        await db.execute(
          `INSERT INTO users (id, created_at, updated_at)
           VALUES (?, ?, ?)`,
          [userId, now, now]
        );

        // 创建用户信息记录
        const profileId = crypto.generateUUID();
        await db.execute(
          `INSERT INTO user_profiles (id, user_id, created_at, updated_at)
           VALUES (?, ?, ?, ?)`,
          [profileId, userId, now, now]
        );

        set({
          currentUser: { id: userId },
          userProfile: { id: profileId, user_id: userId },
          isInitialized: true,
        });

        return true;
      }

      const user = users[0];
      const profiles = await db.query(
        'SELECT * FROM user_profiles WHERE user_id = ?',
        [user.id]
      );

      // 解析 JSON 字段
      const profile = profiles[0] || null;
      if (profile) {
        // 解析工作信息和兴趣爱好（JSON字符串）
        if (profile.work_location) {
          try {
            profile.work_location = JSON.parse(profile.work_location);
          } catch (e) {
            profile.work_location = null;
          }
        }
        if (profile.work_schedule) {
          try {
            profile.work_schedule = JSON.parse(profile.work_schedule);
          } catch (e) {
            profile.work_schedule = null;
          }
        }
        if (profile.interests) {
          try {
            profile.interests = JSON.parse(profile.interests);
          } catch (e) {
            profile.interests = null;
          }
        }
      }

      set({
        currentUser: user,
        userProfile: profile,
        isInitialized: true,
      });

      logger.log('UserStore', '✅ 用户信息加载成功');
      return true;
    } catch (error) {
      logger.error('UserStore', '❌ 加载用户失败:', error);
      logger.error('UserStore', '错误堆栈:', error.stack);
      set({ isInitialized: false });
      throw error;
    }
  },

  // 更新用户信息
  async updateProfile(profileData) {
    try {
      logger.log('UserStore', '开始更新用户信息...');
      logger.log('UserStore', '接收到的数据:', profileData);
      
      const db = await getDatabase();
      const { userProfile } = get();

      if (!userProfile) {
        logger.error('UserStore', '用户信息不存在');
        throw new Error('用户信息不存在');
      }

      logger.log('UserStore', '当前用户信息 ID:', userProfile.id);

      const now = Date.now();
      const updateFields = [];
      const updateValues = [];

      Object.keys(profileData).forEach((key) => {
        const value = profileData[key];
        logger.log('UserStore', `处理字段 ${key}:`, value, '类型:', typeof value, '是否为 undefined:', value === undefined, '是否为 null:', value === null);
        
        // 允许 null 值，但不允许 undefined
        // 注意：空字符串 '' 也会被更新（这是合理的，因为用户可能想清空字段）
        if (value !== undefined) {
          let processedValue = value;
          // 如果是对象或数组，转换为JSON字符串
          if (typeof processedValue === 'object' && processedValue !== null && !Array.isArray(processedValue)) {
            // 检查是否是普通对象（不是 Date 等特殊对象）
            if (processedValue.constructor === Object) {
              processedValue = JSON.stringify(processedValue);
              logger.log('UserStore', `字段 ${key} 转换为 JSON:`, processedValue);
            }
          }
          updateFields.push(`${key} = ?`);
          updateValues.push(processedValue);
          logger.log('UserStore', `添加字段 ${key} 到更新列表，值:`, processedValue);
        } else {
          logger.warn('UserStore', `字段 ${key} 为 undefined，跳过`);
        }
      });

      logger.log('UserStore', '更新字段数量:', updateFields.length);
      logger.log('UserStore', '更新字段列表:', updateFields);
      logger.log('UserStore', '更新值列表:', updateValues);

      if (updateFields.length === 0) {
        logger.warn('UserStore', '⚠️ 没有需要更新的字段');
        return;
      }

      updateFields.push('updated_at = ?');
      updateValues.push(now);
      updateValues.push(userProfile.id);

      const sql = `UPDATE user_profiles SET ${updateFields.join(', ')} WHERE id = ?`;
      logger.log('UserStore', '执行 SQL:', sql);
      logger.log('UserStore', 'SQL 参数:', updateValues);

      const result = await db.execute(sql, updateValues);
      logger.log('UserStore', '更新执行结果:', result);

      // 重新加载用户信息
      logger.log('UserStore', '重新加载用户信息...');
      await get().loadUser();
      
      logger.log('UserStore', '✅ 用户信息更新成功');
    } catch (error) {
      logger.error('UserStore', '❌ 更新用户信息失败:', error);
      logger.error('UserStore', '错误堆栈:', error.stack);
      throw error;
    }
  },
}));

export default useUserStore;
