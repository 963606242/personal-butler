# RSS 订阅模块 - 代码审查与优化建议

## 一、代码层面可优化点

### 1. 首次进入页面时未自动加载文章

**问题**：用户有订阅源时进入 RSS 页面，右侧文章列表为空，需手动点击「全部文章」或某个订阅源才会加载。

**建议**：在 `RssSubscription.jsx` 中，当 feeds 加载完成且数量 > 0 时，自动调用 `loadArticles(selectedFeedId ?? null)`。

```jsx
// 在 loadFeeds 完成后，若有订阅源则自动加载文章
useEffect(() => {
  if (feeds.length > 0 && !loading) {
    loadArticles(selectedFeedId ?? null);
  }
}, [feeds.length, loading]);
```

---

### 2. fetchArticles 中 newCount 统计不准确

**问题**：`INSERT OR IGNORE` 在 guid 重复时会跳过插入，但 `newCount` 仍会递增，导致日志中「新增 X 篇」与实际不符。

**建议**：根据 `db.execute` 返回的 `changes` 判断是否真正插入（若平台支持）。或改为先查询是否存在再插入，以准确统计。

---

### 3. guid 为空时的去重风险

**问题**：部分 Feed 的 item 无 guid 且 link 为空。`UNIQUE (feed_id, guid)` 索引下，若多篇文章 guid 均为空字符串，会触发唯一约束，`INSERT OR IGNORE` 会丢弃后续文章。

**建议**：在 `rssStore.fetchArticles` 中，当 `item.guid` 和 `item.link` 都为空时，使用 `item.title + item.publishedAt` 或 `articleId` 生成 fallback guid，避免重复。

---

### 4. dayjs 语言未随应用语言切换

**问题**：`RssSubscription.jsx` 中写死 `dayjs.locale('zh-cn')`，英文环境下时间仍显示为中文。

**建议**：使用 `useI18n()` 的 `locale`，按 `locale === 'en-US'` 设置 `dayjs.locale('en')`，否则 `dayjs.locale('zh-cn')`。I18nContext 已全局同步 dayjs，可移除页面内的硬编码。

---

### 5. RSS_CATEGORIES 未做 i18n

**问题**：`rss-presets.js` 中 `RSS_CATEGORIES` 的 label 为中文，未接入国际化。

**建议**：在 i18n 中增加 `rss.categories.tech` 等 key，在 `RssAddFeedModal` 中通过 `t()` 渲染。

---

### 6. 文章描述 HTML  stripping 可能残留

**问题**：`article.description.replace(/<[^>]*>/g, '')` 可移除简单标签，但 `&nbsp;`、`&amp;` 等实体未转义，可能显示异常。

**建议**：可考虑使用 `DOMParser` 解析后再取 `textContent`，或增加实体解码逻辑。

---

### 7. addPresetFeeds 统计逻辑

**问题**：`createFeed` 在 URL 已存在时返回已有 id 且不抛错，`addPresetFeeds` 仍会把该次计入 `added`，导致「已添加 X 个」可能包含已存在的。

**建议**：若需区分「新增」与「已存在」，可让 `createFeed` 返回 `{ id, created: boolean }`，或单独提供 `exists` 检查。

---

## 二、功能业务建议

### 1. 定时自动刷新（高优先级）

**现状**：`refresh_interval` 已入库但未使用，Phase 5 要求支持 auto-refresh。

**建议**：在 `RssSubscription.jsx` 或 `MainLayout` 中增加定时器，按每个 feed 的 `refresh_interval` 定期调用 `fetchArticles`。可仅在 RSS 页面可见时执行，避免后台持续请求。

---

### 2. 云同步支持 RSS 数据

**现状**：`exportForSync` / `importFromSync` 未包含 `rss_feeds` 和 `rss_articles`。

**建议**：若需跨设备同步，需将 `rss_feeds`、`rss_articles` 加入 `exportForSync` 和 `importFromSync` 的表列表，并保持外键顺序。

