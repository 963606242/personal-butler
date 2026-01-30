import React, { useState, useEffect } from 'react';
import {
  Card,
  Button,
  Space,
  Typography,
  Table,
  Tag,
  Segmented,
  Popconfirm,
  Spin,
  Form,
  message,
} from 'antd';
import FriendlyEmpty from '../components/FriendlyEmpty';
import { PlusOutlined, EditOutlined, DeleteOutlined, GiftOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import useCountdownStore, {
  COUNTDOWN_TYPES,
  REMINDER_DAYS_OPTIONS,
} from '../stores/countdownStore';
import useUserStore from '../stores/userStore';
import { getLogger } from '../services/logger-client';
import CountdownFormModal from '../components/Countdown/CountdownFormModal';
import { useI18n } from '../context/I18nContext';

const { Title, Text } = Typography;
const logger = getLogger();

const TYPE_KEY_MAP = { anniversary: 'typeAnniversary', countdown: 'typeCountdown', birthday_holiday: 'typeBirthdayHoliday' };
const REMINDER_KEY_MAP = { 0: 'reminder0', 1: 'reminder1', 3: 'reminder3', 7: 'reminder7', 30: 'reminder30' };

function Countdown() {
  const [form] = Form.useForm();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [typeFilter, setTypeFilter] = useState('all');
  const { t } = useI18n();

  const { currentUser, isInitialized } = useUserStore();
  const {
    events,
    loading,
    loadEvents,
    createEvent,
    updateEvent,
    deleteEvent,
    getEventsByType,
    daysUntil,
    formatRepeatLabel,
  } = useCountdownStore();

  useEffect(() => {
    if (!isInitialized || !currentUser) return;
    loadEvents().catch((e) => {
      logger.error('Countdown', '加载失败', e);
    });
  }, [isInitialized, currentUser, loadEvents]);

  const filtered = typeFilter === 'all' ? events : getEventsByType(typeFilter);

  const handleCreate = () => {
    setEditing(null);
    form.resetFields();
    setModalOpen(true);
  };

  const handleEdit = (record) => {
    setEditing(record);
    setModalOpen(true);
  };

  const handleSubmit = async (payload) => {
    try {
      if (editing) {
        await updateEvent(editing.id, payload);
        message.success(t('countdown.updated'));
      } else {
        await createEvent(payload);
        message.success(t('countdown.created'));
      }
      setModalOpen(false);
      setEditing(null);
    } catch (e) {
      logger.error('Countdown', '保存失败', e);
      message.error(e?.message || t('countdown.saveFailed'));
      throw e;
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteEvent(id);
      message.success(t('countdown.deleted'));
    } catch (e) {
      logger.error('Countdown', '删除失败', e);
      message.error(t('countdown.deleteFailed'));
    }
  };

  const columns = [
    {
      title: t('countdown.colTitle'),
      dataIndex: 'title',
      key: 'title',
      render: (val) => (
        <Space>
          <GiftOutlined style={{ color: '#fa8c16' }} />
          <span>{val}</span>
        </Space>
      ),
    },
    {
      title: t('countdown.colType'),
      dataIndex: 'type',
      key: 'type',
      width: 110,
      render: (typeVal) => <Tag>{TYPE_KEY_MAP[typeVal] ? t('countdown.' + TYPE_KEY_MAP[typeVal]) : typeVal}</Tag>,
    },
    {
      title: t('countdown.colTargetDate'),
      dataIndex: 'target_date',
      key: 'target_date',
      width: 140,
      render: (ts, r) => {
        const label = formatRepeatLabel(r);
        const dateStr = label && (r.repeat_unit === 'year' || r.is_annual)
          ? dayjs(ts).format('MM-DD')
          : dayjs(ts).format('YYYY-MM-DD');
        return label ? `${dateStr}（${label}）` : dateStr;
      },
    },
    {
      title: t('countdown.colCountdown'),
      key: 'days',
      width: 100,
      render: (_, r) => {
        const d = daysUntil(r);
        if (d < 0) return <Text type="secondary">{t('countdown.past')}</Text>;
        if (d === 0) return <Tag color="green">{t('countdown.today')}</Tag>;
        return <Text>{t('countdown.daysLeft', undefined, { n: d })}</Text>;
      },
    },
    {
      title: t('countdown.colReminder'),
      dataIndex: 'reminder_days_before',
      key: 'reminder',
      width: 90,
      render: (n) => (REMINDER_KEY_MAP[n] != null ? t('countdown.' + REMINDER_KEY_MAP[n]) : t('countdown.sameDay')),
    },
    {
      title: t('countdown.colAction'),
      key: 'action',
      width: 120,
      render: (_, r) => (
        <Space>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(r)}>
            {t('countdown.edit')}
          </Button>
          <Popconfirm
            title={t('countdown.deleteConfirm')}
            onConfirm={() => handleDelete(r.id)}
            okText={t('countdown.delete')}
            cancelText={t('countdown.cancel')}
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              {t('countdown.delete')}
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  if (!isInitialized) {
    return (
      <Card>
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Spin size="large" />
          <div style={{ marginTop: 16, color: '#8c8c8c' }}>{t('countdown.loading')}</div>
        </div>
      </Card>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={2} style={{ margin: 0 }}>
          <GiftOutlined /> {t('countdown.title')}
        </Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
          {t('countdown.new')}
        </Button>
      </div>

      <Card>
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <div>
            <Text type="secondary" style={{ marginRight: 8 }}>类别：</Text>
            <Segmented
              options={[
                { value: 'all', label: '全部' },
                ...COUNTDOWN_TYPES.map((t) => ({ value: t.value, label: t.label })),
              ]}
              value={typeFilter}
              onChange={setTypeFilter}
            />
          </div>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <Spin />
            </div>
          ) : filtered.length === 0 ? (
            <FriendlyEmpty context="countdown" onAction={handleCreate} />
          ) : (
            <Table
              rowKey="id"
              columns={columns}
              dataSource={filtered}
              pagination={false}
              size="small"
            />
          )}
        </Space>
      </Card>

      <CountdownFormModal
        open={modalOpen}
        editing={editing}
        form={form}
        onCancel={() => {
          setModalOpen(false);
          setEditing(null);
        }}
        onOk={handleSubmit}
      />
    </div>
  );
}

export default Countdown;
