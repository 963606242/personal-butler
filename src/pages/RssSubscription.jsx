/**
 * RSS 订阅页面
 * 双栏布局：左侧订阅源列表，右侧文章列表
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  App, Card, List, Button, Space, Typography, Badge, Empty, Spin, Tag,
  Dropdown, Popconfirm, Segmented, Alert, Upload, Tooltip, Avatar, theme,
} from 'antd';
import {
  PlusOutlined, ReloadOutlined, ImportOutlined, ExportOutlined,
  DeleteOutlined, StarOutlined, StarFilled, CheckOutlined,
  ReadOutlined, WifiOutlined, LinkOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/zh-cn';
import 'dayjs/locale/en';
import useRssStore from '../stores/rssStore';
import useUserStore from '../stores/userStore';
import { RSS_PRESETS } from '../constants/rss-presets';
import { useI18n } from '../context/I18nContext';
import { isElectron } from '../platform';
import RssAddFeedModal from '../components/Rss/RssAddFeedModal';
import RssArticleDetailModal from '../components/Rss/RssArticleDetailModal';
import { getLogger } from '../services/logger-client';

dayjs.extend(relativeTime);

const logger = getLogger();
const { Text, Title, Paragraph } = Typography;

export default function RssSubscription() {
  const { message } = App.useApp();
  const { t } = useI18n();
  const { token } = theme.useToken();
  const { isInitialized, currentUser } = useUserStore();

  const {
    feeds, articles, selectedFeedId, loading, refreshing, articleFilter,
    loadFeeds, loadArticles, loadMoreArticles, createFeed, deleteFeed, fetchArticles,
    markAsRead, markAllAsRead, toggleStar, setArticleFilter, getFilteredArticles,
    refreshAll, importFromOPML, exportToOPML, addPresetFeeds,
    articlesHasMore,
  } = useRssStore();

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [articleDetailOpen, setArticleDetailOpen] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [focusedArticleIndex, setFocusedArticleIndex] = useState(0);
  const focusedIndexRef = useRef(0);
  const [fetchingFeedId, setFetchingFeedId] = useState(null);
  const [isNarrow, setIsNarrow] = useState(false);
  const [mobileView, setMobileView] = useState('feeds'); // 'feeds' | 'articles'

  useEffect(() => {
    if (isInitialized && currentUser) {
      loadFeeds();
    }
  }, [isInitialized, currentUser, loadFeeds]);

  // 订阅源加载完成后，自动加载文章（首次进入时加载全部）
  useEffect(() => {
    if (feeds.length > 0 && !loading) {
      loadArticles(selectedFeedId ?? null);
    }
  }, [feeds.length, loading, loadArticles, selectedFeedId]);

  // 键盘快捷键：j 下一篇, k 上一篇, o 打开, m 标记已读
  useEffect(() => {
    focusedIndexRef.current = focusedArticleIndex;
  }, [focusedArticleIndex]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (addModalOpen || articleDetailOpen) return;
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      const filtered = getFilteredArticles();
      if (filtered.length === 0) return;
      const idx = focusedIndexRef.current;
      switch (e.key) {
        case 'j':
          e.preventDefault();
          focusedIndexRef.current = Math.min(idx + 1, filtered.length - 1);
          setFocusedArticleIndex(focusedIndexRef.current);
          break;
        case 'k':
          e.preventDefault();
          focusedIndexRef.current = Math.max(idx - 1, 0);
          setFocusedArticleIndex(focusedIndexRef.current);
          break;
        case 'o':
          e.preventDefault();
          const art = filtered[focusedIndexRef.current];
          if (art) {
            if (!art.is_read) markAsRead(art.id);
            setSelectedArticle(art);
            setArticleDetailOpen(true);
          }
          break;
        case 'm':
          e.preventDefault();
          const a = filtered[focusedIndexRef.current];
          if (a && !a.is_read) markAsRead(a.id);
          break;
        default:
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [addModalOpen, articleDetailOpen, getFilteredArticles, markAsRead]);

  // 切换 feed 或筛选时重置焦点
  useEffect(() => {
    setFocusedArticleIndex(0);
  }, [selectedFeedId, articleFilter]);

  // 响应式：窄屏时单栏布局
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const apply = () => setIsNarrow(!!mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  // 定时自动刷新：按每个 feed 的 refresh_interval 定期抓取，仅在 RSS 页面可见时执行
  useEffect(() => {
    if (feeds.length === 0) return;
    const CHECK_INTERVAL_MS = 60 * 1000; // 每 60 秒检查一次
    const timer = setInterval(() => {
      const now = Date.now();
      const stateFeeds = useRssStore.getState().feeds;
      const toRefresh = stateFeeds.filter((f) => {
        const intervalMs = (f.refresh_interval || 30) * 60 * 1000;
        return !f.last_fetch_at || now - f.last_fetch_at >= intervalMs;
      });
      toRefresh.forEach((f) => {
        useRssStore.getState().fetchArticles(f.id).catch(() => {});
      });
    }, CHECK_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [feeds.length]);

  // ─── 操作处理 ───

  const handleAddFeed = useCallback(async (data) => {
    try {
      await createFeed(data);
      message.success(t('rss.messages.addSuccess', '订阅添加成功'));
      setAddModalOpen(false);
    } catch (e) {
      message.error(t('rss.messages.addFailed', '订阅添加失败'));
    }
  }, [createFeed, message, t]);

  const handleDeleteFeed = useCallback(async (feedId) => {
    try {
      await deleteFeed(feedId);
      message.success(t('rss.messages.deleteSuccess', '删除成功'));
    } catch (e) {
      message.error(t('rss.messages.deleteFailed', '删除失败'));
    }
  }, [deleteFeed, message, t]);

  const handleRefreshFeed = useCallback(async (feedId) => {
    setFetchingFeedId(feedId);
    try {
      await fetchArticles(feedId);
      message.success(t('rss.messages.refreshSuccess', '刷新成功'));
    } catch (_) {
      message.error(t('rss.messages.refreshFailed', '刷新失败'));
    } finally {
      setFetchingFeedId(null);
    }
  }, [fetchArticles, message, t]);

  const handleRefreshAll = useCallback(async () => {
    try {
      const { success, failed } = await refreshAll();
      message.success(t('rss.messages.refreshAllDone', `刷新完成: ${success} 成功, ${failed} 失败`, { success, failed }));
    } catch (_) {
      message.error(t('rss.messages.refreshFailed', '刷新失败'));
    }
  }, [refreshAll, message, t]);

  const handleSelectFeed = useCallback((feedId) => {
    loadArticles(feedId);
    if (window.matchMedia('(max-width: 768px)').matches) setMobileView('articles');
  }, [loadArticles]);

  const handleArticleClick = useCallback((article) => {
    if (!article.is_read) {
      markAsRead(article.id);
    }
    setSelectedArticle(article);
    setArticleDetailOpen(true);
  }, [markAsRead]);

  const handleOpenArticleLink = useCallback((url) => {
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  }, []);

  const handleMarkAllRead = useCallback(async () => {
    try {
      await markAllAsRead(selectedFeedId);
      message.success(t('rss.messages.markAllReadSuccess', '已全部标记为已读'));
    } catch (_) {
      // silent
    }
  }, [markAllAsRead, selectedFeedId, message, t]);

  const handleExportOPML = useCallback(() => {
    try {
      const xml = exportToOPML();
      const blob = new Blob([xml], { type: 'application/xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `personal-butler-rss-${dayjs().format('YYYY-MM-DD')}.opml`;
      a.click();
      URL.revokeObjectURL(url);
      message.success(t('rss.messages.exportSuccess', '导出成功'));
    } catch (_) {
      message.error(t('rss.messages.exportFailed', '导出失败'));
    }
  }, [exportToOPML, message, t]);

  const handleImportOPML = useCallback(async (file) => {
    try {
      const text = await file.text();
      const result = await importFromOPML(text);
      const msg = result.skipped > 0
        ? t('rss.messages.importResultDetail', `导入完成：${result.imported} 个新增，${result.skipped} 个已存在`, { imported: result.imported, skipped: result.skipped })
        : t('rss.messages.importSuccess', `导入完成：${result.imported} 个新增`, { imported: result.imported });
      message.success(msg);
    } catch (_) {
      message.error(t('rss.messages.importFailed', '导入失败'));
    }
    return false; // 阻止 Upload 默认行为
  }, [importFromOPML, message, t]);

  const handleAddPresets = useCallback(async () => {
    try {
      const count = await addPresetFeeds(RSS_PRESETS);
      message.success(`${t('rss.messages.presetAdded', '已添加')} ${count} ${t('rss.messages.presetSources', '个预设源')}`);
    } catch (_) {
      // silent
    }
  }, [addPresetFeeds, message, t]);

  // ─── 渲染 ───

  const filteredArticles = getFilteredArticles();
  const selectedFeed = feeds.find((f) => f.id === selectedFeedId);
  const totalUnread = feeds.reduce((sum, f) => sum + (f.unread_count || 0), 0);

  if (loading && feeds.length === 0) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
        <Spin size="large" />
      </div>
    );
  }

  // 空状态
  if (feeds.length === 0) {
    return (
      <div style={{ maxWidth: 600, margin: '40px auto', textAlign: 'center' }}>
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={t('rss.noFeeds', '暂无 RSS 订阅')}
        >
          <Space direction="vertical" size="middle">
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setAddModalOpen(true)}>
              {t('rss.addFeed', '添加订阅')}
            </Button>
            <Button onClick={handleAddPresets}>
              {t('rss.addPresets', '一键添加推荐源')}
            </Button>
            <Upload accept=".opml,.xml" showUploadList={false} beforeUpload={handleImportOPML}>
              <Button icon={<ImportOutlined />}>{t('rss.importOPML', '导入 OPML')}</Button>
            </Upload>
          </Space>
        </Empty>

        <Card title={t('rss.presetTitle', '推荐订阅源')} style={{ marginTop: 24, textAlign: 'left' }}>
          <Space wrap size={[8, 8]}>
            {RSS_PRESETS.map((p) => (
              <Tag
                key={p.url}
                style={{ cursor: 'pointer', padding: '4px 12px', fontSize: 13 }}
                onClick={async () => {
                  try {
                    await createFeed({ title: p.title, url: p.url, siteUrl: p.siteUrl, category: p.category, description: p.description });
                    message.success(`${p.title} ${t('rss.messages.addSuccess', '添加成功')}`);
                  } catch (_) {}
                }}
              >
                {p.icon} {p.title}
              </Tag>
            ))}
          </Space>
        </Card>

        <RssAddFeedModal open={addModalOpen} onCancel={() => setAddModalOpen(false)} onOk={handleAddFeed} />
      </div>
    );
  }

  const showFeedList = !isNarrow || mobileView === 'feeds';
  const showArticleList = !isNarrow || mobileView === 'articles';

  return (
    <div style={{ display: 'flex', gap: 16, height: 'calc(100vh - 120px)', minHeight: 400, flexDirection: isNarrow ? 'column' : 'row' }}>
      {/* 左侧：订阅源列表（窄屏时可能隐藏） */}
      <div style={{
        width: isNarrow ? '100%' : 280,
        flexShrink: 0,
        display: showFeedList ? 'flex' : 'none',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        <div style={{ marginBottom: 12 }}>
          <Space wrap size={[4, 4]}>
            <Button type="primary" size="small" icon={<PlusOutlined />} onClick={() => setAddModalOpen(true)}>
              {t('rss.addFeed', '添加')}
            </Button>
            <Button size="small" icon={<ReloadOutlined />} loading={refreshing} onClick={handleRefreshAll}>
              {t('rss.refreshAll', '刷新全部')}
            </Button>
            <Dropdown
              menu={{
                items: [
                  {
                    key: 'import',
                    label: (
                      <Upload accept=".opml,.xml" showUploadList={false} beforeUpload={handleImportOPML}>
                        <span>{t('rss.importOPML', '导入 OPML')}</span>
                      </Upload>
                    ),
                    icon: <ImportOutlined />,
                  },
                  {
                    key: 'export',
                    label: t('rss.exportOPML', '导出 OPML'),
                    icon: <ExportOutlined />,
                    onClick: handleExportOPML,
                  },
                ],
              }}
            >
              <Button size="small">OPML</Button>
            </Dropdown>
          </Space>
        </div>

        {!isElectron() && (
          <Alert
            type="info"
            showIcon
            closable
            message={t('rss.corsWarning', 'Web 模式下部分 RSS 源可能无法访问')}
            style={{ marginBottom: 8, fontSize: 12 }}
          />
        )}

        {/* 全部文章入口 */}
        <div
          onClick={() => {
            loadArticles(null);
            if (window.matchMedia('(max-width: 768px)').matches) setMobileView('articles');
          }}
          style={{
            padding: '8px 12px',
            cursor: 'pointer',
            borderRadius: 6,
            marginBottom: 4,
            background: !selectedFeedId ? token.colorPrimaryBg : 'transparent',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Space size={6}>
            <ReadOutlined />
            <Text strong={!selectedFeedId}>{t('rss.allArticles', '全部文章')}</Text>
          </Space>
          {totalUnread > 0 && <Badge count={totalUnread} size="small" />}
        </div>

        <div style={{ flex: 1, overflow: 'auto' }}>
          {feeds.map((feed) => (
            <div
              key={feed.id}
              onClick={() => handleSelectFeed(feed.id)}
              style={{
                padding: '8px 12px',
                cursor: 'pointer',
                borderRadius: 6,
                marginBottom: 2,
                background: selectedFeedId === feed.id ? token.colorPrimaryBg : 'transparent',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <Space size={6} style={{ flex: 1, minWidth: 0 }}>
                <Avatar
                  size={20}
                  src={feed.icon_url}
                  style={{ backgroundColor: token.colorPrimary, fontSize: 10, flexShrink: 0 }}
                >
                  {!feed.icon_url && (feed.title || '?')[0]}
                </Avatar>
                <Text
                  ellipsis
                  strong={selectedFeedId === feed.id}
                  style={{ maxWidth: 150 }}
                  title={feed.title}
                >
                  {feed.title}
                </Text>
              </Space>
              <Space size={2}>
                {feed.unread_count > 0 && <Badge count={feed.unread_count} size="small" />}
                {feed.last_fetch_status === 'error' && (
                  <Tooltip title={feed.last_fetch_error || t('rss.feed.fetchError', '抓取失败')}>
                    <Text type="danger" style={{ fontSize: 12 }}>!</Text>
                  </Tooltip>
                )}
                <Tooltip title={feed.last_fetch_status === 'error' ? t('rss.feed.retry', '重试') : t('rss.feed.refresh', '刷新')}>
                  <Button
                    type="text"
                    size="small"
                    icon={<ReloadOutlined spin={fetchingFeedId === feed.id} />}
                    onClick={(e) => { e.stopPropagation(); handleRefreshFeed(feed.id); }}
                    style={{ width: 22, height: 22 }}
                  />
                </Tooltip>
                <Popconfirm
                  title={t('rss.messages.deleteConfirm', '确定删除此订阅源？')}
                  onConfirm={(e) => { e?.stopPropagation(); handleDeleteFeed(feed.id); }}
                  onCancel={(e) => e?.stopPropagation()}
                >
                  <Button
                    type="text"
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={(e) => e.stopPropagation()}
                    style={{ width: 22, height: 22 }}
                  />
                </Popconfirm>
              </Space>
            </div>
          ))}
        </div>
      </div>

      {/* 右侧：文章列表（窄屏时选中 feed 后显示） */}
      <div style={{
        flex: 1,
        display: showArticleList ? 'flex' : 'none',
        flexDirection: 'column',
        overflow: 'hidden',
        minWidth: 0,
      }}>
        {selectedFeed?.last_fetch_status === 'error' && (
          <Alert
            type="error"
            showIcon
            message={t('rss.feed.fetchError', '抓取失败')}
            description={selectedFeed.last_fetch_error || ''}
            action={
              <Button size="small" danger onClick={() => handleRefreshFeed(selectedFeed.id)} loading={fetchingFeedId === selectedFeed.id}>
                {t('rss.feed.retry', '重试')}
              </Button>
            }
            style={{ marginBottom: 12 }}
          />
        )}
        <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <Space>
            {isNarrow && (
              <Button
                size="small"
                onClick={() => setMobileView('feeds')}
                style={{ marginRight: 4 }}
              >
                ← {t('rss.feed.back', '返回')}
              </Button>
            )}
            <Title level={5} style={{ margin: 0 }}>
              {selectedFeed ? selectedFeed.title : t('rss.allArticles', '全部文章')}
            </Title>
            {selectedFeed?.last_fetch_at && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                {t('rss.feed.lastFetch', '更新于')} {dayjs(selectedFeed.last_fetch_at).fromNow()}
              </Text>
            )}
          </Space>
          <Space>
            <Segmented
              size="small"
              value={articleFilter}
              onChange={setArticleFilter}
              options={[
                { label: t('rss.article.filterAll', '全部'), value: 'all' },
                { label: t('rss.article.filterUnread', '未读'), value: 'unread' },
                { label: t('rss.article.filterStarred', '收藏'), value: 'starred' },
              ]}
            />
            <Button size="small" icon={<CheckOutlined />} onClick={handleMarkAllRead}>
              {t('rss.article.markAllRead', '全部已读')}
            </Button>
          </Space>
        </div>

        <div
          style={{ flex: 1, overflow: 'auto' }}
          onScroll={(e) => {
            const el = e.target;
            if (!articlesHasMore) return;
            if (el.scrollHeight - el.scrollTop - el.clientHeight < 100) {
              loadMoreArticles();
            }
          }}
        >
          {filteredArticles.length === 0 ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={t('rss.noArticles', '暂无文章')}
              style={{ marginTop: 60 }}
            />
          ) : (
            <List
              dataSource={filteredArticles}
              renderItem={(article, index) => (
                <List.Item
                  key={article.id}
                  style={{
                    cursor: 'pointer',
                    padding: '12px 8px',
                    opacity: article.is_read ? 0.65 : 1,
                    backgroundColor: index === focusedArticleIndex ? token.colorPrimaryBg : undefined,
                    borderRadius: 4,
                  }}
                  onClick={() => { setFocusedArticleIndex(index); handleArticleClick(article); }}
                  actions={[
                    <Tooltip key="star" title={article.is_starred ? t('rss.article.unstar', '取消收藏') : t('rss.article.star', '收藏')}>
                      <Button
                        type="text"
                        size="small"
                        icon={article.is_starred ? <StarFilled style={{ color: '#faad14' }} /> : <StarOutlined />}
                        onClick={(e) => { e.stopPropagation(); toggleStar(article.id); }}
                      />
                    </Tooltip>,
                    article.link && (
                      <Tooltip key="link" title={t('rss.article.openLink', '打开链接')}>
                        <Button
                          type="text"
                          size="small"
                          icon={<LinkOutlined />}
                          onClick={(e) => { e.stopPropagation(); window.open(article.link, '_blank', 'noopener,noreferrer'); }}
                        />
                      </Tooltip>
                    ),
                  ].filter(Boolean)}
                >
                  <List.Item.Meta
                    title={
                      <Space size={6}>
                        {!article.is_read && (
                          <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: token.colorPrimary, display: 'inline-block', flexShrink: 0 }} />
                        )}
                        <Text strong={!article.is_read} style={{ fontSize: 14 }}>
                          {article.title}
                        </Text>
                      </Space>
                    }
                    description={
                      <div>
                        {article.description && (
                          <Paragraph
                            type="secondary"
                            ellipsis={{ rows: 2 }}
                            style={{ fontSize: 12, margin: '4px 0' }}
                          >
                            {article.description.replace(/<[^>]*>/g, '')}
                          </Paragraph>
                        )}
                        <Space size={12} style={{ fontSize: 11, color: token.colorTextTertiary }}>
                          {article.author && <span>{article.author}</span>}
                          {article.published_at && <span>{dayjs(article.published_at).fromNow()}</span>}
                          {!selectedFeedId && (
                            <Tag style={{ fontSize: 11, lineHeight: '16px', padding: '0 4px' }}>
                              {feeds.find((f) => f.id === article.feed_id)?.title || ''}
                            </Tag>
                          )}
                        </Space>
                      </div>
                    }
                  />
                </List.Item>
              )}
            />
          )}
          {articlesHasMore && filteredArticles.length > 0 && (
            <div style={{ textAlign: 'center', padding: 16 }}>
              <Button type="link" onClick={() => loadMoreArticles()}>
                {t('rss.article.loadMore', '加载更多')}
              </Button>
            </div>
          )}
        </div>
      </div>

      <RssAddFeedModal open={addModalOpen} onCancel={() => setAddModalOpen(false)} onOk={handleAddFeed} />
      <RssArticleDetailModal
        open={articleDetailOpen}
        article={selectedArticle ? (articles.find((a) => a.id === selectedArticle.id) || selectedArticle) : null}
        feedTitle={selectedArticle ? feeds.find((f) => f.id === selectedArticle.feed_id)?.title : null}
        onClose={() => setArticleDetailOpen(false)}
        onOpenLink={handleOpenArticleLink}
        onToggleStar={toggleStar}
      />
    </div>
  );
}
