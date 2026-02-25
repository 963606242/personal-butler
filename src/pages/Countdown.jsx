import React, { useState, useEffect, useMemo } from 'react';
import {
  Card,
  Button,
  Space,
  Typography,
  Segmented,
  Popconfirm,
  Spin,
  Form,
  Tooltip,
  message,
} from 'antd';
import FriendlyEmpty from '../components/FriendlyEmpty';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  GiftOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  HeartOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
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

const TYPE_ICONS = {
  anniversary: <HeartOutlined />,
  countdown: <ClockCircleOutlined />,
  birthday_holiday: <GiftOutlined />,
};

const TYPE_CLASS_MAP = {
  anniversary: 'anniversary',
  countdown: 'countdown',
  birthday_holiday: 'birthday',
};

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

  // Compute stats
  const stats = useMemo(() => {
    const total = events.length;
    let upcoming = 0;
    let todayCount = 0;
    let pastCount = 0;
    events.forEach((e) => {
      const d = daysUntil(e);
      if (d === 0) todayCount++;
      else if (d > 0) upcoming++;
      else pastCount++;
    });
    return { total, upcoming, todayCount, pastCount };
  }, [events, daysUntil]);

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

  const getTypeClass = (type) => TYPE_CLASS_MAP[type] || 'countdown';

  const renderCountdownCard = (record) => {
    const d = daysUntil(record);
    const typeClass = getTypeClass(record.type);
    const repeatLabel = formatRepeatLabel(record);
    const dateStr = repeatLabel && (record.repeat_unit === 'year' || record.is_annual)
      ? dayjs(record.target_date).format('MM-DD')
      : dayjs(record.target_date).format('YYYY-MM-DD');

    const isToday = d === 0;
    const isPast = d < 0;

    let daysCircleClass = `countdown-days-circle countdown-days-circle-${typeClass}`;
    if (isToday) daysCircleClass += ' countdown-days-today';
    if (isPast) daysCircleClass += ' countdown-days-past';

    return (
      <Card
        key={record.id}
        className={`countdown-card countdown-card-${typeClass}`}
        size="small"
        styles={{ body: { padding: '16px 20px' } }}
      >
        <div className="countdown-card-body">
          <div className={daysCircleClass}>
            {isToday ? (
              <>
                <span className={`countdown-days-number countdown-days-number-${typeClass}`}>
                  {t('countdown.today')}
                </span>
              </>
            ) : isPast ? (
              <>
                <span className="countdown-days-number">{t('countdown.past')}</span>
              </>
            ) : (
              <>
                <span className={`countdown-days-number countdown-days-number-${typeClass}`}>
                  {d}
                </span>
                <span className="countdown-days-label">{t('countdown.daysUnit', '天')}</span>
              </>
            )}
          </div>

          <div className="countdown-card-info">
            <div className="countdown-card-title">
              {record.title}
            </div>
            <div className="countdown-card-meta">
              <span className={`countdown-type-tag countdown-type-tag-${typeClass}`}>
                {TYPE_ICONS[record.type]} {TYPE_KEY_MAP[record.type] ? t('countdown.' + TYPE_KEY_MAP[record.type]) : record.type}
              </span>
              <Text className="countdown-date-text" type="secondary">
                <CalendarOutlined style={{ marginRight: 3 }} />
                {dateStr}
              </Text>
              {repeatLabel && (
                <span className="countdown-repeat-text">
                  <ReloadOutlined style={{ marginRight: 2, fontSize: 10 }} />
                  {repeatLabel}
                </span>
              )}
            </div>
          </div>

          <div className="countdown-card-actions">
            <Tooltip title={t('countdown.edit')}>
              <Button
                type="text"
                size="small"
                icon={<EditOutlined />}
                onClick={() => handleEdit(record)}
              />
            </Tooltip>
            <Popconfirm
              title={t('countdown.deleteConfirm')}
              onConfirm={() => handleDelete(record.id)}
              okText={t('countdown.delete')}
              cancelText={t('countdown.cancel')}
            >
              <Tooltip title={t('countdown.delete')}>
                <Button
                  type="text"
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                />
              </Tooltip>
            </Popconfirm>
          </div>
        </div>
      </Card>
    );
  };

  if (!isInitialized) {
    return (
      <Card style={{ borderRadius: 16 }}>
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Spin size="large" />
          <Text type="secondary" style={{ display: 'block', marginTop: 16 }}>
            {t('countdown.loading')}
          </Text>
        </div>
      </Card>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="countdown-header">
        <Title level={3} style={{ margin: 0 }}>
          <GiftOutlined style={{ marginRight: 8 }} />
          {t('countdown.title')}
        </Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate} style={{ borderRadius: 10 }}>
          {t('countdown.new')}
        </Button>
      </div>

      {/* Stats */}
      {events.length > 0 && (
        <div className="countdown-stats-row">
          <div className="countdown-stat-card countdown-stat-card-total">
            <div className="countdown-stat-number countdown-stat-number-total">{stats.total}</div>
            <div className="countdown-stat-label">{t('countdown.statTotal', '全部事件')}</div>
          </div>
          <div className="countdown-stat-card countdown-stat-card-upcoming">
            <div className="countdown-stat-number countdown-stat-number-upcoming">{stats.upcoming}</div>
            <div className="countdown-stat-label">{t('countdown.statUpcoming', '即将到来')}</div>
          </div>
          <div className="countdown-stat-card countdown-stat-card-today">
            <div className="countdown-stat-number countdown-stat-number-today">{stats.todayCount}</div>
            <div className="countdown-stat-label">{t('countdown.statToday', '就是今天')}</div>
          </div>
          <div className="countdown-stat-card countdown-stat-card-past">
            <div className="countdown-stat-number countdown-stat-number-past">{stats.pastCount}</div>
            <div className="countdown-stat-label">{t('countdown.statPast', '已过期')}</div>
          </div>
        </div>
      )}

      {/* Filter */}
      <Card className="countdown-filter-bar" size="small" styles={{ body: { padding: '12px 16px' } }}>
        <Space align="center">
          <Text type="secondary">{t('countdown.filterLabel', '类别')}:</Text>
          <Segmented
            options={[
              { value: 'all', label: t('countdown.filterAll', '全部') },
              ...COUNTDOWN_TYPES.map((ct) => ({ value: ct.value, label: ct.label })),
            ]}
            value={typeFilter}
            onChange={setTypeFilter}
          />
        </Space>
      </Card>

      {/* Content */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <Spin size="large" />
        </div>
      ) : filtered.length === 0 ? (
        <Card style={{ borderRadius: 16, marginTop: 0 }}>
          <FriendlyEmpty context="countdown" onAction={handleCreate} />
        </Card>
      ) : (
        <div className="countdown-grid">
          {filtered.map((record) => renderCountdownCard(record))}
        </div>
      )}

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
