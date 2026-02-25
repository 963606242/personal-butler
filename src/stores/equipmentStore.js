/**
 * 装备管理 Store
 * 装备 CRUD、分类、搜索、图片管理
 */
import { create } from 'zustand';
import { getDatabase } from '../services/database';
import { getCryptoService } from '../services/crypto';
import { getLogger } from '../services/logger-client';
import useUserStore from './userStore';
import dayjs from 'dayjs';

const logger = getLogger();

/** 装备类别 */
export const EQUIPMENT_CATEGORIES = [
  { value: 'electronics', label: '电子设备', icon: '💻' },
  { value: 'sports', label: '运动装备', icon: '⚽' },
  { value: 'tools', label: '工具', icon: '🔧' },
  { value: 'appliances', label: '家电', icon: '🏠' },
  { value: 'other', label: '其他', icon: '📦' },
];

/** 装备状态 */
export const EQUIPMENT_STATUS = [
  { value: 'normal', label: '正常使用', color: 'success' },
  { value: 'maintenance', label: '维修中', color: 'warning' },
  { value: 'idle', label: '闲置', color: 'default' },
  { value: 'broken', label: '已损坏', color: 'error' },
];

const useEquipmentStore = create((set, get) => ({
  equipment: [],
  loading: false,

  async loadEquipment() {
    try {
      set({ loading: true });
      const db = await getDatabase();
      const { currentUser } = useUserStore.getState();
      if (!currentUser) {
        set({ equipment: [], loading: false });
        return [];
      }
      const rows = await db.query(
        'SELECT * FROM equipment WHERE user_id = ? ORDER BY created_at DESC',
        [currentUser.id]
      );
      set({ equipment: rows, loading: false });
      logger.log('EquipmentStore', `加载 ${rows.length} 件装备`);
      return rows;
    } catch (e) {
      logger.error('EquipmentStore', '加载装备失败', e);
      set({ equipment: [], loading: false });
      throw e;
    }
  },

  async createEquipment(data) {
    const db = await getDatabase();
    const { currentUser } = useUserStore.getState();
    if (!currentUser) throw new Error('用户未登录');
    const id = getCryptoService().generateUUID();
    const now = Date.now();
    await db.execute(
      `INSERT INTO equipment (id, user_id, name, category, brand, model, purchase_date, price, status, image_path, notes, maintenance_interval, last_maintained, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        currentUser.id,
        data.name || '',
        data.category || 'other',
        data.brand || null,
        data.model || null,
        data.purchase_date ? dayjs(data.purchase_date).valueOf() : null,
        data.price || null,
        data.status || 'normal',
        data.image_path || null,
        data.notes || null,
        data.maintenance_interval || null,
        data.last_maintained ? dayjs(data.last_maintained).valueOf() : null,
        now,
        now,
      ]
    );
    await get().loadEquipment();
    return id;
  },

  async updateEquipment(id, data) {
    const db = await getDatabase();
    const { currentUser } = useUserStore.getState();
    if (!currentUser) throw new Error('用户未登录');
    const now = Date.now();
    await db.execute(
      `UPDATE equipment SET name = ?, category = ?, brand = ?, model = ?, purchase_date = ?, price = ?, status = ?, image_path = ?, notes = ?, maintenance_interval = ?, last_maintained = ?, updated_at = ?
       WHERE id = ? AND user_id = ?`,
      [
        data.name ?? '',
        data.category ?? 'other',
        data.brand ?? null,
        data.model ?? null,
        data.purchase_date ? dayjs(data.purchase_date).valueOf() : null,
        data.price ?? null,
        data.status ?? 'normal',
        data.image_path ?? null,
        data.notes ?? null,
        data.maintenance_interval ?? null,
        data.last_maintained ? dayjs(data.last_maintained).valueOf() : null,
        now,
        id,
        currentUser.id,
      ]
    );
    await get().loadEquipment();
  },

  async markMaintained(id) {
    const db = await getDatabase();
    const { currentUser } = useUserStore.getState();
    if (!currentUser) throw new Error('用户未登录');
    const now = Date.now();
    await db.execute(
      'UPDATE equipment SET last_maintained = ?, updated_at = ? WHERE id = ? AND user_id = ?',
      [now, now, id, currentUser.id]
    );
    await get().loadEquipment();
  },

  getMaintenanceDueItems() {
    const now = Date.now();
    const DAY_MS = 24 * 60 * 60 * 1000;
    return get().equipment.filter((item) => {
      if (!item.maintenance_interval || item.maintenance_interval <= 0) return false;
      if (item.status === 'broken') return false;
      const lastTime = item.last_maintained || item.created_at || 0;
      const nextDue = lastTime + item.maintenance_interval * DAY_MS;
      return now >= nextDue;
    });
  },

  async deleteEquipment(id) {
    const db = await getDatabase();
    const { currentUser } = useUserStore.getState();
    if (!currentUser) throw new Error('用户未登录');
    await db.execute('DELETE FROM equipment WHERE id = ? AND user_id = ?', [id, currentUser.id]);
    await get().loadEquipment();
  },
}));

export default useEquipmentStore;
