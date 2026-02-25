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

/**
 * 根据天气数据生成穿衣建议（纯函数，不依赖 store 状态）
 * @param {object} weather - 天气数据 { temp, feelsLike, humidity, description, windSpeed }
 * @returns {Array<{icon: string, text: string, level: string}>} 建议列表
 */
export function getClothingSuggestion(weather) {
  if (!weather || weather.temp == null) return [];

  const temp = weather.feelsLike ?? weather.temp;
  const humidity = weather.humidity || 0;
  const desc = (weather.description || '').toLowerCase();
  const windSpeed = weather.windSpeed || 0;
  const suggestions = [];

  // 温度分级穿衣建议
  if (temp <= -10) {
    suggestions.push({ icon: '🧥', text: '极寒天气，建议穿羽绒服或厚棉服，搭配保暖内衣、围巾、帽子和手套', level: 'cold' });
  } else if (temp <= 0) {
    suggestions.push({ icon: '🧥', text: '严寒天气，建议穿厚外套或羽绒服，注意头部和手部保暖', level: 'cold' });
  } else if (temp <= 5) {
    suggestions.push({ icon: '🧣', text: '寒冷天气，建议穿毛衣搭配厚外套，围巾不可少', level: 'cold' });
  } else if (temp <= 10) {
    suggestions.push({ icon: '🧶', text: '较冷天气，建议穿毛衣或卫衣，外搭一件外套', level: 'cool' });
  } else if (temp <= 15) {
    suggestions.push({ icon: '🧥', text: '微凉天气，建议穿长袖加薄外套或夹克', level: 'cool' });
  } else if (temp <= 20) {
    suggestions.push({ icon: '👔', text: '舒适天气，建议穿长袖衬衫或薄针织衫', level: 'comfort' });
  } else if (temp <= 25) {
    suggestions.push({ icon: '👕', text: '温暖天气，建议穿短袖或薄长袖即可', level: 'comfort' });
  } else if (temp <= 30) {
    suggestions.push({ icon: '👕', text: '炎热天气，建议穿轻薄透气的短袖短裤', level: 'hot' });
  } else {
    suggestions.push({ icon: '🩳', text: '酷暑天气，穿最轻薄的衣物，注意防暑降温补水', level: 'hot' });
  }

  // 降雨建议
  if (desc.includes('雨') || desc.includes('rain') || desc.includes('drizzle') || desc.includes('shower')) {
    if (desc.includes('大雨') || desc.includes('暴雨') || desc.includes('heavy')) {
      suggestions.push({ icon: '☔', text: '降雨较大，务必带伞，建议穿防水鞋和防水外套', level: 'rain' });
    } else {
      suggestions.push({ icon: '☂️', text: '有降雨，记得带伞，建议穿防水或深色衣物', level: 'rain' });
    }
  }

  // 降雪建议
  if (desc.includes('雪') || desc.includes('snow')) {
    suggestions.push({ icon: '❄️', text: '有降雪，建议穿防水保暖鞋，注意路面湿滑', level: 'snow' });
  }

  // 大风建议
  if (windSpeed > 10) {
    suggestions.push({ icon: '💨', text: '大风天气，建议穿紧实防风外套，避免穿裙装', level: 'wind' });
  } else if (windSpeed > 6) {
    suggestions.push({ icon: '🌬️', text: '风力较大，外出建议穿挡风衣物', level: 'wind' });
  }

  // 湿度建议
  if (humidity > 80 && temp > 25) {
    suggestions.push({ icon: '💧', text: '闷热潮湿，建议穿棉麻等吸汗透气面料', level: 'humidity' });
  } else if (humidity < 25) {
    suggestions.push({ icon: '🏜️', text: '空气干燥，注意皮肤保湿和补水', level: 'dry' });
  }

  // 紫外线/防晒建议
  if ((desc.includes('晴') || desc.includes('clear') || desc.includes('sunny')) && temp > 22) {
    suggestions.push({ icon: '☀️', text: '阳光充足，建议做好防晒，可戴帽子和太阳镜', level: 'sun' });
  }

  // 雾霾建议
  if (desc.includes('雾') || desc.includes('霾') || desc.includes('fog') || desc.includes('haze') || desc.includes('mist')) {
    suggestions.push({ icon: '😷', text: '能见度低，建议佩戴口罩，减少户外活动', level: 'fog' });
  }

  return suggestions;
}

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

  /** 智能搭配推荐 - 综合天气、场合、颜色匹配 */
  async recommendOutfit(options = {}) {
    // 动态导入 clothingStore 以避免循环依赖
    const clothingStoreModule = await import('./clothingStore');
    const useClothingStore = clothingStoreModule.default;
    const { clothing: allClothing } = useClothingStore.getState();
    
    const { season, style, occasion, excludeDirty = true, weather } = options;

    // ========== 1. 根据天气推断季节和需求 ==========
    let inferredSeason = season;
    let needOuterwear = false;
    let needWaterproof = false;
    let needBreathable = false;

    if (weather && weather.temp != null) {
      const temp = weather.feelsLike ?? weather.temp;
      if (temp <= 5) { inferredSeason = inferredSeason || 'winter'; needOuterwear = true; }
      else if (temp <= 15) { inferredSeason = inferredSeason || 'autumn'; needOuterwear = true; }
      else if (temp <= 25) { inferredSeason = inferredSeason || 'spring'; }
      else { inferredSeason = inferredSeason || 'summer'; needBreathable = true; }

      const desc = (weather.description || '').toLowerCase();
      if (desc.includes('雨') || desc.includes('rain') || desc.includes('drizzle')) {
        needWaterproof = true;
      }
    }

    // ========== 2. 场合对应风格映射 ==========
    const occasionStyleMap = {
      work: 'formal', formal: 'formal', sport: 'sport',
      daily: 'casual', party: 'casual', travel: 'casual',
    };
    const preferredStyle = style || (occasion ? occasionStyleMap[occasion] : null);

    // ========== 3. 筛选候选服装 ==========
    let candidates = allClothing.filter((c) => {
      if (excludeDirty && c.wash_status === 'dirty') return false;
      if (inferredSeason && c.season !== 'all' && c.season !== inferredSeason) return false;
      return true;
    });

    // 按类别分组
    const byCategory = {};
    candidates.forEach((c) => {
      if (!byCategory[c.category]) byCategory[c.category] = [];
      byCategory[c.category].push(c);
    });

    const tops = byCategory.top || [];
    const bottoms = byCategory.bottom || [];
    const outerwears = byCategory.outerwear || [];
    const shoes = byCategory.shoes || [];
    const accessories = byCategory.accessories || [];

    if (tops.length === 0 || bottoms.length === 0) {
      return []; // 没有足够的衣服生成搭配
    }

    // ========== 4. 颜色协调规则 ==========
    const colorHarmony = {
      black: ['white', 'gray', 'red', 'blue', 'beige', 'navy', 'pink'],
      white: ['black', 'navy', 'blue', 'gray', 'red', 'brown', 'beige'],
      gray: ['black', 'white', 'blue', 'red', 'pink', 'navy', 'purple'],
      navy: ['white', 'beige', 'gray', 'brown', 'red', 'pink'],
      blue: ['white', 'gray', 'beige', 'brown', 'navy', 'black'],
      brown: ['white', 'beige', 'blue', 'green', 'navy', 'orange'],
      beige: ['navy', 'brown', 'white', 'blue', 'black', 'green'],
      red: ['black', 'white', 'gray', 'navy', 'blue', 'beige'],
      green: ['white', 'beige', 'brown', 'black', 'gray', 'navy'],
      pink: ['white', 'gray', 'navy', 'black', 'blue', 'beige'],
      purple: ['white', 'gray', 'black', 'beige', 'pink'],
      orange: ['white', 'navy', 'brown', 'beige', 'blue', 'black'],
      yellow: ['navy', 'gray', 'white', 'blue', 'brown', 'black'],
    };

    const getColorScore = (color1, color2) => {
      if (!color1 || !color2 || color1 === 'other' || color2 === 'other') return 5;
      if (color1 === color2) return 7; // 同色系
      const harmonious = colorHarmony[color1] || [];
      if (harmonious.includes(color2)) return 10;
      return 3; // 不搭配
    };

    // ========== 5. 搭配评分函数 ==========
    const scoreOutfit = (items) => {
      let score = 0;

      // 颜色搭配得分 (0-30)
      let colorScore = 0;
      let colorPairs = 0;
      for (let i = 0; i < items.length; i++) {
        for (let j = i + 1; j < items.length; j++) {
          colorScore += getColorScore(items[i].color, items[j].color);
          colorPairs++;
        }
      }
      if (colorPairs > 0) score += (colorScore / colorPairs) * 3;

      // 风格一致性得分 (0-20)
      if (preferredStyle) {
        const matchCount = items.filter(c => c.style === preferredStyle || c.style === 'other').length;
        score += (matchCount / items.length) * 20;
      } else {
        // 无指定风格时，检查风格统一性
        const styles = items.map(c => c.style).filter(Boolean);
        const mostCommon = styles.sort((a, b) =>
          styles.filter(v => v === b).length - styles.filter(v => v === a).length
        )[0];
        if (mostCommon) {
          const consistency = styles.filter(s => s === mostCommon || s === 'other').length / styles.length;
          score += consistency * 15;
        }
      }

      // 天气适配得分 (0-20)
      if (weather && weather.temp != null) {
        const temp = weather.feelsLike ?? weather.temp;
        const hasOuterwear = items.some(c => c.category === 'outerwear');
        if (needOuterwear && hasOuterwear) score += 10;
        if (!needOuterwear && !hasOuterwear) score += 5;
        // 面料适配
        items.forEach(c => {
          const mat = (c.material || '').toLowerCase();
          if (temp > 28 && (mat.includes('棉') || mat.includes('麻') || mat.includes('cotton') || mat.includes('linen'))) score += 3;
          if (temp < 10 && (mat.includes('羊毛') || mat.includes('绒') || mat.includes('wool') || mat.includes('fleece'))) score += 3;
        });
      }

      // 搭配完整性得分 (0-10)
      const categories = new Set(items.map(c => c.category));
      if (categories.has('top') && categories.has('bottom')) score += 5;
      if (categories.has('shoes')) score += 3;
      if (categories.has('accessories')) score += 2;

      return Math.round(score * 10) / 10;
    };

    // ========== 6. 生成搭配组合 ==========
    const rawCombos = [];
    const maxTops = Math.min(tops.length, 8);
    const maxBottoms = Math.min(bottoms.length, 8);

    for (let i = 0; i < maxTops; i++) {
      for (let j = 0; j < maxBottoms; j++) {
        const items = [tops[i], bottoms[j]];
        const ids = [tops[i].id, bottoms[j].id];

        // 根据天气决定是否添加外套
        if (outerwears.length > 0 && needOuterwear) {
          const ow = outerwears[Math.floor(Math.random() * outerwears.length)];
          items.push(ow);
          ids.push(ow.id);
        } else if (outerwears.length > 0 && Math.random() > 0.7) {
          const ow = outerwears[Math.floor(Math.random() * outerwears.length)];
          items.push(ow);
          ids.push(ow.id);
        }

        // 添加鞋子
        if (shoes.length > 0) {
          const shoe = shoes[Math.floor(Math.random() * shoes.length)];
          items.push(shoe);
          ids.push(shoe.id);
        }

        rawCombos.push({
          clothing_ids: ids,
          items,
          score: scoreOutfit(items),
        });
      }
    }

    // ========== 7. 按评分排序，返回前10组 ==========
    rawCombos.sort((a, b) => b.score - a.score);

    // 去重（避免相同的衣物组合）
    const seen = new Set();
    const recommendations = [];
    for (const combo of rawCombos) {
      const key = [...combo.clothing_ids].sort().join(',');
      if (seen.has(key)) continue;
      seen.add(key);
      recommendations.push(combo);
      if (recommendations.length >= 10) break;
    }

    return recommendations;
  },
}));

export default useOutfitStore;
