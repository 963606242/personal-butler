import React, { useState, useEffect, memo } from 'react';
import { Modal, Form, Input, Select, Button, Tag, Space, Spin, Typography, Divider } from 'antd';
import { LinkOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { RSS_PRESETS, RSS_CATEGORIES } from '../../constants/rss-presets';
import { fetchAndParseFeed } from '../../services/rss-service';
import { useI18n } from '../../context/I18nContext';

const { Text } = Typography;

function RssAddFeedModal({ open, onCancel, onOk }) {
  const [form] = Form.useForm();
  const [validating, setValidating] = useState(false);
  const [validated, setValidated] = useState(false);
  const { t } = useI18n();

  useEffect(() => {
    if (open) {
      form.resetFields();
      setValidated(false);
    }
  }, [open, form]);

  const handleValidate = async () => {
    const url = (form.getFieldValue('url') || '').trim();
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) {
      form.setFields([{ name: 'url', errors: [t('rss.feed.urlInvalid', '请输入有效的 URL（需以 http:// 或 https:// 开头）')] }]);
      return;
    }
    setValidating(true);
    setValidated(false);
    try {
      const result = await fetchAndParseFeed(url);
      if (result.success) {
        form.setFieldsValue({
          title: result.data.title || '',
          description: result.data.description || '',
          siteUrl: result.data.link || '',
          iconUrl: result.data.image || '',
        });
        setValidated(true);
      } else {
        form.setFields([{ name: 'url', errors: [t('rss.messages.validateFailed', '无法解析此 Feed URL')] }]);
      }
    } catch (_) {
      form.setFields([{ name: 'url', errors: [t('rss.messages.validateFailed', '无法解析此 Feed URL')] }]);
    } finally {
      setValidating(false);
    }
  };

  const handlePresetClick = (preset) => {
    form.setFieldsValue({
      url: preset.url,
      title: preset.title,
      description: preset.description,
      siteUrl: preset.siteUrl,
      category: preset.category,
    });
    setValidated(true);
  };

  const handleFinish = (values) => {
    onOk({
      url: values.url,
      title: values.title,
      description: values.description,
      siteUrl: values.siteUrl,
      iconUrl: values.iconUrl || null,
      category: values.category || 'other',
      refreshInterval: values.refreshInterval || 30,
    });
  };

  return (
    <Modal
      title={t('rss.addFeed', '添加 RSS 订阅')}
      open={open}
      onCancel={onCancel}
      onOk={() => form.submit()}
      okText={t('common.save', '保存')}
      cancelText={t('common.cancel', '取消')}
      destroyOnHidden
      width={520}
    >
      <Form form={form} layout="vertical" onFinish={handleFinish}>
        <Form.Item
          name="url"
          label="Feed URL"
          rules={[
            { required: true, message: t('rss.feed.urlRequired', '请输入 RSS Feed URL') },
            {
              validator: (_, value) => {
                if (!value || !value.trim()) return Promise.resolve();
                if (!/^https?:\/\//i.test(value.trim())) {
                  return Promise.reject(new Error(t('rss.feed.urlInvalid', '请输入有效的 URL（需以 http:// 或 https:// 开头）')));
                }
                return Promise.resolve();
              },
            },
          ]}
        >
          <Input
            prefix={<LinkOutlined />}
            placeholder="https://example.com/feed"
            suffix={
              validating ? (
                <Spin size="small" />
              ) : validated ? (
                <CheckCircleOutlined style={{ color: '#52c41a' }} />
              ) : (
                <Button type="link" size="small" onClick={handleValidate}>
                  {t('rss.feed.validate', '验证')}
                </Button>
              )
            }
            onPressEnter={handleValidate}
          />
        </Form.Item>

        <Form.Item name="title" label={t('rss.feed.title', '标题')}>
          <Input placeholder={t('rss.feed.titlePlaceholder', '自动填充或手动输入')} />
        </Form.Item>

        <Form.Item name="category" label={t('rss.feed.category', '分类')} initialValue="other">
          <Select
            options={RSS_CATEGORIES.map((c) => ({ value: c.value, label: t(`rss.categories.${c.value}`, c.label) }))}
          />
        </Form.Item>

        <Form.Item name="refreshInterval" label={t('rss.feed.refreshInterval', '刷新间隔(分钟)')} initialValue={30}>
          <Select
            options={[
              { value: 15, label: '15' },
              { value: 30, label: '30' },
              { value: 60, label: '60' },
              { value: 120, label: '120' },
            ]}
          />
        </Form.Item>

        <Form.Item name="description" hidden><Input /></Form.Item>
        <Form.Item name="siteUrl" hidden><Input /></Form.Item>
        <Form.Item name="iconUrl" hidden><Input /></Form.Item>
      </Form>

      <Divider style={{ margin: '12px 0 8px' }} />
      <Text type="secondary" style={{ fontSize: 12, marginBottom: 8, display: 'block' }}>
        {t('rss.presetHint', '或从预设中选择：')}
      </Text>
      <Space wrap size={[4, 6]}>
        {RSS_PRESETS.map((preset) => (
          <Tag
            key={preset.url}
            style={{ cursor: 'pointer' }}
            onClick={() => handlePresetClick(preset)}
          >
            {preset.icon} {preset.title}
          </Tag>
        ))}
      </Space>
    </Modal>
  );
}

export default memo(RssAddFeedModal);
