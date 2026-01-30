/**
 * 服装管理 Store
 * 服装 CRUD、分类、筛选、搭配管理
 */
import { create } from 'zustand';
import { getDatabase } from '../services/database';
import { getCryptoService } from '../services/crypto';
import { getLogger } from '../services/logger-client';
import useUserStore from './userStore';
import dayjs from 'dayjs';

const logger = getLogger();

/** 服装类别 */
export const CLOTHING_CATEGORIES = [
  { value: 'top', label: '上衣', icon: '👕' },
  { value: 'bottom', label: '下装', icon: '👖' },
  { value: 'outerwear', label: '外套', icon: '🧥' },
  { value: 'accessories', label: '配饰', icon: '👒' },
  { value: 'shoes', label: '鞋类', icon: '👟' },
];

/** 颜色选项 */
export const CLOTHING_COLORS = [
  { value: 'black', label: '黑色', color: '#000000' },
  { value: 'white', label: '白色', color: '#FFFFFF' },
  { value: 'gray', label: '灰色', color: '#808080' },
  { value: 'brown', label: '棕色', color: '#8B4513' },
  { value: 'beige', label: '米色', color: '#F5F5DC' },
  { value: 'red', label: '红色', color: '#FF0000' },
  { value: 'pink', label: '粉色', color: '#FFC0CB' },
  { value: 'orange', label: '橙色', color: '#FFA500' },
  { value: 'yellow', label: '黄色', color: '#FFFF00' },
  { value: 'green', label: '绿色', color: '#008000' },
  { value: 'blue', label: '蓝色', color: '#0000FF' },
  { value: 'purple', label: '紫色', color: '#800080' },
  { value: 'navy', label: '海军蓝', color: '#000080' },
  { value: 'other', label: '其他', color: '#CCCCCC' },
];

/** 季节选项 */
export const CLOTHING_SEASONS = [
  { value: 'spring', label: '春季' },
  { value: 'summer', label: '夏季' },
  { value: 'autumn', label: '秋季' },
  { value: 'winter', label: '冬季' },
  { value: 'all', label: '四季' },
];

/** 风格选项 */
export const CLOTHING_STYLES = [
  { value: 'formal', label: '正式' },
  { value: 'casual', label: '休闲' },
  { value: 'sport', label: '运动' },
  { value: 'other', label: '其他' },
];

/** 清洗状态 */
export const WASH_STATUS = [
  { value: 'clean', label: '干净', color: 'success' },
  { value: 'dirty', label: '待洗', color: 'warning' },
];

const useClothingStore = create((set, get) => ({
  clothing: [],
  loading: false,

  async loadClothing() {
    try {
      set({ loading: true });
      const db = await getDatabase();
      const { currentUser } = useUserStore.getState();
      if (!currentUser) {
        set({ clothing: [], loading: false });
        return [];
      }
      const rows = await db.query(
        'SELECT * FROM clothing WHERE user_id = ? ORDER BY created_at DESC',
        [currentUser.id]
      );
      set({ clothing: rows, loading: false });
      logger.log('ClothingStore', `加载 ${rows.length} 件服装`);
      return rows;
    } catch (e) {
      logger.error('ClothingStore', '加载服装失败', e);
      set({ clothing: [], loading: false });
      throw e;
    }
  },

  async createClothing(data) {
    const db = await getDatabase();
    const { currentUser } = useUserStore.getState();
    if (!currentUser) throw new Error('用户未登录');
    const id = getCryptoService().generateUUID();
    const now = Date.now();
    await db.execute(
      `INSERT INTO clothing (id, user_id, name, category, color, material, season, style, image_path, purchase_date, price, wash_status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        currentUser.id,
        data.name || '',
        data.category || 'other',
        data.color || null,
        data.material || null,
        data.season || 'all',
        data.style || 'casual',
        data.image_path || null,
        data.purchase_date ? dayjs(data.purchase_date).valueOf() : null,
        data.price || null,
        data.wash_status || 'clean',
        now,
        now,
      ]
    );
    await get().loadClothing();
    return id;
  },

  async updateClothing(id, data) {
    const db = await getDatabase();
    const { currentUser } = useUserStore.getState();
    if (!currentUser) throw new Error('用户未登录');
    const now = Date.now();
    await db.execute(
      `UPDATE clothing SET name = ?, category = ?, color = ?, material = ?, season = ?, style = ?, image_path = ?, purchase_date = ?, price = ?, wash_status = ?, updated_at = ?
       WHERE id = ? AND user_id = ?`,
      [
        data.name ?? '',
        data.category ?? 'other',
        data.color ?? null,
        data.material ?? null,
        data.season ?? 'all',
        data.style ?? 'casual',
        data.image_path ?? null,
        data.purchase_date ? dayjs(data.purchase_date).valueOf() : null,
        data.price ?? null,
        data.wash_status ?? 'clean',
        now,
        id,
        currentUser.id,
      ]
    );
    await get().loadClothing();
  },

  async deleteClothing(id) {
    const db = await getDatabase();
    const { currentUser } = useUserStore.getState();
    if (!currentUser) throw new Error('用户未登录');
    await db.execute('DELETE FROM clothing WHERE id = ? AND user_id = ?', [id, currentUser.id]);
    await get().loadClothing();
  },

  /** 获取按类别分组的服装 */
  getClothingByCategory() {
    const { clothing } = get();
    const grouped = {};
    CLOTHING_CATEGORIES.forEach((cat) => {
      grouped[cat.value] = clothing.filter((c) => c.category === cat.value);
    });
    return grouped;
  },
}));

export default useClothingStore;
