import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Row,
  Col,
  Card,
  Typography,
  Space,
  Button,
  Statistic,
  Progress,
  List,
  Avatar,
  Tag,
  Spin,
  Divider,
  Alert,
  message,
  Modal,
} from 'antd';
import {
  UserOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  CloudOutlined,
  FireOutlined,
  ClockCircleOutlined,
  RightOutlined,
  ThunderboltOutlined,
  TrophyOutlined,
  FileTextOutlined,
  RobotOutlined,
  MoonOutlined,
  ExperimentOutlined,
  SmileOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import useUserStore from '../stores/userStore';
import useHabitStore from '../stores/habitStore';
import useScheduleStore from '../stores/scheduleStore';
import useWeatherStore from '../stores/weatherStore';
import useNewsStore from '../stores/newsStore';
import { getCurrentPeriodInfo } from '../utils/period-helper';
import {
  fetchTodaySuggestion,
  isAIConfigured,
  getCachedSuggestion,
  setCachedSuggestion,
} from '../services/ai-suggestion';
import SuggestionDisplay from '../components/AI/SuggestionDisplay';
import FriendlyEmpty from '../components/FriendlyEmpty';
import { useTheme } from '../context/ThemeContext';
import { useOnboarding } from '../context/OnboardingContext';
import { useI18n } from '../context/I18nContext';
import { getZodiacFromBirthday } from '../utils/zodiac';
import { getAssistantName } from '../utils/assistant-name';
import { getTodayCheckin, performCheckin } from '../utils/fun-checkin';
import { theme } from 'antd';

const NEWS_CATEGORIES = [
  { value: 'general', icon: '📰' },
  { value: 'technology', icon: '💻' },
  { value: 'business', icon: '💼' },
  { value: 'entertainment', icon: '🎬' },
  { value: 'sports', icon: '⚽' },
  { value: 'science', icon: '🔬' },
  { value: 'health', icon: '🏥' },
];

const { Title, Text, Paragraph } = Typography;

function Dashboard() {
  const navigate = useNavigate();
  const { currentUser, userProfile, isInitialized } = useUserStore();
  const { habits, loadHabits, getCurrentPeriodHabits, getStats, getStreak, checkIn, getLog } = useHabitStore();
  const { schedules, loadSchedules, getSchedulesByDate } = useScheduleStore();
  const { currentWeather, currentCity, initialize: initWeather } = useWeatherStore();
  const { dailyReport, getTodayMorningReport, getTodayEveningReport } = useNewsStore();
  const { isDark, accent } = useTheme();
  const { openIfNewUser } = useOnboarding();
  const { t } = useI18n();
  const { token } = theme.useToken();

  const [greeting, setGreeting] = useState('你好');
  const [currentPeriodInfo, setCurrentPeriodInfo] = useState(null);
  const [todaySchedules, setTodaySchedules] = useState([]);
  const [periodHabits, setPeriodHabits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [suggestionLoading, setSuggestionLoading] = useState(false);
  const [suggestionText, setSuggestionText] = useState('');
  const [suggestionError, setSuggestionError] = useState(null);
  const [checkinToday, setCheckinToday] = useState(null);
  const [batchCheckInModalOpen, setBatchCheckInModalOpen] = useState(false);
  const [batchCheckInLoading, setBatchCheckInLoading] = useState(false);
  const [pendingBatchHabits, setPendingBatchHabits] = useState([]);

  useEffect(() => {
    try {
      const key = 'personal-butler-first-visit-done';
      if (!localStorage.getItem(key)) {
        localStorage.setItem(key, '1');
        message.success(t('dashboard.welcomeMessage'), 4);
      }
    } catch (_) {}
  }, [t]);

  useEffect(() => {
    if (!isInitialized || loading) return;
    const t = setTimeout(() => openIfNewUser(), 800);
    return () => clearTimeout(t);
  }, [isInitialized, loading, openIfNewUser]);

  useEffect(() => {
    if (!isInitialized) return;

    // 设置问候语
    const hour = dayjs().hour();
    let g = t('dashboard.greeting.hello');
    if (hour >= 5 && hour < 9) g = t('dashboard.greeting.morning');
    else if (hour >= 9 && hour < 12) g = t('dashboard.greeting.forenoon');
    else if (hour >= 12 && hour < 14) g = t('dashboard.greeting.noon');
    else if (hour >= 14 && hour < 18) g = t('dashboard.greeting.afternoon');
    else if (hour >= 18 && hour < 22) g = t('dashboard.greeting.evening');
    else g = t('dashboard.greeting.night');

    const gender = userProfile?.gender;
    let title = '';
    if (gender === 'male') title = t('dashboard.greetingTitle.sir');
    else if (gender === 'female') title = t('dashboard.greetingTitle.madam');
    setGreeting(title ? `${g}，${title}` : g);

    // 获取当前时段信息
    const periodInfo = getCurrentPeriodInfo();
    setCurrentPeriodInfo(periodInfo);

    // 加载数据
    const loadData = async () => {
      setLoading(true);
      try {
        await Promise.all([
          loadHabits(),
          loadSchedules(dayjs().startOf('day').toDate(), dayjs().endOf('day').toDate()),
          initWeather().catch((e) => {
            // 天气初始化失败不影响其他功能，只记录错误
            console.warn('天气初始化失败:', e.message);
          }),
        ]);

        // 根据时间加载早报或晚报
        const hour = dayjs().hour();
        if (hour >= 6 && hour < 12) {
          getTodayMorningReport().catch((e) => console.warn('加载早报失败:', e.message));
        } else if (hour >= 18) {
          getTodayEveningReport().catch((e) => console.warn('加载晚报失败:', e.message));
        }
        // 恢复今日建议缓存（切换页面后保留）
        const cached = await getCachedSuggestion();
        if (cached) {
          setSuggestionText(cached);
          setSuggestionError(null);
        }
      } catch (e) {
        console.error('加载数据失败', e);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [isInitialized, userProfile, loadHabits, loadSchedules, t]);

  useEffect(() => {
    setCheckinToday(getTodayCheckin());
  }, []);

  useEffect(() => {
    if (!isInitialized || loading) return;
    const today = dayjs();
    const todayScheds = getSchedulesByDate(today.toDate());
    setTodaySchedules(todayScheds.slice(0, 5)); // 只显示前5个
    const periodHabitsList = getCurrentPeriodHabits();
    setPeriodHabits(periodHabitsList.slice(0, 5)); // 只显示前5个
  }, [isInitialized, loading, habits, schedules, getSchedulesByDate, getCurrentPeriodHabits]);

  const handleFetchSuggestion = async () => {
    if (!isAIConfigured()) return;
    setSuggestionLoading(true);
    setSuggestionError(null);
    setSuggestionText('');
    try {
      const text = await fetchTodaySuggestion();
      setSuggestionText(text || '');
      if (text) await setCachedSuggestion(text);
    } catch (e) {
      setSuggestionError(e?.message || t('dashboard.getSuggestionFailed'));
    } finally {
      setSuggestionLoading(false);
    }
  };

  const handleBatchCheckInClick = () => {
    const list = getCurrentPeriodHabits();
    const today = new Date();
    const pending = list.filter((ph) => !getLog(ph.habit.id, today)?.completed);
    if (pending.length === 0) {
      message.info(t('dashboard.batchCheckInEmpty', '当前时段没有待打卡习惯'));
      return;
    }
    setPendingBatchHabits(pending);
    setBatchCheckInModalOpen(true);
  };

  const handleBatchCheckInConfirm = async () => {
    const list = pendingBatchHabits;
    if (list.length === 0) {
      setBatchCheckInModalOpen(false);
      return;
    }
    setBatchCheckInLoading(true);
    try {
      const today = new Date();
      for (const ph of list) {
        await checkIn(ph.habit.id, today, true);
      }
      message.success(t('dashboard.batchCheckInDone', undefined, { n: list.length }));
      setBatchCheckInModalOpen(false);
      setPendingBatchHabits([]);
    } catch (e) {
      message.error(e?.message || t('habits.messages.checkFailed', '打卡失败'));
    } finally {
      setBatchCheckInLoading(false);
    }
  };

  // 统计信息
  const stats = useMemo(() => {
    if (!habits.length) return { total: 0, completed: 0, rate: 0, totalStreak: 0 };
    let completed = 0;
    let totalStreak = 0;
    const today = dayjs();
    for (const h of habits) {
      const stats = getStats(h.id, 7);
      if (stats.completed > 0) completed++;
      const streak = getStreak(h.id);
      if (streak > totalStreak) totalStreak = streak;
    }
    return {
      total: habits.length,
      completed,
      rate: habits.length ? Math.round((completed / habits.length) * 100) : 0,
      totalStreak,
    };
  }, [habits, getStats, getStreak]);

  const greetingGradient = useMemo(() => {
    if (accent === 'male') {
      return isDark
        ? 'linear-gradient(135deg, #1e3a8a 0%, #1e40af 50%, #2563eb 100%)'
        : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 50%, #1d4ed8 100%)';
    }
    if (accent === 'female') {
      return isDark
        ? 'linear-gradient(135deg, #831843 0%, #9d174d 50%, #be185d 100%)'
        : 'linear-gradient(135deg, #ec4899 0%, #db2777 50%, #be185d 100%)';
    }
    return isDark
      ? 'linear-gradient(135deg, #4c4c7a 0%, #3d2c5c 100%)'
      : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
  }, [isDark, accent]);

  const isWeekend = useMemo(() => {
    const d = dayjs().day();
    return d === 0 || d === 6;
  }, []);

  const zodiac = useMemo(() => getZodiacFromBirthday(userProfile?.birthday), [userProfile?.birthday]);
  const mbti = userProfile?.mbti || null;

  const isBirthdayToday = useMemo(() => {
    const b = userProfile?.birthday;
    if (!b) return false;
    const d = dayjs(b);
    const t = dayjs();
    return d.month() === t.month() && d.date() === t.date();
  }, [userProfile?.birthday]);

  if (!isInitialized || loading) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 0' }}>
        <Spin size="large">
          <div style={{ padding: '20px 0', color: token.colorTextSecondary }}>
            {!isInitialized ? t('common.loadingInitializing') : t('common.loadingData')}
          </div>
        </Spin>
      </div>
    );
  }

  return (
    <div>
      {/* 问候与日期 */}
      <Card style={{ marginBottom: 24, background: greetingGradient, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
        <Row align="middle" gutter={24}>
          <Col flex="auto">
            <Space align="center" wrap size="small" style={{ marginBottom: 4 }}>
              <Title level={2} style={{ color: '#fff', margin: 0 }}>
                {greeting}
              </Title>
              {isWeekend && (
                <Tag style={{ background: 'rgba(255,255,255,0.25)', color: '#fff', border: 'none', fontSize: 12 }}>
                  {t('dashboard.weekendTag')}
                </Tag>
              )}
              {zodiac && (
                <Tag style={{ background: 'rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.95)', border: 'none', fontSize: 12 }}>
                  {zodiac}
                </Tag>
              )}
              {mbti && (
                <Tag style={{ background: 'rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.95)', border: 'none', fontSize: 12 }}>
                  {mbti}
                </Tag>
              )}
            </Space>
            <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 16 }}>
              {dayjs().format('YYYY年MM月DD日 dddd')}
            </Text>
          </Col>
          <Col>
            <Text style={{ color: 'rgba(255,255,255,0.95)', fontSize: 48, fontWeight: 'bold', letterSpacing: 2 }}>
              {dayjs().format('HH:mm')}
            </Text>
          </Col>
        </Row>
      </Card>

      {isBirthdayToday && (
        <Alert
          type="success"
          message={t('dashboard.birthdayTitle')}
          description={t('dashboard.birthdayDesc')}
          showIcon
          icon={<TrophyOutlined />}
          className="birthday-glow"
          style={{ marginBottom: 24 }}
        />
      )}

      <Row gutter={[16, 16]}>
        {/* 左侧：主要功能卡片 */}
        <Col xs={24} lg={16}>
          {/* AI 管家建议 */}
          <Card
            title={
              <Space>
                <RobotOutlined style={{ color: '#722ed1' }} />
                <span>{t('dashboard.assistantSuggestion', undefined, { name: getAssistantName() })}</span>
              </Space>
            }
            extra={
              isAIConfigured() ? (
                <Button type="primary" size="small" loading={suggestionLoading} onClick={handleFetchSuggestion}>
                  {t('dashboard.getSuggestion')}
                </Button>
              ) : (
                <Button type="link" size="small" onClick={() => navigate('/settings')}>
                  {t('dashboard.goSetupAi')}
                </Button>
              )
            }
            style={{ marginBottom: 16 }}
          >
            {suggestionError && (
              <Alert type="warning" message={suggestionError} style={{ marginBottom: 12 }} showIcon />
            )}
            {suggestionText ? (
              <>
                <SuggestionDisplay text={suggestionText} />
                <Divider style={{ margin: '16px 0' }} />
                <Space wrap>
                  <Text type="secondary">{t('dashboard.quickActions', '快捷执行')}：</Text>
                  <Button size="small" icon={<CheckCircleOutlined />} onClick={handleBatchCheckInClick}>
                    {t('dashboard.batchCheckIn', '当前时段习惯一键打卡')}
                  </Button>
                  <Button size="small" icon={<CalendarOutlined />} onClick={() => navigate('/schedule')}>
                    {t('dashboard.addSchedule', '添加日程')}
                  </Button>
                </Space>
              </>
            ) : !suggestionLoading && !suggestionError && (
              <Paragraph type="secondary" style={{ margin: 0 }}>
                {t('dashboard.suggestionPlaceholder')}
              </Paragraph>
            )}
          </Card>

          <Modal
            title={t('dashboard.batchCheckInConfirm', '确认为以下习惯打卡今日？')}
            open={batchCheckInModalOpen}
            onOk={handleBatchCheckInConfirm}
            onCancel={() => setBatchCheckInModalOpen(false)}
            confirmLoading={batchCheckInLoading}
            okText={t('dashboard.batchCheckInOk', '确认打卡')}
            cancelText={t('common.cancel', '取消')}
          >
            <List
              size="small"
              dataSource={pendingBatchHabits.map((ph) => ph.habit.name)}
              renderItem={(name) => (
                <List.Item>
                  <CheckCircleOutlined style={{ color: '#52c41a', marginRight: 8 }} />
                  {name}
                </List.Item>
              )}
            />
          </Modal>

          {/* 天气信息 */}
          {currentWeather && (
            <Card
              title={
                <Space>
                  <CloudOutlined style={{ color: '#1890ff' }} />
                  <span>{t('dashboard.weather')}</span>
                  {currentCity && (
                    <Tag color="blue">{currentCity.displayName || `${currentCity.name}, ${currentCity.country}`}</Tag>
                  )}
                </Space>
              }
              extra={
                <Button type="link" onClick={() => navigate('/weather')} icon={<RightOutlined />}>
                  {t('dashboard.detail')}
                </Button>
              }
              style={{ marginBottom: 16 }}
            >
              <Row gutter={[16, 16]} align="middle">
                <Col span={12}>
                  <div style={{ textAlign: 'center' }}>
                    {currentWeather.icon && (
                      <img
                        src={`https://openweathermap.org/img/wn/${currentWeather.icon}@2x.png`}
                        alt={currentWeather.description}
                        style={{ width: 60, height: 60 }}
                      />
                    )}
                    <div style={{ fontSize: 48, fontWeight: 'bold', lineHeight: 1 }}>
                      {currentWeather.temp}°
                    </div>
                    <div style={{ fontSize: 14, color: '#666', marginTop: 8 }}>
                      {currentWeather.description}
                    </div>
                  </div>
                </Col>
                <Col span={12}>
                  <Space direction="vertical" size="small" style={{ width: '100%' }}>
                    <div>
                      <Text type="secondary">{t('dashboard.feelsLike')}：</Text>
                      <Text strong>{currentWeather.feelsLike}°C</Text>
                    </div>
                    <div>
                      <Text type="secondary">{t('dashboard.humidity')}：</Text>
                      <Text strong>{currentWeather.humidity}%</Text>
                    </div>
                    {currentWeather.windSpeed > 0 && (
                      <div>
                        <Text type="secondary">{t('dashboard.windSpeed')}：</Text>
                        <Text strong>{currentWeather.windSpeed} m/s</Text>
                      </div>
                    )}
                  </Space>
                </Col>
              </Row>
            </Card>
          )}
          {/* 当前时段习惯推荐 */}
          {currentPeriodInfo && (
            <Card
              title={
                <Space wrap size="small">
                  <ThunderboltOutlined style={{ color: '#1890ff' }} />
                  <span>{t('dashboard.periodRecommend')}</span>
                  <Tag color="blue">{t('dashboard.periodLabel.' + currentPeriodInfo.value)}</Tag>
                  {stats.totalStreak > 0 && (
                    <Tag icon={<FireOutlined />} color="orange">
                      {t('dashboard.streakDays', undefined, { n: stats.totalStreak })}
                    </Tag>
                  )}
                </Space>
              }
              extra={
                <Button type="link" onClick={() => navigate('/habits')} icon={<RightOutlined />}>
                  {t('dashboard.viewAll')}
                </Button>
              }
              style={{ marginBottom: 16 }}
            >
              {periodHabits.length > 0 ? (
                <List
                  dataSource={periodHabits}
                  renderItem={(item) => (
                    <List.Item
                      style={{ cursor: 'pointer', padding: '12px 0' }}
                      onClick={() => navigate('/habits')}
                    >
                      <List.Item.Meta
                        avatar={<Avatar icon={<CheckCircleOutlined />} style={{ backgroundColor: '#52c41a' }} />}
                        title={item.habit.name}
                        description={
                          <Space>
                            {item.habit.reminder_time && (
                              <Text type="secondary">
                                <ClockCircleOutlined /> {item.habit.reminder_time}
                              </Text>
                            )}
                            <Text type="secondary">{t('dashboard.streakDaysShort', undefined, { n: getStreak(item.habit.id) })}</Text>
                          </Space>
                        }
                      />
                      <Button type="primary" size="small" onClick={(e) => { e.stopPropagation(); navigate('/habits'); }}>
                        {t('dashboard.goCheckIn')}
                      </Button>
                    </List.Item>
                  )}
                />
              ) : (
                <FriendlyEmpty context="schedulePeriod" />
              )}
            </Card>
          )}

          {/* 今日新闻（早报/晚报） */}
          {dailyReport && (
            <Card
              title={
                <Space>
                  {dailyReport.type === 'morning' ? (
                    <>
                      <ThunderboltOutlined style={{ color: '#faad14' }} />
                      <span>{t('dashboard.todayMorningReport')}</span>
                    </>
                  ) : (
                    <>
                      <MoonOutlined style={{ color: '#1890ff' }} />
                      <span>{t('dashboard.todayEveningReport')}</span>
                    </>
                  )}
                  <Tag>{dailyReport.date}</Tag>
                </Space>
              }
              extra={
                <Button type="link" onClick={() => navigate('/news')} icon={<RightOutlined />}>
                  {t('dashboard.viewAll')}
                </Button>
              }
              style={{ marginBottom: 16 }}
            >
              {dailyReport.type === 'morning' && dailyReport.categories ? (
                <div>
                  {Object.keys(dailyReport.categories).length === 0 ? (
                    <FriendlyEmpty context="news" />
                  ) : (
                    Object.entries(dailyReport.categories)
                      .filter(([, news]) => news && Array.isArray(news) && news.length > 0)
                      .slice(0, 2) // 只显示前2个分类
                      .map(([category, news]) => {
                        const catInfo = NEWS_CATEGORIES.find((c) => c.value === category);
                        return (
                          <div key={category} style={{ marginBottom: 16 }}>
                            <Text strong>
                              {catInfo?.icon || '📰'} {t('dashboard.newsCategory.' + category)}
                            </Text>
                            <List
                              size="small"
                              dataSource={news.slice(0, 2)} // 每个分类只显示2条
                              renderItem={(item) => (
                                <List.Item style={{ padding: '8px 0' }}>
                                  <List.Item.Meta
                                    title={
                                      <a href={item.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 14 }}>
                                        {item.title}
                                      </a>
                                    }
                                    description={
                                      item.description && (
                                        <Text type="secondary" ellipsis style={{ fontSize: 12 }}>
                                          {item.description}
                                        </Text>
                                      )
                                    }
                                  />
                                </List.Item>
                              )}
                            />
                          </div>
                        );
                      })
                  )}
                </div>
              ) : dailyReport.type === 'evening' && dailyReport.headlines ? (
                dailyReport.headlines.length === 0 ? (
                  <FriendlyEmpty context="news" />
                ) : (
                  <List
                    size="small"
                    dataSource={dailyReport.headlines.slice(0, 3)} // 只显示前3条
                    renderItem={(item) => (
                      <List.Item style={{ padding: '8px 0' }}>
                        <List.Item.Meta
                          title={
                            <a href={item.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 14 }}>
                              {item.title}
                            </a>
                          }
                          description={
                            item.description && (
                              <Text type="secondary" ellipsis style={{ fontSize: 12 }}>
                                {item.description}
                              </Text>
                            )
                          }
                        />
                      </List.Item>
                    )}
                  />
                )
              ) : null}
            </Card>
          )}

          {/* 今日日程 */}
          <Card
            title={
              <Space>
                <CalendarOutlined style={{ color: '#52c41a' }} />
                <span>{t('dashboard.todaySchedule')}</span>
              </Space>
            }
            extra={
              <Button type="link" onClick={() => navigate('/schedule')} icon={<RightOutlined />}>
                {t('dashboard.viewAll')}
              </Button>
            }
            style={{ marginBottom: 16 }}
          >
            {todaySchedules.length > 0 ? (
              <List
                dataSource={todaySchedules}
                renderItem={(schedule) => {
                  const start = schedule.start_time ? dayjs(schedule.start_time).format('HH:mm') : t('dashboard.allDay');
                  const end = schedule.end_time ? dayjs(schedule.end_time).format('HH:mm') : '';
                  return (
                    <List.Item
                      style={{ cursor: 'pointer', padding: '12px 0' }}
                      onClick={() => navigate('/schedule')}
                    >
                      <List.Item.Meta
                        avatar={<Avatar icon={<CalendarOutlined />} style={{ backgroundColor: '#1890ff' }} />}
                        title={schedule.title || t('dashboard.noTitle')}
                        description={
                          <Space>
                            <Text type="secondary">{start}{end ? ` - ${end}` : ''}</Text>
                            {schedule.location && <Text type="secondary">📍 {schedule.location}</Text>}
                            {schedule.tags && schedule.tags.length > 0 && (
                              <Tag color="blue">{schedule.tags[0]}</Tag>
                            )}
                          </Space>
                        }
                      />
                    </List.Item>
                  );
                }}
              />
            ) : (
              <FriendlyEmpty context="schedule" />
            )}
          </Card>

          {/* 统计概览 */}
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12} md={8}>
              <Card>
                <Statistic
                  title={t('dashboard.habitTotal')}
                  value={stats.total}
                  prefix={<CheckCircleOutlined />}
                  valueStyle={{ color: '#1890ff' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Card>
                <Statistic
                  title={t('dashboard.recent7Rate')}
                  value={stats.rate}
                  suffix="%"
                  prefix={<TrophyOutlined />}
                  valueStyle={{ color: '#52c41a' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Card>
                <Statistic
                  title={t('dashboard.longestStreak')}
                  value={stats.totalStreak}
                  suffix={t('dashboard.day')}
                  prefix={<FireOutlined />}
                  valueStyle={{ color: '#faad14' }}
                />
              </Card>
            </Col>
          </Row>
        </Col>

        {/* 右侧：快速入口 */}
        <Col xs={24} lg={8}>
          {/* 每日签到（小卡片） */}
          <Card
            size="small"
            title={
              <Space>
                <SmileOutlined style={{ color: '#faad14' }} />
                <span>{t('dashboard.checkin.title', '今日签到')}</span>
              </Space>
            }
            style={{ marginBottom: 16 }}
          >
            {!checkinToday ? (
              <Button
                type="primary"
                block
                onClick={() => {
                  const data = performCheckin();
                  setCheckinToday(data);
                  message.success(t('dashboard.checkin.done', '签到成功～'));
                }}
              >
                {t('dashboard.checkin.button', '今日签到')}
              </Button>
            ) : (
              <Space direction="vertical" size="small" style={{ width: '100%' }}>
                <div>
                  <Text type="secondary">{t('dashboard.checkin.score', '运势')} </Text>
                  <Tag color="gold">{checkinToday.score}</Tag>
                  <Text type="secondary"> {t('dashboard.checkin.scoreUnit', '分')}</Text>
                </div>
                <div>
                  <Text type="secondary" style={{ fontSize: 12 }}>{t('dashboard.checkin.yi', '宜')} </Text>
                  {checkinToday.yi.slice(0, 2).map((item, i) => (
                    <Tag key={i} color="green" style={{ marginBottom: 2 }}>{item}</Tag>
                  ))}
                </div>
                <div>
                  <Text type="secondary" style={{ fontSize: 12 }}>{t('dashboard.checkin.ji', '忌')} </Text>
                  {checkinToday.ji.slice(0, 2).map((item, i) => (
                    <Tag key={i} style={{ marginBottom: 2 }}>{item}</Tag>
                  ))}
                </div>
              </Space>
            )}
          </Card>

          <Card title={t('dashboard.quickEntry', '快速入口')} style={{ marginBottom: 16 }}>
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
              <Button
                type="default"
                block
                size="large"
                icon={<UserOutlined />}
                onClick={() => navigate('/profile')}
              >
                {t('layout.sidebar.menu.profile', '个人信息')}
              </Button>
              <Button
                type="default"
                block
                size="large"
                icon={<CalendarOutlined />}
                onClick={() => navigate('/schedule')}
              >
                {t('layout.sidebar.menu.schedule', '日程管理')}
              </Button>
              <Button
                type="default"
                block
                size="large"
                icon={<CheckCircleOutlined />}
                onClick={() => navigate('/habits')}
              >
                {t('layout.sidebar.menu.habits', '习惯追踪')}
              </Button>
              <Divider style={{ margin: '8px 0' }} />
              <Button
                type="default"
                block
                size="large"
                icon={<CloudOutlined />}
                onClick={() => navigate('/weather')}
              >
                {t('layout.sidebar.menu.weather', '天气与搭配')}
              </Button>
              <Button
                type="default"
                block
                size="large"
                icon={<FileTextOutlined />}
                onClick={() => navigate('/news')}
              >
                {t('layout.sidebar.menu.news', '新闻资讯')}
              </Button>
              <Button
                type="default"
                block
                size="large"
                icon={<RobotOutlined />}
                onClick={() => navigate('/ai')}
              >
                {t('layout.sidebar.menu.ai', 'AI助手')}
              </Button>
              <Button
                type="default"
                block
                size="large"
                icon={<ExperimentOutlined />}
                onClick={() => navigate('/fun')}
              >
                {t('dashboard.funTools', '趣味工具')}
              </Button>
            </Space>
          </Card>

          {/* 习惯完成进度 */}
          {habits.length > 0 && (
            <Card title={t('dashboard.habitProgress', '习惯完成进度')} style={{ marginBottom: 16 }}>
              <Space direction="vertical" style={{ width: '100%' }} size="small">
                {habits.slice(0, 5).map((habit) => {
                  const stats = getStats(habit.id, 7);
                  return (
                    <div key={habit.id}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <Text strong>{habit.name}</Text>
                        <Text type="secondary">{stats.completed}/{stats.targetDays}</Text>
                      </div>
                      <Progress
                        percent={stats.rate}
                        size="small"
                        strokeColor={{
                          '0%': '#108ee9',
                          '100%': '#87d068',
                        }}
                      />
                    </div>
                  );
                })}
                {habits.length > 5 && (
                  <Button type="link" block onClick={() => navigate('/habits')}>
                    {t('dashboard.viewAllHabits', '查看全部习惯 →')}
                  </Button>
                )}
              </Space>
            </Card>
          )}

          {/* 提示卡片 */}
          <Card>
            <Paragraph type="secondary" style={{ margin: 0, fontSize: 12 }}>
              💡 <Text strong>{t('dashboard.tip', '提示')}</Text>
              <br />
              {t('dashboard.tipDesc1', '点击卡片或按钮可快速跳转到对应功能页面。')}
              <br />
              {t('dashboard.tipDesc2', '当前时段推荐会根据时间自动更新。')}
            </Paragraph>
          </Card>
        </Col>
      </Row>
    </div>
  );
}

export default Dashboard;
