import React, { useState, useEffect } from 'react';
import {
  Modal,
  Button,
  Space,
  Checkbox,
  Input,
  Select,
  TimePicker,
  message,
  Typography,
} from 'antd';
import dayjs from 'dayjs';
import useHabitStore from '../../stores/habitStore';
import { PERIOD_OPTIONS, FREQUENCY_OPTIONS } from '../../constants/habits';
import { getLogger } from '../../services/logger-client';

const { Text } = Typography;
const logger = getLogger();
const FREQ_LABELS = { daily: '每天', weekdays: '工作日', weekends: '周末', weekly: '每周' };
const VALID_PERIODS = new Set(PERIOD_OPTIONS.map((p) => p.value));

function normalizeItem(it) {
  const period = VALID_PERIODS.has(it.period) ? it.period : 'morning';
  return {
    name: (it.name != null ? String(it.name) : '').trim() || '未命名',
    period,
    frequency: it.frequency || 'daily',
    reminder_time: it.reminder_time || null,
  };
}

export default function BatchSaveHabitModal({ open, items: rawItems, onSuccess, onCancel }) {
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [saving, setSaving] = useState(false);
  const createHabit = useHabitStore((s) => s.createHabit);

  useEffect(() => {
    if (open && Array.isArray(rawItems) && rawItems.length > 0) {
      const normalized = rawItems.map(normalizeItem);
      setItems(normalized);
      setSelected(new Set(normalized.map((_, i) => i)));
    }
  }, [open, rawItems]);

  const toggle = (i) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === items.length) setSelected(new Set());
    else setSelected(new Set(items.map((_, i) => i)));
  };

  const updateItem = (i, field, value) => {
    setItems((prev) => {
      const next = [...prev];
      next[i] = { ...next[i], [field]: value };
      return next;
    });
  };

  const handleSave = async () => {
    const indices = [...selected].sort((a, b) => a - b);
    if (indices.length === 0) {
      message.warning('请至少勾选一项');
      return;
    }
    setSaving(true);
    try {
      for (const i of indices) {
        const it = items[i];
        await createHabit({
          name: it.name,
          period: it.period || 'morning',
          frequency: it.frequency || 'daily',
          reminder_time:
            it.reminder_time != null && it.reminder_time !== ''
              ? (typeof it.reminder_time === 'string'
                  ? it.reminder_time
                  : dayjs(it.reminder_time).format('HH:mm'))
              : null,
        });
      }
      message.success(`已保存 ${indices.length} 个习惯`);
      onSuccess?.();
    } catch (e) {
      logger.error('BatchSaveHabitModal', '保存失败', e);
      message.error(e?.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title="批量保存为习惯"
      open={open}
      onCancel={onCancel}
      footer={null}
      width={600}
      destroyOnHidden
    >
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        <Text type="secondary">
          以下由 AI 解析得到，请勾选要保存的项，可修改后确认。共 {items.length} 个。
        </Text>
        <Button size="small" onClick={toggleAll}>
          {selected.size === items.length ? '取消全选' : '全选'}
        </Button>
        <div style={{ maxHeight: 400, overflow: 'auto', border: '1px solid #d9d9d9', borderRadius: 8, padding: 12 }}>
          {items.map((it, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 0',
                borderBottom: i < items.length - 1 ? '1px solid #f0f0f0' : 'none',
              }}
            >
              <Checkbox checked={selected.has(i)} onChange={() => toggle(i)} />
              <Input
                value={it.name}
                onChange={(e) => updateItem(i, 'name', e.target.value)}
                placeholder="习惯名称"
                size="small"
                style={{ width: 140 }}
              />
              <Select
                value={it.period}
                onChange={(v) => updateItem(i, 'period', v)}
                options={PERIOD_OPTIONS.map((p) => ({ value: p.value, label: p.label }))}
                size="small"
                style={{ width: 90 }}
              />
              <Select
                value={it.frequency}
                onChange={(v) => updateItem(i, 'frequency', v)}
                options={FREQUENCY_OPTIONS.map((f) => ({ value: f, label: FREQ_LABELS[f] }))}
                size="small"
                style={{ width: 90 }}
              />
              <TimePicker
                value={
                  it.reminder_time
                    ? (typeof it.reminder_time === 'string'
                        ? dayjs(it.reminder_time, 'HH:mm')
                        : dayjs(it.reminder_time))
                    : null
                }
                onChange={(d) => updateItem(i, 'reminder_time', d ? d.format('HH:mm') : null)}
                format="HH:mm"
                size="small"
                placeholder="提醒"
                style={{ width: 80 }}
              />
            </div>
          ))}
        </div>
        <Space>
          <Button type="primary" loading={saving} onClick={handleSave}>
            保存选中的 {selected.size} 个
          </Button>
          <Button onClick={onCancel}>取消</Button>
        </Space>
      </Space>
    </Modal>
  );
}
