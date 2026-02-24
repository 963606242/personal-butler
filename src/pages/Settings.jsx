import React, { useState, useEffect } from 'react';
import {
  Card,
  Form,
  Input,
  Button,
  Typography,
  message,
  Space,
  Select,
  Alert,
  Radio,
  Collapse,
  Tag,
  Modal,
  Tooltip,
  Switch,
  InputNumber,
  TimePicker,
} from 'antd';
import {
  SaveOutlined,
  LinkOutlined,
  ExclamationCircleOutlined,
  DeleteOutlined,
  ApiOutlined,
  RobotOutlined,
  DatabaseOutlined,
  BookOutlined,
  CloudSyncOutlined,
} from '@ant-design/icons';
import useSettingsStore from '../stores/settingsStore';
import useUserStore from '../stores/userStore';
import useScheduleStore from '../stores/scheduleStore';
import useHabitStore from '../stores/habitStore';
import useCountdownStore from '../stores/countdownStore';
import useEquipmentStore from '../stores/equipmentStore';
import useClothingStore from '../stores/clothingStore';
import useOutfitStore from '../stores/outfitStore';
import useAiChatStore from '../stores/aiChatStore';
import { useOnboarding } from '../context/OnboardingContext';
import { useI18n } from '../context/I18nContext';
import { API_KEY_CONFIGS } from '../constants/settings-api-links';
import { resetAppData } from '../services/data-reset-service';
import { getDatabasePath, apiBridgeRestart, readApiBridgeDoc, isElectron, isCapacitor, syncSaveEncryptionPassword, syncClearEncryptionPassword } from '../platform';
import * as syncService from '../services/sync/sync-service';
import { HAS_BUILTIN_ONEDRIVE, BUILTIN_ONEDRIVE_CLIENT_ID } from '../constants/sync';
import dayjs from 'dayjs';
import ReactMarkdown from 'react-markdown';
import './Settings.css';

const { Title, Text } = Typography;

const AI_PROVIDERS = [
  { value: 'ollama', label: 'Ollama（本地）' },
  { value: 'openai', label: 'OpenAI 协议' },
  { value: 'anthropic', label: 'Anthropic 协议' },
];

