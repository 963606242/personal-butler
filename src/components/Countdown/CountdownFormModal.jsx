import React, { useEffect } from 'react';
import { Modal, Form, Input, Select, DatePicker, InputNumber, Space } from 'antd';
import dayjs from 'dayjs';
import { COUNTDOWN_TYPES, REMINDER_DAYS_OPTIONS, REPEAT_UNIT_OPTIONS } from '../../stores/countdownStore';

export default function CountdownFormModal({ open, editing, onCancel, onOk, form }) {
  useEffect(() => {
    if (!open) return;
    if (editing) {
      const ri = parseInt(editing.repeat_interval, 10) || 0;
      const legacyAnnual = !ri && editing.is_annual;
      const enabled = ri > 0 || legacyAnnual;
      form.setFieldsValue({
        type: editing.type,
        title: editing.title,
        target_date: dayjs(editing.target_date),
        repeat_enabled: enabled ? 1 : 0,
        repeat_interval: enabled ? (ri || 1) : 1,
        repeat_unit: (enabled && (editing.repeat_unit || (legacyAnnual ? 'year' : null))) || 'year',
        reminder_days_before: editing.reminder_days_before ?? 0,
        notes: editing.notes || '',
      });
    } else {
      form.resetFields();
      form.setFieldsValue({
        type: 'countdown',
        repeat_enabled: 0,
        repeat_interval: 1,
        repeat_unit: 'year',
        reminder_days_before: 0,
      });
    }
  }, [open, editing, form]);

  return (
    <Modal
      title={editing ? '编辑' : '新建'}
      open={open}
      onCancel={onCancel}
      onOk={() => form.submit()}
      okText="保存"
      cancelText="取消"
      destroyOnHidden={false}
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={(v) => {
          const repeatEnabled = !!v.repeat_enabled;
          const ri = repeatEnabled ? Math.max(1, parseInt(v.repeat_interval, 10) || 1) : 0;
          const ru = repeatEnabled ? v.repeat_unit : null;
          const payload = {
            type: v.type,
            title: v.title,
            target_date: v.target_date?.startOf('day').toDate(),
            is_annual: ri === 1 && ru === 'year',
            repeat_interval: ri,
            repeat_unit: ru,
            reminder_days_before: v.reminder_days_before ?? 0,
            notes: v.notes || null,
          };
          onOk(payload);
        }}
      >
        <Form.Item name="type" label="类别" rules={[{ required: true }]}>
          <Select
            options={COUNTDOWN_TYPES.map((t) => ({ value: t.value, label: t.label }))}
          />
        </Form.Item>
        <Form.Item name="title" label="标题" rules={[{ required: true, message: '请输入标题' }]}>
          <Input placeholder="请输入标题" />
        </Form.Item>
        <Form.Item name="target_date" label="目标日期" rules={[{ required: true, message: '请选择日期' }]}>
          <DatePicker style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="repeat_enabled" label="重复">
          <Select
            options={[
              { value: 0, label: '不重复' },
              { value: 1, label: '重复' },
            ]}
          />
        </Form.Item>
        <Form.Item noStyle shouldUpdate={(prev, curr) => prev.repeat_enabled !== curr.repeat_enabled}>
          {({ getFieldValue }) =>
            getFieldValue('repeat_enabled') ? (
              <Space align="baseline" size="middle">
                <Form.Item name="repeat_interval" label="间隔" rules={[{ required: true }]} style={{ marginBottom: 0 }}>
                  <InputNumber min={1} max={999} placeholder="N" style={{ width: 72 }} />
                </Form.Item>
                <Form.Item name="repeat_unit" label=" " rules={[{ required: true }]} style={{ marginBottom: 0 }}>
                  <Select
                    options={REPEAT_UNIT_OPTIONS.map((u) => ({ value: u.value, label: u.label }))}
                    style={{ width: 80 }}
                  />
                </Form.Item>
                <span style={{ color: 'rgba(0,0,0,0.45)', fontSize: 12 }}>重复</span>
              </Space>
            ) : null
          }
        </Form.Item>
        <Form.Item name="reminder_days_before" label="提前几天提醒">
          <Select
            options={REMINDER_DAYS_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
          />
        </Form.Item>
        <Form.Item name="notes" label="备注">
          <Input.TextArea rows={2} placeholder="选填" />
        </Form.Item>
      </Form>
    </Modal>
  );
}
