import React, { useState, useEffect, useMemo } from 'react';
import {
  Card,
  Button,
  Table,
  Space,
  Typography,
  Modal,
  Form,
  Input,
  DatePicker,
  TimePicker,
  Select,
  InputNumber,
  Tag,
  message,
  Popconfirm,
  Row,
  Col,
  Tabs,
  Calendar,
  Badge,
  Checkbox,
  Tooltip,
  Spin,
  Segmented,
  Progress,
  Statistic,
} from 'antd';
import { getScheduleConflicts } from '../utils/schedule-conflict';
import { computeScheduleStats } from '../utils/schedule-analysis';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  SettingOutlined,
  BarChartOutlined,
  RobotOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import useScheduleStore from '../stores/scheduleStore';
import useUserStore from '../stores/userStore';
import useCalendarConfigStore from '../stores/calendarConfigStore';
import { getLogger } from '../services/logger-client';
import { getCalendarService } from '../services/calendar-service';
import CalendarConfigModal from '../components/Calendar/CalendarConfigModal';
import { useI18n } from '../context/I18nContext';

const { Title } = Typography;
const { Option } = Select;
const { TextArea } = Input;
const logger = getLogger();

function Schedule() {
  const [form] = Form.useForm();
  const [modalVisible, setModalVisible] = useState(false);
  const [configModalVisible, setConfigModalVisible] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [viewMode, setViewMode] = useState('calendar'); // 'calendar' | 'list' | 'analysis'，默认日历视图
  const [analysisRange, setAnalysisRange] = useState('week'); // 'week' | 'month'
  const { t } = useI18n();
  
  const {
    schedules,
    loading,
    selectedDate,
    loadSchedules,
    createSchedule,
    updateSchedule,
    deleteSchedule,
    getSchedulesByDate,
    setSelectedDate,
  } = useScheduleStore();
  
  const { currentUser, isInitialized } = useUserStore();
  const {
    showLunar,
    showHoliday,
    showWeekend,
    showToday,
    lunarFormat,
  } = useCalendarConfigStore();
  const navigate = useNavigate();
  const calendarService = getCalendarService();

  const analysisStats = useMemo(() => {
    if (!schedules.length) {
      return { totalMinutes: 0, scheduledMinutes: 0, freeMinutes: 0, byTag: [], instanceCount: 0 };
    }
    const start = analysisRange === 'week'
      ? dayjs().startOf('week')
      : dayjs().startOf('month');
    const end = analysisRange === 'week'
      ? dayjs().endOf('week')
      : dayjs().endOf('month');
    return computeScheduleStats(schedules, start.toDate(), end.toDate());
  }, [schedules, analysisRange]);

  useEffect(() => {
    if (isInitialized && currentUser) {
      loadSchedules();
    }
  }, [isInitialized, currentUser]);

  // 预加载当前年份的日历数据
  useEffect(() => {
    const currentYear = dayjs().year();
    calendarService.preloadYearData(currentYear).catch((err) => {
      logger.warn('Schedule', '预加载日历数据失败:', err);
    });
  }, []);

  // 处理创建/编辑日程
  const handleSubmit = async (values) => {
    try {
      logger.log('Schedule', '提交日程表单:', values);

      const dateValue = values.date ? values.date.startOf('day').toDate() : new Date();
      let startTimeValue = null;
      let endTimeValue = null;

      if (values.startTime) {
        const startDate = values.date || dayjs();
        startTimeValue = startDate
          .hour(values.startTime.hour())
          .minute(values.startTime.minute())
          .second(0)
          .millisecond(0)
          .toDate();
      }
      if (values.endTime) {
        const endDate = values.date || dayjs();
        endTimeValue = endDate
          .hour(values.endTime.hour())
          .minute(values.endTime.minute())
          .second(0)
          .millisecond(0)
          .toDate();
      }

      const candidate = {
        start_time: startTimeValue?.getTime() ?? null,
        end_time: endTimeValue?.getTime() ?? null,
      };
      const dayInstances = getSchedulesByDate(dateValue);
      const conflicts = getScheduleConflicts(
        dayInstances,
        candidate,
        editingSchedule?.id
      );

      if (conflicts.length > 0) {
        const conflictTitles = conflicts.map((c) => c.title).join('、');
        const ok = await new Promise((resolve) => {
          Modal.confirm({
            title: '时间冲突',
            content: `与以下日程时间重叠：${conflictTitles}。是否仍要保存？`,
            okText: '仍要保存',
            cancelText: '取消',
            onOk: () => resolve(true),
            onCancel: () => resolve(false),
          });
        });
        if (!ok) return;
      }

      await doSave(values, dateValue, startTimeValue, endTimeValue);
    } catch (error) {
      logger.error('Schedule', '保存日程失败:', error);
      message.error('保存失败: ' + error.message);
    }
  };

  const doSave = async (values, dateValue, startTimeValue, endTimeValue) => {
    const repeatRule = values.repeat_rule && values.repeat_rule !== 'none'
      ? {
          type: values.repeat_rule,
          interval: values.repeat_interval ?? 1,
          endDate: values.repeat_end_date ? values.repeat_end_date.format('YYYY-MM-DD') : null,
          weekdays: values.repeat_rule === 'weekly' && values.repeat_weekdays?.length
            ? values.repeat_weekdays
            : undefined,
        }
      : null;

    const scheduleData = {
      title: values.title,
      date: dateValue,
      startTime: startTimeValue,
      endTime: endTimeValue,
      location: values.location || null,
      notes: values.notes || null,
      priority: values.priority || 0,
      tags: values.tags || [],
      repeat_rule: repeatRule,
      reminder_settings: values.reminder_enabled
        ? { enabled: true, minutes: values.reminder_minutes ?? 15 }
        : null,
    };

    if (editingSchedule) {
      await updateSchedule(editingSchedule.id, scheduleData);
      message.success('日程更新成功');
    } else {
      await createSchedule(scheduleData);
      message.success('日程创建成功');
    }

    setModalVisible(false);
    setEditingSchedule(null);
    form.resetFields();
  };

  // 打开创建对话框
  const handleCreate = () => {
    setEditingSchedule(null);
    form.resetFields();
    form.setFieldsValue({
      date: dayjs(),
      priority: 0,
      repeat_rule: 'none',
      repeat_interval: 1,
      reminder_enabled: false,
      reminder_minutes: 15,
    });
    setModalVisible(true);
  };

  // 打开编辑对话框
  const handleEdit = (schedule) => {
    setEditingSchedule(schedule);
    form.setFieldsValue({
      title: schedule.title,
      date: schedule.date ? dayjs(schedule.date) : dayjs(),
      startTime: schedule.start_time ? dayjs(schedule.start_time) : null,
      endTime: schedule.end_time ? dayjs(schedule.end_time) : null,
      location: schedule.location || null,
      notes: schedule.notes || null,
      priority: schedule.priority || 0,
      tags: schedule.tags || [],
      repeat_rule: schedule.repeat_rule?.type || 'none',
      repeat_interval: schedule.repeat_rule?.interval ?? 1,
      repeat_end_date: schedule.repeat_rule?.endDate ? dayjs(schedule.repeat_rule.endDate) : null,
      repeat_weekdays: schedule.repeat_rule?.weekdays || undefined,
      reminder_enabled: schedule.reminder_settings?.enabled || false,
      reminder_minutes: schedule.reminder_settings?.minutes ?? 15,
    });
    setModalVisible(true);
  };

  // 删除日程
  const handleDelete = async (scheduleId) => {
    try {
      await deleteSchedule(scheduleId);
      message.success('日程删除成功');
    } catch (error) {
      logger.error('Schedule', '删除日程失败:', error);
      message.error('删除失败: ' + error.message);
    }
  };

  // 表格列定义
  const columns = [
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      width: 200,
    },
    {
      title: '日期',
      dataIndex: 'date',
      key: 'date',
      width: 120,
      render: (date) => date ? dayjs(date).format('YYYY-MM-DD') : '-',
    },
    {
      title: '时间',
      key: 'time',
      width: 150,
      render: (_, record) => {
        const start = record.start_time ? dayjs(record.start_time).format('HH:mm') : '';
        const end = record.end_time ? dayjs(record.end_time).format('HH:mm') : '';
        return start && end ? `${start} - ${end}` : start || '-';
      },
    },
    {
      title: '地点',
      dataIndex: 'location',
      key: 'location',
      width: 150,
      render: (location) => location || '-',
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      key: 'priority',
      width: 100,
      render: (priority) => {
        const colors = { 0: 'default', 1: 'blue', 2: 'orange', 3: 'red' };
        const texts = { 0: '普通', 1: '低', 2: '中', 3: '高' };
        return <Tag color={colors[priority] || 'default'}>{texts[priority] || '普通'}</Tag>;
      },
    },
    {
      title: '标签',
      dataIndex: 'tags',
      key: 'tags',
      width: 200,
      render: (tags) => {
        if (!tags || tags.length === 0) return '-';
        return (
          <Space>
            {tags.map((tag, index) => (
              <Tag key={index}>{tag}</Tag>
            ))}
          </Space>
        );
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定要删除这个日程吗？"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button
              type="link"
              danger
              icon={<DeleteOutlined />}
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // 日历单元格渲染：用 fullCellRender 完全自定义，避免 antd 默认再画一遍日期（如 09）造成重复
  const fullCellRender = (current, info) => {
    // info.type 可以是 'date' 或 'month'
    if (info.type !== 'date') {
      return null; // 月份单元格不需要自定义渲染
    }
    
    const value = current;
    const date = value.toDate();
    const daySchedules = getSchedulesByDate(date);
    
    // 获取日期信息
    const dateInfo = calendarService.getDateInfo(date, {
      showLunar,
      showHoliday,
    });
    
    const isToday = dayjs(date).isSame(dayjs(), 'day');
    const isWeekend = value.day() === 0 || value.day() === 6;
    
    // 农历单独一行；节气+节假日合并为一行 Tag 并排 [情人节] [春节]
    const lunarText =
      showLunar && dateInfo.lunar
        ? lunarFormat === 'full'
          ? dateInfo.lunar.fullText
          : lunarFormat === 'simple'
            ? dateInfo.lunar.simpleText
            : ''
        : '';
    const tagItems = []; // 节气、节假日，用于一行内 Tag 并排
    if (showHoliday && dateInfo.holidays && dateInfo.holidays.length > 0) {
      dateInfo.holidays.forEach((holiday) => {
        tagItems.push({
          text: holiday.name,
          type: holiday.type,
          isOffDay: holiday.isOffDay,
        });
      });
    }
    
    const restLabel = dateInfo.restLabel; // 休 / 班（国务院放假）

    // 底色：休=淡蓝，班=淡红，今日=强调，周末=淡灰，平日=浅灰白
    let cellBg = '#fafafa';
    let cellBorder = '1px solid #f0f0f0';
    let dateColor = '#262626';
    if (restLabel === '休') {
      cellBg = '#e6f7ff';
      cellBorder = '1px solid #bae7ff';
      dateColor = '#0958d9';
    } else if (restLabel === '班') {
      cellBg = '#fff1f0';
      cellBorder = '1px solid #ffccc7';
      dateColor = '#cf1322';
    } else if (isWeekend && showWeekend) {
      cellBg = '#f5f5f5';
      dateColor = '#8c8c8c';
    }
    if (isToday) {
      cellBg = restLabel === '休' ? '#bae7ff' : restLabel === '班' ? '#ffccc7' : '#e6f4ff';
      cellBorder = '2px solid #1677ff';
      dateColor = '#1677ff';
    }

    return (
      <div
        style={{
          minHeight: '90px',
          padding: '8px 6px',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
          borderRadius: '8px',
          background: cellBg,
          border: cellBorder,
          transition: 'border-color .2s, background .2s',
        }}
      >
        {/* 日期行：左为日期，右为休/班小标 + 日程数 */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            minHeight: '24px',
            marginBottom: '2px',
          }}
        >
          <span
            style={{
              fontSize: '15px',
              fontWeight: isToday ? 700 : 600,
              color: dateColor,
              lineHeight: '24px',
            }}
          >
            {value.date()}
          </span>
          <Space size={6} style={{ alignItems: 'center' }}>
            {restLabel && (
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: restLabel === '休' ? '#0958d9' : '#cf1322',
                  background: restLabel === '休' ? 'rgba(9,88,217,.14)' : 'rgba(207,19,34,.1)',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  lineHeight: '18px',
                }}
              >
                {restLabel}
              </span>
            )}
            {daySchedules.length > 0 && (
              <Badge count={daySchedules.length} size="small" style={{ backgroundColor: '#1677ff' }} />
            )}
          </Space>
        </div>

        {/* 农历一行；节气/节假日一行内 Tag 并排 [情人节] [春节] */}
        {(lunarText || tagItems.length > 0 || daySchedules.length > 0) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '4px' }}>
            {lunarText && (
              <div
                style={{
                  fontSize: '10px',
                  color: '#595959',
                  lineHeight: '16px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
                title={lunarText}
              >
                {lunarText}
              </div>
            )}
            {(tagItems.length > 0 || daySchedules.length > 0) && (
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '4px',
                  alignItems: 'center',
                  lineHeight: '20px',
                }}
              >
                {tagItems.map((item, index) => {
                  const isJieqi = item.type === 'jieqi';
                  const isOff = item.isOffDay;
                  const tagStyle = {
                    margin: 0,
                    fontSize: '10px',
                    lineHeight: '18px',
                    height: '18px',
                    padding: '0 5px',
                    borderRadius: '4px',
                    border: 'none',
                    maxWidth: '100%',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  };
                  if (isJieqi) {
                    return (
                      <span
                        key={index}
                        style={{
                          ...tagStyle,
                          color: '#389e0d',
                          background: 'rgba(56,158,13,.1)',
                          display: 'inline-flex',
                          alignItems: 'center',
                        }}
                        title={item.text}
                      >
                        {item.text}
                      </span>
                    );
                  }
                  if (isOff) {
                    return (
                      <span
                        key={index}
                        style={{
                          ...tagStyle,
                          color: '#0958d9',
                          background: 'rgba(9,88,217,.12)',
                          display: 'inline-flex',
                          alignItems: 'center',
                        }}
                        title={item.text}
                      >
                        {item.text}
                      </span>
                    );
                  }
                  return (
                    <span
                      key={index}
                      style={{
                        ...tagStyle,
                        color: '#595959',
                        background: 'rgba(0,0,0,.06)',
                        display: 'inline-flex',
                        alignItems: 'center',
                      }}
                      title={item.text}
                    >
                      {item.text}
                    </span>
                  );
                })}
                {/* 日程用同款 Tag：与节日同一行，不单独占行，文字过长省略 */}
                {daySchedules.length > 0 && (() => {
                  const sorted = [...daySchedules].sort((a, b) => (b.priority || 1) - (a.priority || 1));
                  const top = sorted[0];
                  const count = daySchedules.length;
                  const label = count === 1 ? (top.title || '未命名日程') : `${top.title || '未命名日程'} 等${count}项`;
                  let scheduleTagBg = 'rgba(22,119,255,.1)';
                  let scheduleTagColor = '#1677ff';
                  if ((top.priority || 1) === 3) {
                    scheduleTagBg = 'rgba(255,77,79,.12)';
                    scheduleTagColor = '#cf1322';
                  } else if ((top.priority || 1) === 2) {
                    scheduleTagBg = 'rgba(250,173,20,.15)';
                    scheduleTagColor = '#d48806';
                  }
                  const tooltipContent = (
                    <div style={{ maxWidth: 320 }}>
                      {sorted.map((schedule) => {
                        const startTime = schedule.start_time ? dayjs(schedule.start_time).format('HH:mm') : '';
                        const endTime = schedule.end_time ? dayjs(schedule.end_time).format('HH:mm') : '';
                        const timeText = startTime && endTime ? `${startTime}-${endTime}` : startTime || '全天';
                        return (
                          <div key={schedule.id} style={{ marginBottom: 8 }}>
                            <div style={{ fontWeight: 600, marginBottom: 2 }}>{schedule.title || '未命名日程'}</div>
                            {timeText && <div style={{ fontSize: 12, color: '#666' }}><span style={{ color: '#999' }}>时间：</span>{timeText}</div>}
                            {schedule.location && <div style={{ fontSize: 12, color: '#666' }}><span style={{ color: '#999' }}>地点：</span>{schedule.location}</div>}
                          </div>
                        );
                      })}
                    </div>
                  );
                  return (
                    <Tooltip key="schedule-tag" title={tooltipContent} placement="topLeft">
                      <span
                        role="button"
                        tabIndex={0}
                        style={{
                          fontSize: '10px',
                          lineHeight: '18px',
                          height: '18px',
                          padding: '0 5px',
                          borderRadius: '4px',
                          border: 'none',
                          maxWidth: '80px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          color: scheduleTagColor,
                          background: scheduleTagBg,
                          display: 'inline-flex',
                          alignItems: 'center',
                          cursor: 'pointer',
                        }}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleEdit(top); } }}
                        onClick={() => handleEdit(top)}
                      >
                        {label}
                      </span>
                    </Tooltip>
                  );
                })()}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // 如果用户未初始化，显示加载状态而不是错误
  if (!isInitialized) {
    return (
      <Card>
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Spin size="large">
            <div style={{ padding: '20px 0', color: '#8c8c8c' }}>正在初始化用户信息...</div>
          </Spin>
        </div>
      </Card>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={2}>
          <CalendarOutlined /> {t('schedule.title')}
        </Title>
        <Space>
          <Button icon={<RobotOutlined />} onClick={() => navigate('/ai', { state: { carry: ['schedule'] } })}>
            {t('habits.actions.askAI')}
          </Button>
          <Button
            icon={<SettingOutlined />}
            onClick={() => setConfigModalVisible(true)}
          >
            {t('schedule.calendarConfig')}
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleCreate}
          >
            {t('friendlyEmpty.schedule.action')}
          </Button>
        </Space>
      </div>

      <Card>
        <Tabs
          activeKey={viewMode}
          onChange={setViewMode}
          items={[
            {
              key: 'calendar',
              label: t('schedule.calendarView'),
              children: (
                <>
                  <div style={{ marginBottom: 16 }}>
                    <Space wrap>
                      {showLunar && (
                        <Tag color="blue">已启用农历显示</Tag>
                      )}
                      {showHoliday && (
                        <Tag color="red">已启用节假日显示</Tag>
                      )}
                    </Space>
                  </div>
                  <Calendar
                    fullCellRender={fullCellRender}
                    onSelect={(date) => {
                      setSelectedDate(date.toDate());
                      const daySchedules = getSchedulesByDate(date.toDate());
                      const dateInfo = calendarService.getDateInfo(date.toDate(), {
                        showLunar,
                        showHoliday,
                      });
                      
                      let infoText = `这一天有 ${daySchedules.length} 个日程`;
                      if (dateInfo.lunar && showLunar) {
                        infoText += `，农历${dateInfo.lunar.fullText}`;
                      }
                      if (dateInfo.holidays && dateInfo.holidays.length > 0 && showHoliday) {
                        infoText += `，${dateInfo.holidays.map(h => h.name).join('、')}`;
                      }
                      
                      message.info(infoText);
                    }}
                  />
                </>
              ),
            },
            {
              key: 'list',
              label: t('schedule.listView'),
              children: (
                <Table
                  columns={columns}
                  dataSource={schedules}
                  rowKey="id"
                  loading={loading}
                  pagination={{
                    pageSize: 10,
                    showSizeChanger: true,
                    showTotal: (total) => `共 ${total} 条日程`,
                  }}
                />
              ),
            },
            {
              key: 'analysis',
              label: (
                <span>
                  <BarChartOutlined /> {t('schedule.analysis')}
                </span>
              ),
              children: (
                <>
                  <div style={{ marginBottom: 16 }}>
                    <Space>
                      <span>统计范围：</span>
                      <Segmented
                        options={[
                          { value: 'week', label: '本周' },
                          { value: 'month', label: '本月' },
                        ]}
                        value={analysisRange}
                        onChange={setAnalysisRange}
                      />
                    </Space>
                  </div>
                  <Row gutter={24} style={{ marginBottom: 24 }}>
                    <Col span={6}>
                      <Card size="small">
                        <Statistic
                          title="总时间"
                          value={Math.round(analysisStats.totalMinutes / 60 * 10) / 10}
                          suffix="小时"
                        />
                      </Card>
                    </Col>
                    <Col span={6}>
                      <Card size="small">
                        <Statistic
                          title="已安排"
                          value={Math.round(analysisStats.scheduledMinutes / 60 * 10) / 10}
                          suffix="小时"
                        />
                      </Card>
                    </Col>
                    <Col span={6}>
                      <Card size="small">
                        <Statistic
                          title="空闲时间"
                          value={Math.round(analysisStats.freeMinutes / 60 * 10) / 10}
                          suffix="小时"
                        />
                      </Card>
                    </Col>
                    <Col span={6}>
                      <Card size="small">
                        <Statistic
                          title="日程数量"
                          value={analysisStats.instanceCount}
                          suffix="个"
                        />
                      </Card>
                    </Col>
                  </Row>
                  <Card size="small" title="时间分配（按标签）">
                    {analysisStats.byTag.length === 0 ? (
                      <Typography.Text type="secondary">暂无日程数据</Typography.Text>
                    ) : (
                      <Space direction="vertical" style={{ width: '100%' }} size="middle">
                        {analysisStats.byTag
                          .sort((a, b) => b.minutes - a.minutes)
                          .map(({ tag, minutes }) => {
                            const pct = analysisStats.totalMinutes > 0
                              ? Math.round((minutes / analysisStats.totalMinutes) * 100)
                              : 0;
                            const hours = Math.round(minutes / 60 * 10) / 10;
                            return (
                              <div key={tag}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                  <Tag>{tag}</Tag>
                                  <span>{hours} 小时</span>
                                </div>
                                <Progress percent={pct} size="small" showInfo={false} />
                              </div>
                            );
                          })}
                      </Space>
                    )}
                  </Card>
                </>
              ),
            },
          ]}
        />
      </Card>

      {/* 创建/编辑日程对话框 */}
      <Modal
        title={editingSchedule ? '编辑日程' : '新建日程'}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          setEditingSchedule(null);
          form.resetFields();
        }}
        onOk={() => form.submit()}
        width={600}
        okText="保存"
        cancelText="取消"
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Form.Item
            name="title"
            label="标题"
            rules={[{ required: true, message: '请输入日程标题' }]}
          >
            <Input placeholder="请输入日程标题" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="date"
                label="日期"
                rules={[{ required: true, message: '请选择日期' }]}
              >
                <DatePicker
                  style={{ width: '100%' }}
                  format="YYYY-MM-DD"
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="priority"
                label="优先级"
              >
                <Select style={{ width: '100%' }}>
                  <Option value={0}>普通</Option>
                  <Option value={1}>低</Option>
                  <Option value={2}>中</Option>
                  <Option value={3}>高</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="startTime"
                label="开始时间"
              >
                <TimePicker
                  style={{ width: '100%' }}
                  format="HH:mm"
                  placeholder="选择开始时间"
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="endTime"
                label="结束时间"
              >
                <TimePicker
                  style={{ width: '100%' }}
                  format="HH:mm"
                  placeholder="选择结束时间"
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="location"
            label="地点"
          >
            <Input placeholder="请输入地点" />
          </Form.Item>

          <Form.Item
            name="notes"
            label="备注"
          >
            <TextArea
              rows={4}
              placeholder="请输入备注"
            />
          </Form.Item>

          <Form.Item
            name="tags"
            label="标签"
          >
            <Select
              mode="tags"
              placeholder="输入标签，按回车添加"
              style={{ width: '100%' }}
            />
          </Form.Item>

          <Form.Item
            name="repeat_rule"
            label="重复规则"
          >
            <Select placeholder="选择重复规则" allowClear>
              <Option value="none">不重复</Option>
              <Option value="daily">每天</Option>
              <Option value="weekly">每周</Option>
              <Option value="monthly">每月</Option>
              <Option value="yearly">每年</Option>
            </Select>
          </Form.Item>

          <Form.Item
            noStyle
            shouldUpdate={(prevValues, currentValues) =>
              prevValues.repeat_rule !== currentValues.repeat_rule
            }
          >
            {({ getFieldValue }) => {
              const rule = getFieldValue('repeat_rule');
              if (!rule || rule === 'none') return null;
              return (
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item
                      name="repeat_interval"
                      label="重复间隔"
                    >
                      <InputNumber
                        min={1}
                        max={99}
                        style={{ width: '100%' }}
                        addonAfter={
                          rule === 'daily' ? '天' :
                          rule === 'weekly' ? '周' :
                          rule === 'monthly' ? '个月' : '年'
                        }
                      />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item
                      name="repeat_end_date"
                      label="结束日期"
                    >
                      <DatePicker
                        style={{ width: '100%' }}
                        format="YYYY-MM-DD"
                        placeholder="不填则一直重复"
                      />
                    </Form.Item>
                  </Col>
                </Row>
              );
            }}
          </Form.Item>

          <Form.Item
            noStyle
            shouldUpdate={(prevValues, currentValues) =>
              prevValues.repeat_rule !== currentValues.repeat_rule
            }
          >
            {({ getFieldValue }) => {
              if (getFieldValue('repeat_rule') !== 'weekly') return null;
              return (
                <Form.Item
                  name="repeat_weekdays"
                  label="星期"
                >
                  <Select
                    mode="multiple"
                    placeholder="不选则使用日程开始日星期"
                    style={{ width: '100%' }}
                    options={[
                      { value: 0, label: '周日' },
                      { value: 1, label: '周一' },
                      { value: 2, label: '周二' },
                      { value: 3, label: '周三' },
                      { value: 4, label: '周四' },
                      { value: 5, label: '周五' },
                      { value: 6, label: '周六' },
                    ]}
                  />
                </Form.Item>
              );
            }}
          </Form.Item>

          <Form.Item
            name="reminder_enabled"
            valuePropName="checked"
          >
            <Checkbox>启用提醒</Checkbox>
          </Form.Item>

          <Form.Item
            noStyle
            shouldUpdate={(prevValues, currentValues) =>
              prevValues.reminder_enabled !== currentValues.reminder_enabled
            }
          >
            {({ getFieldValue }) =>
              getFieldValue('reminder_enabled') ? (
                <Form.Item
                  name="reminder_minutes"
                  label="提前提醒"
                >
                  <Select
                    style={{ width: '100%' }}
                    placeholder="选择提前时间"
                    options={[
                      { value: 5, label: '提前 5 分钟' },
                      { value: 15, label: '提前 15 分钟' },
                      { value: 30, label: '提前 30 分钟' },
                      { value: 60, label: '提前 1 小时' },
                      { value: 120, label: '提前 2 小时' },
                      { value: 1440, label: '提前 1 天' },
                    ]}
                  />
                </Form.Item>
              ) : null
            }
          </Form.Item>
        </Form>
      </Modal>

      {/* 日历配置对话框 */}
      <CalendarConfigModal
        visible={configModalVisible}
        onCancel={() => setConfigModalVisible(false)}
      />
    </div>
  );
}

export default Schedule;