export default function Settings() {
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [provider, setProvider] = useState('ollama');
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [apiBridgeEnabled, setApiBridgeEnabled] = useState(false);
  const [apiBridgePort, setApiBridgePort] = useState(3847);
  const [apiBridgeSecret, setApiBridgeSecret] = useState('');
  const [apiBridgeSaving, setApiBridgeSaving] = useState(false);
  const [apiBridgeDocVisible, setApiBridgeDocVisible] = useState(false);
  const [apiBridgeDocContent, setApiBridgeDocContent] = useState('');
  const [dailyReminderEnabled, setDailyReminderEnabled] = useState(false);
  const [dailyReminderTime, setDailyReminderTime] = useState('08:00');
  const [databasePath, setDatabasePath] = useState('');
  const [syncEnabled, setSyncEnabled] = useState(false);
  const [syncProvider, setSyncProvider] = useState('onedrive');
  const [syncClientId, setSyncClientId] = useState('');
  const [syncWebdavUrl, setSyncWebdavUrl] = useState('');
  const [syncWebdavUser, setSyncWebdavUser] = useState('');
  const [syncWebdavPassword, setSyncWebdavPassword] = useState('');
  const [syncPassword, setSyncPassword] = useState('');
  const [syncRememberPassword, setSyncRememberPassword] = useState(false);
  const [syncLastSyncAt, setSyncLastSyncAt] = useState('');
  const [syncLoading, setSyncLoading] = useState(false);
  const [oauthConnecting, setOauthConnecting] = useState(false);
  const { loaded, loadFromDb, setMany, set, get } = useSettingsStore();
  const currentUser = useUserStore((s) => s.currentUser);
  const { open: openOnboarding } = useOnboarding();
  const { t, locale, setLocale } = useI18n();

  const THEME_OPTIONS = [
    { value: 'light', label: t('settings.appearance.themeOptions.light', '浅色模式') },
    { value: 'dark', label: t('settings.appearance.themeOptions.dark', '深色模式') },
    { value: 'system', label: t('settings.appearance.themeOptions.system', '跟随系统') },
  ];

  const LANGUAGE_OPTIONS = [
    { value: 'zh-CN', label: t('settings.appearance.languageOptions.zhCN', '简体中文') },
    { value: 'en-US', label: t('settings.appearance.languageOptions.enUS', 'English') },
  ];

  useEffect(() => {
    loadFromDb();
  }, [loadFromDb]);

  useEffect(() => {
    if (!loaded) return;
    const v = {
      tianapi_key: get('tianapi_key') ?? '',
      jisuapi_key: get('jisuapi_key') ?? '',
      news_api_key: get('news_api_key') ?? '',
      weather_api_key: get('weather_api_key') ?? '',
      ai_provider: get('ai_provider') || 'ollama',
      ollama_base_url: get('ollama_base_url') || 'http://localhost:11434',
      ollama_model: get('ollama_model') || 'llama3.2',
      openai_base_url: get('openai_base_url') ?? '',
      openai_api_key: get('openai_api_key') ?? '',
      openai_model: get('openai_model') || 'gpt-4o-mini',
      anthropic_base_url: get('anthropic_base_url') ?? '',
      anthropic_api_key: get('anthropic_api_key') ?? '',
      anthropic_model: get('anthropic_model') || 'claude-3-5-haiku-20241022',
      ai_assistant_name: get('ai_assistant_name') ?? '',
    };
    form.setFieldsValue(v);
    setProvider(v.ai_provider || 'ollama');
  }, [loaded, get, form]);

  useEffect(() => {
    if (!loaded) return;
    const enabled = (get('api_bridge_enabled') || '').toLowerCase();
    setApiBridgeEnabled(enabled === '1' || enabled === 'true');
    const p = parseInt(get('api_bridge_port'), 10);
    setApiBridgePort(Number.isNaN(p) ? 3847 : p);
    setApiBridgeSecret(get('api_bridge_secret') || '');
    const drEnabled = (get('daily_reminder_enabled') || '').toLowerCase();
    setDailyReminderEnabled(drEnabled === '1' || drEnabled === 'true');
    setDailyReminderTime(get('daily_reminder_time') || '08:00');
  }, [loaded, get]);

  useEffect(() => {
    if (isElectron()) {
      getDatabasePath().then(setDatabasePath).catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (!loaded) return;
    setSyncEnabled((get('sync_enabled') || '') === '1');
    setSyncProvider(get('sync_provider') || 'onedrive');
    setSyncClientId(get('sync_onedrive_client_id') || get('sync_googledrive_client_id') || get('sync_dropbox_client_id') || '');
    setSyncWebdavUrl(get('sync_webdav_url') || '');
    setSyncWebdavUser(get('sync_webdav_user') || '');
    setSyncWebdavPassword(get('sync_webdav_password') || '');
    const last = get('sync_last_sync_at');
    setSyncLastSyncAt(last ? dayjs(parseInt(last, 10)).format('YYYY-MM-DD HH:mm') : '');
  }, [loaded, get]);

  const onFinish = async (v) => {
    if (!v || typeof v !== 'object') return;
    setSaving(true);
    try {
      await setMany({
        tianapi_key: v.tianapi_key ?? '',
        jisuapi_key: v.jisuapi_key ?? '',
        news_api_key: v.news_api_key ?? '',
        weather_api_key: v.weather_api_key ?? '',
        ai_provider: v.ai_provider || 'ollama',
        ollama_base_url: (v.ollama_base_url || '').trim() || 'http://localhost:11434',
        ollama_model: (v.ollama_model || '').trim() || 'llama3.2',
        openai_base_url: (v.openai_base_url || '').trim(),
        openai_api_key: v.openai_api_key ?? '',
        openai_model: (v.openai_model || '').trim() || 'gpt-4o-mini',
        anthropic_base_url: (v.anthropic_base_url || '').trim(),
        anthropic_api_key: v.anthropic_api_key ?? '',
        anthropic_model: (v.anthropic_model || '').trim() || 'claude-3-5-haiku-20241022',
        ai_assistant_name: (v.ai_assistant_name || '').trim() || '',
      });
      message.success(t('settings.messages.saveSuccess', '设置已保存'));
    } catch (e) {
      message.error(t('settings.messages.saveFailed', '保存失败'));
    } finally {
      setSaving(false);
    }
  };

  const handleThemeChange = async (e) => {
    const v = e?.target?.value || 'system';
    try {
      await set('theme', v);
      message.success(t('settings.messages.themeSwitched', '主题已切换'));
    } catch (err) {
      message.error(t('settings.messages.themeSaveFailed', '保存主题失败'));
    }
  };

  const handleLanguageChange = async (value) => {
    try {
      await setLocale(value);
      message.success(t('settings.messages.languageSwitched', '语言已切换'));
    } catch (err) {
      message.error(t('settings.messages.languageSaveFailed', '保存语言失败'));
    }
  };

  const handleApiBridgeSave = async () => {
    setApiBridgeSaving(true);
    try {
      await set('api_bridge_enabled', apiBridgeEnabled ? '1' : '0');
      await set('api_bridge_port', String(apiBridgePort));
      await set('api_bridge_secret', (apiBridgeSecret || '').trim());
      if (isElectron()) {
        const result = await apiBridgeRestart();
        if (result?.success) {
          message.success(t('settings.sections.apiBridgeSaveSuccess', '已保存，API 已重启'));
        } else {
          message.warning(t('settings.messages.saveSuccess', '设置已保存') + (result?.error ? ` (${result.error})` : ''));
        }
      } else {
        message.success(t('settings.messages.saveSuccess', '设置已保存'));
      }
    } catch (e) {
      message.error(t('settings.messages.saveFailed', '保存失败'));
    } finally {
      setApiBridgeSaving(false);
    }
  };

  const generateApiKey = () => {
    const part = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
    setApiBridgeSecret(part() + part());
  };

  const handleSyncEnabledChange = async (checked) => {
    setSyncEnabled(checked);
    await set('sync_enabled', checked ? '1' : '0');
    if (checked) syncService.startSyncInterval();
    else syncService.stopSyncInterval();
    message.success(t('settings.messages.saveSuccess', '设置已保存'));
  };

  const handleConnectOAuth = async () => {
    const keyMap = { onedrive: 'sync_onedrive_client_id', googledrive: 'sync_googledrive_client_id', dropbox: 'sync_dropbox_client_id' };
    const key = keyMap[syncProvider];
    let clientId = (syncClientId || '').trim() || (key ? get(key) : '') || '';
    if (syncProvider === 'onedrive' && !clientId && HAS_BUILTIN_ONEDRIVE) clientId = BUILTIN_ONEDRIVE_CLIENT_ID;
    if (syncProvider !== 'webdav' && !clientId) {
      message.warning('请先填写当前同步目标的客户端 ID / App key');
      return;
    }
    if (key && clientId) await set(key, clientId);
    setOauthConnecting(true);
    try {
      const loginRes = await syncService.openLoginWindow(clientId);
      if (!loginRes.success || !loginRes.code) {
        message.error(loginRes.error || '登录取消或失败');
        return;
      }
      const tokenRes = await syncService.exchangeCodeForTokens(clientId, loginRes.code, loginRes.codeVerifier);
      if (!tokenRes.success) {
        message.error(tokenRes.error || '获取令牌失败');
        return;
      }
      message.success('已连接');
    } catch (e) {
      message.error(e?.message || '连接失败');
    } finally {
      setOauthConnecting(false);
    }
  };

  const handleSyncProviderChange = async (provider) => {
    setSyncProvider(provider);
    await set('sync_provider', provider);
    const cid = provider === 'onedrive' ? get('sync_onedrive_client_id') : provider === 'googledrive' ? get('sync_googledrive_client_id') : provider === 'dropbox' ? get('sync_dropbox_client_id') : '';
    setSyncClientId(cid || '');
  };

  const handlePushSync = async () => {
    if (!syncPassword.trim()) {
      message.warning('请填写同步加密密码');
      return;
    }
    setSyncLoading(true);
    try {
      const res = await syncService.pushSync(syncPassword);
      if (res.success) {
        message.success('已上传到云端');
        setSyncLastSyncAt(dayjs().format('YYYY-MM-DD HH:mm'));
        if (syncRememberPassword) {
          const r = await syncSaveEncryptionPassword(syncPassword);
          if (!r.success) message.info('无法在此设备保存密码：' + (r.error || ''));
        }
      } else message.error(res.error || '上传失败');
    } finally {
      setSyncLoading(false);
    }
  };

  const handlePullSync = async () => {
    const pwd = syncPassword.trim() || null;
    if (!pwd) {
      message.warning('请填写同步加密密码（与上传时一致），或勾选「在此设备记住密码」后先上传一次');
      return;
    }
    setSyncLoading(true);
    try {
      const res = await syncService.pullSync(pwd);
      if (res.success) {
        message.success('已从云端拉取并覆盖本地数据');
        setSyncLastSyncAt(dayjs().format('YYYY-MM-DD HH:mm'));
        if (syncRememberPassword) {
          const r = await syncSaveEncryptionPassword(pwd);
          if (!r.success) message.info('无法在此设备保存密码：' + (r.error || ''));
        }
        window.location.reload();
      } else message.error(res.error || '拉取失败');
    } finally {
      setSyncLoading(false);
    }
  };

  const isKeyConfigured = (key) => {
    const val = get(key) ?? '';
    return typeof val === 'string' && val.trim().length > 0;
  };

  const handleDataReset = async () => {
      if (!currentUser?.id) {
      message.error(t('settings.messages.loginFirst', '请先登录'));
      return;
    }
    setResetting(true);
    try {
      const { cleared, error } = await resetAppData(currentUser.id);
      if (error) {
        message.error(error);
        return;
      }
      message.success(t('settings.messages.resetSuccess', '已重置 {{count}} 类数据', { count: cleared.length }));
      setResetModalOpen(false);
      useScheduleStore.getState().loadSchedules?.();
      useHabitStore.getState().loadHabits?.();
      useCountdownStore.getState().loadEvents?.();
      useEquipmentStore.getState().loadEquipment?.();
      useClothingStore.getState().loadClothing?.();
      useOutfitStore.getState().loadOutfits?.();
      useAiChatStore.getState().loadMessages?.();
    } catch (e) {
      message.error(e?.message || t('settings.messages.resetFailed', '重置失败'));
    } finally {
      setResetting(false);
    }
  };

  const configuredCount = API_KEY_CONFIGS.filter((c) => isKeyConfigured(c.key)).length;

  const collapseItems = [
    {
      key: 'appearance',
      label: (
        <Space>
          <span>{t('settings.appearance.sectionTitle', '外观')}</span>
          <Tag color="blue">{t('settings.appearance.themeLabel', '主题')}</Tag>
        </Space>
      ),
      children: (
        <Card size="small" type="inner">
          <Form.Item label={t('settings.appearance.themeLabel', '主题')}>
            <Radio.Group
              options={THEME_OPTIONS}
              value={get('theme') || 'system'}
              onChange={handleThemeChange}
              optionType="button"
              buttonStyle="solid"
            />
          </Form.Item>
          <Form.Item label={t('settings.appearance.languageLabel', '语言')}>
            <Select
              options={LANGUAGE_OPTIONS}
              value={locale}
              onChange={handleLanguageChange}
              style={{ width: 160 }}
            />
          </Form.Item>
          <Form.Item
            label={t('settings.sections.dailyReminder', '每日提醒')}
            extra={t('settings.sections.dailyReminderDesc', '到点后在本机弹出系统通知，展示今日摘要（需已开启「AI 调用本应用」）')}
          >
            <Space>
              <Switch
                checked={dailyReminderEnabled}
                onChange={async (checked) => {
                  setDailyReminderEnabled(checked);
                  try {
                    await set('daily_reminder_enabled', checked ? '1' : '0');
                    message.success(t('settings.messages.saveSuccess', '设置已保存'));
                  } catch (_) {
                    message.error(t('settings.messages.saveFailed', '保存失败'));
                  }
                }}
              />
              <span>{t('settings.sections.dailyReminderEnabled', '启用每日提醒')}</span>
              <TimePicker
                format="HH:mm"
                value={dailyReminderTime ? (() => {
                  const [h, m] = dailyReminderTime.split(':').map(Number);
                  const d = new Date();
                  d.setHours(h || 8, m || 0, 0, 0);
                  return dayjs(d);
                })() : null}
                onChange={(_, str) => {
                  const val = str || '08:00';
                  setDailyReminderTime(val);
                  set('daily_reminder_time', val).then(() => message.success(t('settings.messages.saveSuccess', '设置已保存'))).catch(() => message.error(t('settings.messages.saveFailed', '保存失败')));
                }}
                minuteStep={5}
                disabled={!dailyReminderEnabled}
              />
            </Space>
          </Form.Item>
        </Card>
      ),
    },
    {
      key: 'apikeys',
      label: (
        <Space>
          <ApiOutlined />
          <span>{t('settings.sections.apikeys', 'API Keys')}</span>
          {configuredCount > 0 && (
            <Tag color="green">{t('settings.sections.configuredCount', '已配置 {{n}} / {{total}}', { n: configuredCount, total: API_KEY_CONFIGS.length })}</Tag>
          )}
        </Space>
      ),
      children: (
        <Card size="small" type="inner">
          <Alert
            type="info"
            showIcon
            message={t('settings.sections.configNote', '配置说明')}
            description={t('settings.sections.configNoteDesc', '以下 Key 保存到本地，优先于 .env。修改后无需重启。获取 Key 后请到对应控制台配置；天聚数行需单独申请「国内新闻」「分类新闻」接口权限。')}
            style={{ marginBottom: 16 }}
          />
          {API_KEY_CONFIGS.map((cfg) => (
            <Form.Item
              key={cfg.key}
              name={cfg.key}
              label={
                <Space wrap size="small">
                  <span>{cfg.label}</span>
                  <Text type="secondary">（{cfg.usage}）</Text>
                  {isKeyConfigured(cfg.key) ? (
                    <Tag color="green">{t('settings.sections.configured', '已配置')}</Tag>
                  ) : (
                    <Tag>{t('settings.sections.notConfigured', '未配置')}</Tag>
                  )}
                  <a
                    href={cfg.configUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: 12 }}
                  >
                    <LinkOutlined /> {cfg.configUrlLabel}
                  </a>
                  {cfg.requiredApis && cfg.requiredApis.length > 0 && (
                    <Tooltip
                      title={
                        <span>
                          {t('settings.sections.applyInConsole', '需在控制台申请：')}
                          {cfg.requiredApis.map((a, i) => (
                            <span key={a.name}>
                              {i > 0 && '、'}
                              <a href={a.url} target="_blank" rel="noopener noreferrer" style={{ color: '#fff', textDecoration: 'underline' }}>
                                {a.name}
                              </a>
                            </span>
                          ))}
                        </span>
                      }
                    >
                      <Tag color="orange">{t('settings.sections.requireApiTag', '需申请接口')}</Tag>
                    </Tooltip>
                  )}
                </Space>
              }
            >
              <Input.Password placeholder={cfg.placeholder} autoComplete="off" />
            </Form.Item>
          ))}
          <Form.Item>
            <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={saving}>
              {t('settings.sections.saveApiKeys', '保存 API Keys')}
            </Button>
          </Form.Item>
        </Card>
      ),
    },
    {
      key: 'ai',
      label: (
        <Space>
          <RobotOutlined />
          <span>{t('settings.sections.aiAssistant', 'AI 助手')}</span>
        </Space>
      ),
      children: (
        <Card size="small" type="inner">
          <Form.Item
            name="ai_assistant_name"
            label={t('settings.sections.assistantName', '管家名称')}
            extra={t('settings.sections.assistantNameExtra', '如贾维斯、小爱同学等，留空则使用默认「AI 管家」')}
          >
            <Input placeholder={t('settings.sections.assistantNamePlaceholder', '贾维斯、小爱同学…')} allowClear maxLength={24} />
          </Form.Item>
          <Form.Item name="ai_provider" label={t('settings.sections.provider', '提供商')}>
            <Select
              options={AI_PROVIDERS}
              onChange={(val) => setProvider(val || 'ollama')}
            />
          </Form.Item>
          {provider === 'ollama' && (
            <>
              <Form.Item name="ollama_base_url" label={t('settings.sections.ollamaUrl', 'Ollama 地址')} extra={t('settings.sections.ollamaUrlExtra', '默认 http://localhost:11434')}>
                <Input placeholder="http://localhost:11434" />
              </Form.Item>
              <Form.Item name="ollama_model" label={t('settings.sections.ollamaModel', '模型')} extra={t('settings.sections.ollamaModelExtra', '如 llama3.2、qwen2.5')}>
                <Input placeholder="llama3.2" />
              </Form.Item>
            </>
          )}
          {provider === 'openai' && (
            <>
              <Form.Item
                name="openai_base_url"
                label={t('settings.sections.apiUrlOptional', 'API 地址（可选）')}
                extra={t('settings.sections.apiUrlOpenaiExtra', '留空为 OpenAI 官方。Xiaomi MiMo 等兼容服务填 base_url，如 https://api.xiaomimimo.com/v1')}
              >
                <Input placeholder="https://api.openai.com/v1 或 https://api.xiaomimimo.com/v1" />
              </Form.Item>
              <Form.Item name="openai_api_key" label={t('settings.sections.apiKey', 'API Key')} rules={[{ required: true, message: t('settings.sections.requiredPlaceholder', '请填写') }]}>
                <Input.Password placeholder="sk-..." autoComplete="off" />
              </Form.Item>
              <Form.Item name="openai_model" label={t('settings.sections.ollamaModel', '模型')} extra={t('settings.sections.modelOpenaiExtra', 'OpenAI: gpt-4o-mini；MiMo: mimo-v2-flash')}>
                <Input placeholder="gpt-4o-mini" />
              </Form.Item>
            </>
          )}
          {provider === 'anthropic' && (
            <>
              <Form.Item
                name="anthropic_base_url"
                label={t('settings.sections.apiUrlOptional', 'API 地址（可选）')}
                extra={t('settings.sections.apiUrlAnthropicExtra', '留空为 Anthropic 官方；兼容服务可填自定义 base_url')}
              >
                <Input placeholder="https://api.anthropic.com/v1" />
              </Form.Item>
              <Form.Item name="anthropic_api_key" label={t('settings.sections.apiKey', 'API Key')} rules={[{ required: true, message: t('settings.sections.requiredPlaceholder', '请填写') }]}>
                <Input.Password placeholder="sk-ant-..." autoComplete="off" />
              </Form.Item>
              <Form.Item name="anthropic_model" label={t('settings.sections.ollamaModel', '模型')} extra={t('settings.sections.modelAnthropicExtra', '如 claude-3-5-haiku、claude-3-5-sonnet')}>
                <Input placeholder="claude-3-5-haiku-20241022" />
              </Form.Item>
            </>
          )}
          <Form.Item>
            <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={saving}>
              {t('settings.sections.saveAiConfig', '保存 AI 配置')}
            </Button>
          </Form.Item>
        </Card>
      ),
    },
    {
      key: 'apiBridge',
      label: (
        <Space>
          <RobotOutlined />
          <span>{t('settings.sections.apiBridge', 'AI 调用本应用')}</span>
        </Space>
      ),
      children: (
        <Card size="small" type="inner">
          <Alert
            type="info"
            showIcon
            message={t('settings.sections.apiBridge', 'AI 调用本应用')}
            description={t('settings.sections.apiBridgeDesc', '开启后，本应用会在本机启动一个 HTTP API（仅 localhost），供外部 AI、脚本或插件读取/写入习惯、日程、倒数等数据。')}
            style={{ marginBottom: 16 }}
          />
          <div>
            <Form.Item label={t('settings.sections.apiBridgeEnable', '启用 API')}>
              <Switch checked={apiBridgeEnabled} onChange={setApiBridgeEnabled} />
            </Form.Item>
            <Form.Item label={t('settings.sections.apiBridgePort', '端口')} extra={t('settings.sections.apiBridgePortExtra', '默认 3847，仅监听 127.0.0.1')}>
              <InputNumber min={1024} max={65535} value={apiBridgePort} onChange={(v) => setApiBridgePort(v ?? 3847)} style={{ width: 120 }} />
            </Form.Item>
            <Form.Item label={t('settings.sections.apiBridgeSecret', 'API Key（可选）')} extra={t('settings.sections.apiBridgeSecretExtra', '留空则不校验；设置后请求头需带 X-API-Key')}>
              <Space.Compact style={{ width: '100%' }}>
                <Input.Password placeholder="留空则不校验" value={apiBridgeSecret} onChange={(e) => setApiBridgeSecret(e.target.value)} style={{ maxWidth: 280 }} />
                <Button onClick={generateApiKey}>{t('settings.sections.apiBridgeGenerate', '生成')}</Button>
              </Space.Compact>
            </Form.Item>
            <Form.Item>
              <Button type="primary" onClick={handleApiBridgeSave} loading={apiBridgeSaving}>
                {t('settings.sections.apiBridgeSave', '保存并重启 API')}
              </Button>
              <Button
                type="link"
                onClick={async () => {
                  if (isElectron()) {
                    const { success, content } = await readApiBridgeDoc();
                    setApiBridgeDocContent(success ? content : '');
                  }
                  setApiBridgeDocVisible(true);
                }}
                style={{ marginLeft: 8 }}
              >
                {t('settings.sections.apiBridgeDoc', 'API 说明')}
              </Button>
            </Form.Item>
          </div>
        </Card>
      ),
    },
    ...((isElectron() || isCapacitor())
      ? [
          {
            key: 'sync',
            label: (
              <Space>
                <CloudSyncOutlined />
                <span>云端同步</span>
              </Space>
            ),
            children: (
              <Card size="small" type="inner">
                <Alert
                  type="info"
                  showIcon
                  message="本地优先，加密同步到您的网盘"
                  description="数据仅存本地与您选择的网盘，无需在本应用注册账号。加密后上传到 OneDrive / Google Drive / Dropbox / WebDAV，其他设备（如 Windows / iPad）配置相同网盘与加密密码即可拉取。打开应用与定时（约 15 分钟）会自动拉取（需已「记住密码」）。"
                  style={{ marginBottom: 16 }}
                />
                <Form.Item label="启用同步">
                  <Switch checked={syncEnabled} onChange={handleSyncEnabledChange} />
                </Form.Item>
                <Form.Item label="同步目标">
                  <Select
                    value={syncProvider}
                    onChange={handleSyncProviderChange}
                    options={syncService.getAllAdapters().map((a) => ({ value: a.id, label: a.name }))}
                    style={{ width: 280 }}
                  />
                </Form.Item>
                {(syncProvider === 'onedrive' || syncProvider === 'googledrive' || syncProvider === 'dropbox') && (
                  <>
                    {syncProvider === 'onedrive' && HAS_BUILTIN_ONEDRIVE && (
                      <Alert
                        type="info"
                        showIcon
                        message="与 Remotely Save 相同方式：无需自行注册 Azure"
                        description="本应用已配置内置 OneDrive 授权。您只需点击下方「登录并授权」，使用个人微软账号登录并同意权限即可，无需填写客户端 ID。若希望使用自己的 Azure 应用，可在「高级」中填写。"
                        style={{ marginBottom: 16 }}
                      />
                    )}
                    {syncProvider === 'onedrive' && (
                      <Collapse
                        size="small"
                        items={[
                          {
                            key: 'onedrive-advanced',
                            label: HAS_BUILTIN_ONEDRIVE ? '高级：使用自己的 Azure 应用（可选）' : '如何获取 OneDrive 客户端 ID（必读）',
                            children: (
                              <div style={{ paddingRight: 8 }}>
                                {!HAS_BUILTIN_ONEDRIVE && (
                                  <Alert
                                    type="warning"
                                    showIcon
                                    message="若提示「在目录外部创建应用已被弃用」"
                                    description={
                                      <span>
                                        微软已要求应用必须在「目录」(租户) 内创建。可
                                        <a href="https://developer.microsoft.com/microsoft-365/profile" target="_blank" rel="noopener noreferrer">加入 M365 开发者计划</a>或
                                        <a href="https://azure.microsoft.com/zh-cn/free/" target="_blank" rel="noopener noreferrer">注册 Azure 免费账户</a>。
                                        或直接选 <strong>Google Drive、Dropbox、WebDAV</strong> 无需 Azure。
                                      </span>
                                    }
                                    style={{ marginBottom: 12 }}
                                  />
                                )}
                                <p style={{ marginBottom: 8 }}>1. 打开 <a href="https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps/ApplicationsListBlade" target="_blank" rel="noopener noreferrer">Azure 应用注册</a>（需已有所属目录）。</p>
                                <p style={{ marginBottom: 8 }}>2. 新注册 → 名称随意 → <strong>支持的账户类型</strong>选「任何组织目录中的账户和个人 Microsoft 账户」或「仅个人 Microsoft 账户」。</p>
                                <p style={{ marginBottom: 8 }}>3. 重定向 URI 选「公共客户端/本机」，填 <code>http://localhost:3848/callback</code>。</p>
                                <p style={{ marginBottom: 0 }}>4. 注册后复制「应用程序(客户端) ID」到下方；API 权限添加 Microsoft Graph 委托权限：<code>Files.ReadWrite</code>、<code>offline_access</code>。</p>
                              </div>
                            ),
                          },
                        ]}
                        style={{ marginBottom: 16 }}
                      />
                    )}
                    {(syncProvider !== 'onedrive' || !HAS_BUILTIN_ONEDRIVE) && (
                      <Form.Item
                        label={syncProvider === 'onedrive' ? 'OneDrive 客户端 ID' : syncProvider === 'googledrive' ? 'Google 客户端 ID' : 'Dropbox App key'}
                        extra={
                          syncProvider === 'onedrive'
                            ? '复制 Azure 应用「概述」页的「应用程序(客户端) ID」'
                            : syncProvider === 'googledrive'
                              ? 'Google Cloud 应用，重定向 URI http://localhost:3848/callback，范围 drive.appdata'
                              : 'Dropbox 应用，重定向 URI http://localhost:3848/callback，权限 files.content.read/write'
                        }
                      >
                        <Input
                          placeholder={syncProvider === 'dropbox' ? 'App key' : '客户端 ID'}
                          value={syncClientId}
                          onChange={(e) => setSyncClientId(e.target.value)}
                          onBlur={() => {
                            if (!syncClientId) return;
                            const k = syncProvider === 'onedrive' ? 'sync_onedrive_client_id' : syncProvider === 'googledrive' ? 'sync_googledrive_client_id' : 'sync_dropbox_client_id';
                            set(k, syncClientId);
                          }}
                        />
                      </Form.Item>
                    )}
                    {syncProvider === 'onedrive' && HAS_BUILTIN_ONEDRIVE && (
                      <Form.Item extra="留空则使用应用内置授权；填写则使用您自己的 Azure 应用">
                        <Input
                          placeholder="可选：自己的 Azure 应用客户端 ID"
                          value={syncClientId}
                          onChange={(e) => setSyncClientId(e.target.value)}
                          onBlur={() => syncClientId && set('sync_onedrive_client_id', syncClientId)}
                        />
                      </Form.Item>
                    )}
                    <Form.Item>
                      <Button loading={oauthConnecting} onClick={handleConnectOAuth}>
                        登录并授权
                      </Button>
                    </Form.Item>
                  </>
                )}
                {syncProvider === 'webdav' && (
                  <>
                    <Form.Item label="WebDAV 地址" extra="根地址，如 https://nextcloud.example.com/remote.php/dav/files/用户名/">
                      <Input
                        placeholder="https://..."
                        value={syncWebdavUrl}
                        onChange={(e) => setSyncWebdavUrl(e.target.value)}
                        onBlur={() => syncWebdavUrl && set('sync_webdav_url', syncWebdavUrl)}
                      />
                    </Form.Item>
                    <Form.Item label="用户名">
                      <Input value={syncWebdavUser} onChange={(e) => setSyncWebdavUser(e.target.value)} onBlur={() => set('sync_webdav_user', syncWebdavUser)} />
                    </Form.Item>
                    <Form.Item label="密码">
                      <Input.Password value={syncWebdavPassword} onChange={(e) => setSyncWebdavPassword(e.target.value)} onBlur={() => set('sync_webdav_password', syncWebdavPassword)} autoComplete="off" />
                    </Form.Item>
                  </>
                )}
                <Form.Item label="同步加密密码" extra="所有设备使用同一密码加密/解密，不填写则不会上传或拉取">
                  <Input.Password
                    placeholder="与其它设备一致"
                    value={syncPassword}
                    onChange={(e) => setSyncPassword(e.target.value)}
                    autoComplete="off"
                  />
                </Form.Item>
                <Form.Item>
                  <Space>
                    <Button type="primary" loading={syncLoading} onClick={handlePushSync}>
                      上传到云端
                    </Button>
                    <Button loading={syncLoading} onClick={handlePullSync}>
                      从云端拉取
                    </Button>
                  </Space>
                </Form.Item>
                <Form.Item>
                  <Space>
                    <Switch checked={syncRememberPassword} onChange={setSyncRememberPassword} />
                    <span>在此设备记住加密密码（用于打开应用时自动拉取）</span>
                  </Space>
                </Form.Item>
                {syncLastSyncAt && (
                  <Form.Item label="上次同步">
                    <Text type="secondary">{syncLastSyncAt}</Text>
                  </Form.Item>
                )}
              </Card>
            ),
          },
        ]
      : []),
    {
      key: 'data',
      label: (
        <Space>
          <DatabaseOutlined />
          <span>{t('settings.sections.dataReset', '数据与重置')}</span>
        </Space>
      ),
      children: (
        <Card size="small" type="inner">
          <Alert
            type="warning"
            showIcon
            icon={<ExclamationCircleOutlined />}
            message={t('settings.sections.dataResetTitle', '数据重置')}
            description={
              <div>
                <p style={{ marginBottom: 8 }}>
                  {t('settings.sections.dataResetDesc', '重置将永久删除当前账号下的：日程、习惯与打卡、倒数纪念日、装备、服装与搭配、AI 聊天记录、天气与新闻缓存等。')}
                </p>
                <p style={{ marginBottom: 0 }}>
                  {t('settings.sections.dataResetDesc2', '不会删除：账号、个人资料、本页的设置（API Keys、主题等）。')}
                </p>
              </div>
            }
            style={{ marginBottom: 16 }}
          />
          {databasePath && (
            <Form.Item
              label={t('settings.sections.databasePath', '数据库文件位置')}
              extra={t('settings.sections.databasePathExtra', '备份或外部查看时可复制此路径；详见 docs/data-storage.md')}
              style={{ marginBottom: 16 }}
            >
              <Typography.Paragraph copyable style={{ marginBottom: 0, fontFamily: 'monospace', fontSize: 13 }}>
                {databasePath}
              </Typography.Paragraph>
            </Form.Item>
          )}
          <Button
            type="primary"
            danger
            icon={<DeleteOutlined />}
            onClick={() => setResetModalOpen(true)}
          >
            {t('settings.sections.dataResetButton', '数据重置')}
          </Button>
        </Card>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        <Title level={2} style={{ margin: 0 }}>{t('settings.title', '设置')}</Title>
        <Button type="link" icon={<BookOutlined />} onClick={openOnboarding}>
          {t('settings.newbieGuide', '新手教程')}
        </Button>
      </div>
      <Alert
        type="info"
        showIcon
        message={t('settings.configPriorityTitle', '配置优先于 .env')}
        description={t('settings.configPriorityDesc', '以下内容保存到本地，优先于环境变量。修改后无需重启。')}
        style={{ marginBottom: 24 }}
      />
      <Form form={form} layout="vertical" onFinish={onFinish}>
        <Collapse items={collapseItems} defaultActiveKey={['appearance', 'apikeys', 'ai']} />
      </Form>

      <Modal
        title={t('settings.sections.apiBridgeDoc', 'API 说明')}
        open={apiBridgeDocVisible}
        onCancel={() => setApiBridgeDocVisible(false)}
        footer={[<Button key="close" type="primary" onClick={() => setApiBridgeDocVisible(false)}>{t('settings.modal.resetCancel', '取消')}</Button>]}
        width={720}
      >
        <div className="api-doc-markdown">
          {apiBridgeDocContent ? (
            <ReactMarkdown>{apiBridgeDocContent}</ReactMarkdown>
          ) : (
            <span className="api-doc-placeholder">
              {locale === 'zh-CN' ? 'API 说明文档暂不可用。' : 'API documentation is temporarily unavailable.'}
            </span>
          )}
        </div>
      </Modal>
      <Modal
        title={t('settings.modal.resetTitle', '确认数据重置')}
        open={resetModalOpen}
        onOk={handleDataReset}
        onCancel={() => setResetModalOpen(false)}
        okText={t('settings.modal.resetOk', '确认重置')}
        cancelText={t('settings.modal.resetCancel', '取消')}
        okButtonProps={{ danger: true, loading: resetting }}
      >
        <p>{t('settings.modal.resetContent1', '即将清除当前账号下的全部应用数据（日程、习惯、倒数纪念日、装备、服装、AI 聊天、缓存等），此操作不可恢复。')}</p>
        <p>{t('settings.modal.resetContent2', '是否继续？')}</p>
      </Modal>
    </div>
  );
}
