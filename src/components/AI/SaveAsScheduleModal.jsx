import React, { useEffect } from 'react';
import { Modal, Form, Input, DatePicker, TimePicker, message } from 'antd';
import dayjs from 'dayjs';
import useScheduleStore from '../../stores/scheduleStore';
import { getLogger } from '../../services/logger-client';

const { TextArea } = Input;
const logger = getLogger();

export default function SaveAsScheduleModal({ open, initialTitle, initialNotes, onSuccess, onCancel }) {
  const [form] = Form.useForm();
  const createSchedule = useScheduleStore((s) => s.createSchedule);

  useEffect(() => {
    if (open) {
      form.setFieldsValue({
        title: initialTitle || 'AI 建议日程',
        date: dayjs(),
        startTime: dayjs().hour(9).minute(0).second(0).millisecond(0),
        endTime: dayjs().hour(9).minute(30).second(0).millisecond(0),
        notes: initialNotes || '',
      });
    }
  }, [open, initialTitle, initialNotes, form]);

  const handleOk = async () => {
    try {
      const v = await form.validateFields();
      const d = v.date || dayjs();
      const start = v.startTime
        ? d.hour(v.startTime.hour()).minute(v.startTime.minute()).second(0).millisecond(0).toDate()
        : null;
      const end = v.endTime
        ? d.hour(v.endTime.hour()).minute(v.endTime.minute()).second(0).millisecond(0).toDate()
        : null;
      await createSchedule({
        title: v.title,
        date: d.toDate(),
        startTime: start,
        endTime: end,
        notes: v.notes || null,
      });
      form.resetFields();
      onSuccess?.();
    } catch (e) {
      if (e?.errorFields) return;
      logger.error('SaveAsScheduleModal', '保存失败', e);
      message.error(e?.message || '保存失败');
      throw e;
    }
  };

  return (
    <Modal
      title="保存为日程"
      open={open}
      onCancel={onCancel}
      onOk={handleOk}
      okText="保存"
      cancelText="取消"
      destroyOnHidden={false}
    >
      <Form form={form} layout="vertical">
        <Form.Item name="title" label="标题" rules={[{ required: true, message: '请输入标题' }]}>
          <Input placeholder="如：晨间运动、午餐" />
        </Form.Item>
        <Form.Item name="date" label="日期" rules={[{ required: true }]}>
          <DatePicker style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="startTime" label="开始时间">
          <TimePicker format="HH:mm" style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="endTime" label="结束时间">
          <TimePicker format="HH:mm" style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="notes" label="备注">
          <TextArea rows={4} placeholder="可粘贴 AI 建议全文" />
        </Form.Item>
      </Form>
    </Modal>
  );
}
