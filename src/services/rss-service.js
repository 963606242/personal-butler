/**
 * RSS 解析服务（浏览器兼容）
 * 使用 DOMParser 解析 RSS/Atom，避免 rss-parser 的 Node 依赖
 */
import { isElectron, fetchUrlText } from '../platform';
import { getLogger } from './logger-client';

const logger = getLogger();
const FETCH_TIMEOUT_MS = 15000;

/**
 * 获取 RSS 原始文本（兼容 Electron 和 Web，15 秒超时）
 */
async function fetchFeedText(url) {
  if (isElectron()) {
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('请求超时')), FETCH_TIMEOUT_MS);
    });
    const fetchPromise = fetchUrlText(url).then((res) => {
      if (res.success && typeof res.data === 'string') return res.data;
      throw new Error(`HTTP ${res.status || ''}: ${res.errorBody || ''}`);
    });
    return Promise.race([fetchPromise, timeoutPromise]);
  }
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
      },
    });
    clearTimeout(timeoutId);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.text();
  } catch (e) {
    clearTimeout(timeoutId);
    if (e.name === 'AbortError') throw new Error('请求超时');
    throw e;
  }
}

/**
 * 解析 RSS 2.0 或 Atom 格式
 */
function parseFeedXml(xmlText) {
  const domParser = new DOMParser();
  const doc = domParser.parseFromString(xmlText, 'text/xml');
  const parseError = doc.querySelector('parsererror');
  if (parseError) {
    throw new Error('XML 解析失败');
  }

  const channel = doc.querySelector('rss channel');
  const feed = doc.querySelector('feed');

  if (channel) {
    return parseRss2Channel(channel);
  }
  if (feed) {
    return parseAtomFeed(feed);
  }
  throw new Error('无法识别的 Feed 格式');
}

function parseRss2Channel(channel) {
  const getText = (el, selector) => {
    const n = el?.querySelector(selector);
    return n ? n.textContent?.trim() || '' : '';
  };
  const getLink = (el) => {
    const link = el?.querySelector('link');
    if (link) return link.textContent?.trim() || '';
    const atomLink = el?.querySelector('atom\\:link, link[rel="alternate"]');
    return atomLink?.getAttribute('href') || '';
  };
  const getImage = (el) => {
    const img = el?.querySelector('image url');
    return img ? img.textContent?.trim() : null;
  };

  const title = getText(channel, 'title');
  const description = getText(channel, 'description');
  const link = getLink(channel) || getText(channel, 'link');
  const image = getImage(channel);

  const items = [];
  channel.querySelectorAll('item').forEach((item) => {
    const pubDate = getText(item, 'pubDate') || getText(item, 'dc\\:date');
    let publishedAt = null;
    if (pubDate) {
      const d = new Date(pubDate);
      publishedAt = isNaN(d.getTime()) ? null : d.getTime();
    }
    const enclosure = item.querySelector('enclosure[type^="image"]');
    const imageUrl = enclosure?.getAttribute('url') || null;
    items.push({
      title: getText(item, 'title'),
      link: getText(item, 'link') || getLink(item),
      guid: getText(item, 'guid') || getText(item, 'link') || '',
      description: getText(item, 'description'),
      content: getText(item, 'content\\:encoded') || getText(item, 'description'),
      author: getText(item, 'dc\\:creator') || getText(item, 'author'),
      imageUrl: imageUrl || extractImageFromContent(getText(item, 'content\\:encoded') || getText(item, 'description')),
      publishedAt,
    });
  });

  return { title, description, link, image, items };
}

const ATOM_NS = 'http://www.w3.org/2005/Atom';

