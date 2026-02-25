/**
 * 预设 RSS 订阅源
 */

export const RSS_CATEGORIES = [
  { value: 'tech', label: '科技' },
  { value: 'news', label: '资讯' },
  { value: 'blog', label: '博客' },
  { value: 'design', label: '设计' },
  { value: 'other', label: '其他' },
];

export const RSS_PRESETS = [
  // 中文源
  {
    title: '36氪',
    url: 'https://36kr.com/feed',
    siteUrl: 'https://36kr.com',
    category: 'tech',
    icon: '🚀',
    description: '让一部分人先看到未来',
    lang: 'zh',
  },
  {
    title: '少数派',
    url: 'https://sspai.com/feed',
    siteUrl: 'https://sspai.com',
    category: 'tech',
    icon: '📱',
    description: '高效工作，品质生活',
    lang: 'zh',
  },
  {
    title: '虎嗅',
    url: 'https://www.huxiu.com/rss/0.xml',
    siteUrl: 'https://www.huxiu.com',
    category: 'tech',
    icon: '🐯',
    description: '有视角的商业资讯',
    lang: 'zh',
  },
  {
    title: 'IT之家',
    url: 'https://www.ithome.com/rss/',
    siteUrl: 'https://www.ithome.com',
    category: 'tech',
    icon: '💻',
    description: '数码、科技、互联网资讯',
    lang: 'zh',
  },
  {
    title: '阮一峰的网络日志',
    url: 'https://www.ruanyifeng.com/blog/atom.xml',
    siteUrl: 'https://www.ruanyifeng.com/blog/',
    category: 'blog',
    icon: '📝',
    description: '科技爱好者周刊',
    lang: 'zh',
  },
  // 英文源
  {
    title: 'Hacker News',
    url: 'https://hnrss.org/frontpage',
    siteUrl: 'https://news.ycombinator.com',
    category: 'tech',
    icon: '🔶',
    description: 'Hacker News Front Page',
    lang: 'en',
  },
  {
    title: 'TechCrunch',
    url: 'https://techcrunch.com/feed/',
    siteUrl: 'https://techcrunch.com',
    category: 'tech',
    icon: '⚡',
    description: 'Startup and Technology News',
    lang: 'en',
  },
  {
    title: 'The Verge',
    url: 'https://www.theverge.com/rss/index.xml',
    siteUrl: 'https://www.theverge.com',
    category: 'tech',
    icon: '🔷',
    description: 'Technology, Science, Art',
    lang: 'en',
  },
  {
    title: 'Ars Technica',
    url: 'https://feeds.arstechnica.com/arstechnica/index',
    siteUrl: 'https://arstechnica.com',
    category: 'tech',
    icon: '🔬',
    description: 'Serving the Technologist',
    lang: 'en',
  },
  {
    title: 'DEV Community',
    url: 'https://dev.to/feed',
    siteUrl: 'https://dev.to',
    category: 'blog',
    icon: '👩‍💻',
    description: 'Developer Community',
    lang: 'en',
  },
];
