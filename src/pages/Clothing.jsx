import React, { useState, useEffect, useMemo } from 'react';
import {
  Card,
  Button,
  Space,
  Typography,
  Form,
  Input,
  Select,
  message,
  Popconfirm,
  Row,
  Col,
  Spin,
  Tag,
  Tabs,
  Badge,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
  FilterOutlined,
  RobotOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import useClothingStore, {
  CLOTHING_CATEGORIES,
  CLOTHING_COLORS,
  CLOTHING_SEASONS,
  CLOTHING_STYLES,
  WASH_STATUS,
} from '../stores/clothingStore';
import useOutfitStore from '../stores/outfitStore';
import useUserStore from '../stores/userStore';
import { getLogger } from '../services/logger-client';
import { useI18n } from '../context/I18nContext';
import ClothingFormModal from '../components/Clothing/ClothingFormModal';
import LocalImage from '../components/LocalImage';
import FriendlyEmpty from '../components/FriendlyEmpty';
import { useNavigate } from 'react-router-dom';

const { Title, Text } = Typography;
const { Search } = Input;
const logger = getLogger();

function Clothing() {
  const [form] = Form.useForm();
  const { t } = useI18n();
  const [modalVisible, setModalVisible] = useState(false);
  const [editingClothing, setEditingClothing] = useState(null);
  const [searchText, setSearchText] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [colorFilter, setColorFilter] = useState('all');
  const [seasonFilter, setSeasonFilter] = useState('all');
  const [viewMode, setViewMode] = useState('grid'); // grid | wardrobe

  const { currentUser, isInitialized } = useUserStore();
  const navigate = useNavigate();
  const { clothing, loading, loadClothing, createClothing, updateClothing, deleteClothing, getClothingByCategory } =
    useClothingStore();

  useEffect(() => {
    if (!isInitialized || !currentUser) return;
    loadClothing().catch((e) => {
      logger.error('Clothing', '加载服装失败', e);
      message.error(t('clothing.messages.loadFailed', '加载服装失败'));
    });
  }, [isInitialized, currentUser, loadClothing]);

  const handleCreate = () => {
    setEditingClothing(null);
    setModalVisible(true);
  };

  const handleEdit = (item) => {
    setEditingClothing(item);
    setModalVisible(true);
  };

  const handleSubmit = async (values) => {
    try {
      if (editingClothing) {
        await updateClothing(editingClothing.id, values);
        message.success(t('clothing.messages.updated', '已更新服装'));
      } else {
        await createClothing(values);
        message.success(t('clothing.messages.created', '已添加服装'));
      }
      setModalVisible(false);
      setEditingClothing(null);
    } catch (e) {
      logger.error('Clothing', '保存服装失败', e);
      message.error(t('clothing.messages.saveFailed', '保存失败'));
    }
  };

  const handleDelete = async (item) => {
    try {
      await deleteClothing(item.id);
      message.success(t('clothing.messages.deleted', '已删除服装'));
    } catch (e) {
      logger.error('Clothing', '删除服装失败', e);
      message.error(t('clothing.messages.deleteFailed', '删除失败'));
    }
  };

  const filteredClothing = useMemo(() => {
    let result = clothing;
    if (searchText) {
      result = result.filter((item) => item.name?.toLowerCase().includes(searchText.toLowerCase()));
    }
    if (categoryFilter !== 'all') {
      result = result.filter((item) => item.category === categoryFilter);
    }
    if (colorFilter !== 'all') {
      result = result.filter((item) => item.color === colorFilter);
    }
    if (seasonFilter !== 'all') {
      result = result.filter((item) => item.season === seasonFilter || item.season === 'all');
    }
    return result;
  }, [clothing, searchText, categoryFilter, colorFilter, seasonFilter]);

  const clothingByCategory = useMemo(() => {
    return getClothingByCategory();
  }, [clothing, getClothingByCategory]);

  const getCategoryIcon = (category) => {
    const cat = CLOTHING_CATEGORIES.find((c) => c.value === category);
    return cat?.icon || '👕';
  };

  const getColorDisplay = (color) => {
    const colorObj = CLOTHING_COLORS.find((c) => c.value === color);
    if (!colorObj) return null;
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        <span
          style={{
            display: 'inline-block',
            width: 12,
            height: 12,
            backgroundColor: colorObj.color,
            border: '1px solid #ddd',
            borderRadius: 2,
          }}
        />
        {colorObj.label}
      </span>
    );
  };


  if (!isInitialized || loading) {
    return (
      <div style={{ textAlign: 'center', padding: 50 }}>
        <Spin size="large" />
      </div>
    );
  }

  const tabItems = [
    {
      key: 'grid',
      label: '列表视图',
      children: (
        <div>
          <Row gutter={[16, 16]}>
            {filteredClothing.length === 0 ? (
              <Col span={24}>
                <FriendlyEmpty context="clothing" onAction={handleCreate} />
              </Col>
            ) : (
              filteredClothing.map((item) => (
                <Col key={item.id} xs={24} sm={12} md={8} lg={6}>
                  <Card
                    className="clothing-card"
                    hoverable
                    cover={
                      item.image_path ? (
                        <div className="clothing-card-cover">
                          <LocalImage
                            src={item.image_path}
                            alt={item.name}
                            fallback={<span className="clothing-card-icon">{getCategoryIcon(item.category)}</span>}
                          />
                        </div>
                      ) : (
                        <div className="clothing-card-cover">
                          <span className="clothing-card-icon">{getCategoryIcon(item.category)}</span>
                        </div>
                      )
                    }
                    actions={[
                      <EditOutlined key="edit" onClick={() => handleEdit(item)} />,
                      <Popconfirm
                        key="delete"
                        title="确定删除这件服装吗？"
                        onConfirm={() => handleDelete(item)}
                      >
                        <DeleteOutlined />
                      </Popconfirm>,
                    ]}
                  >
                    <Card.Meta
                      title={
                        <div>
                          <Text strong>{item.name}</Text>
                          <span className={`clothing-wash-tag clothing-wash-${item.wash_status || 'clean'}`} style={{ marginLeft: 8 }}>
                            {WASH_STATUS.find((s) => s.value === item.wash_status)?.label || '干净'}
                          </span>
                        </div>
                      }
                      description={
                        <div className="clothing-card-meta">
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <span>{CLOTHING_CATEGORIES.find((c) => c.value === item.category)?.label}</span>
                            {item.color && (
                              <span className="clothing-color-swatch">
                                <span 
                                  className="clothing-color-dot" 
                                  style={{ backgroundColor: CLOTHING_COLORS.find((c) => c.value === item.color)?.color }}
                                />
                                {CLOTHING_COLORS.find((c) => c.value === item.color)?.label}
                              </span>
                            )}
                          </div>
                          {item.material && <div className="clothing-meta-item">材质: {item.material}</div>}
                          {item.price && (
                            <div className="clothing-meta-item">
                              <span className="clothing-price">¥{Number(item.price).toFixed(2)}</span>
                            </div>
                          )}
                        </div>
                      }
                    />
                  </Card>
                </Col>
              ))
            )}
          </Row>
        </div>
      ),
    },
    {
      key: 'wardrobe',
      label: '虚拟衣柜',
      children: (
        <div>
          {CLOTHING_CATEGORIES.map((category) => {
            const items = clothingByCategory[category.value] || [];
            if (items.length === 0) return null;
            return (
              <Card
                key={category.value}
                className="clothing-wardrobe-card"
                title={
                  <span>
                    {category.icon} {category.label} ({items.length})
                  </span>
                }
              >
                <Row gutter={[16, 16]}>
                  {items.map((item) => (
                    <Col key={item.id} xs={12} sm={8} md={6} lg={4}>
                      <Card
                        className="clothing-mini-card"
                        hoverable
                        size="small"
                        cover={
                          item.image_path ? (
                            <div className="clothing-mini-cover" style={{ position: 'relative' }}>
                              <LocalImage
                                src={item.image_path}
                                alt={item.name}
                                fallback={<span className="clothing-mini-icon">{getCategoryIcon(item.category)}</span>}
                              />
                              {item.wash_status === 'dirty' && <div className="clothing-dirty-indicator" />}
                            </div>
                          ) : (
                            <div className="clothing-mini-cover" style={{ position: 'relative' }}>
                              <span className="clothing-mini-icon">{getCategoryIcon(item.category)}</span>
                              {item.wash_status === 'dirty' && <div className="clothing-dirty-indicator" />}
                            </div>
                          )
                        }
                        onClick={() => handleEdit(item)}
                      >
                        <Card.Meta
                          title={
                            <Text ellipsis style={{ fontSize: 12 }}>
                              {item.name}
                            </Text>
                          }
                        />
                      </Card>
                    </Col>
                  ))}
                </Row>
              </Card>
            );
          })}
          {Object.values(clothingByCategory).every((items) => items.length === 0) && (
            <FriendlyEmpty context="clothing" onAction={handleCreate} />
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="clothing-header">
        <Title level={2}>服装管理</Title>
        <Space>
          <Button icon={<RobotOutlined />} onClick={() => navigate('/ai', { state: { carry: ['clothing'] } })}>
            问 AI
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            添加服装
          </Button>
        </Space>
      </div>

      <Card className="clothing-filter-card">
        <Space wrap>
          <Search
            placeholder="搜索服装名称"
            allowClear
            style={{ width: 200 }}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            prefix={<SearchOutlined />}
          />
          <Select
            placeholder="类别"
            style={{ width: 120 }}
            value={categoryFilter}
            onChange={setCategoryFilter}
            allowClear
          >
            <Select.Option key="category-all" value="all">全部类别</Select.Option>
            {CLOTHING_CATEGORIES.map((cat) => (
              <Select.Option key={cat.value} value={cat.value}>
                {cat.icon} {cat.label}
              </Select.Option>
            ))}
          </Select>
          <Select
            placeholder="颜色"
            style={{ width: 120 }}
            value={colorFilter}
            onChange={setColorFilter}
            allowClear
          >
            <Select.Option key="color-all" value="all">全部颜色</Select.Option>
            {CLOTHING_COLORS.map((color) => (
              <Select.Option key={color.value} value={color.value}>
                {color.label}
              </Select.Option>
            ))}
          </Select>
          <Select
            placeholder="季节"
            style={{ width: 120 }}
            value={seasonFilter}
            onChange={setSeasonFilter}
            allowClear
          >
            {CLOTHING_SEASONS.map((season) => (
              <Select.Option key={season.value} value={season.value}>
                {season.label}
              </Select.Option>
            ))}
          </Select>
        </Space>
      </Card>

      <Tabs
        className="clothing-tabs"
        items={[
          ...tabItems,
          {
            key: 'outfits',
            label: '搭配管理',
            children: (
              <div style={{ textAlign: 'center', padding: 40 }}>
                <FriendlyEmpty context="outfitsLink" simple />
              </div>
            ),
          },
        ]}
        activeKey={viewMode}
        onChange={setViewMode}
      />

      {modalVisible && (
        <ClothingFormModal
          visible={modalVisible}
          form={form}
          editingClothing={editingClothing}
          onOk={handleSubmit}
          onCancel={() => {
            setModalVisible(false);
            setEditingClothing(null);
          }}
        />
      )}
    </div>
  );
}

export default Clothing;