function parseAtomFeed(feed) {
  const getText = (el, tagName) => {
    const nodes = el?.getElementsByTagNameNS?.(ATOM_NS, tagName) || el?.getElementsByTagName?.(tagName);
    const n = nodes?.length ? nodes[0] : el?.querySelector(tagName);
    return n ? n.textContent?.trim() || '' : '';
  };
  const getLink = (el) => {
    const links = el?.getElementsByTagNameNS?.(ATOM_NS, 'link') || el?.getElementsByTagName?.('link') || [];
    for (let i = 0; i < links.length; i++) {
      const rel = links[i].getAttribute('rel');
      if (!rel || rel === 'alternate') {
        const href = links[i].getAttribute('href');
        if (href) return href;
      }
    }
    return '';
  };

  const title = getText(feed, 'title');
  const link = getLink(feed);
  const description = getText(feed, 'subtitle') || getText(feed, 'tagline') || '';
  const iconEl = feed.getElementsByTagNameNS?.(ATOM_NS, 'icon')[0] || feed.getElementsByTagNameNS?.(ATOM_NS, 'logo')[0] || feed.querySelector('icon, logo');
  const image = iconEl?.textContent?.trim() || null;

  const entries = feed.getElementsByTagNameNS?.(ATOM_NS, 'entry') || feed.getElementsByTagName?.('entry') || feed.querySelectorAll('entry') || [];
  const items = [];
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const published = getText(entry, 'published') || getText(entry, 'updated');
    let publishedAt = null;
    if (published) {
      const d = new Date(published);
      publishedAt = isNaN(d.getTime()) ? null : d.getTime();
    }
    const contentEl = entry.getElementsByTagNameNS?.(ATOM_NS, 'content')[0] || entry.querySelector('content');
    const summaryEl = entry.getElementsByTagNameNS?.(ATOM_NS, 'summary')[0] || entry.querySelector('summary');
    const content = contentEl?.innerHTML || contentEl?.textContent?.trim() || '';
    const summary = summaryEl?.innerHTML || summaryEl?.textContent?.trim() || '';
    const idEl = entry.getElementsByTagNameNS?.(ATOM_NS, 'id')[0] || entry.querySelector('id');
    const guid = idEl?.textContent?.trim() || getLink(entry) || '';
    const linkHref = getLink(entry);
    const authorEntry = entry.getElementsByTagNameNS?.(ATOM_NS, 'author')[0] || entry.querySelector('author');
    const author = authorEntry ? (authorEntry.getElementsByTagNameNS?.(ATOM_NS, 'name')[0] || authorEntry.querySelector('name'))?.textContent?.trim() || '' : '';
    items.push({
      title: getText(entry, 'title') || '(无标题)',
      link: linkHref,
      guid,
      description: summary,
      content,
      author,
      imageUrl: extractImageFromContent(content || summary),
      publishedAt,
    });
  }

  return { title, description, link, image, items };
}

function extractImageFromContent(html) {
  if (!html) return null;
  const match = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return match ? match[1] : null;
}

function normalizeArticle(item) {
  return {
    title: item.title || '(无标题)',
    link: item.link || '',
    guid: item.guid || item.link || '',
    description: item.description || '',
    content: item.content || '',
    author: item.author || '',
    imageUrl: item.imageUrl || null,
    publishedAt: item.publishedAt,
  };
}

/**
 * 抓取并解析 RSS Feed
 * @param {string} url - Feed URL
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 */
export async function fetchAndParseFeed(url) {
  try {
    logger.log('RSSService', `开始解析 Feed: ${url}`);
    const text = await fetchFeedText(url);
    const feed = parseFeedXml(text);
    const items = feed.items.map(normalizeArticle);

    logger.log('RSSService', `解析完成: ${feed.title}, ${items.length} 篇文章`);

    return {
      success: true,
      data: {
        title: feed.title || '',
        description: feed.description || '',
        link: feed.link || '',
        image: feed.image || null,
        items,
      },
    };
  } catch (e) {
    logger.error('RSSService', `解析失败: ${url}`, e);
    return {
      success: false,
      error: e.message || 'unknown',
    };
  }
}

/**
 * 解析 OPML 文件
 * @param {string} xmlText - OPML XML 文本
 * @returns {{title: string, xmlUrl: string, htmlUrl: string}[]}
 */
export function parseOPML(xmlText) {
  const domParser = new DOMParser();
  const doc = domParser.parseFromString(xmlText, 'text/xml');
  const outlines = doc.querySelectorAll('outline[xmlUrl], outline[xmlurl]');
  const feeds = [];

  outlines.forEach((outline) => {
    const xmlUrl = outline.getAttribute('xmlUrl') || outline.getAttribute('xmlurl') || '';
    const htmlUrl = outline.getAttribute('htmlUrl') || outline.getAttribute('htmlurl') || '';
    const title = outline.getAttribute('text') || outline.getAttribute('title') || '';
    const category = outline.getAttribute('category') || '';
    if (xmlUrl) {
      feeds.push({ title, xmlUrl, htmlUrl, category });
    }
  });

  logger.log('RSSService', `OPML 解析完成: ${feeds.length} 个订阅源`);
  return feeds;
}

/**
 * 生成 OPML 文件
 * @param {Array} feeds - 订阅源列表
 * @returns {string} OPML XML 字符串
 */
export function generateOPML(feeds) {
  const escapeXml = (str) =>
    (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const outlines = feeds
    .map(
      (f) =>
        `    <outline type="rss" text="${escapeXml(f.title)}" title="${escapeXml(f.title)}" xmlUrl="${escapeXml(f.url)}" htmlUrl="${escapeXml(f.site_url || '')}" />`
    )
    .join('\n');

  const now = new Date().toUTCString();

  return `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head>
    <title>Personal Butler RSS Subscriptions</title>
    <dateCreated>${now}</dateCreated>
  </head>
  <body>
${outlines}
  </body>
</opml>`;
}
