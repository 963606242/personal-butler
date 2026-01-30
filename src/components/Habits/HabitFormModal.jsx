/**
 * 习惯新建/编辑表单弹窗
 * 支持时段、提醒时间、频率、示例预设
 */
import React from 'react';
import { Modal, Form, Input, Select, TimePicker } from 'antd';
import dayjs from 'dayjs';
import { PERIOD_OPTIONS, FREQUENCY_OPTIONS, WEEKDAY_OPTIONS } from '../../constants/habits';

const FREQ_LABELS = { daily: '每天', weekdays: '工作日', weekends: '周末', weekly: '每周' };

/** 示例预设：名称、时段、建议提醒时间、频率 */
const PRESETS = [
  { name: '早晨起床喝水', period: 'dawn', reminder: '07:00', frequency: 'daily' },
  { name: '晨间运动/拉伸', period: 'dawn', reminder: '07:30', frequency: 'daily' },
  { name: '上午定时喝水', period: 'morning', reminder: '10:00', frequency: 'weekdays' },
  { name: '中午就餐记录', period: 'noon', reminder: '12:00', frequency: 'daily' },
  { name: '饭后站立/散步', period: 'noon', reminder: '12:30', frequency: 'weekdays' },
  { name: '下午定时活动防久坐', period: 'afternoon', reminder: '15:00', frequency: 'weekdays' },
  { name: '傍晚运动', period: 'dusk', reminder: '18:30', frequency: 'daily' },
  { name: '晚上记录晚餐', period: 'evening', reminder: '19:00', frequency: 'daily' },
  { name: '晚上定点上床避免熬夜', period: 'night', reminder: '22:30', frequency: 'daily' },
  { name: '睡前准备/复盘', period: 'night', reminder: '23:00', frequency: 'daily' },
];

function HabitFormModal({ open, editing, onCancel, onOk, form }) {
  const handlePreset = (p) => {
    form.setFieldsValue({
      name: p.name,
      period: p.period,
      reminder_time: p.reminder ? dayjs(p.reminder, 'HH:mm') : null,
      frequency: p.frequency || 'daily',
    });
  };

  return (
    <Modal
      title={editing ? '编辑习惯' : '新建习惯'}
      open={open}
      onCancel={onCancel}
      onOk={() => form.submit()}
      okText="保存"
      cancelText="取消"
      width={560}
    >
      {!editing && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: '#8c8c8c', marginBottom: 6 }}>快速填写（可修改）</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {PRESETS.map((p) => (
              <span
                key={p.name + p.period}
                onClick={() => handlePreset(p)}
                style={{
                  padding: '4px 10px',
                  borderRadius: 4,
                  background: '#f5f5f5',
                  cursor: 'pointer',
                  fontSize: 12,
                }}
              >
                {p.name}
              </span>
            ))}
          </div>
        </div>
      )}
      <Form form={form} layout="vertical" onFinish={onOk}>
        <Form.Item name="name" label="习惯名称" rules={[{ required: true, message: '请输入习惯名称' }]}>
          <Input placeholder="如：早晨起床喝水、中午就餐记录" />
        </Form.Item>
        <Form.Item name="period" label="时段" rules={[{ required: true, message: '请选择时段' }]}>
          <Select
            placeholder="选择习惯所属时段"
            options={PERIOD_OPTIONS.map((p) => ({
              value: p.value,
              label: `${p.label}（${p.hint}）`,
            }))}
          />
        </Form.Item>
        <Form.Item name="frequency" label="频率">
          <Select
            placeholder="选择频率"
            options={FREQUENCY_OPTIONS.map((f) => ({ value: f, label: FREQ_LABELS[f] }))}
          />
        </Form.Item>
        <Form.Item noStyle shouldUpdate={(p, c) => p.frequency !== c.frequency}>
          {({ getFieldValue }) =>
            getFieldValue('frequency') === 'weekly' ? (
              <Form.Item name="target_days" label="选择星期" rules={[{ required: true, message: '请至少选择一天' }]}>
                <Select mode="multiple" placeholder="选择要打卡的星期" options={WEEKDAY_OPTIONS} />
              </Form.Item>
            ) : null
          }
        </Form.Item>
        <Form.Item name="reminder_time" label="提醒时间">
          <TimePicker format="HH:mm" placeholder="可选，到点提醒" style={{ width: '100%' }} />
        </Form.Item>
      </Form>
    </Modal>
  );
}

export default HabitFormModal;
