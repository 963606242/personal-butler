/**
 * 设置页 API 配置链接与说明
 * 方便新用户获取 Key、申请接口权限
 */
export const API_KEY_CONFIGS = [
  {
    key: 'tianapi_key',
    label: '天聚数行',
    usage: '国内新闻',
    placeholder: '可选，与 .env 二选一',
    configUrl: 'https://www.tianapi.com/',
    configUrlLabel: '天聚数行控制台',
    /** 需申请的接口及文档链接 */
    requiredApis: [
      { name: '国内新闻', url: 'https://www.tianapi.com/apiview/4' },
      { name: '分类新闻', url: 'https://www.tianapi.com/apiview/51' },
    ],
  },
  {
    key: 'jisuapi_key',
    label: '极速数据',
    usage: '国内新闻备选',
    placeholder: '可选',
    configUrl: 'https://www.jisuapi.com/',
    configUrlLabel: '极速数据控制台',
    requiredApis: null,
  },
  {
    key: 'news_api_key',
    label: 'NewsAPI',
    usage: '国外新闻 / 搜索',
    placeholder: '可选',
    configUrl: 'https://newsapi.org/',
    configUrlLabel: 'NewsAPI 注册',
    requiredApis: null,
  },
  {
    key: 'weather_api_key',
    label: 'OpenWeatherMap',
    usage: '天气',
    placeholder: '可选',
    configUrl: 'https://openweathermap.org/api',
    configUrlLabel: 'OpenWeatherMap API',
    requiredApis: null,
  },
];
