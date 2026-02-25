# Personal Butler - 代码梳理与优化建议

> 基于对项目代码的全面梳理，整理出代码层面可优化点、功能业务建议及可靠性增强方案。

---

## 一、项目概览

**技术栈**：React 18 + Vite + Ant Design + Zustand + Electron / Capacitor / Web

**核心模块**：
- 日程、习惯、倒数纪念日、日记
- 装备、服装、搭配
- 天气、新闻、RSS 订阅
- AI 助手、趣味工具
- 云同步（OneDrive / Google Drive / Dropbox / WebDAV）

---

## 二、代码层面可优化点

### 1. RSS 模块（部分已实现，可继续完善）

| 项目 | 状态 | 说明 |
|------|------|------|
| 首次进入自动加载文章 | ✅ 已实现 | `RssSubscription.jsx` 中 useEffect 已处理 |
| guid 为空时的 fallback | ✅ 已实现 | `rssStore.fetchArticles` 使用 `item.guid \|\| item.link \|\| fallback` |
| RSS 分类 i18n | ✅ 已实现 | `RssAddFeedModal` 使用 `t('rss.categories.xxx')` |
| newCount 统计不准确 | ⚠️ 待优化 | `INSERT OR IGNORE` 时 newCount 仍递增，可用 `db.execute` 返回的 `changes` 判断是否真正插入 |
| dayjs 语言 | ✅ 已全局处理 | `I18nContext` 已同步 dayjs，RssSubscription 无硬编码 |
| 文章描述 HTML  stripping | ⚠️ 可选 | `&nbsp;`、`&amp;` 等实体未解码，可用 `DOMParser` 或实体解码 |
| addPresetFeeds 统计 | ⚠️ 可选 | `createFeed` 在 URL 已存在时返回已有 id，可返回 `{ id, created }` 区分新增/已存在 |

### 2. 云同步缺少 RSS 数据

**现状**：`exportForSync` / `importFromSync` 的表列表中**未包含** `rss_feeds` 和 `rss_articles`。

**影响**：跨设备同步时，RSS 订阅和文章不会同步。

**建议**：在 `database-main.js` 和 `database-web-sqlite.js` 中，将 `rss_feeds`、`rss_articles` 加入同步表列表，并保持外键顺序（rss_feeds 在 rss_articles 之前）。

```javascript
// database-main.js exportForSync
const tables = [
  'users', 'user_profiles', 'schedules', 'habits', 'habit_logs',
  'equipment', 'clothing', 'outfits', 'settings', 'diary_entries',
  'ai_chat_messages', 'countdown_events',
  'rss_feeds', 'rss_articles',  // 新增
  'cache',
];
```

### 3. RSS 请求无超时控制

**现状**：`rss-service.js` 的 `fetchFeedText` 使用原生 `fetch`，无超时，慢速或挂死的源会长时间阻塞。

**建议**：使用 `AbortController` 实现超时（如 15 秒）：

```javascript
async function fetchFeedText(url) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/rss+xml, application/atom+xml, ...' },
    });
    clearTimeout(timeoutId);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.text();
  } catch (e) {
    clearTimeout(timeoutId);
    throw e;
  }
}
```

> Electron 端 `fetchUrlText` 需在主进程实现超时，或通过 IPC 传递 AbortSignal。

### 4. 错误边界未国际化

**现状**：`App.jsx` 中 `ErrorBoundary` 的文案为硬编码中文。

**建议**：使用 `useI18n` 或通过 Context 注入 `t`，将「应用出现错误」「未知错误」「刷新页面」等改为 `t()` 调用。

### 5. AI 相关服务硬编码中文

**现状**：`ai-suggestion.js` 中 `CATEGORY_LABELS`、`gatherContext` 的 prompt 文本、`TYPE_LABELS` 等为中文，AI 生成内容也偏向中文。

**建议**：根据 `useI18n().locale` 选择中/英 prompt 模板，或让 AI 根据用户语言返回对应语言内容。

### 6. 依赖冗余

**现状**：`package.json` 中同时存在 `chinese-lunar` 和 `lunar-javascript`，可能功能重叠。

**建议**：确认两者用途，若可合并则移除其一，减少包体积。

### 7. RSS useEffect 依赖与重复加载

**现状**：`RssSubscription` 中 `useEffect` 依赖 `[feeds.length, loading, loadArticles, selectedFeedId]`。`loadArticles` 来自 Zustand，引用通常稳定；`selectedFeedId` 变化时会触发重新加载，符合预期。

