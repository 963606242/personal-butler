import React, { useState, useEffect } from 'react';
import { Card, Button, Space, Typography, Popconfirm, Spin, Calendar, Badge, Input, App } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, PictureOutlined, SoundOutlined, VideoCameraOutlined, SearchOutlined, RobotOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import useDiaryStore from '../stores/diaryStore';
import useUserStore from '../stores/userStore';
import { getLogger } from '../services/logger-client';
import DiaryFormModal from '../components/Diary/DiaryFormModal';
import FriendlyEmpty from '../components/FriendlyEmpty';
import { useI18n } from '../context/I18nContext';
import { generateDiaryReport } from '../services/diary-ai-report';
import { isAIConfigured } from '../services/ai-providers';

const { Title, Text, Paragraph } = Typography;
const logger = getLogger();

function Diary() {
  const { message: messageApi } = App.useApp();
  const [modalVisible, setModalVisible] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [selectedDate, setSelectedDate] = useState(dayjs());
  const [searchKeyword, setSearchKeyword] = useState('');
  const [aiQuestion, setAiQuestion] = useState('');
  const [aiReport, setAiReport] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  const { currentUser, isInitialized } = useUserStore();
  const { t } = useI18n();
  const { entries, loading, loadEntries, loadEntriesByDate, deleteEntry, searchEntries } = useDiaryStore();

  useEffect(() => {
    if (!isInitialized || !currentUser) return;
    if (searchKeyword.trim()) searchEntries(searchKeyword.trim());
    else loadEntries();
  }, [isInitialized, currentUser, searchKeyword]);

  const handleCreate = () => {
    setEditingEntry(null);
    setSelectedDate(dayjs());
    setModalVisible(true);
  };

  const handleEdit = (entry) => {
    setEditingEntry(entry);
    setSelectedDate(dayjs(entry.date));
    setModalVisible(true);
  };

  const handleDelete = async (id) => {
    try {
      await deleteEntry(id);
      messageApi.success('删除成功');
    } catch (error) {
      logger.error('Diary', '删除失败', error);
      messageApi.error('删除失败');
    }
  };

  const handleAiReport = async () => {
    if (!aiQuestion.trim()) {
      messageApi.warning('请输入问题，如：上周五做了什么');
      return;
    }
    if (!isAIConfigured()) {
      messageApi.warning('请先在设置中配置 AI 提供商与 API Key');
      return;
    }
    setAiLoading(true);
    setAiReport('');
    try {
      const report = await generateDiaryReport(aiQuestion.trim());
      setAiReport(report);
    } catch (error) {
      logger.error('Diary', 'AI 回顾失败', error);
      messageApi.error(error?.message || '生成报告失败');
    } finally {
      setAiLoading(false);
    }
  };

  const handleDateSelect = (date) => {
    setSelectedDate(date);
    loadEntriesByDate(date.toDate());
  };

  const dateCellRender = (date) => {
    const dateStr = date.format('YYYY-MM-DD');
    const dayEntries = entries.filter((e) => dayjs(e.date).format('YYYY-MM-DD') === dateStr);
    if (dayEntries.length === 0) return null;
    return (
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {dayEntries.slice(0, 3).map((e) => (
          <li key={e.id}>
            <Badge status="success" text={e.title || '无标题'} />
          </li>
        ))}
        {dayEntries.length > 3 && <li>...</li>}
      </ul>
    );
  };

  const selectedDateEntries = entries.filter((e) => dayjs(e.date).format('YYYY-MM-DD') === selectedDate.format('YYYY-MM-DD'));

  if (loading && entries.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 0' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div>
      <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}>
        <Title level={2} style={{ margin: 0 }}>
          {t('diary.pageTitle', '日记小记')}
        </Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
          {t('diary.newEntry', '新建日记')}
        </Button>
      </Space>

      <Card title="AI 回顾" style={{ marginBottom: 16 }} extra={isAIConfigured() ? null : <Text type="secondary">需在设置中配置 AI</Text>}>
        <Space.Compact style={{ width: '100%', marginBottom: 8 }}>
          <Input
            placeholder="例如：上周五做了什么、昨天做了什么、本周一"
            value={aiQuestion}
            onChange={(e) => setAiQuestion(e.target.value)}
            onPressEnter={handleAiReport}
          />
          <Button type="primary" icon={<RobotOutlined />} loading={aiLoading} onClick={handleAiReport}>
            生成报告
          </Button>
        </Space.Compact>
        {aiReport ? <Paragraph style={{ whiteSpace: 'pre-wrap', marginBottom: 0 }}>{aiReport}</Paragraph> : null}
      </Card>

      <Space style={{ marginBottom: 8 }}>
        <Input
          prefix={<SearchOutlined />}
          placeholder="搜索日记（标题、内容、图片分析、录音转写）"
          value={searchKeyword}
          onChange={(e) => setSearchKeyword(e.target.value)}
          allowClear
          style={{ width: 280 }}
        />
      </Space>

      <Card style={{ marginBottom: 16 }}>
        <Calendar
          fullscreen={false}
          onSelect={handleDateSelect}
          value={selectedDate}
          dateCellRender={dateCellRender}
        />
      </Card>

      <Card title={selectedDate.format('YYYY年MM月DD日')}>
        {selectedDateEntries.length === 0 ? (
          <FriendlyEmpty description={t('diary.noEntries', '这一天还没有记录，点击「新建日记」开始记录吧')} />
        ) : (
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            {selectedDateEntries.map((entry) => (
              <Card
                key={entry.id}
                hoverable
                actions={[
                  <EditOutlined key="edit" onClick={() => handleEdit(entry)} />,
                  <Popconfirm
                    key="delete"
                    title={t('diary.deleteConfirm', '确定删除这条日记吗？')}
                    onConfirm={() => handleDelete(entry.id)}
                    okText="确定"
                    cancelText="取消"
                  >
                    <DeleteOutlined />
                  </Popconfirm>,
                ]}
              >
                <Card.Meta
                  title={
                    <Space>
                      {entry.title || '无标题'}
                      {entry.mood && <Badge status="processing" text={entry.mood} />}
                    </Space>
                  }
                  description={
                    <div>
                      <Paragraph ellipsis={{ rows: 3 }} style={{ marginBottom: 8 }}>
                        {entry.content}
                      </Paragraph>
                      <Space size="small" wrap>
                        {entry.images && entry.images.length > 0 && (
                          <Text type="secondary">
                            <PictureOutlined /> {entry.images.length} 张图片
                          </Text>
                        )}
                        {entry.audio_path && (
                          <Text type="secondary">
                            <SoundOutlined /> 语音
                          </Text>
                        )}
                        {entry.video_path && (
                          <Text type="secondary">
                            <VideoCameraOutlined /> 视频
                          </Text>
                        )}
                        {entry.location && <Text type="secondary">📍 {entry.location}</Text>}
                        {entry.tags && entry.tags.length > 0 && (
                          <Text type="secondary">🏷️ {entry.tags.join(', ')}</Text>
                        )}
                      </Space>
                    </div>
                  }
                />
              </Card>
            ))}
          </Space>
        )}
      </Card>

      <DiaryFormModal
        visible={modalVisible}
        editingEntry={editingEntry}
        initialDate={selectedDate}
        onCancel={() => {
          setModalVisible(false);
          setEditingEntry(null);
        }}
        onOk={() => {
          setModalVisible(false);
          setEditingEntry(null);
          loadEntries();
        }}
      />
    </div>
  );
}

export default Diary;
