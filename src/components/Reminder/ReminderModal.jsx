/**
 * 日程提醒弹窗组件
 * 展示待处理提醒队列，支持「知道了」「查看日程」
 */
import React, { useEffect } from 'react';
import { Modal, Typography, Button, Space } from 'antd';
import { ClockCircleOutlined, EnvironmentOutlined, CalendarOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import useReminderStore from '../../stores/reminderStore';

const { Text } = Typography;

function ReminderModal() {
  const navigate = useNavigate();
  const { queue, dismissReminder, getCurrent } = useReminderStore();
  const current = getCurrent();

  useEffect(() => {
    if (!current || typeof document === 'undefined') return;
    try {
      const prev = document.title;
      document.title = `⏰ 日程提醒：${current.title}`;
      const t = setTimeout(() => {
        document.title = prev || 'Personal Butler';
      }, 4000);
      return () => clearTimeout(t);
    } catch (_) {}
  }, [current?.id]);

  if (!current) return null;

  const handleOk = () => {
    dismissReminder(current.id);
  };

  const handleGoSchedule = () => {
    dismissReminder(current.id);
    navigate('/schedule');
  };

  return (
    <Modal
      title={
        <Space>
          <ClockCircleOutlined style={{ color: '#1890ff' }} />
          <span>日程提醒</span>
        </Space>
      }
      open={true}
      onCancel={handleOk}
      footer={
        <Space>
          <Button onClick={handleOk}>知道了</Button>
          <Button type="primary" icon={<CalendarOutlined />} onClick={handleGoSchedule}>
            查看日程
          </Button>
        </Space>
      }
      width={420}
      maskClosable={false}
      centered
      closable={true}
    >
      <div style={{ padding: '8px 0' }}>
        <Typography.Title level={5} style={{ marginTop: 0, marginBottom: 12 }}>
          {current.title}
        </Typography.Title>
        <div style={{ marginBottom: 8 }}>
          <ClockCircleOutlined style={{ marginRight: 8, color: '#8c8c8c' }} />
          <Text type="secondary">开始时间：</Text>
          <Text strong>{current.timeStr}</Text>
        </div>
        {current.location && (
          <div style={{ marginBottom: 8 }}>
            <EnvironmentOutlined style={{ marginRight: 8, color: '#8c8c8c' }} />
            <Text type="secondary">地点：</Text>
            <Text>{current.location}</Text>
          </div>
        )}
        {queue.length > 1 && (
          <Text type="secondary" style={{ fontSize: 12 }}>
            还有 {queue.length - 1} 条待处理提醒
          </Text>
        )}
      </div>
    </Modal>
  );
}

export default ReminderModal;