**可选优化**：若出现「切换 feed 时短暂闪烁」或「重复请求」，可加防抖或 `isMounted` 检查，避免组件卸载后仍更新状态。

---

## 三、功能业务建议

### 高优先级

| 功能 | 说明 |
|------|------|
| **RSS 定时自动刷新** | `refresh_interval` 已入库但未使用。在 RSS 页面可见时，按每个 feed 的 `refresh_interval` 定时调用 `fetchArticles`，离开页面可暂停。 |
| **RSS 错误信息展示** | 抓取失败时仅更新 `last_fetch_status = 'error'`。建议增加 `last_fetch_error` 字段存储具体错误，UI 展示「重试」按钮和错误原因。 |
| **URL 校验** | 在 `RssAddFeedModal` 提交前校验 URL 格式（`http://` 或 `https://`），避免无效请求。 |

### 中优先级

| 功能 | 说明 |
|------|------|
| **RSS 内置阅读器** | 点击文章直接 `window.open` 打开外部链接。可增加文章详情弹窗，用 `article.content` 或 `article.description` 渲染，支持离线阅读。 |
| **订阅源图标** | `icon_url` 已入库但未使用。若 feed 有 `icon_url` 或 `image`，优先显示；无则用首字母 Avatar。 |
| **OPML 导入结果细化** | 导入时统计「新增 / 已存在」数量，展示「导入完成：5 个新增，3 个已存在」。 |
| **RSS 文章分页/虚拟滚动** | 当前 `LIMIT 200` 一次性加载。文章多时可做分页或虚拟滚动，减轻首屏压力。 |

### 低优先级

| 功能 | 说明 |
|------|------|
| **键盘快捷键** | 支持 `j/k` 上下切换文章、`o` 打开链接、`m` 标记已读等，提升阅读效率。 |
| **移动端 RSS 布局** | 双栏布局在窄屏下拥挤，可改为单栏或抽屉式：先显示订阅源，选中后再显示文章。 |

---

## 四、可靠性建议

### 1. 数据库迁移与版本

**现状**：`database-main.js` 中有多个 `migrateXxxSchema` 方法，Web 端 `database-web-sqlite.js` 有 `migrateExistingDb`，但缺少统一的 schema 版本号。

**建议**：引入 `schema_version` 表，每次迁移后更新版本，启动时按版本号执行未执行的迁移，避免重复或遗漏。

### 2. 同步冲突处理

**现状**：`importFromSync` 使用 `DELETE` + `INSERT OR REPLACE`，以「后写入覆盖」策略为主，无显式冲突解决。

**建议**：若未来需要多设备同时编辑，可考虑 `updated_at` 比较、last-write-wins 或操作日志合并。当前单用户场景可保持现状。

### 3. 敏感配置存储

**现状**：API Key、同步密码等存储在 `settings` 表，Electron 端可能涉及主进程。

**建议**：确认 Electron 的 `safeStorage` 或系统密钥链是否用于加密敏感项；Web 端需注意 localStorage/IndexedDB 的暴露风险，可考虑仅在内存中持有、不持久化密钥（用户每次输入）。

### 4. 日志与诊断

**现状**：已有 `logger-client` 和 `getLogger`，部分模块有日志。

**建议**：对关键路径（同步、数据库初始化、RSS 抓取、AI 调用）增加结构化日志，便于排查线上问题；可增加「导出诊断包」功能，供用户反馈时附带。

---

## 五、快速修复清单（可直接实施）

| 序号 | 项目 | 文件 | 工作量 |
|------|------|------|--------|
| 1 | 云同步加入 RSS 表 | `database-main.js`, `database-web-sqlite.js` | 小 |
| 2 | RSS 请求超时 | `rss-service.js` | 小 |
| 3 | newCount 准确统计 | `rssStore.js` | 小 |
| 4 | 错误边界国际化 | `App.jsx` | 小 |
| 5 | RSS 添加 URL 校验 | `RssAddFeedModal.jsx` | 小 |
| 6 | RSS 定时自动刷新 | `RssSubscription.jsx` 或 `MainLayout` | 中 |

---

## 六、与现有文档的关系

- **RSS_OPTIMIZATION_RECOMMENDATIONS.md**：已有更细的 RSS 专项建议，本文档与之互补，部分项已实现或已纳入本文档。
- 建议优先实施「快速修复清单」中的高优先级项，再逐步推进功能与可靠性增强。

---

*文档生成时间：2025-02-25*
