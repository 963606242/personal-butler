import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  Button,
  Space,
  Typography,
  Input,
  Spin,
  Empty,
  Tag,
  Tabs,
  List,
  Avatar,
  message,
  Alert,
  Switch,
  Segmented,
} from 'antd';
import {
  SearchOutlined,
  ReloadOutlined,
  FileTextOutlined,
  ThunderboltOutlined,
  MoonOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import useNewsStore from '../stores/newsStore';
import useUserStore from '../stores/userStore';
import { getLogger } from '../services/logger-client';
import { useI18n } from '../context/I18nContext';
import {
  isApiKeyConfigured,
  isIntlApiConfigured,
  CN_CATEGORIES,
  INTL_CATEGORIES,
} from '../services/news-api';
import { getCnCategories } from '../services/news-api-cn';

const { Title, Text } = Typography;
const { Search } = Input;
const logger = getLogger();

const NEWS_SHOW_IMAGES_STORAGE_KEY = 'news-show-images';

function News() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [searchText, setSearchText] = useState('');
  const [activeTab, setActiveTab] = useState('cn');
  const [selectedCategoryCn, setSelectedCategoryCn] = useState('guonei');
  const [selectedCategoryIntl, setSelectedCategoryIntl] = useState('general');
  const [showImages, setShowImages] = useState(() => {
    try {
      return localStorage.getItem(NEWS_SHOW_IMAGES_STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [intlError, setIntlError] = useState(false);
  const [cnCategories, setCnCategories] = useState([{ value: 'guonei', label: '国内', colid: null }]);
  const [categoryViewModeCn, setCategoryViewModeCn] = useState('cloud');
  const [categoryViewModeIntl, setCategoryViewModeIntl] = useState('cloud');

  const { currentUser, isInitialized } = useUserStore();
  const {
    headlinesCn,
    headlinesIntl,
    newsByCategoryCn,
    newsByCategoryIntl,
    headlineLoading,
    categoryLoading,
    dailyReport,
    searchResults,
    searchLoading,
    fetchHeadlinesBySource,
    fetchNewsByCategoryBySource,
    searchNews: searchNewsInStore,
    getTodayMorningReport,
    getTodayEveningReport,
  } = useNewsStore();

  useEffect(() => {
    if (!isInitialized || !currentUser || !isApiKeyConfigured()) return;
    const load = async () => {
      let cats = [];
      try {
        cats = await getCnCategories();
        if (cats && cats.length > 0) {
          setCnCategories(cats);
          setSelectedCategoryCn(cats[0].value);
        } else {
          cats = [{ value: 'guonei', label: '国内', colid: null }];
          setCnCategories(cats);
          setSelectedCategoryCn('guonei');
        }
      } catch (e) {
        logger.error('News', '加载国内分类列表失败', e);
        cats = [{ value: 'guonei', label: '国内', colid: null }];
        setCnCategories(cats);
        setSelectedCategoryCn('guonei');
      }
      if (cats.length === 0) {
        cats = [{ value: 'guonei', label: '国内', colid: null }];
        setCnCategories(cats);
        setSelectedCategoryCn('guonei');
      }
      const firstCat = cats[0]?.value || 'guonei';
      await new Promise((r) => setTimeout(r, 400));
      try {
        await fetchHeadlinesBySource({ source: 'cn' });
      } catch (e) {
        logger.error('News', '加载国内头条失败', e);
      }
      if (firstCat !== 'guonei') {
        await new Promise((r) => setTimeout(r, 400));
        try {
          await fetchNewsByCategoryBySource(firstCat, 'cn', 20);
        } catch (e) {
          logger.error('News', '加载国内分类失败', e);
        }
      }
    };
    load();
  }, [isInitialized, currentUser, fetchHeadlinesBySource, fetchNewsByCategoryBySource]);

  const handleSearch = async (value) => {
    if (!value?.trim()) return;
    try {
      await searchNewsInStore(value.trim());
      setActiveTab('search');
    } catch (e) {
      logger.error('News', '搜索失败', e);
      message.error(t('news.messages.searchFailed', '搜索失败，请稍后重试'));
    }
  };

  const handleCategoryCn = async (category) => {
    setSelectedCategoryCn(category);
    if (category === 'guonei') return;
    try {
      await fetchNewsByCategoryBySource(category, 'cn', 20);
    } catch (e) {
      logger.error('News', `加载国内分类 ${category} 失败`, e);
      message.error(t('news.messages.loadFailed', '加载失败，请重试'));
    }
  };

  const handleCategoryIntl = async (category) => {
    setSelectedCategoryIntl(category);
    try {
      await fetchNewsByCategoryBySource(category, 'intl', 20);
    } catch (e) {
      logger.error('News', `加载国外分类 ${category} 失败`, e);
      message.error(t('news.messages.loadFailed', '加载失败，请重试'));
    }
  };

  const handleRefreshCn = async () => {
    try {
      await fetchHeadlinesBySource({ source: 'cn', skipCache: true });
      message.success(t('news.messages.refreshed', '已刷新'));
    } catch (e) {
      message.error(t('news.messages.refreshFailed', '刷新失败'));
    }
  };

  const handleRefreshIntl = async () => {
    setIntlError(false);
    try {
      await fetchHeadlinesBySource({ source: 'intl', skipCache: true });
      await fetchNewsByCategoryBySource(selectedCategoryIntl, 'intl', 20, { skipCache: true });
      message.success(t('news.messages.refreshed', '已刷新'));
    } catch (e) {
      setIntlError(true);
      message.error(t('news.messages.refreshFailedNetwork', '刷新失败，请检查网络或代理后重试'));
    }
  };

  const handleRetryIntl = async () => {
    setIntlError(false);
    try {
      await fetchHeadlinesBySource({ source: 'intl' });
      await fetchNewsByCategoryBySource('general', 'intl', 20);
    } catch (e) {
      setIntlError(true);
      message.error(t('news.messages.intlLoadFailed', '国外新闻加载失败，请检查网络或代理后重试'));
    }
  };

  const handleGenerateMorningReport = async () => {
    try {
      await getTodayMorningReport();
      message.success(t('news.messages.morningGenerated', '早报已生成'));
    } catch (e) {
      logger.error('News', '生成早报失败', e);
      message.error(t('news.messages.morningFailed', '生成早报失败'));
    }
  };

  const handleGenerateEveningReport = async () => {
    try {
      await getTodayEveningReport();
      message.success(t('news.messages.eveningGenerated', '晚报已生成'));
    } catch (e) {
      logger.error('News', '生成晚报失败', e);
      message.error(t('news.messages.eveningFailed', '生成晚报失败'));
    }
  };

  const formatDate = (dateString) =>
    dateString ? dayjs(dateString).format('YYYY-MM-DD HH:mm') : '';

  const renderNewsThumb = (item, size = 100) => {
    if (!showImages || !item?.urlToImage) {
      return <Avatar shape="square" size={size} icon={<FileTextOutlined />} />;
    }
    return (
      <Avatar
        shape="square"
        size={size}
        src={item.urlToImage}
        icon={<FileTextOutlined />}
        onError={() => false}
      />
    );
  };

  const spinBlock = (tip = '加载中...') => (
    <div style={{ textAlign: 'center', padding: 24 }}>
      <Spin size="small" />
      <div style={{ marginTop: 8 }}><Text type="secondary" style={{ fontSize: 12 }}>{tip}</Text></div>
    </div>
  );

  /** 头条：横向滚动卡片 */
  const renderHeadlineCards = (items, spinning) => {
    if (spinning) return spinBlock();
    if (!items?.length) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无" />;
    return (
      <div className="news-headline-scroll">
        {items.slice(0, 10).map((item, idx) => (
          <Card
            key={item.url || idx}
            size="small"
            hoverable
            className="news-headline-item"
            styles={{ body: { padding: 10 } }}
            onClick={() => item.url && window.open(item.url, '_blank', 'noopener,noreferrer')}
          >
            <div style={{ display: 'flex', gap: 8 }}>
              {renderNewsThumb(item, 56)}
              <div style={{ flex: 1, minWidth: 0 }}>
                <Text ellipsis={{ rows: 2 }} style={{ fontSize: 13, lineHeight: 1.4, display: 'block' }}>
                  {item.title}
                </Text>
              </div>
            </div>
            <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
              <Tag className="news-source-tag">{item.source}</Tag>
              <Text type="secondary" style={{ fontSize: 11 }}>{formatDate(item.publishedAt)}</Text>
            </div>
          </Card>
        ))}
      </div>
    );
  };

  /** 分类主区：较密列表，横向布局 */
  const renderCategoryList = (items, spinning) => {
    if (spinning) return spinBlock();
    if (!items?.length) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无" />;
    return (
      <List
        size="small"
        itemLayout="horizontal"
        dataSource={items}
        renderItem={(item) => (
          <List.Item className="news-list-item" style={{ alignItems: 'flex-start' }}>
            <List.Item.Meta
              avatar={<span className="news-thumb">{renderNewsThumb(item, 64)}</span>}
              title={
                <a href={item.url} target="_blank" rel="noopener noreferrer">
                  {item.title}
                </a>
              }
              description={
                <div>
                  {item.description && (
                    <Text type="secondary" ellipsis={{ rows: 1 }} style={{ fontSize: 12 }}>
                      {item.description}
                    </Text>
                  )}
                  <div style={{ marginTop: 4 }}>
                    <Tag className="news-source-tag" style={{ marginRight: 4 }}>{item.source}</Tag>
                    <Text type="secondary" style={{ fontSize: 12 }}>{formatDate(item.publishedAt)}</Text>
                  </div>
                </div>
              }
            />
          </List.Item>
        )}
      />
    );
  };

  /** 分类：卡片 / 瀑布流风格（栅格） */
  const renderCategoryGrid = (items, spinning) => {
    if (spinning) return spinBlock();
    if (!items?.length) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无" />;
    return (
      <List
        grid={{ gutter: 12, xs: 1, sm: 1, md: 2, lg: 2, xl: 3 }}
        dataSource={items}
        renderItem={(item) => (
          <List.Item>
            <Card
              size="small"
              hoverable
              className="news-grid-card"
              styles={{ body: { padding: 8 } }}
              onClick={() => {
                if (item.url) {
                  window.open(item.url, '_blank', 'noopener,noreferrer');
                }
              }}
            >
              <Space align="start" size={8}>
                <span className="news-thumb">{renderNewsThumb(item, 56)}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Text ellipsis={{ rows: 2 }} style={{ display: 'block', marginBottom: 4 }}>
                    {item.title}
                  </Text>
                  {item.description && (
                    <Text type="secondary" ellipsis={{ rows: 2 }} style={{ fontSize: 12 }}>
                      {item.description}
                    </Text>
                  )}
                  <div style={{ marginTop: 4 }}>
                    <Tag className="news-source-tag" style={{ marginRight: 4 }}>{item.source}</Tag>
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      {formatDate(item.publishedAt)}
                    </Text>
                  </div>
                </div>
              </Space>
            </Card>
          </List.Item>
        )}
      />
    );
  };

  /** 分类：云图（信息更丰富的标签块） */
  const CLOUD_BORDER_COLORS = ['#1890ff', '#52c41a', '#2f54eb', '#722ed1', '#faad14', '#fa541c'];
  const renderCategoryCloud = (items, spinning) => {
    if (spinning) return spinBlock();
    if (!items?.length) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无" />;
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        {items.map((item, idx) => (
          <Card
            key={item.url || idx}
            size="small"
            hoverable
            className="news-cloud-card"
            styles={{ body: { padding: 10 } }}
            style={{
              borderLeftColor: `${CLOUD_BORDER_COLORS[idx % CLOUD_BORDER_COLORS.length]} !important`,
              borderLeft: `3px solid ${CLOUD_BORDER_COLORS[idx % CLOUD_BORDER_COLORS.length]}`,
            }}
            onClick={() => item.url && window.open(item.url, '_blank', 'noopener,noreferrer')}
          >
            <div style={{ display: 'flex', gap: 8 }}>
              {showImages && item?.urlToImage ? (
                <Avatar
                  shape="square"
                  size={48}
                  src={item.urlToImage}
                  icon={<FileTextOutlined />}
                  onError={() => false}
                  className="news-thumb"
                  style={{ flexShrink: 0 }}
                />
              ) : null}
              <div style={{ flex: 1, minWidth: 0 }}>
                <Text ellipsis={{ rows: 2 }} style={{ fontSize: 13, lineHeight: 1.4, display: 'block', marginBottom: 4 }}>
                  {item.title}
                </Text>
                {item.description && (
                  <Text type="secondary" ellipsis={{ rows: 1 }} style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
                    {item.description}
                  </Text>
                )}
                <Space size={4} style={{ flexWrap: 'wrap' }}>
                  <Tag className="news-source-tag">{item.source}</Tag>
                  <Text type="secondary" style={{ fontSize: 11 }}>{formatDate(item.publishedAt)}</Text>
                </Space>
              </div>
            </div>
          </Card>
        ))}
      </div>
    );
  };

  /** 根据展示模式渲染分类列表 */
  const renderCategoryByMode = (items, mode, spinning) => {
    if (mode === 'grid') return renderCategoryGrid(items, spinning);
    if (mode === 'cloud') return renderCategoryCloud(items, spinning);
    return renderCategoryList(items, spinning);
  };

  if (!isInitialized) {
    return (
      <div style={{ textAlign: 'center', padding: 50 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!isApiKeyConfigured()) {
    return (
      <div>
        <Title level={2}>新闻资讯</Title>
        <Alert
          message="请配置至少一个新闻 API"
          description={
            <div>
              <p>请在 <strong>设置 → API Keys</strong> 中配置：</p>
              <p>国内：天聚数行 / 极速数据；国外：NewsAPI。也可在 <code>.env</code> 中配置相应变量。</p>
            </div>
          }
          type="warning"
          showIcon
          action={<Button size="small" onClick={() => navigate('/settings')}>去设置</Button>}
        />
      </div>
    );
  }

  const cnHeadlineSpin = headlineLoading === 'cn';
  const intlHeadlineSpin = headlineLoading === 'intl';
  const cnCategorySpin = categoryLoading != null && String(categoryLoading).startsWith('cn_');
  const intlCategorySpin = categoryLoading != null && String(categoryLoading).startsWith('intl_');

  const tabItems = [
    {
      key: 'cn',
      label: '国内新闻',
      children: (
        <div>
          <Alert
            type="info"
            showIcon
            message="天聚数行 QPS=3，已做早/午/晚缓存，请勿频繁刷新"
            style={{ marginBottom: 12 }}
          />
          <Card
            size="small"
            className="news-headline-card"
            title="头条"
            extra={
              <Button type="link" size="small" icon={<ReloadOutlined />} onClick={handleRefreshCn} loading={cnHeadlineSpin}>
                刷新
              </Button>
            }
            styles={{ body: { padding: '8px 12px' } }}
          >
            {renderHeadlineCards(headlinesCn, cnHeadlineSpin)}
          </Card>
      <div style={{ marginBottom: 12, display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            <Text type="secondary">分类</Text>
            <Space wrap size="small">
              {cnCategories.map((c) => (
                <Button
                  key={c.value}
                  type={selectedCategoryCn === c.value ? 'primary' : 'default'}
                  size="small"
                  style={{ borderRadius: 8 }}
                  onClick={() => handleCategoryCn(c.value)}
                  loading={categoryLoading === `cn_${c.value}`}
                >
                  {c.label}
                </Button>
              ))}
            </Space>
            <Text type="secondary" style={{ marginLeft: 8 }}>展示</Text>
            <Segmented
              size="small"
              value={categoryViewModeCn}
              onChange={(v) => setCategoryViewModeCn(v)}
              options={[
                { label: '列表', value: 'list' },
                { label: '卡片', value: 'grid' },
                { label: '云图', value: 'cloud' },
              ]}
            />
          </div>
          {renderCategoryByMode(
            selectedCategoryCn === 'guonei'
              ? headlinesCn
              : newsByCategoryCn[selectedCategoryCn],
            categoryViewModeCn,
            selectedCategoryCn === 'guonei'
              ? cnHeadlineSpin
              : (cnCategorySpin && categoryLoading === `cn_${selectedCategoryCn}`)
          )}
        </div>
      ),
    },
    {
      key: 'intl',
      label: '国外新闻',
      children: (
        <div>
          {!isIntlApiConfigured() && (
            <Alert
              type="info"
              showIcon
              message="未配置国际 API"
              description="国外新闻需在 设置 → API Keys 配置 NewsAPI Key。"
              style={{ marginBottom: 12 }}
              action={<Button size="small" onClick={() => navigate('/settings')}>去设置</Button>}
            />
          )}
          {isIntlApiConfigured() && intlError && (
            <Alert
              type="warning"
              showIcon
              message="国外新闻加载失败，请检查网络或代理后重试"
              style={{ marginBottom: 12 }}
              action={<Button size="small" onClick={handleRetryIntl}>重试</Button>}
            />
          )}
          <Card
            size="small"
            className="news-headline-card"
            title="头条"
            extra={
              <Button
                type="link"
                size="small"
                icon={<ReloadOutlined />}
                onClick={handleRefreshIntl}
                loading={intlHeadlineSpin}
                disabled={!isIntlApiConfigured()}
              >
                刷新
              </Button>
            }
            styles={{ body: { padding: '8px 12px' } }}
          >
            {renderHeadlineCards(headlinesIntl, intlHeadlineSpin)}
          </Card>
          <div style={{ marginBottom: 12, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
            <Text type="secondary">分类</Text>
            <Space wrap size="small">
              {INTL_CATEGORIES.map((c) => (
                <Button
                  key={c.value}
                  type={selectedCategoryIntl === c.value ? 'primary' : 'default'}
                  size="small"
                  style={{ borderRadius: 8 }}
                  onClick={() => handleCategoryIntl(c.value)}
                  loading={categoryLoading === `intl_${c.value}`}
                  disabled={!isIntlApiConfigured()}
                >
                  {c.icon} {c.label}
                </Button>
              ))}
            </Space>
            <Text type="secondary" style={{ marginLeft: 8 }}>展示</Text>
            <Segmented
              size="small"
              value={categoryViewModeIntl}
              onChange={(v) => setCategoryViewModeIntl(v)}
              options={[
                { label: '列表', value: 'list' },
                { label: '卡片', value: 'grid' },
                { label: '云图', value: 'cloud' },
              ]}
            />
          </div>
          {renderCategoryByMode(
            newsByCategoryIntl[selectedCategoryIntl],
            categoryViewModeIntl,
            intlCategorySpin && categoryLoading === `intl_${selectedCategoryIntl}`
          )}
        </div>
      ),
    },
    {
      key: 'search',
      label: '搜索',
      children: (
        <div>
          {!isIntlApiConfigured() && (
            <Alert
              type="info"
              showIcon
              message="搜索需在 设置 → API Keys 配置 NewsAPI Key"
              style={{ marginBottom: 12 }}
              action={<Button size="small" onClick={() => navigate('/settings')}>去设置</Button>}
            />
          )}
          <Search
            placeholder="搜索关键词（国际 API）"
            allowClear
            enterButton={<SearchOutlined />}
            size="middle"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onSearch={handleSearch}
            loading={searchLoading}
            style={{ marginBottom: 12 }}
          />
          {searchLoading ? spinBlock('搜索中...') : searchResults.length > 0 ? (
            renderCategoryList(searchResults, false)
          ) : (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="输入关键词搜索" />
          )}
        </div>
      ),
    },
    {
      key: 'reports',
      label: '早报/晚报',
      children: (
        <div>
          <Space size="small" style={{ marginBottom: 12 }}>
            <Button type="primary" size="small" icon={<ThunderboltOutlined />} onClick={handleGenerateMorningReport}>
              生成早报
            </Button>
            <Button size="small" icon={<MoonOutlined />} onClick={handleGenerateEveningReport}>
              生成晚报
            </Button>
          </Space>
          {dailyReport && (
            <Card
              size="small"
              className="news-report-card"
              title={
                <Space size="small">
                  {dailyReport.type === 'morning' ? (
                    <><ThunderboltOutlined style={{ color: '#faad14' }} /><span>今日早报</span></>
                  ) : (
                    <><MoonOutlined style={{ color: '#1890ff' }} /><span>今日晚报</span></>
                  )}
                  <Tag>{dailyReport.date}</Tag>
                </Space>
              }
            >
              {dailyReport.type === 'morning' && dailyReport.categories && Object.keys(dailyReport.categories).length > 0 ? (
                <div>
                  {Object.entries(dailyReport.categories).map(([cat, news]) => {
                    if (!news?.length) return null;
                    const info = CN_CATEGORIES.find((c) => c.value === cat) || INTL_CATEGORIES.find((c) => c.value === cat);
                    return (
                      <div key={cat} className="news-report-section">
                        <Text strong style={{ display: 'block', marginBottom: 8 }}>
                          {info?.icon || '📰'} {info?.label || cat}
                        </Text>
                        <List
                          size="small"
                          dataSource={news}
                          renderItem={(item) => (
                            <List.Item style={{ padding: '4px 0', borderBlockEnd: 'none' }}>
                              <List.Item.Meta
                                title={
                                  <a href={item.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13 }}>
                                    {item.title}
                                  </a>
                                }
                                description={
                                  <div style={{ marginTop: 2 }}>
                                    {item.description && (
                                      <Text type="secondary" ellipsis style={{ fontSize: 12 }}>
                                        {item.description}
                                      </Text>
                                    )}
                                    <div style={{ marginTop: 2 }}>
                                      <Tag style={{ marginRight: 4 }}>{item.source}</Tag>
                                      <Text type="secondary" style={{ fontSize: 11 }}>{formatDate(item.publishedAt)}</Text>
                                    </div>
                                  </div>
                                }
                              />
                            </List.Item>
                          )}
                        />
                      </div>
                    );
                  })}
                </div>
              ) : dailyReport.type === 'evening' && dailyReport.headlines?.length > 0 ? (
                renderCategoryList(dailyReport.headlines, false)
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无报告，请点击上方按钮生成" />
              )}
            </Card>
          )}
          {!dailyReport && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="请生成早报或晚报" />}
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="news-header">
        <Title level={3} style={{ margin: 0 }}>新闻资讯</Title>
        <Space size="small">
          <Text type="secondary" style={{ fontSize: 12 }}>配图</Text>
          <Switch
            size="small"
            checked={showImages}
            onChange={(checked) => {
              setShowImages(checked);
              try { localStorage.setItem(NEWS_SHOW_IMAGES_STORAGE_KEY, checked ? '1' : '0'); } catch {}
            }}
          />
        </Space>
        <Search
          placeholder="搜索新闻"
          allowClear
          enterButton={<SearchOutlined />}
          size="middle"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          onSearch={handleSearch}
          loading={searchLoading}
          style={{ flex: '1 1 200px', minWidth: 200, maxWidth: 360 }}
        />
      </div>

      <Tabs
        className="news-tabs"
        items={tabItems}
        activeKey={activeTab}
        onChange={(k) => {
          setActiveTab(k);
          if (k === 'intl') setIntlError(false);
          if (
            k === 'intl' &&
            isIntlApiConfigured() &&
            headlinesIntl.length === 0 &&
            headlineLoading !== 'intl'
          ) {
            Promise.all([
              fetchHeadlinesBySource({ source: 'intl' }),
              fetchNewsByCategoryBySource('general', 'intl', 20),
            ]).catch(() => {
              setIntlError(true);
              message.warning(t('news.messages.intlLoadFailed', '国外新闻加载失败，请检查网络或代理后重试'));
            });
          }
        }}
      />
    </div>
  );
}

export default News;
