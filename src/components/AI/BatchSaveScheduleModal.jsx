import React, { useState, useEffect } from 'react';
import {
  Modal,
  Button,
  Space,
  Checkbox,
  Input,
  TimePicker,
  DatePicker,
  message,
  Typography,
} from 'antd';
import dayjs from 'dayjs';
import useScheduleStore from '../../stores/scheduleStore';
import { getLogger } from '../../services/logger-client';

const { TextArea } = Input;
const { Text } = Typography;
const logger = getLogger();

function normalizeItem(it) {
  return {
    title: (it.title != null ? String(it.title) : '').trim() || '未命名',
    startTime: it.startTime || '09:00',
    endTime: it.endTime || '09:30',
    notes: (it.notes != null ? String(it.notes) : '').trim() || null,
  };
}

export default function BatchSaveScheduleModal({
  open,
  items: rawItems,
  defaultDate,
  onSuccess,
  onCancel,
}) {
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [baseDate, setBaseDate] = useState(dayjs());
  const [saving, setSaving] = useState(false);
  const createSchedule = useScheduleStore((s) => s.createSchedule);

  useEffect(() => {
    if (open && Array.isArray(rawItems) && rawItems.length > 0) {
      const normalized = rawItems.map(normalizeItem);
      setItems(normalized);
      setSelected(new Set(normalized.map((_, i) => i)));
      setBaseDate(defaultDate ? dayjs(defaultDate) : dayjs());
    }
  }, [open, rawItems, defaultDate]);

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
      const d = baseDate;
      for (const i of indices) {
        const it = items[i];
        const [sh, sm] = (it.startTime || '09:00').split(':').map(Number);
        const [eh, em] = (it.endTime || '09:30').split(':').map(Number);
        const start = d.hour(sh).minute(sm || 0).second(0).millisecond(0).toDate();
        const end = d.hour(eh).minute(em || 0).second(0).millisecond(0).toDate();
        await createSchedule({
          title: it.title,
          date: d.toDate(),
          startTime: start,
          endTime: end,
          notes: it.notes || null,
        });
      }
      message.success(`已保存 ${indices.length} 条日程`);
      onSuccess?.();
    } catch (e) {
      logger.error('BatchSaveScheduleModal', '保存失败', e);
      message.error(e?.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title="批量保存为日程"
      open={open}
      onCancel={onCancel}
      footer={null}
      width={640}
      destroyOnHidden
    >
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        <Text type="secondary">
          以下由 AI 解析得到，请勾选要保存的项，可修改后确认。共 {items.length} 条。
        </Text>
        <Space>
          <DatePicker value={baseDate} onChange={(d) => setBaseDate(d || dayjs())} />
          <Button size="small" onClick={toggleAll}>
            {selected.size === items.length ? '取消全选' : '全选'}
          </Button>
        </Space>
        <div style={{ maxHeight: 360, overflow: 'auto', border: '1px solid #d9d9d9', borderRadius: 8, padding: 12 }}>
          {items.map((it, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 8,
                padding: '8px 0',
                borderBottom: i < items.length - 1 ? '1px solid #f0f0f0' : 'none',
              }}
            >
              <Checkbox
                checked={selected.has(i)}
                onChange={() => toggle(i)}
                style={{ marginTop: 6 }}
              />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <Input
                  value={it.title}
                  onChange={(e) => updateItem(i, 'title', e.target.value)}
                  placeholder="标题"
                  size="small"
                />
                <Space size="small">
                  <TimePicker
                    value={
                      it.startTime
                        ? (() => {
                            const [h, m] = (it.startTime || '09:00').split(':').map(Number);
                            return dayjs().hour(h || 9).minute(m || 0).second(0).millisecond(0);
                          })()
                        : null
                    }
                    onChange={(d) => updateItem(i, 'startTime', d ? d.format('HH:mm') : '09:00')}
                    format="HH:mm"
                    size="small"
                    placeholder="开始"
                  />
                  <span style={{ color: '#999' }}>—</span>
                  <TimePicker
                    value={
                      it.endTime
                        ? (() => {
                            const [h, m] = (it.endTime || '09:30').split(':').map(Number);
                            return dayjs().hour(h || 9).minute(m || 30).second(0).millisecond(0);
                          })()
                        : null
                    }
                    onChange={(d) => updateItem(i, 'endTime', d ? d.format('HH:mm') : '09:30')}
                    format="HH:mm"
                    size="small"
                    placeholder="结束"
                  />
                </Space>
                <TextArea
                  value={it.notes || ''}
                  onChange={(e) => updateItem(i, 'notes', e.target.value)}
                  placeholder="备注（可选）"
                  rows={2}
                  size="small"
                />
              </div>
            </div>
          ))}
        </div>
        <Space>
          <Button type="primary" loading={saving} onClick={handleSave}>
            保存选中的 {selected.size} 条
          </Button>
          <Button onClick={onCancel}>取消</Button>
        </Space>
      </Space>
    </Modal>
  );
}
