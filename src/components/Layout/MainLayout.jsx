import React, { useState, useEffect } from 'react';
import { Layout, Menu, Spin, Button, theme } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';
import dayjs from 'dayjs';
import {
  DashboardOutlined,
  UserOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  ToolOutlined,
  SkinOutlined,
  CloudOutlined,
  FileTextOutlined,
  RobotOutlined,
  GiftOutlined,
  SettingOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  ExperimentOutlined,
} from '@ant-design/icons';
import useUserStore from '../../stores/userStore';
import useScheduleStore from '../../stores/scheduleStore';
import useReminderStore from '../../stores/reminderStore';
import useSettingsStore from '../../stores/settingsStore';
import useCountdownStore from '../../stores/countdownStore';
import { useTheme } from '../../context/ThemeContext';
import { useI18n } from '../../context/I18nContext';
import { getLogger } from '../../services/logger-client';
import { startReminderPolling, stopReminderPolling } from '../../services/reminder-service';
import { startCountdownReminderPolling, stopCountdownReminderPolling } from '../../services/countdown-reminder-service';
import ReminderModal from '../Reminder/ReminderModal';

const logger = getLogger();

const { Header, Sider, Content } = Layout;

function MainLayout({ children }) {
  const [collapsed, setCollapsed] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();
  const { loadUser, isInitialized, currentUser } = useUserStore();
  const { loadSchedules } = useScheduleStore();
  const { isDark } = useTheme();
  const { token } = theme.useToken();
  const { loadFromDb: loadSettings, get: getSetting } = useSettingsStore();
  const { t } = useI18n();

  useEffect(() => {
    const init = async () => {
      try {
        logger.log('MainLayout', '开始初始化...');
        await Promise.all([loadSettings(), !isInitialized ? loadUser() : Promise.resolve()]);
        logger.log('MainLayout', '初始化完成');
      } catch (error) {
        logger.error('MainLayout', '初始化失败:', error);
      } finally {
        setInitializing(false);
      }
    };

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { loadEvents } = useCountdownStore();

  // 日程提醒轮询（用户已初始化且存在时启动）
  useEffect(() => {
    if (!isInitialized || !currentUser) return;
    const getSchedules = async () => {
      await loadSchedules();
      return useScheduleStore.getState().schedules;
    };
    const onReminder = (payload) => useReminderStore.getState().pushReminder(payload);
    startReminderPolling(getSchedules, onReminder);
    return () => stopReminderPolling();
  }, [isInitialized, currentUser, loadSchedules]);

  // 倒数纪念日提醒轮询
  useEffect(() => {
    if (!isInitialized || !currentUser) return;
    const getEvents = async () => {
      await loadEvents();
      return useCountdownStore.getState().events;
    };
    startCountdownReminderPolling(getEvents);
    return () => stopCountdownReminderPolling();
  }, [isInitialized, currentUser, loadEvents]);

  // 每日提醒：到点后请求今日摘要并弹出系统通知（需开启 API 桥接）
  useEffect(() => {
    const KEY = 'personal-butler-last-daily-notify-date';
    const interval = setInterval(() => {
      const enabled = (getSetting('daily_reminder_enabled') || '').toLowerCase();
      if (enabled !== '1' && enabled !== 'true') return;
      const timeStr = getSetting('daily_reminder_time') || '08:00';
      const now = dayjs();
      if (now.format('HH:mm') !== timeStr) return;
      const today = now.format('YYYY-MM-DD');
      try {
        if (localStorage.getItem(KEY) === today) return;
      } catch (_) {}
      const port = parseInt(getSetting('api_bridge_port'), 10) || 3847;
      const secret = (getSetting('api_bridge_secret') || '').trim();
      const url = `http://127.0.0.1:${port}/api/v1/summary`;
      const headers = { 'Content-Type': 'application/json' };
      if (secret) headers['X-API-Key'] = secret;
      fetch(url, { method: 'GET', headers })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          let body = '';
          if (data && typeof data === 'object') {
            const s = data.today_schedule?.length || 0;
            const h = data.habits?.length || 0;
            const done = data.habits?.filter((x) => x.today_completed).length || 0;
            const c = data.countdown_upcoming?.length || 0;
            body = `今日 ${s} 个日程，${h} 个习惯（${done} 已打卡）${c > 0 ? `，${c} 个倒数/纪念日临近` : ''}`;
          } else {
            body = '打开个人管家查看今日安排';
          }
          if (typeof Notification !== 'undefined') {
            try {
              new Notification('个人管家', { body });
            } catch (_) {}
          }
          try {
            localStorage.setItem(KEY, today);
          } catch (_) {}
        })
        .catch(() => {
          if (typeof Notification !== 'undefined') {
            try {
              new Notification('个人管家', { body: '打开个人管家查看今日安排' });
            } catch (_) {}
          }
          try {
            localStorage.setItem(KEY, today);
          } catch (_) {}
        });
    }, 60 * 1000);
    return () => clearInterval(interval);
  }, [getSetting]);

  if (initializing) {
    return (
      <Layout
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: token.colorBgLayout,
        }}
      >
        <Spin size="large">
          <div style={{ padding: '20px 0', color: token.colorTextSecondary }}>{t('common.loadingInitializing', '正在初始化...')}</div>
        </Spin>
      </Layout>
    );
  }

  const siderWidth = collapsed ? 80 : 200;

  const menuGroupItems = [
    {
      type: 'group',
      label: t('layout.sidebar.groups.overview', '概览'),
      children: [
        { key: '/', icon: <DashboardOutlined />, label: t('layout.sidebar.menu.dashboard', '仪表盘') },
        { key: '/profile', icon: <UserOutlined />, label: t('layout.sidebar.menu.profile', '个人信息') },
      ],
    },
    {
      type: 'group',
      label: t('layout.sidebar.groups.planHabits', '计划与习惯'),
      children: [
        { key: '/schedule', icon: <CalendarOutlined />, label: t('layout.sidebar.menu.schedule', '日程管理') },
        { key: '/habits', icon: <CheckCircleOutlined />, label: t('layout.sidebar.menu.habits', '习惯追踪') },
        { key: '/countdown', icon: <GiftOutlined />, label: t('layout.sidebar.menu.countdown', '倒数纪念日') },
      ],
    },
    {
      type: 'group',
      label: t('layout.sidebar.groups.itemsOutfits', '物品与搭配'),
      children: [
        { key: '/equipment', icon: <ToolOutlined />, label: t('layout.sidebar.menu.equipment', '装备管理') },
        { key: '/clothing', icon: <SkinOutlined />, label: t('layout.sidebar.menu.clothing', '服装管理') },
        { key: '/weather', icon: <CloudOutlined />, label: t('layout.sidebar.menu.weather', '天气与搭配') },
      ],
    },
    {
      type: 'group',
      label: t('layout.sidebar.groups.newsAssistant', '资讯与助手'),
      children: [
        { key: '/news', icon: <FileTextOutlined />, label: t('layout.sidebar.menu.news', '新闻资讯') },
        { key: '/ai', icon: <RobotOutlined />, label: t('layout.sidebar.menu.ai', 'AI助手') },
      ],
    },
    {
      type: 'group',
      label: t('layout.sidebar.groups.fun', '趣味'),
      children: [
        { key: '/fun', icon: <ExperimentOutlined />, label: t('layout.sidebar.menu.fun', '趣味工具') },
      ],
    },
    {
      type: 'group',
      label: t('layout.sidebar.groups.system', '系统'),
      children: [
        { key: '/settings', icon: <SettingOutlined />, label: t('layout.sidebar.menu.settings', '设置') },
      ],
    },
  ];

  return (
    <Layout className="app-layout" style={{ minHeight: '100vh', height: '100vh', overflow: 'hidden', background: token.colorBgLayout }}>
      <ReminderModal />
      <Sider
        className="app-sidebar"
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        theme={isDark ? 'dark' : 'light'}
        width={200}
        trigger={null}
        style={{
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          zIndex: 100,
          overflow: 'hidden',
        }}
      >
        <div className="sidebar-inner" style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div className="sidebar-header" style={{ height: 64, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 12px', gap: 8, borderBottom: `1px solid ${token.colorBorderSecondary}` }}>
            <span style={{ fontSize: 18, fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {collapsed ? t('layout.sidebar.titleShort', 'PB') : t('layout.header.title', 'Personal Butler')}
            </span>
            <Button
              type="text"
              size="small"
              className="sidebar-collapse-btn"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed(!collapsed)}
              style={{ flexShrink: 0 }}
            />
          </div>
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', WebkitOverflowScrolling: 'touch' }}>
            <Menu
              className="sidebar-menu"
              mode="inline"
              selectedKeys={[location.pathname]}
              items={menuGroupItems}
              onClick={({ key }) => navigate(key)}
              style={{ borderRight: 0 }}
            />
          </div>
        </div>
      </Sider>
      <Layout
        style={{
          marginLeft: siderWidth,
          flex: 1,
          minWidth: 0,
          height: '100vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <Header
          className="main-header"
          style={{
            flexShrink: 0,
            background: token.colorBgContainer,
            padding: '0 24px',
            borderBottom: `1px solid ${token.colorBorderSecondary}`,
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 500, color: token.colorText }}>
            {t('layout.header.title', '个人管家')}
          </h1>
        </Header>
        <Content
          className="main-content"
          style={{
            flex: 1,
            margin: 24,
            padding: 24,
            overflow: 'auto',
            background: token.colorBgContainer,
            borderRadius: token.borderRadius,
            minHeight: 0,
          }}
        >
          {children}
        </Content>
      </Layout>
    </Layout>
  );
}

export default MainLayout;
