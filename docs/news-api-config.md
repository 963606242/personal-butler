# 新闻API配置说明

本应用支持多个新闻API源，可以自动切换以确保服务的稳定性。

## 支持的API源

### 1. 国内API（优先使用）

#### 天聚数行API（推荐）
- **官网**: https://www.tianapi.com/
- **免费额度**: 普通会员100次/天，**免费 QPS=3**（请勿频繁请求）
- **注册地址**: https://www.tianapi.com/
- **环境变量**: `VITE_TIANAPI_KEY`
- **缓存**: 头条/分类按早、午、晚时间段缓存，命中则不再请求 API

#### 极速数据API（备选）
- **官网**: https://www.jisuapi.com/
- **免费额度**: 免费会员100次/天
- **注册地址**: https://www.jisuapi.com/
- **环境变量**: `VITE_JISUAPI_KEY`

### 2. 国际API（备用）

#### NewsAPI
- **官网**: https://newsapi.org/
- **免费额度**: 100次/天（仅限开发使用）
- **注册地址**: https://newsapi.org/register
- **环境变量**: `VITE_NEWS_API_KEY`

## 配置方法

### 步骤1：获取API Key

#### 天聚数行API
1. 访问 https://www.tianapi.com/
2. 注册账号并登录
3. 在控制台创建应用，获取API Key
4. 选择"国内新闻"接口

#### 极速数据API（备选）
1. 访问 https://www.jisuapi.com/
2. 注册账号并登录
3. 在控制台创建应用，获取API Key
4. 选择"新闻"接口

#### NewsAPI（国际备用）
1. 访问 https://newsapi.org/register
2. 注册账号并登录
3. 在控制台获取API Key

### 步骤2：配置环境变量

在项目根目录的 `.env` 文件中添加以下配置：

```env
# 国内API（至少配置一个，推荐天聚数行）
VITE_TIANAPI_KEY=your_tianapi_key_here
# VITE_JISUAPI_KEY=your_jisuapi_key_here  # 可选，作为天聚数行的备选

# 国际API（备用，当国内API失败时自动切换）
VITE_NEWS_API_KEY=your_newsapi_key_here
```

### 步骤3：重启开发服务器

配置完成后，需要重启开发服务器才能生效：

```bash
# 停止当前服务器（Ctrl+C）
# 然后重新启动
npm run dev
```

## API切换逻辑

1. **优先使用国内API**：
   - 当请求中国新闻（`country='cn'`）时，优先使用天聚数行API
   - 如果天聚数行API失败，自动切换到极速数据API
   - 如果两个国内API都失败，自动切换到国际API（NewsAPI）

2. **国际新闻**：
   - 当请求非中国新闻时，直接使用国际API（NewsAPI）

3. **搜索功能**：
   - 中文搜索优先尝试国内API
   - 如果国内API不支持搜索或失败，自动切换到国际API

## 注意事项

1. **至少配置一个API Key**：建议至少配置一个国内API Key和一个国际API Key，以确保服务的稳定性。

2. **免费额度限制**：
   - 天聚数行：100次/天
   - 极速数据：100次/天
   - NewsAPI：100次/天
   - 建议合理使用，避免频繁刷新

3. **缓存机制**：应用会自动缓存新闻数据1小时，减少API调用次数。

4. **错误处理**：如果所有API都失败，应用会显示友好的错误提示，不会崩溃。

## 测试配置

配置完成后，可以访问"新闻资讯"页面测试：
- 如果看到新闻内容，说明配置成功
- 如果看到"API未配置"提示，请检查环境变量是否正确设置
- 如果看到错误信息，请检查API Key是否有效

## 常见问题

### Q: 为什么优先使用国内API？
A: 国内API通常对中文新闻的支持更好，响应速度更快，且不受网络限制影响。

### Q: 可以只配置国际API吗？
A: 可以，但建议同时配置国内API以获得更好的体验。

### Q: API Key会泄露吗？
A: 不会。API Key存储在本地 `.env` 文件中，该文件已添加到 `.gitignore`，不会被提交到代码仓库。

### Q: 如何查看API调用次数？
A: 可以登录对应的API服务商控制台查看调用统计。