---

### 3. 内置阅读器 / 文章详情

**现状**：点击文章直接 `window.open` 打开外部链接。

**建议**：可增加「文章详情」弹窗或内嵌阅读器，用 `article.content` 或 `article.description` 渲染，支持离线阅读。可选实现：Modal + 简单 HTML 渲染。

---

### 4. 订阅源图标

**现状**：`icon_url` 已入库但未使用，当前用首字母 Avatar 代替。

**建议**：若 feed 有 `icon_url` 或 `image`，优先使用图片；无则用首字母或默认图标。

---

### 5. 错误重试与友好提示

**现状**：抓取失败时仅更新 `last_fetch_status = 'error'`，用户无明确错误原因。

**建议**：在 `rss_feeds` 增加 `last_fetch_error` 字段（或复用现有字段），在 UI 中展示具体错误信息；对网络错误可提供「重试」按钮。

---

### 6. 文章分页 / 虚拟滚动

**现状**：`loadArticles` 固定 `LIMIT 200`，一次性加载。

**建议**：文章较多时，可做分页或虚拟滚动，减少首屏渲染压力。

---

### 7. 键盘快捷键

**建议**：支持 `j/k` 上下切换文章、`o` 打开链接、`m` 标记已读等，提升阅读效率。

---

### 8. 移动端适配

**现状**：双栏布局（280px + flex）在窄屏下可能拥挤。

**建议**：小屏下改为单栏：先显示订阅源列表，选中后再显示文章列表；或使用抽屉式布局。

---

## 三、可靠性建议

### 1. URL 校验

**建议**：在 `RssAddFeedModal` 提交前校验 URL 格式（`http://` 或 `https://`），避免无效请求。

### 2. 请求超时与取消

**建议**：`fetchFeedText` 使用 `AbortController` 支持超时，长时间未响应时取消请求，避免长时间挂起。

### 3. 导入 OPML 时的重复检查

**现状**：`importFromOPML` 依赖 `createFeed` 的 URL 去重，重复 URL 会跳过。

**建议**：可统计「新增 / 跳过」数量，在导入结果中分别展示，例如「导入完成：5 个新增，3 个已存在」。

### 4. 导出 OPML 的字段兼容

**现状**：`generateOPML` 使用 `f.url`、`f.site_url`、`f.title`，与数据库字段一致。

**建议**：确认 `feeds` 来自 store 时字段名正确（如 `site_url` 等），避免导出异常。

---

## 四、优先级建议

| 优先级 | 项目 | 工作量 |
|--------|------|--------|
| 高 | 首次进入自动加载文章 | 小 |
| 高 | 定时自动刷新 | 中 |
| 高 | guid 为空时的 fallback | 小 |
| 中 | dayjs 语言 | 小 |
| 中 | RSS 分类 i18n | 小 |
| 中 | 云同步支持 RSS | 中 |
| 低 | 订阅源图标 | 小 |
| 低 | 文章详情 / 阅读器 | 中 |
| 低 | 移动端布局 | 中 |

---

## 五、快速修复清单（可直接实施）

1. **首次加载文章**：在 `RssSubscription.jsx` 中增加 `useEffect`，在 feeds 加载完成后自动调用 `loadArticles`。
2. **移除 dayjs 硬编码**：删除 `RssSubscription.jsx` 中的 `dayjs.locale('zh-cn')`，依赖 I18nContext 的全局设置。
3. **guid fallback**：在 `rssStore.fetchArticles` 中，当 `!item.guid && !item.link` 时，使用 ``${item.title}-${item.publishedAt || Date.now()}` 作为 guid。
4. **RSS_CATEGORIES i18n**：在 `zh-CN.json` 和 `en-US.json` 增加 `rss.categories.*`，在 `RssAddFeedModal` 中通过 `t()` 渲染。
