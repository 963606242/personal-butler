import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Card,
  Input,
  Button,
  Typography,
  List,
  Space,
  message,
  Alert,
  Avatar,
  Popconfirm,
  Checkbox,
  Collapse,
  Tooltip,
} from 'antd';
import {
  SendOutlined,
  UserOutlined,
  RobotOutlined,
  DeleteOutlined,
  DatabaseOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { chat, getActiveProvider, isAIConfigured } from '../services/ai-providers';
import { getLogger } from '../services/logger-client';
import useAiChatStore from '../stores/aiChatStore';
import useUserStore from '../stores/userStore';
import { DATA_CARRY_OPTIONS, gatherDataForChat } from '../services/ai-chat-data';
import { buildStructuredDailyPlanMessages, parseDailyPlanJson } from '../services/ai-daily-plan';
import { getAssistantName } from '../utils/assistant-name';
import SaveAsScheduleModal from '../components/AI/SaveAsScheduleModal';
import SaveAsHabitModal from '../components/AI/SaveAsHabitModal';
import BatchSaveScheduleModal from '../components/AI/BatchSaveScheduleModal';
import BatchSaveHabitModal from '../components/AI/BatchSaveHabitModal';

const CARRY_STORAGE_KEY = 'ai-chat-carry-data';

function loadCarryFromStorage() {
  try {
    const raw = localStorage.getItem(CARRY_STORAGE_KEY);
    if (!raw) return [];
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

const { Title, Text } = Typography;
const { TextArea } = Input;
const logger = getLogger();

const PROVIDER_LABELS = { ollama: 'Ollama', openai: 'OpenAI 协议', anthropic: 'Anthropic 协议' };

function parseFirstLine(t) {
  const line = (t || '').split(/\n/).map((s) => s.trim()).find(Boolean);
  if (!line) return '';
  return line.replace(/^[·\-\*]\s*/, '').replace(/\*\*/g, '').trim();
}

export default function AIChat() {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser, isInitialized } = useUserStore();
  const { messages, loadMessages, appendMessage, clearMessages, loading: loadingHistory } = useAiChatStore();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [carryData, setCarryData] = useState(loadCarryFromStorage);
  const [planLoading, setPlanLoading] = useState(false);
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [habitModalOpen, setHabitModalOpen] = useState(false);
  const [batchScheduleOpen, setBatchScheduleOpen] = useState(false);
  const [batchScheduleItems, setBatchScheduleItems] = useState([]);
  const [batchHabitOpen, setBatchHabitOpen] = useState(false);
  const [batchHabitItems, setBatchHabitItems] = useState([]);
  const listRef = useRef(null);

  const lastAssistant = messages.filter((m) => m.role === 'assistant').pop();
  const lastAssistantText = lastAssistant?.content ?? '';

  useEffect(() => {
    if (isInitialized && currentUser) loadMessages();
  }, [isInitialized, currentUser, loadMessages]);

  useEffect(() => {
    listRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    try {
      localStorage.setItem(CARRY_STORAGE_KEY, JSON.stringify(carryData));
    } catch (e) {
      logger.warn('AIChat', '持久化携带数据失败', e);
    }
  }, [carryData]);

  useEffect(() => {
    const s = location.state;
    if (s?.carry && Array.isArray(s.carry) && s.carry.length > 0) {
      setCarryData(s.carry);
      try {
        localStorage.setItem(CARRY_STORAGE_KEY, JSON.stringify(s.carry));
      } catch (_) {}
    }
  }, [location.state]);

  const handleSend = async () => {
    const text = (input || '').trim();
    if (!text || loading) return;

    setInput('');
    setLoading(true);

    let userContent = text;
    if (carryData.length > 0) {
      try {
        const context = await gatherDataForChat(carryData);
        userContent = `【以下为我携带的数据】\n\n${context}\n\n【我的问题】\n${text}`;
      } catch (e) {
        logger.error('AIChat', '携带数据聚合失败', e);
        message.warning('携带数据加载失败，已仅发送问题');
      }
    }

    const userMsg = { role: 'user', content: userContent };

    try {
      await appendMessage('user', userContent);
    } catch (e) {
      logger.error('AIChat', '保存消息失败', e);
      message.error(e?.message || '保存失败，请重试');
      setInput(text);
      setLoading(false);
      return;
    }
    try {
      const history = [...messages, userMsg].map((m) => ({ role: m.role, content: m.content }));
      const reply = await chat(history);
      await appendMessage('assistant', reply);
    } catch (e) {
      logger.error('AIChat', '发送失败', e);
      message.error(e?.message || '发送失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const handleClear = async () => {
    try {
      await clearMessages();
      message.success('已清空聊天记录');
    } catch (e) {
      message.error('清空失败');
    }
  };

  const handleDailyPlan = async () => {
    if (!isAIConfigured() || planLoading || loading) return;
    const userContent = '请生成今日的日程与习惯建议（结构化格式）。';
    setPlanLoading(true);
    try {
      await appendMessage('user', userContent);
      const [sys] = buildStructuredDailyPlanMessages();
      const reply = await chat([sys, { role: 'user', content: userContent }]);
      await appendMessage('assistant', reply);
    } catch (e) {
      logger.error('AIChat', '生成每日计划失败', e);
      message.error(e?.message || '生成失败，请重试');
    } finally {
      setPlanLoading(false);
    }
  };

  const openSaveAsSchedule = () => {
    const parsed = parseDailyPlanJson(lastAssistantText);
    if (!parsed.error && parsed.schedules?.length > 0) {
      setBatchScheduleItems(parsed.schedules);
      setBatchScheduleOpen(true);
    } else {
      setScheduleModalOpen(true);
    }
  };

  const openSaveAsHabit = () => {
    const parsed = parseDailyPlanJson(lastAssistantText);
    if (!parsed.error && parsed.habits?.length > 0) {
      setBatchHabitItems(parsed.habits);
      setBatchHabitOpen(true);
    } else {
      setHabitModalOpen(true);
    }
  };

  const configured = isAIConfigured();
  const provider = getActiveProvider();

  if (!configured && provider !== 'ollama') {
    return (
      <div>
        <Title level={2}>{getAssistantName()}</Title>
        <Alert
          type="warning"
          showIcon
          message="请先配置 API"
          description={
            <span>
              当前使用 <strong>{PROVIDER_LABELS[provider] || provider}</strong>，请先在
              <Button type="link" size="small" onClick={() => navigate('/settings')} style={{ padding: 0 }}>
                设置 → AI 助手
              </Button>
              中配置对应的 API Key。
            </span>
          }
        />
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <Title level={2} style={{ margin: 0 }}>{getAssistantName()}</Title>
          <Text type="secondary" style={{ display: 'block' }}>
            当前：{PROVIDER_LABELS[provider] || provider}
            {provider === 'ollama' && '（本地 Ollama，无需 Key）'}
          </Text>
        </div>
        {messages.length > 0 && (
          <Popconfirm title="确定清空所有聊天记录？" onConfirm={handleClear} okText="确定" cancelText="取消">
            <Button icon={<DeleteOutlined />} danger>清空记录</Button>
          </Popconfirm>
        )}
      </div>

      <Space direction="vertical" style={{ marginBottom: 16 }} size="small">
        <Space wrap>
          <Tooltip title="按结构化格式生成多条日程与习惯，保存时可批量勾选">
            <Button
              icon={<ThunderboltOutlined />}
              onClick={handleDailyPlan}
              loading={planLoading || loading}
              disabled={!isAIConfigured()}
            >
              生成每日计划建议
            </Button>
          </Tooltip>
          <Tooltip title="若上一条为结构化计划则批量勾选保存，否则按单条解析">
            <Button
              icon={<CalendarOutlined />}
              onClick={openSaveAsSchedule}
              disabled={!lastAssistant}
            >
              保存为日程
            </Button>
          </Tooltip>
          <Tooltip title="若上一条为结构化计划则批量勾选保存，否则按单条解析">
            <Button
              icon={<CheckCircleOutlined />}
              onClick={openSaveAsHabit}
              disabled={!lastAssistant}
            >
              保存为习惯
            </Button>
          </Tooltip>
        </Space>
        <Text type="secondary" style={{ fontSize: 12 }}>
          生成每日计划 → AI 返回多条日程/习惯 → 保存时勾选要写入的项；普通对话则按单条解析保存。
        </Text>
      </Space>

      <Card loading={loadingHistory}>
        <List
          dataSource={messages}
          locale={{ emptyText: '发送一条消息开始对话' }}
          renderItem={(m) => (
            <List.Item key={m.id}>
              <List.Item.Meta
                avatar={
                  <Avatar
                    icon={m.role === 'user' ? <UserOutlined /> : <RobotOutlined />}
                    style={{ backgroundColor: m.role === 'user' ? '#1890ff' : '#52c41a' }}
                  />
                }
                title={m.role === 'user' ? '你' : '助手'}
                description={
                  <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {m.content}
                  </div>
                }
              />
            </List.Item>
          )}
        />
        <div ref={listRef} />
        <Collapse
          size="small"
          defaultActiveKey={[]}
          style={{ marginTop: 16, marginBottom: 16 }}
          items={[
            {
              key: 'carry',
              label: (
                <Space>
                  <DatabaseOutlined />
                  <span>选择携带什么数据与 AI 开展对话</span>
                  {carryData.length > 0 && (
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      已选 {carryData.length} 项
                    </Text>
                  )}
                </Space>
              ),
              children: (
                <Checkbox.Group
                  value={carryData}
                  onChange={(v) => setCarryData(v || [])}
                  style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
                >
                  {DATA_CARRY_OPTIONS.map((opt) => (
                    <Tooltip key={opt.id} title={opt.desc} placement="topLeft">
                      <Checkbox value={opt.id}>{opt.label}</Checkbox>
                    </Tooltip>
                  ))}
                </Checkbox.Group>
              ),
            },
          ]}
        />
        <div style={{ marginTop: 0 }}>
          <Space.Compact style={{ width: '100%' }}>
            <TextArea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onPressEnter={(e) => {
                if (!e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="输入消息，Enter 发送 Shift+Enter 换行"
              autoSize={{ minRows: 2, maxRows: 6 }}
              disabled={loading}
            />
            <Button
              type="primary"
              icon={<SendOutlined />}
              onClick={handleSend}
              loading={loading}
              style={{ height: 'auto', alignSelf: 'stretch' }}
            >
              发送
            </Button>
          </Space.Compact>
        </div>
      </Card>

      <SaveAsScheduleModal
        open={scheduleModalOpen}
        initialTitle={parseFirstLine(lastAssistantText) || 'AI 建议日程'}
        initialNotes={lastAssistantText}
        onSuccess={() => {
          setScheduleModalOpen(false);
          message.success('已保存为日程');
        }}
        onCancel={() => setScheduleModalOpen(false)}
      />
      <SaveAsHabitModal
        open={habitModalOpen}
        initialName={parseFirstLine(lastAssistantText) || 'AI 建议习惯'}
        onSuccess={() => {
          setHabitModalOpen(false);
          message.success('已保存为习惯');
        }}
        onCancel={() => setHabitModalOpen(false)}
      />
      <BatchSaveScheduleModal
        open={batchScheduleOpen}
        items={batchScheduleItems}
        defaultDate={new Date()}
        onSuccess={() => setBatchScheduleOpen(false)}
        onCancel={() => setBatchScheduleOpen(false)}
      />
      <BatchSaveHabitModal
        open={batchHabitOpen}
        items={batchHabitItems}
        onSuccess={() => setBatchHabitOpen(false)}
        onCancel={() => setBatchHabitOpen(false)}
      />
    </div>
  );
}
