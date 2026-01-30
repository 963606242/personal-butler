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
  Empty,
  Tag,
  Divider,
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
} from '@ant-design/icons';
import dayjs from 'dayjs';
import useWeatherStore from '../stores/weatherStore';
import useUserStore from '../stores/userStore';
import { getLogger } from '../services/logger-client';
import { isApiKeyConfigured } from '../services/weather-api';

const { Title, Text } = Typography;
const logger = getLogger();

function Weather() {
  const navigate = useNavigate();
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
      message.error('搜索城市失败');
    }
  };

  const handleSelect = async (value, option) => {
    try {
      await switchCity(option.city);
      setSearchValue('');
      setSearchOptions([]);
      message.success(`已切换到 ${option.city.displayName}`);
    } catch (e) {
      logger.error('Weather', '切换城市失败', e);
      message.error('切换城市失败');
    }
  };

  const handleRefresh = async () => {
    try {
      await fetchCurrentWeather(null, { skipCache: true });
      await fetchForecast(null, { skipCache: true });
      message.success('天气信息已更新');
    } catch (e) {
      logger.error('Weather', '刷新失败', e);
      message.error('刷新失败');
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
      <div style={{ textAlign: 'center', padding: 50 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!isApiKeyConfigured()) {
    return (
      <div>
        <Title level={2}>天气服务</Title>
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
          action={<Button size="small" onClick={() => navigate('/settings')}>去设置</Button>}
        />
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={2}>天气服务</Title>
        <Space>
          <Button icon={<RobotOutlined />} onClick={() => navigate('/ai', { state: { carry: ['weather'] } })}>
            问 AI
          </Button>
          <Button icon={<ReloadOutlined />} onClick={handleRefresh} loading={loading}>
            刷新
          </Button>
        </Space>
      </div>

      <Card style={{ marginBottom: 16 }}>
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
            />
          </AutoComplete>
        </Space>
      </Card>

      {currentCity && (
        <Card style={{ marginBottom: 16 }}>
          <Space>
            <EnvironmentOutlined />
            <Text strong>当前城市：</Text>
            <Text>{currentCity.displayName || `${currentCity.name}, ${currentCity.country}`}</Text>
          </Space>
        </Card>
      )}

      {loading && !currentWeather ? (
        <Card>
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Spin size="large" />
            <div style={{ marginTop: 16 }}>正在加载天气数据...</div>
          </div>
        </Card>
      ) : currentWeather ? (
        <>
          <Card style={{ marginBottom: 16 }}>
            <Row gutter={[16, 16]}>
              <Col xs={24} md={12}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 64, fontWeight: 'bold', lineHeight: 1 }}>
                    {currentWeather.temp}°
                  </div>
                  <div style={{ fontSize: 18, color: '#666', marginTop: 8 }}>
                    {currentWeather.description}
                  </div>
                  <div style={{ marginTop: 16 }}>
                    <img
                      src={getWeatherIcon(currentWeather.icon)}
                      alt={currentWeather.description}
                      style={{ width: 80, height: 80 }}
                    />
                  </div>
                </div>
              </Col>
              <Col xs={24} md={12}>
                <Space direction="vertical" style={{ width: '100%' }}>
                  <div>
                    <Text type="secondary">体感温度：</Text>
                    <Text strong>{currentWeather.feelsLike}°C</Text>
                  </div>
                  <div>
                    <Text type="secondary">湿度：</Text>
                    <Text strong>{currentWeather.humidity}%</Text>
                  </div>
                  <div>
                    <Text type="secondary">气压：</Text>
                    <Text strong>{currentWeather.pressure} hPa</Text>
                  </div>
                  {currentWeather.windSpeed > 0 && (
                    <div>
                      <Text type="secondary">风速：</Text>
                      <Text strong>
                        {currentWeather.windSpeed} m/s ({getWindDirection(currentWeather.windDeg)})
                      </Text>
                    </div>
                  )}
                  {currentWeather.visibility && (
                    <div>
                      <Text type="secondary">能见度：</Text>
                      <Text strong>{currentWeather.visibility} km</Text>
                    </div>
                  )}
                  <Divider />
                  <div>
                    <Text type="secondary">日出：</Text>
                    <Text strong>{dayjs(currentWeather.sunrise).format('HH:mm')}</Text>
                  </div>
                  <div>
                    <Text type="secondary">日落：</Text>
                    <Text strong>{dayjs(currentWeather.sunset).format('HH:mm')}</Text>
                  </div>
                </Space>
              </Col>
            </Row>
          </Card>

          {forecast.length > 0 && (
            <Card title="天气预报（5天）">
              <Row gutter={[16, 16]}>
                {forecast
                  .filter((item, index) => index % 8 === 0) // 每天取一个时间点（每3小时一次，8次=24小时）
                  .slice(0, 5)
                  .map((item, index) => (
                    <Col key={index} xs={24} sm={12} md={8} lg={4}>
                      <Card size="small">
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: 12, color: '#666', marginBottom: 8 }}>
                            {dayjs(item.date).format('MM/DD HH:mm')}
                          </div>
                          <img
                            src={getWeatherIcon(item.icon)}
                            alt={item.description}
                            style={{ width: 50, height: 50 }}
                          />
                          <div style={{ fontSize: 18, fontWeight: 'bold', marginTop: 8 }}>
                            {item.temp}°
                          </div>
                          <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
                            {item.description}
                          </div>
                        </div>
                      </Card>
                    </Col>
                  ))}
              </Row>
            </Card>
          )}
        </>
      ) : !loading ? (
        <Card>
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
                <p style={{ marginTop: 16 }}>
                  请检查 <code>.env</code> 文件中的 <code>VITE_WEATHER_API_KEY</code> 配置是否正确
                </p>
              </div>
            }
            extra={
              <Button type="primary" onClick={handleRefresh}>
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
