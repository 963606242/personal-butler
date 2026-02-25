import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  Button,
  Space,
  Typography,
  Input,
  AutoComplete,
  Row,
  Col,
  Spin,
  Tag,
  message,
  Alert,
  Result,
} from 'antd';
import {
  SearchOutlined,
  ReloadOutlined,
  EnvironmentOutlined,
  CloudOutlined,
  RobotOutlined,
  SkinOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import useWeatherStore from '../stores/weatherStore';
import useUserStore from '../stores/userStore';
import { getLogger } from '../services/logger-client';
import { useI18n } from '../context/I18nContext';
import { isApiKeyConfigured } from '../services/weather-api';
import { getClothingSuggestion } from '../stores/outfitStore';

const { Title, Text } = Typography;
const logger = getLogger();

function Weather() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [searchValue, setSearchValue] = useState('');
  const [searchOptions, setSearchOptions] = useState([]);

  const { currentUser, isInitialized } = useUserStore();
  const {
    currentCity,
    currentWeather,
    forecast,
    loading,
    searchResults,
    searchLoading,
    loadUserCity,
    searchCities,
    fetchCurrentWeather,
    fetchForecast,
    switchCity,
    initialize,
  } = useWeatherStore();

  useEffect(() => {
    if (!isInitialized || !currentUser) return;
    initialize().catch((e) => {
      logger.error('Weather', '初始化失败', e);
    });
  }, [isInitialized, currentUser, initialize]);

  const handleSearch = async (value) => {
    if (!value || value.trim().length === 0) {
      setSearchOptions([]);
      return;
    }

    try {
      const results = await searchCities(value);
      setSearchOptions(
        results.map((city) => ({
          value: city.displayName,
          label: (
            <div>
              <Text strong>{city.name}</Text>
              {city.state && <Text type="secondary">, {city.state}</Text>}
              <Text type="secondary">, {city.country}</Text>
            </div>
          ),
          city: city,
        }))
      );
    } catch (e) {
      logger.error('Weather', '搜索失败', e);
      message.error(t('weather.messages.searchFailed', '搜索城市失败'));
    }
  };

  const handleSelect = async (value, option) => {
    try {
      await switchCity(option.city);
      setSearchValue('');
      setSearchOptions([]);
      message.success(t('weather.messages.citySwitched', '已切换到 {{city}}', { city: option.city.displayName }));
    } catch (e) {
      logger.error('Weather', '切换城市失败', e);
      message.error(t('weather.messages.switchFailed', '切换城市失败'));
    }
  };

  const handleRefresh = async () => {
    try {
      await fetchCurrentWeather(null, { skipCache: true });
      await fetchForecast(null, { skipCache: true });
      message.success(t('weather.messages.refreshed', '天气信息已更新'));
    } catch (e) {
      logger.error('Weather', '刷新失败', e);
      message.error(t('weather.messages.refreshFailed', '刷新失败'));
    }
  };

  const getWeatherIcon = (icon) => {
    return `https://openweathermap.org/img/wn/${icon}@2x.png`;
  };

  const getWindDirection = (deg) => {
    const directions = ['北', '东北', '东', '东南', '南', '西南', '西', '西北'];
    return directions[Math.round(deg / 45) % 8];
  };

  if (!isInitialized || loading) {
    return (
      <Card style={{ borderRadius: 16 }}>
        <div style={{ textAlign: 'center', padding: 50 }}>
          <Spin size="large" />
          <Text type="secondary" style={{ display: 'block', marginTop: 16 }}>正在加载天气...</Text>
        </div>
      </Card>
    );
  }

  if (!isApiKeyConfigured()) {
    return (
      <div>
        <div className="weather-header">
          <Title level={3} style={{ margin: 0 }}>
            <CloudOutlined style={{ marginRight: 8 }} />
            天气服务
          </Title>
        </div>
        <Alert
          message="天气 API 未配置"
          description={
            <div>
              <p>请在 <strong>设置 → API Keys</strong> 中配置 OpenWeatherMap Key，也可在 <code>.env</code> 配置 <code>VITE_WEATHER_API_KEY</code>。</p>
              <p>
                获取 Key：<a href="https://openweathermap.org/api" target="_blank" rel="noopener noreferrer">openweathermap.org/api</a>
              </p>
            </div>
          }
          type="warning"
          showIcon
          style={{ borderRadius: 12 }}
          action={<Button size="small" onClick={() => navigate('/settings')}>去设置</Button>}
        />
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="weather-header">
        <Title level={3} style={{ margin: 0 }}>
          <CloudOutlined style={{ marginRight: 8 }} />
          天气服务
        </Title>
        <Space>
          <Button icon={<RobotOutlined />} onClick={() => navigate('/ai', { state: { carry: ['weather'] } })} style={{ borderRadius: 10 }}>
            问 AI
          </Button>
          <Button icon={<ReloadOutlined />} onClick={handleRefresh} loading={loading} style={{ borderRadius: 10 }}>
            刷新
          </Button>
        </Space>
      </div>

      {/* Search */}
      <Card className="weather-search-card">
        <Space direction="vertical" style={{ width: '100%' }}>
          <Text strong>搜索城市</Text>
          <AutoComplete
            style={{ width: '100%' }}
            value={searchValue}
            onChange={setSearchValue}
            onSearch={handleSearch}
            onSelect={handleSelect}
            options={searchOptions}
            loading={searchLoading}
            allowClear
          >
            <Input
              prefix={<SearchOutlined />}
              placeholder="输入城市名搜索，如北京、上海、New York"
              style={{ borderRadius: 12 }}
            />
          </AutoComplete>
        </Space>
      </Card>

      {/* Current city */}
      {currentCity && (
        <Card className="weather-city-bar" size="small" styles={{ body: { padding: '10px 16px' } }}>
          <Space>
            <EnvironmentOutlined style={{ color: 'var(--accent-primary, #1677ff)' }} />
            <Text strong>当前城市：</Text>
            <Text>{currentCity.displayName || `${currentCity.name}, ${currentCity.country}`}</Text>
          </Space>
        </Card>
      )}

      {/* Current weather */}
      {loading && !currentWeather ? (
        <Card style={{ borderRadius: 16 }}>
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Spin size="large" />
            <Text type="secondary" style={{ display: 'block', marginTop: 16 }}>正在加载天气数据...</Text>
          </div>
        </Card>
      ) : currentWeather ? (
        <>
          <Card className="weather-current-card">
            <Row gutter={[24, 16]}>
              <Col xs={24} md={12}>
                <div className="weather-temp-display">
                  <div className="weather-temp-number">
                    {currentWeather.temp}°
                  </div>
                  <div className="weather-temp-desc">
                    {currentWeather.description}
                  </div>
                  <div className="weather-icon-wrap">
                    <img
                      src={getWeatherIcon(currentWeather.icon)}
                      alt={currentWeather.description}
                    />
                  </div>
                </div>
              </Col>
              <Col xs={24} md={12}>
                <div style={{ padding: '8px 0' }}>
                  <div className="weather-detail-item">
                    <Text type="secondary">体感温度</Text>
                    <Text strong>{currentWeather.feelsLike}°C</Text>
                  </div>
                  <div className="weather-detail-item">
                    <Text type="secondary">湿度</Text>
                    <Text strong>{currentWeather.humidity}%</Text>
                  </div>
                  <div className="weather-detail-item">
                    <Text type="secondary">气压</Text>
                    <Text strong>{currentWeather.pressure} hPa</Text>
                  </div>
                  {currentWeather.windSpeed > 0 && (
                    <div className="weather-detail-item">
                      <Text type="secondary">风速</Text>
                      <Text strong>{currentWeather.windSpeed} m/s ({getWindDirection(currentWeather.windDeg)})</Text>
                    </div>
                  )}
                  {currentWeather.visibility && (
                    <div className="weather-detail-item">
                      <Text type="secondary">能见度</Text>
                      <Text strong>{currentWeather.visibility} km</Text>
                    </div>
                  )}
                  <div className="weather-sun-row">
                    <div>
                      <Text type="secondary">🌅 日出 </Text>
                      <Text strong>{dayjs(currentWeather.sunrise).format('HH:mm')}</Text>
                    </div>
                    <div>
                      <Text type="secondary">🌇 日落 </Text>
                      <Text strong>{dayjs(currentWeather.sunset).format('HH:mm')}</Text>
                    </div>
                  </div>
                </div>
              </Col>
            </Row>
          </Card>

          {/* Clothing Suggestion */}
          {(() => {
            const suggestions = getClothingSuggestion(currentWeather);
            if (suggestions.length === 0) return null;
            return (
              <Card
                className="weather-forecast-card"
                title={
                  <span><SkinOutlined style={{ marginRight: 8 }} />今日穿衣建议</span>
                }
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {suggestions.map((item, idx) => (
                    <div key={idx} className="weather-suggestion-item">
                      <span style={{ fontSize: 22, flexShrink: 0 }}>{item.icon}</span>
                      <Text style={{ fontSize: 14, lineHeight: 1.6 }}>{item.text}</Text>
                    </div>
                  ))}
                </div>
              </Card>
            );
          })()}

          {/* Forecast */}
          {forecast.length > 0 && (
            <Card className="weather-forecast-card" title="天气预报（5天）">
              <Row gutter={[12, 12]}>
                {forecast
                  .filter((item, index) => index % 8 === 0)
                  .slice(0, 5)
                  .map((item, index) => (
                    <Col key={index} xs={12} sm={8} md={6} lg={4}>
                      <Card size="small" className="weather-forecast-item" styles={{ body: { padding: 12 } }}>
                        <div className="weather-forecast-date">
                          {dayjs(item.date).format('MM/DD HH:mm')}
                        </div>
                        <div className="weather-forecast-icon">
                          <img src={getWeatherIcon(item.icon)} alt={item.description} />
                        </div>
                        <div className="weather-forecast-temp">
                          {item.temp}°
                        </div>
                        <div className="weather-forecast-desc">
                          {item.description}
                        </div>
                      </Card>
                    </Col>
                  ))}
              </Row>
            </Card>
          )}
        </>
      ) : !loading ? (
        <Card style={{ borderRadius: 16 }}>
          <Result
            status="warning"
            title="无法获取天气数据"
            subTitle={
              <div>
                <p>可能的原因：</p>
                <ul style={{ textAlign: 'left', maxWidth: 600, margin: '0 auto' }}>
                  <li>API Key 无效或未激活（新申请的 Key 可能需要等待几分钟到几小时）</li>
                  <li>API Key 超过了免费额度限制</li>
                  <li>网络连接问题</li>
                </ul>
              </div>
            }
            extra={
              <Button type="primary" onClick={handleRefresh} style={{ borderRadius: 10 }}>
                重试
              </Button>
            }
          />
        </Card>
      ) : null}
    </div>
  );
}

export default Weather;
