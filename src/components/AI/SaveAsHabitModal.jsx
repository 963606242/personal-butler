import React, { useEffect } from 'react';
import { Modal, Form, Input, Select, TimePicker, message } from 'antd';
import dayjs from 'dayjs';
import useHabitStore from '../../stores/habitStore';
import { PERIOD_OPTIONS, FREQUENCY_OPTIONS } from '../../constants/habits';
import { getLogger } from '../../services/logger-client';

const logger = getLogger();
const FREQ_LABELS = { daily: '每天', weekdays: '工作日', weekends: '周末', weekly: '每周' };

export default function SaveAsHabitModal({ open, initialName, onSuccess, onCancel }) {
  const [form] = Form.useForm();
  const createHabit = useHabitStore((s) => s.createHabit);

  useEffect(() => {
    if (open) {
      form.setFieldsValue({
        name: initialName || 'AI 建议习惯',
        period: 'morning',
        frequency: 'daily',
        reminder_time: null,
      });
    }
  }, [open, initialName, form]);

  const handleOk = async () => {
    try {
      const v = await form.validateFields();
      await createHabit({
        name: v.name,
        period: v.period || 'morning',
        frequency: v.frequency || 'daily',
        reminder_time: v.reminder_time ? v.reminder_time.format('HH:mm') : null,
        target_days: v.frequency === 'weekly' && v.target_days?.length ? v.target_days : undefined,
      });
      form.resetFields();
      onSuccess?.();
    } catch (e) {
      if (e?.errorFields) return;
      logger.error('SaveAsHabitModal', '保存失败', e);
      message.error(e?.message || '保存失败');
      throw e;
    }
  };

  return (
    <Modal
      title="保存为习惯"
      open={open}
      onCancel={onCancel}
      onOk={handleOk}
      okText="保存"
      cancelText="取消"
      destroyOnHidden={false}
    >
      <Form form={form} layout="vertical">
        <Form.Item name="name" label="习惯名称" rules={[{ required: true, message: '请输入习惯名称' }]}>
          <Input placeholder="如：早晨起床喝水、晨间运动" />
        </Form.Item>
        <Form.Item name="period" label="时段" rules={[{ required: true }]}>
          <Select
            options={PERIOD_OPTIONS.map((p) => ({ value: p.value, label: `${p.label}（${p.hint}）` }))}
          />
        </Form.Item>
        <Form.Item name="frequency" label="频率">
          <Select options={FREQUENCY_OPTIONS.map((f) => ({ value: f, label: FREQ_LABELS[f] }))} />
        </Form.Item>
        <Form.Item noStyle shouldUpdate={(prev, curr) => prev.frequency !== curr.frequency}>
          {({ getFieldValue }) =>
            getFieldValue('frequency') === 'weekly' ? (
              <Form.Item name="target_days" label="选择星期" rules={[{ required: true, message: '请至少选择一天' }]}>
                <Select
                  mode="multiple"
                  placeholder="选择要打卡的星期"
                  options={[0, 1, 2, 3, 4, 5, 6].map((d) => ({
                    value: d,
                    label: ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][d],
                  }))}
                />
              </Form.Item>
            ) : null
          }
        </Form.Item>
        <Form.Item name="reminder_time" label="提醒时间">
          <TimePicker format="HH:mm" placeholder="可选" style={{ width: '100%' }} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
