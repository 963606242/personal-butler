import React, { useState, useEffect } from 'react';
import { App, Modal, Form, Input, DatePicker, Button, Space, Tag, Select, Typography, theme } from 'antd';
import { PictureOutlined, SoundOutlined, VideoCameraOutlined, DeleteOutlined, StopOutlined, RobotOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import useDiaryStore from '../../stores/diaryStore';
import { selectMediaFile, startAudioRecording, stopAudioRecording, cancelAudioRecording, isElectron } from '../../platform';
import { getLogger } from '../../services/logger-client';
import { analyzeImageForDiary } from '../../services/ai-providers';
import { getConfigStr } from '../../services/config';

const { TextArea } = Input;
const { Text } = Typography;
const logger = getLogger();

const MOOD_OPTIONS = [
  { value: 'happy', label: '😊 开心' },
  { value: 'sad', label: '😢 难过' },
  { value: 'angry', label: '😠 生气' },
  { value: 'calm', label: '😌 平静' },
  { value: 'excited', label: '🤩 兴奋' },
  { value: 'tired', label: '😴 疲惫' },
];

function DiaryFormModal({ visible, editingEntry, initialDate, onCancel, onOk }) {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [images, setImages] = useState([]);
  const [audioPath, setAudioPath] = useState(null);
  const [videoPath, setVideoPath] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [tags, setTags] = useState([]);
  const [tagInput, setTagInput] = useState('');
  const [imageAnalysis, setImageAnalysis] = useState('');
  const [audioTranscript, setAudioTranscript] = useState('');
  const [analyzingImages, setAnalyzingImages] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const { token } = theme.useToken();

  const { createEntry, updateEntry } = useDiaryStore();

  useEffect(() => {
    if (visible) {
      if (editingEntry) {
        form.setFieldsValue({
          date: dayjs(editingEntry.date),
          title: editingEntry.title,
          content: editingEntry.content,
          mood: editingEntry.mood,
          location: editingEntry.location,
          weather: editingEntry.weather,
        });
        setImages(editingEntry.images || []);
        setAudioPath(editingEntry.audio_path);
        setVideoPath(editingEntry.video_path);
        setTags(editingEntry.tags || []);
        setImageAnalysis(editingEntry.image_analysis || '');
        setAudioTranscript(editingEntry.audio_transcript || '');
      } else {
        form.resetFields();
        form.setFieldsValue({ date: initialDate || dayjs() });
        setImages([]);
        setAudioPath(null);
        setVideoPath(null);
        setTags([]);
        setImageAnalysis('');
        setAudioTranscript('');
      }
      setIsRecording(false);
    }
  }, [visible, editingEntry, initialDate, form]);

  const handleImageSelect = async () => {
    try {
      const result = await selectMediaFile({ accept: 'image' });
      const filePath = result && (typeof result === 'string' ? result : result.filePath);
      if (filePath) {
        const imageUrl = filePath.startsWith('file://') ? filePath : `file:///${filePath.replace(/\\/g, '/')}`;
        setImages([...images, imageUrl]);
      }
    } catch (error) {
      logger.error('DiaryFormModal', '选择图片失败', error);
      message.error('选择图片失败');
    }
  };

  const handleVideoSelect = async () => {
    try {
      const result = await selectMediaFile({ accept: 'video' });
      const filePath = result && (typeof result === 'string' ? result : result.filePath);
      if (filePath) {
        setVideoPath(filePath);
        message.success('视频已选择');
      }
    } catch (error) {
      logger.error('DiaryFormModal', '选择视频失败', error);
      message.error('选择视频失败');
    }
  };

  const handleStartRecording = async () => {
    try {
      const result = await startAudioRecording();
      if (result.success) {
        setIsRecording(true);
        message.success('开始录音');
      } else {
        message.error(result.error || '录音失败');
      }
    } catch (error) {
      logger.error('DiaryFormModal', '开始录音失败', error);
      message.error('录音失败');
    }
  };

  const handleStopRecording = async () => {
    try {
      const result = await stopAudioRecording();
      if (result.success && result.filePath) {
        setAudioPath(result.filePath);
        setIsRecording(false);
        message.success('录音完成');
      } else {
        message.error(result.error || '录音失败');
        setIsRecording(false);
      }
    } catch (error) {
      logger.error('DiaryFormModal', '停止录音失败', error);
      message.error('录音失败');
      setIsRecording(false);
    }
  };

  const handleCancelRecording = async () => {
    await cancelAudioRecording();
    setIsRecording(false);
    message.info('已取消录音');
  };

  const imageUrlToBase64 = (url) => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        try {
          const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
          resolve(dataUrl.replace(/^data:image\/\w+;base64,/, ''));
        } catch (e) {
          reject(e);
        }
      };
      img.onerror = () => reject(new Error('图片加载失败'));
      img.src = url;
    });
  };

  const handleAnalyzeImages = async () => {
    if (images.length === 0) {
      message.warning('请先添加图片');
      return;
    }
    setAnalyzingImages(true);
    try {
      const lines = [];
      for (let i = 0; i < images.length; i++) {
        const base64 = await imageUrlToBase64(images[i]);
        const text = await analyzeImageForDiary(base64, 'image/jpeg');
        lines.push(`图${i + 1}：${text}`);
      }
      setImageAnalysis(lines.join('\n'));
      message.success('图片分析已保存，可用于搜索');
    } catch (error) {
      logger.error('DiaryFormModal', '图片分析失败', error);
      message.error(error?.message || '图片分析失败');
    } finally {
      setAnalyzingImages(false);
    }
  };

  const handleTranscribeAudio = async () => {
    if (!audioPath) {
      message.warning('请先录制或选择录音');
      return;
    }
    if (!isElectron() || !window.electronAPI?.transcribeAudio) {
      message.warning('录音转写当前仅支持 Electron 环境，且需配置 OpenAI API Key');
      return;
    }
    const apiKey = getConfigStr('openai_api_key');
    if (!apiKey) {
      message.warning('请先在设置中配置 OpenAI API Key');
      return;
    }
    setTranscribing(true);
    try {
      const res = await fetch(audioPath);
      const blob = await res.blob();
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = reader.result;
          resolve(dataUrl.replace(/^data:.*;base64,/, ''));
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      const result = await window.electronAPI.transcribeAudio({ base64, apiKey });
      if (result.success && result.text) {
        setAudioTranscript(result.text);
        message.success('转写已保存，可用于搜索');
      } else {
        message.error(result.error || '转写失败');
      }
    } catch (error) {
      logger.error('DiaryFormModal', '转写失败', error);
      message.error(error?.message || '转写失败');
    } finally {
      setTranscribing(false);
    }
  };

  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tag) => {
    setTags(tags.filter((t) => t !== tag));
  };

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      const data = {
        date: values.date,
        title: values.title,
        content: values.content,
        mood: values.mood,
        location: values.location,
        weather: values.weather,
        images,
        audio_path: audioPath,
        video_path: videoPath,
        tags,
        image_analysis: imageAnalysis || undefined,
        audio_transcript: audioTranscript || undefined,
      };

      if (editingEntry) {
        await updateEntry(editingEntry.id, data);
        message.success('更新成功');
      } else {
        await createEntry(data);
        message.success('创建成功');
      }
      onOk();
    } catch (error) {
      logger.error('DiaryFormModal', '保存失败', error);
      message.error('保存失败');
    }
  };

  return (
    <Modal
      title={editingEntry ? '编辑日记' : '新建日记'}
      open={visible}
      onCancel={onCancel}
      onOk={handleOk}
      width={800}
      okText="保存"
      cancelText="取消"
    >
      <Form form={form} layout="vertical">
        <Form.Item name="date" label="日期" rules={[{ required: true }]}>
          <DatePicker style={{ width: '100%' }} />
        </Form.Item>

        <Form.Item name="title" label="标题">
          <Input placeholder="给这条日记起个标题（可选）" />
        </Form.Item>

        <Form.Item name="content" label="内容" rules={[{ required: true, message: '请输入内容' }]}>
          <TextArea rows={6} placeholder="记录今天的所见所闻所想..." />
        </Form.Item>

        <Form.Item label="图片">
          <Space direction="vertical" style={{ width: '100%' }}>
            <Space>
              <Button icon={<PictureOutlined />} onClick={handleImageSelect}>
                添加图片
              </Button>
              <Button icon={<RobotOutlined />} loading={analyzingImages} onClick={handleAnalyzeImages}>
                AI 分析图片（便于搜索）
              </Button>
            </Space>
            {imageAnalysis ? <Text type="secondary" style={{ display: 'block', marginTop: 4 }}>分析结果：{imageAnalysis.slice(0, 80)}…</Text> : null}
            {images.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {images.map((img, idx) => (
                  <div key={idx} style={{ position: 'relative', width: 100, height: 100 }}>
                    <img
                      src={img}
                      alt={`图片 ${idx + 1}`}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 4 }}
                    />
                    <Button
                      type="text"
                      danger
                      icon={<DeleteOutlined />}
                      size="small"
                      style={{ position: 'absolute', top: 0, right: 0 }}
                      onClick={() => setImages(images.filter((_, i) => i !== idx))}
                    />
                  </div>
                ))}
              </div>
            )}
          </Space>
        </Form.Item>

        <Form.Item label="语音">
          <Space direction="vertical" style={{ width: '100%' }}>
            <Space wrap>
            {!isRecording ? (
              <>
                {audioPath ? (
                  <>
                    <audio controls src={audioPath} style={{ maxWidth: 300 }} />
                    <Button danger size="small" onClick={() => setAudioPath(null)}>删除</Button>
                    <Button icon={<RobotOutlined />} loading={transcribing} onClick={handleTranscribeAudio}>
                      AI 转写（便于搜索）
                    </Button>
                  </>
                ) : (
                  <Button icon={<SoundOutlined />} onClick={handleStartRecording}>
                    开始录音
                  </Button>
                )}
              </>
            ) : (
              <>
                <Button icon={<StopOutlined />} danger onClick={handleStopRecording}>
                  停止录音
                </Button>
                <Button onClick={handleCancelRecording}>取消</Button>
              </>
            )}
            </Space>
            {audioTranscript ? <Text type="secondary" style={{ display: 'block', marginTop: 4 }}>转写：{audioTranscript.slice(0, 80)}…</Text> : null}
          </Space>
        </Form.Item>

        <Form.Item label="视频">
          <Space>
            {videoPath ? (
              <>
                <Text type="secondary">已选择视频</Text>
                <Button danger size="small" onClick={() => setVideoPath(null)}>
                  删除
                </Button>
              </>
            ) : (
              <Button icon={<VideoCameraOutlined />} onClick={handleVideoSelect}>
                选择视频
              </Button>
            )}
          </Space>
        </Form.Item>

        <Form.Item name="mood" label="心情">
          <Select placeholder="选择心情（可选）" options={MOOD_OPTIONS} allowClear />
        </Form.Item>

        <Form.Item label="标签">
          <Space direction="vertical" style={{ width: '100%' }}>
            <Space>
              <Input
                placeholder="输入标签"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onPressEnter={handleAddTag}
                style={{ width: 200 }}
              />
              <Button onClick={handleAddTag}>添加</Button>
            </Space>
            {tags.length > 0 && (
              <div>
                {tags.map((tag) => (
                  <Tag key={tag} closable onClose={() => handleRemoveTag(tag)} style={{ marginBottom: 4 }}>
                    {tag}
                  </Tag>
                ))}
              </div>
            )}
          </Space>
        </Form.Item>

        <Form.Item name="location" label="位置">
          <Input placeholder="记录位置（可选）" />
        </Form.Item>

        <Form.Item name="weather" label="天气">
          <Input placeholder="记录天气（可选）" />
        </Form.Item>
      </Form>
    </Modal>
  );
}

export default DiaryFormModal;
