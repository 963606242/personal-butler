/**
 * RSS 文章详情弹窗 - 内置阅读器
 */
import React, { memo } from 'react';
import { Modal, Typography, Space, Tag, Button } from 'antd';
import { LinkOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useI18n } from '../../context/I18nContext';

const { Title, Text, Paragraph } = Typography;

function stripHtml(html) {
  if (!html) return '';
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent || div.innerText || html.replace(/<[^>]*>/g, '');
}

function RssArticleDetailModal({ open, article, feedTitle, onClose, onOpenLink, onToggleStar }) {
  const { t } = useI18n();
  if (!article) return null;

  const content = article.content || article.description || '';
  const plainContent = stripHtml(content);

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={640}
      destroyOnHidden
      styles={{ body: { maxHeight: '70vh', overflow: 'auto' } }}
    >
      <div style={{ padding: '8px 0' }}>
        <Title level={4} style={{ marginBottom: 12 }}>
          {article.title}
        </Title>
        <Space wrap size={[8, 4]} style={{ marginBottom: 16 }}>
          {feedTitle && (
            <Tag>{feedTitle}</Tag>
          )}
          {article.author && <Text type="secondary">{article.author}</Text>}
          {article.published_at && (
            <Text type="secondary">{dayjs(article.published_at).format('YYYY-MM-DD HH:mm')}</Text>
          )}
        </Space>
        <Paragraph style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>
          {plainContent || t('rss.article.noContent', '暂无正文')}
        </Paragraph>
        <Space style={{ marginTop: 24 }}>
          {article.link && (
            <Button type="primary" icon={<LinkOutlined />} onClick={() => onOpenLink?.(article.link)}>
              {t('rss.article.openLink', '打开原文')}
            </Button>
          )}
          {onToggleStar && (
            <Button onClick={() => onToggleStar(article.id)}>
              {article.is_starred ? t('rss.article.unstar', '取消收藏') : t('rss.article.star', '收藏')}
            </Button>
          )}
        </Space>
      </div>
    </Modal>
  );
}

export default memo(RssArticleDetailModal);
