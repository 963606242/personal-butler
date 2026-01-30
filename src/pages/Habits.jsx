import React, { useState, useEffect, useMemo } from 'react';
import {
  Card,
  Button,
  Space,
  Typography,
  Form,
  message,
  Popconfirm,
  Checkbox,
  Progress,
  Statistic,
  Row,
  Col,
  Spin,
  Tooltip,
  Tabs,
  Segmented,
  Table,
  theme,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  CheckCircleOutlined,
  FireOutlined,
  CalendarOutlined,
  RobotOutlined,
} from '@ant-design/icons';
import { Column } from '@ant-design/charts';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import useHabitStore from '../stores/habitStore';
import useUserStore from '../stores/userStore';
import { getLogger } from '../services/logger-client';
import { PERIOD_OPTIONS, PERIOD_LABELS, FREQUENCY_OPTIONS } from '../constants/habits';
import HabitFormModal from '../components/Habits/HabitFormModal';
import HabitsPieChart from '../components/Habits/HabitsPieChart';
import FriendlyEmpty from '../components/FriendlyEmpty';
import { useTheme } from '../context/ThemeContext';
import { useI18n } from '../context/I18nContext';

const { Title, Text } = Typography;
const logger = getLogger();

/** 本周一 00:00 */
function getWeekStart(d) {
  const x = dayjs(d);
  const dow = x.day();
  const monday = dow === 0 ? x.subtract(6, 'day') : x.subtract(dow - 1, 'day');
  return monday.startOf('day');
}

