/**
 * 搭配管理 Store
 * 搭配 CRUD、搭配推荐、搭配历史
 */
import { create } from 'zustand';
import { getDatabase } from '../services/database';
import { getCryptoService } from '../services/crypto';
import { getLogger } from '../services/logger-client';
import useUserStore from './userStore';
import dayjs from 'dayjs';

const logger = getLogger();

const useOutfitStore = create((set, get) => ({
  outfits: [],
  loading: false,

  async loadOutfits() {
    try {
      set({ loading: true });
      const db = await getDatabase();
      const { currentUser } = useUserStore.getState();
      if (!currentUser) {
        set({ outfits: [], loading: false });
        return [];
      }
      const rows = await db.query(
        'SELECT * FROM outfits WHERE user_id = ? ORDER BY created_at DESC',
        [currentUser.id]
      );
      // 解析 JSON 字段
      const parsed = rows.map((row) => ({
        ...row,
        clothing_ids: row.clothing_ids ? JSON.parse(row.clothing_ids) : [],
        weather_condition: row.weather_condition ? JSON.parse(row.weather_condition) : null,
      }));
      set({ outfits: parsed, loading: false });
      logger.log('OutfitStore', `加载 ${parsed.length} 个搭配`);
      return parsed;
    } catch (e) {
      logger.error('OutfitStore', '加载搭配失败', e);
      set({ outfits: [], loading: false });
      throw e;
    }
  },

  async createOutfit(data) {
    const db = await getDatabase();
    const { currentUser } = useUserStore.getState();
    if (!currentUser) throw new Error('用户未登录');
    const id = getCryptoService().generateUUID();
    const now = Date.now();
    await db.execute(
      `INSERT INTO outfits (id, user_id, name, clothing_ids, occasion, weather_condition, rating, worn_date, image_path, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        currentUser.id,
        data.name || '',
        JSON.stringify(data.clothing_ids || []),
        data.occasion || null,
        data.weather_condition ? JSON.stringify(data.weather_condition) : null,
        data.rating || null,
        data.worn_date ? dayjs(data.worn_date).valueOf() : null,
        data.image_path || null,
        now,
      ]
    );
    await get().loadOutfits();
    return id;
  },

  async updateOutfit(id, data) {
    const db = await getDatabase();
    const { currentUser } = useUserStore.getState();
    if (!currentUser) throw new Error('用户未登录');
    await db.execute(
      `UPDATE outfits SET name = ?, clothing_ids = ?, occasion = ?, weather_condition = ?, rating = ?, worn_date = ?, image_path = ?
       WHERE id = ? AND user_id = ?`,
      [
        data.name ?? '',
        JSON.stringify(data.clothing_ids || []),
        data.occasion ?? null,
        data.weather_condition ? JSON.stringify(data.weather_condition) : null,
        data.rating ?? null,
        data.worn_date ? dayjs(data.worn_date).valueOf() : null,
        data.image_path ?? null,
        id,
        currentUser.id,
      ]
    );
    await get().loadOutfits();
  },

  async deleteOutfit(id) {
    const db = await getDatabase();
    const { currentUser } = useUserStore.getState();
    if (!currentUser) throw new Error('用户未登录');
    await db.execute('DELETE FROM outfits WHERE id = ? AND user_id = ?', [id, currentUser.id]);
    await get().loadOutfits();
  },

  /** 智能搭配推荐 */
  async recommendOutfit(options = {}) {
    // 动态导入 clothingStore 以避免循环依赖
    const clothingStoreModule = await import('./clothingStore');
    const useClothingStore = clothingStoreModule.default;
    const { clothing: allClothing } = useClothingStore.getState();
    
    const { season, style, occasion, excludeDirty = true } = options;
    let candidates = allClothing.filter((c) => {
      if (excludeDirty && c.wash_status === 'dirty') return false;
      if (season && c.season !== 'all' && c.season !== season) return false;
      if (style && c.style !== style) return false;
      return true;
    });

    // 按类别分组
    const byCategory = {};
    candidates.forEach((c) => {
      if (!byCategory[c.category]) byCategory[c.category] = [];
      byCategory[c.category].push(c);
    });

    // 基础搭配规则：至少需要上衣和下装
    const recommendations = [];
    const tops = byCategory.top || [];
    const bottoms = byCategory.bottom || [];
    const outerwears = byCategory.outerwear || [];
    const shoes = byCategory.shoes || [];
    const accessories = byCategory.accessories || [];

    // 生成搭配组合
    for (const top of tops.slice(0, 5)) {
      for (const bottom of bottoms.slice(0, 5)) {
        const outfit = {
          clothing_ids: [top.id, bottom.id],
          items: [top, bottom],
        };
        
        // 可选：添加外套
        if (outerwears.length > 0 && Math.random() > 0.5) {
          const outerwear = outerwears[Math.floor(Math.random() * outerwears.length)];
          outfit.clothing_ids.push(outerwear.id);
          outfit.items.push(outerwear);
        }
        
        // 可选：添加鞋子
        if (shoes.length > 0 && Math.random() > 0.7) {
          const shoe = shoes[Math.floor(Math.random() * shoes.length)];
          outfit.clothing_ids.push(shoe.id);
          outfit.items.push(shoe);
        }
        
        recommendations.push(outfit);
        if (recommendations.length >= 10) break;
      }
      if (recommendations.length >= 10) break;
    }

    return recommendations;
  },
}));

export default useOutfitStore;
