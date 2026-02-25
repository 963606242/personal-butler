/**
 * RSS 订阅 Store
 * 订阅源管理、文章管理、OPML 导入导出
 */
import { create } from 'zustand';
import { getDatabase } from '../services/database';
import { getCryptoService } from '../services/crypto';
import { getLogger } from '../services/logger-client';
import useUserStore from './userStore';
import { fetchAndParseFeed, parseOPML, generateOPML } from '../services/rss-service';

const logger = getLogger();

const useRssStore = create((set, get) => ({
  feeds: [],
  articles: [],
  articlesHasMore: false,
  selectedFeedId: null,
  loading: false,
  loadingMore: false,
  refreshing: false,
  articleFilter: 'all', // 'all' | 'unread' | 'starred'

  // ─── Feed 管理 ───

  async loadFeeds() {
    try {
      set({ loading: true });
      const db = await getDatabase();
      const { currentUser } = useUserStore.getState();
      if (!currentUser) {
        set({ feeds: [], loading: false });
        return [];
      }
      const rows = await db.query(
        'SELECT * FROM rss_feeds WHERE user_id = ? ORDER BY sort_order ASC, created_at ASC',
        [currentUser.id]
      );
      set({ feeds: rows || [], loading: false });
      logger.log('RSSStore', `加载 ${(rows || []).length} 个订阅源`);
      return rows || [];
    } catch (e) {
      logger.error('RSSStore', '加载订阅源失败', e);
      set({ feeds: [], loading: false });
      throw e;
    }
  },

  async createFeed(data) {
    const db = await getDatabase();
    const { currentUser } = useUserStore.getState();
    if (!currentUser) throw new Error('用户未登录');

    // 检查 URL 是否已存在
    const existing = await db.query(
      'SELECT id FROM rss_feeds WHERE user_id = ? AND url = ?',
      [currentUser.id, data.url]
    );
    if (existing && existing.length > 0) {
      return { id: existing[0].id, created: false }; // 已存在
    }

    const id = getCryptoService().generateUUID();
    const now = Date.now();
    await db.execute(
      `INSERT INTO rss_feeds (id, user_id, title, url, site_url, description, icon_url, category, refresh_interval, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        currentUser.id,
        data.title || '',
        data.url,
        data.siteUrl || data.site_url || null,
        data.description || null,
        data.iconUrl || data.icon_url || null,
        data.category || 'other',
        data.refreshInterval || data.refresh_interval || 30,
        data.sortOrder || data.sort_order || 0,
        now,
        now,
      ]
    );
    await get().loadFeeds();
    // 立即抓取文章
    get().fetchArticles(id).catch(() => {});
    logger.log('RSSStore', `创建订阅源: ${data.title}`);
    return { id, created: true };
  },

  async updateFeed(id, data) {
    const db = await getDatabase();
    const { currentUser } = useUserStore.getState();
    if (!currentUser) throw new Error('用户未登录');
    const fields = [];
    const values = [];
    if (data.title !== undefined) { fields.push('title = ?'); values.push(data.title); }
    if (data.category !== undefined) { fields.push('category = ?'); values.push(data.category); }
    if (data.refresh_interval !== undefined) { fields.push('refresh_interval = ?'); values.push(data.refresh_interval); }
    if (data.sort_order !== undefined) { fields.push('sort_order = ?'); values.push(data.sort_order); }
    if (fields.length === 0) return;
    fields.push('updated_at = ?');
    values.push(Date.now());
    values.push(id, currentUser.id);
    await db.execute(
      `UPDATE rss_feeds SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`,
      values
    );
    await get().loadFeeds();
  },

  async deleteFeed(id) {
    const db = await getDatabase();
    const { currentUser } = useUserStore.getState();
    if (!currentUser) throw new Error('用户未登录');
    await db.execute('DELETE FROM rss_articles WHERE feed_id = ? AND user_id = ?', [id, currentUser.id]);
    await db.execute('DELETE FROM rss_feeds WHERE id = ? AND user_id = ?', [id, currentUser.id]);
    const { selectedFeedId } = get();
    if (selectedFeedId === id) {
      set({ selectedFeedId: null, articles: [] });
    }
    await get().loadFeeds();
    logger.log('RSSStore', `删除订阅源: ${id}`);
  },

  // ─── 文章管理 ───

  async loadArticles(feedId) {
    try {
      const db = await getDatabase();
      const { currentUser } = useUserStore.getState();
      if (!currentUser) return [];

      const limit = 50;
      let sql, params;
      if (feedId) {
        sql = 'SELECT * FROM rss_articles WHERE feed_id = ? AND user_id = ? ORDER BY published_at DESC LIMIT ?';
        params = [feedId, currentUser.id, limit];
      } else {
        sql = 'SELECT * FROM rss_articles WHERE user_id = ? ORDER BY published_at DESC LIMIT ?';
        params = [currentUser.id, limit];
      }
      const rows = await db.query(sql, params);
      set({ articles: rows || [], selectedFeedId: feedId || null, articlesHasMore: (rows?.length || 0) >= limit });
      return rows || [];
    } catch (e) {
      logger.error('RSSStore', '加载文章失败', e);
      set({ articles: [] });
      throw e;
    }
  },

  async loadMoreArticles(feedId) {
    const { articles, selectedFeedId, articlesHasMore, loadingMore } = get();
    if (!articlesHasMore || loadingMore) return articles;

    const currentFeedId = feedId ?? selectedFeedId;
    set({ loadingMore: true });
    try {
      const db = await getDatabase();
      const { currentUser } = useUserStore.getState();
      if (!currentUser) return articles;

      const limit = 50;
      const offset = articles.length;
      let sql, params;
      if (currentFeedId) {
        sql = 'SELECT * FROM rss_articles WHERE feed_id = ? AND user_id = ? ORDER BY published_at DESC LIMIT ? OFFSET ?';
        params = [currentFeedId, currentUser.id, limit, offset];
      } else {
        sql = 'SELECT * FROM rss_articles WHERE user_id = ? ORDER BY published_at DESC LIMIT ? OFFSET ?';
        params = [currentUser.id, limit, offset];
      }
      const rows = await db.query(sql, params);
      const merged = [...articles, ...(rows || [])];
      set({ articles: merged, articlesHasMore: (rows?.length || 0) >= limit, loadingMore: false });
      return merged;
    } catch (e) {
      logger.error('RSSStore', '加载更多文章失败', e);
      set({ loadingMore: false });
      return articles;
    }
  },

  async fetchArticles(feedId) {
    const db = await getDatabase();
    const { currentUser } = useUserStore.getState();
    if (!currentUser) return;

    const feeds = get().feeds;
    const feed = feeds.find((f) => f.id === feedId);
    if (!feed) return;

    const result = await fetchAndParseFeed(feed.url);
    const now = Date.now();

    if (!result.success) {
      const errMsg = (result.error || 'unknown').slice(0, 500);
      await db.execute(
        'UPDATE rss_feeds SET last_fetch_at = ?, last_fetch_status = ?, last_fetch_error = ?, updated_at = ? WHERE id = ? AND user_id = ?',
        [now, 'error', errMsg, now, feedId, currentUser.id]
      );
      await get().loadFeeds();
      throw new Error(result.error);
    }

    const { items, image } = result.data;
    let newCount = 0;

    // 更新订阅源图标（若解析结果中有）
    if (image) {
      await db.execute(
        'UPDATE rss_feeds SET icon_url = ? WHERE id = ? AND user_id = ?',
        [image, feedId, currentUser.id]
      );
    }

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      try {
        const articleId = getCryptoService().generateUUID();
        // guid 为空时使用 fallback，避免 UNIQUE 约束导致多篇文章被丢弃
        const guid = item.guid || item.link || `${item.title || ''}-${item.publishedAt || now}-${i}`;
        const execResult = await db.execute(
          `INSERT OR IGNORE INTO rss_articles (id, feed_id, user_id, title, link, guid, description, content, author, image_url, published_at, is_read, is_starred, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?)`,
          [
            articleId,
            feedId,
            currentUser.id,
            item.title,
            item.link,
            guid,
            item.description,
            item.content,
            item.author,
            item.imageUrl,
            item.publishedAt,
            now,
          ]
        );
        // 仅当实际插入成功时统计（INSERT OR IGNORE 在 guid 重复时 changes=0）
        if ((execResult?.changes ?? 0) > 0) newCount++;
      } catch (_) {
        // guid 冲突时 INSERT OR IGNORE 会静默跳过
      }
    }

    // 更新 unread_count
    const unreadRows = await db.query(
      'SELECT COUNT(*) as cnt FROM rss_articles WHERE feed_id = ? AND user_id = ? AND is_read = 0',
      [feedId, currentUser.id]
    );
    const unreadCount = unreadRows?.[0]?.cnt || 0;

    await db.execute(
      'UPDATE rss_feeds SET last_fetch_at = ?, last_fetch_status = ?, last_fetch_error = NULL, unread_count = ?, updated_at = ? WHERE id = ? AND user_id = ?',
      [now, 'success', unreadCount, now, feedId, currentUser.id]
    );

    await get().loadFeeds();
    if (get().selectedFeedId === feedId) {
      await get().loadArticles(feedId);
    }

    logger.log('RSSStore', `抓取 ${feed.title}: 新增 ${newCount} 篇`);
  },

  async markAsRead(articleId) {
    const db = await getDatabase();
    const { currentUser } = useUserStore.getState();
    if (!currentUser) return;

    await db.execute(
      'UPDATE rss_articles SET is_read = 1 WHERE id = ? AND user_id = ?',
      [articleId, currentUser.id]
    );

    // 更新内存中的 articles
    set((s) => ({
      articles: s.articles.map((a) => (a.id === articleId ? { ...a, is_read: 1 } : a)),
    }));

    // 更新 feed 的 unread_count
    const article = get().articles.find((a) => a.id === articleId);
    if (article) {
      const unreadRows = await db.query(
        'SELECT COUNT(*) as cnt FROM rss_articles WHERE feed_id = ? AND user_id = ? AND is_read = 0',
        [article.feed_id, currentUser.id]
      );
      const unreadCount = unreadRows?.[0]?.cnt || 0;
      await db.execute(
        'UPDATE rss_feeds SET unread_count = ? WHERE id = ? AND user_id = ?',
        [unreadCount, article.feed_id, currentUser.id]
      );
      set((s) => ({
        feeds: s.feeds.map((f) => (f.id === article.feed_id ? { ...f, unread_count: unreadCount } : f)),
      }));
    }
  },

  async markAllAsRead(feedId) {
    const db = await getDatabase();
    const { currentUser } = useUserStore.getState();
    if (!currentUser) return;

    if (feedId) {
      await db.execute(
        'UPDATE rss_articles SET is_read = 1 WHERE feed_id = ? AND user_id = ? AND is_read = 0',
        [feedId, currentUser.id]
      );
      await db.execute(
        'UPDATE rss_feeds SET unread_count = 0 WHERE id = ? AND user_id = ?',
        [feedId, currentUser.id]
      );
    } else {
      await db.execute(
        'UPDATE rss_articles SET is_read = 1 WHERE user_id = ? AND is_read = 0',
        [currentUser.id]
      );
      await db.execute(
        'UPDATE rss_feeds SET unread_count = 0 WHERE user_id = ?',
        [currentUser.id]
      );
    }

    await get().loadFeeds();
    await get().loadArticles(feedId || get().selectedFeedId);
  },

  async toggleStar(articleId) {
    const db = await getDatabase();
    const { currentUser } = useUserStore.getState();
    if (!currentUser) return;

    await db.execute(
      'UPDATE rss_articles SET is_starred = 1 - is_starred WHERE id = ? AND user_id = ?',
      [articleId, currentUser.id]
    );

    set((s) => ({
      articles: s.articles.map((a) =>
        a.id === articleId ? { ...a, is_starred: a.is_starred ? 0 : 1 } : a
      ),
    }));
  },

  setArticleFilter(filter) {
    set({ articleFilter: filter });
  },

  getFilteredArticles() {
    const { articles, articleFilter } = get();
    if (articleFilter === 'unread') return articles.filter((a) => !a.is_read);
    if (articleFilter === 'starred') return articles.filter((a) => a.is_starred);
    return articles;
  },

  // ─── 批量操作 ───

  async refreshAll() {
    const { feeds } = get();
    if (feeds.length === 0) return { success: 0, failed: 0 };
    set({ refreshing: true });
    let success = 0;
    let failed = 0;

    // 限制并发为 3
    const chunks = [];
    for (let i = 0; i < feeds.length; i += 3) {
      chunks.push(feeds.slice(i, i + 3));
    }

    for (const chunk of chunks) {
      const results = await Promise.allSettled(
        chunk.map((f) => get().fetchArticles(f.id))
      );
      for (const r of results) {
        if (r.status === 'fulfilled') success++;
        else failed++;
      }
    }

    set({ refreshing: false });
    logger.log('RSSStore', `刷新完成: 成功 ${success}, 失败 ${failed}`);
    return { success, failed };
  },

  async importFromOPML(xmlText) {
    const parsedFeeds = parseOPML(xmlText);
    let imported = 0;
    let skipped = 0;

    for (const feed of parsedFeeds) {
      try {
        const res = await get().createFeed({
          title: feed.title,
          url: feed.xmlUrl,
          siteUrl: feed.htmlUrl,
          category: feed.category || 'other',
        });
        if (res?.created) imported++;
        else skipped++;
      } catch (_) {
        skipped++;
      }
    }

    logger.log('RSSStore', `OPML 导入: ${imported} 个成功, ${skipped} 个跳过`);
    return { imported, skipped, total: parsedFeeds.length };
  },

  exportToOPML() {
    const { feeds } = get();
    return generateOPML(feeds);
  },

  async addPresetFeeds(presets) {
    let added = 0;
    for (const preset of presets) {
      try {
        const res = await get().createFeed({
          title: preset.title,
          url: preset.url,
          siteUrl: preset.siteUrl,
          category: preset.category,
          iconUrl: null,
          description: preset.description,
        });
        if (res?.created) added++;
      } catch (_) {
        // skip duplicates
      }
    }
    logger.log('RSSStore', `预设源添加: ${added} 个`);
    return added;
  },
}));

export default useRssStore;