function Habits() {
  const [form] = Form.useForm();
  const [modalVisible, setModalVisible] = useState(false);
  const [editingHabit, setEditingHabit] = useState(null);
  const [statsRange, setStatsRange] = useState(7);
  const [reportTab, setReportTab] = useState('week');
  const [reportOffset, setReportOffset] = useState(0); // 0=本周/本月/今年, -1=上周/上月/去年

  const { currentUser, isInitialized } = useUserStore();
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const { t } = useI18n();
  const { token } = theme.useToken();
  const legendColor = isDark ? 'rgba(255,255,255,0.88)' : token.colorText;
  const FREQ_LABELS = {
    daily: t('habits.frequency.daily', '每天'),
    weekdays: t('habits.frequency.weekdays', '工作日'),
    weekends: t('habits.frequency.weekends', '周末'),
    weekly: t('habits.frequency.weekly', '每周'),
  };
  const {
    habits,
    logsByHabit,
    loading,
    loadHabits,
    loadLogs,
    createHabit,
    updateHabit,
    deleteHabit,
    checkIn,
    getLog,
    getStreak,
    getStats,
    isTargetDay,
    getWeeklyReport,
    getMonthlyReport,
    getYearlyReport,
  } = useHabitStore();

  useEffect(() => {
    if (!isInitialized || !currentUser) return;
    loadHabits();
    loadLogs(null, dayjs().subtract(366, 'day').toDate(), dayjs().toDate());
  }, [isInitialized, currentUser]);

  const handleCreate = () => {
    setEditingHabit(null);
    form.resetFields();
    form.setFieldsValue({ frequency: 'daily', period: 'morning' });
    setModalVisible(true);
  };

  const handleEdit = (habit) => {
    setEditingHabit(habit);
    form.setFieldsValue({
      name: habit.name,
      frequency: habit.frequency || 'daily',
      period: habit.period || 'morning',
      reminder_time: habit.reminder_time ? dayjs(habit.reminder_time, 'HH:mm') : null,
      target_days: habit.target_days?.length ? habit.target_days : undefined,
    });
    setModalVisible(true);
  };

  const handleSubmit = async (values) => {
    try {
      const data = {
        name: values.name,
        frequency: values.frequency || 'daily',
        period: values.period || 'morning',
        reminder_time: values.reminder_time ? values.reminder_time.format('HH:mm') : null,
        target_days: values.frequency === 'weekly' && values.target_days?.length ? values.target_days : undefined,
      };
      if (editingHabit) {
        await updateHabit(editingHabit.id, data);
        message.success(t('habits.messages.updated', '习惯已更新'));
      } else {
        await createHabit(data);
        message.success(t('habits.messages.created', '习惯已创建'));
      }
      setModalVisible(false);
      setEditingHabit(null);
      form.resetFields();
      loadLogs(null, dayjs().subtract(366, 'day').toDate(), dayjs().toDate());
    } catch (e) {
      if (e?.errorFields) return;
      logger.error('Habits', '保存习惯失败', e);
      message.error(t('habits.messages.saveFailed', '保存失败：') + (e?.message || t('habits.messages.saveUnknownError', '未知错误')));
    }
  };

  const handleDelete = async (habit) => {
    try {
      await deleteHabit(habit.id);
      message.success(t('habits.messages.deleted', '已删除习惯'));
    } catch (e) {
      logger.error('Habits', '删除习惯失败', e);
      message.error(t('habits.messages.deleteFailed', '删除失败'));
    }
  };

  const today = dayjs();
  const handleToggleCheck = async (habit, checked) => {
    try {
      await checkIn(habit.id, today, checked);
      message.success(checked ? t('habits.messages.checkIn', '已打卡') : t('habits.messages.uncheck', '已取消打卡'));
    } catch (e) {
      logger.error('Habits', '打卡失败', e);
      message.error(t('habits.messages.operationFailed', '操作失败'));
    }
  };

  const reportData = useMemo(() => {
    if (reportTab === 'week') {
      const ws = getWeekStart(today).add(reportOffset * 7, 'day');
      return getWeeklyReport(ws);
    }
    if (reportTab === 'month') {
      const m = today.add(reportOffset, 'month');
      return getMonthlyReport(m.year(), m.month() + 1);
    }
    const y = today.add(reportOffset, 'year');
    return getYearlyReport(y.year());
  }, [reportTab, reportOffset, habits, logsByHabit, getWeeklyReport, getMonthlyReport, getYearlyReport]);

  // 按时段饼图：显示每个时段的目标次数占比，每个时段包含"已完成"和"未完成"两部分
  // 例如：早晨时段目标3次，完成1次 -> 显示"早晨-已完成(1/3)"和"早晨-未完成(2/3)"
  const pieData = useMemo(() => {
    const r = reportData;
    if (!r || !r.byPeriod || r.totalTarget === 0) return [];
    const labels = PERIOD_LABELS;
    const result = [];
    Object.entries(r.byPeriod).forEach(([k, stats]) => {
      if (stats.target > 0) {
        const periodLabel = labels[k] || k;
        // 已完成部分
        if (stats.completed > 0) {
          result.push({
            type: `${periodLabel} - 已完成 (${stats.completed}/${stats.target})`,
            value: stats.completed,
            target: stats.target,
            period: periodLabel,
            status: '已完成',
          });
        }
        // 未完成部分
        const uncompleted = stats.target - stats.completed;
        if (uncompleted > 0) {
          result.push({
            type: `${periodLabel} - 未完成 (${uncompleted}/${stats.target})`,
            value: uncompleted,
            target: stats.target,
            period: periodLabel,
            status: '未完成',
          });
        }
      }
    });
    return result;
  }, [reportData]);

  // 按习惯饼图：显示每个习惯的目标次数占比，每个习惯包含"已完成"和"未完成"两部分
  // 例如：习惯A目标7次，完成1次 -> 显示"习惯A-已完成(1/7)"和"习惯A-未完成(6/7)"
  const pieDataByHabit = useMemo(() => {
    const r = reportData;
    if (!r?.habitDetails || r.totalTarget === 0) return [];
    const result = [];
    r.habitDetails.forEach((d) => {
      if (d.target > 0) {
        // 已完成部分
        if (d.completed > 0) {
          result.push({
            type: `${d.habit.name} - 已完成 (${d.completed}/${d.target})`,
            value: d.completed,
            target: d.target,
            habit: d.habit.name,
            status: '已完成',
          });
        }
        // 未完成部分
        const uncompleted = d.target - d.completed;
        if (uncompleted > 0) {
          result.push({
            type: `${d.habit.name} - 未完成 (${uncompleted}/${d.target})`,
            value: uncompleted,
            target: d.target,
            habit: d.habit.name,
            status: '未完成',
          });
        }
      }
    });
    return result;
  }, [reportData]);

  const columnData = useMemo(() => {
    const r = reportData;
    if (!r?.dailyCompletion) return [];
    return r.dailyCompletion.map((d) => ({ date: d.label, 完成: d.completed, 目标: d.target }));
  }, [reportData]);

  const habitsByPeriod = useMemo(() => {
    const map = {};
    for (const p of PERIOD_OPTIONS) map[p.value] = [];
    for (const h of habits) {
      const k = h.period || 'morning';
      if (!map[k]) map[k] = [];
      map[k].push(h);
    }
    return PERIOD_OPTIONS.filter((p) => map[p.value].length > 0).map((p) => ({ period: p, list: map[p.value] }));
  }, [habits]);

  if (!isInitialized) {
    return (
      <Card>
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Spin size="large">
            <div style={{ padding: '20px 0', color: '#8c8c8c' }}>{t('habits.loadingInitializing', '正在初始化...')}</div>
          </Spin>
        </div>
      </Card>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={2}>
          <CheckCircleOutlined /> {t('habits.title', '习惯追踪')}
        </Title>
        <Space>
          <Button icon={<RobotOutlined />} onClick={() => navigate('/ai', { state: { carry: ['habit_logs'] } })}>
            {t('habits.actions.askAI', '问 AI')}
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            {t('habits.actions.newHabit', '新建习惯')}
          </Button>
        </Space>
      </div>

      <Tabs
        items={[
          {
            key: 'habits',
            label: t('habits.tabs.habits', '习惯与打卡'),
            children: (
              <>
                {habits.length === 0 && !loading ? (
                  <Card>
                    <FriendlyEmpty context="habits" onAction={handleCreate} />
                  </Card>
                ) : (
                  <>
                    <div style={{ marginBottom: 16 }}>
                      <Space>
                        <Text type="secondary">{t('habits.statsRangeLabel', '统计范围：')}</Text>
                        <Segmented
                          options={[
                            { value: 7, label: t('habits.statsRange7', '近 7 天') },
                            { value: 30, label: t('habits.statsRange30', '近 30 天') },
                          ]}
                          value={statsRange}
                          onChange={setStatsRange}
                        />
                      </Space>
                    </div>
                    {habitsByPeriod.map(({ period, list }) => (
                      <Card
                        key={period.value}
                        size="small"
                        title={`${period.label}（${period.hint}）`}
                        style={{ marginBottom: 16 }}
                      >
                        <Row gutter={[16, 16]}>
                          {list.map((habit) => {
                            const log = getLog(habit.id, today);
                            const completed = !!(log && log.completed);
                            const targetToday = isTargetDay(habit, today);
                            const streak = getStreak(habit.id);
                            const stats = getStats(habit.id, statsRange);
                            return (
                              <Col key={habit.id} xs={24} sm={24} md={12} lg={8}>
                                <Card
                                  size="small"
                                  type="inner"
                                  title={
                                    <Space>
                                      <span>{habit.name}</span>
                                      <Text type="secondary" style={{ fontSize: 12 }}>
                                        {FREQ_LABELS[habit.frequency] || habit.frequency}
                                      </Text>
                                    </Space>
                                  }
                                  extra={
                                    <Space>
                                      <Button type="text" size="small" icon={<EditOutlined />} onClick={() => handleEdit(habit)} />
                                      <Popconfirm
                                        title={t('habits.messages.deleteConfirm', '确定删除该习惯？其打卡记录将一并删除。')}
                                        onConfirm={() => handleDelete(habit)}
                                        okText={t('habits.messages.deleteOk', '删除')}
                                        cancelText={t('habits.messages.deleteCancel', '取消')}
                                      >
                                        <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                                      </Popconfirm>
                                    </Space>
                                  }
                                  actions={[
                                    <Tooltip key="ck" title={targetToday ? (completed ? t('habits.todayCheck.tooltipCancel', '取消打卡') : t('habits.todayCheck.tooltipTargetToday', '今日打卡')) : t('habits.todayCheck.tooltipNonTarget', '今日非目标日')}>
                                      <Checkbox
                                        checked={completed}
                                        disabled={!targetToday}
                                        onChange={(e) => handleToggleCheck(habit, e.target.checked)}
                                      >
                                        {t('habits.todayCheck.label', '今日已打卡')}
                                      </Checkbox>
                                    </Tooltip>,
                                  ]}
                                >
                                  <Row gutter={12}>
                                    <Col span={12}>
                                      <Statistic title={t('habits.cards.streakTitle', '连续')} value={streak} prefix={<FireOutlined />} suffix={t('habits.cards.streakSuffix', '天')} />
                                    </Col>
                                    <Col span={12}>
                                      <Statistic title={t('habits.cards.recentStatsTitlePrefix', '近') + statsRange + t('habits.cards.recentStatsTitleSuffix', '天')} value={stats.completed} suffix={`/ ${stats.targetDays}`} />
                                    </Col>
                                  </Row>
                                  <Progress percent={stats.rate} size="small" style={{ marginTop: 8 }} />
                                  {habit.reminder_time && (
                                    <div style={{ marginTop: 6, fontSize: 12, color: '#8c8c8c' }}>
                                      <CalendarOutlined /> {t('habits.cards.reminderPrefix', '提醒 ')}{habit.reminder_time}
                                    </div>
                                  )}
                                </Card>
                              </Col>
                            );
                          })}
                        </Row>
                      </Card>
                    ))}
                    {habits.length > 0 && (
                      <Card size="small" title={t('habits.table.recentWeekTitle', '最近一周打卡')} style={{ marginTop: 16 }}>
                        <Table
                          size="small"
                          pagination={false}
                          dataSource={habits.map((h) => {
                            const row = { key: h.id, name: h.name };
                            for (let i = 6; i >= 0; i--) {
                              const d = today.subtract(i, 'day');
                              const l = getLog(h.id, d);
                              const target = isTargetDay(h, d);
                              const label = d.format('M/D');
                              row[label] = target ? (l?.completed ? '✓' : '－') : '·';
                            }
                            return row;
                          })}
                          columns={[
                            { title: t('habits.table.habitColumn', '习惯'), dataIndex: 'name', key: 'name', width: 140 },
                            ...[6, 5, 4, 3, 2, 1, 0].map((i) => {
                              const d = today.subtract(i, 'day');
                              const label = d.format('M/D');
                              return {
                                title: i === 0 ? t('habits.table.todayColumn', '今天') : label,
                                dataIndex: label,
                                key: label,
                                width: 56,
                                align: 'center',
                                render: (v) => (
                                  <span style={{ color: v === '✓' ? '#52c41a' : v === '－' ? '#ff4d4f' : '#d9d9d9' }}>{v}</span>
                                ),
                              };
                            }),
                          ]}
                        />
                      </Card>
                    )}
                  </>
                )}
              </>
            ),
          },
          {
            key: 'reports',
            label: t('habits.tabs.reports', '统计与报表'),
            children: (
              <>
                <div style={{ marginBottom: 16 }}>
                  <Space>
                    <Segmented
                      options={[
                        { value: 'week', label: t('habits.reports.week', '周报') },
                        { value: 'month', label: t('habits.reports.month', '月报') },
                        { value: 'year', label: t('habits.reports.year', '年报') },
                      ]}
                      value={reportTab}
                      onChange={setReportTab}
                    />
                    <Segmented
                      options={[
                        { value: 0, label: reportTab === 'week' ? t('habits.reports.currentWeek', '本周') : reportTab === 'month' ? t('habits.reports.currentMonth', '本月') : t('habits.reports.currentYear', '今年') },
                        { value: -1, label: reportTab === 'week' ? t('habits.reports.lastWeek', '上周') : reportTab === 'month' ? t('habits.reports.lastMonth', '上月') : t('habits.reports.lastYear', '去年') },
                      ]}
                      value={reportOffset}
                      onChange={(v) => setReportOffset(Number(v))}
                    />
                  </Space>
                </div>
                {habits.length === 0 ? (
                  <Card><FriendlyEmpty context="habits" onAction={handleCreate} /></Card>
                ) : (
                  <>
                    <Row gutter={[16, 16]}>
                      <Col span={24} md={12}>
                        <Card size="small" title={t('habits.reports.byPeriodTitle', '完成占比（按时段）')}>
                          {pieData.length > 0 ? (
                            <HabitsPieChart data={pieData} legendColor={legendColor} />
                          ) : (
                            <FriendlyEmpty context="habitsStats" />
                          )}
                        </Card>
                      </Col>
                      <Col span={24} md={12}>
                        <Card size="small" title={t('habits.reports.byHabitTitle', '完成占比（按习惯）')}>
                          {pieDataByHabit.length > 0 ? (
                            <HabitsPieChart data={pieDataByHabit} legendColor={legendColor} />
                          ) : (
                            <FriendlyEmpty context="habitsStats" />
                          )}
                        </Card>
                      </Col>
                    </Row>
                    <Card size="small" title={t('habits.reports.dailyCompletionTitle', '每日完成情况')} style={{ marginTop: 16 }}>
                      {columnData.length > 0 ? (
                        <div style={{ minHeight: 260 }}>
                          <Column
                            data={columnData}
                            xField="date"
                            yField="完成"
                            color="#1890ff"
                            label={{ position: 'top' }}
                          />
                        </div>
                      ) : (
                        <FriendlyEmpty context="habitsStats" />
                      )}
                    </Card>
                    {reportData && (
                      <Card size="small" title={reportTab === 'week' ? t('habits.reports.reportTitleWeek', '习惯周报') : reportTab === 'month' ? t('habits.reports.reportTitleMonth', '习惯月报') : t('habits.reports.reportTitleYear', '习惯年报')} style={{ marginTop: 16 }}>
                        <div style={{ marginBottom: 12 }}>
                          <Statistic
                            title={t('habits.reports.completionRate', '完成率')}
                            value={reportData.rate}
                            suffix="%"
                          />
                          <Text type="secondary"> {t('habits.reports.summary', '目标 {{totalTarget}} 次，完成 {{totalCompleted}} 次', { totalTarget: reportData.totalTarget, totalCompleted: reportData.totalCompleted })}</Text>
                        </div>
                        <div style={{ marginBottom: 12 }}>
                          <Text strong>{t('habits.reports.habitDetailPrefix', '各习惯明细')}</Text>
                          <ul style={{ margin: '8px 0 0', paddingLeft: 20 }}>
                            {reportData.habitDetails?.map((d) => (
                              <li key={d.habit.id}>
                                {d.habit.name}：完成 {d.completed}/{d.target}，{t('habits.reports.completionRate', '完成率')} {d.rate}%，{t('habits.cards.streakTitle', '连续')} {d.streak} {t('habits.cards.streakSuffix', '天')}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <Text type="secondary">
                            {reportData.scope === 'week' && t('habits.reports.scopeWeek', '周报')}
                            {reportData.scope === 'month' && t('habits.reports.scopeMonth', '月报')}
                            {reportData.scope === 'year' && t('habits.reports.scopeYear', '年报')}
                            {' '}{t('habits.reports.scopeRange', '范围：{{start}} 至 {{end}}', { start: reportData.start, end: reportData.end })}
                          </Text>
                        </div>
                      </Card>
                    )}
                  </>
                )}
              </>
            ),
          },
        ]}
      />

      <HabitFormModal
        open={modalVisible}
        editing={editingHabit}
        form={form}
        onCancel={() => {
          setModalVisible(false);
          setEditingHabit(null);
          form.resetFields();
        }}
        onOk={handleSubmit}
      />
    </div>
  );
}

export default Habits;
