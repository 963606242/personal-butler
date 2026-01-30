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
import ClothingFormModal from '../components/Clothing/ClothingFormModal';
import FriendlyEmpty from '../components/FriendlyEmpty';
import { useNavigate } from 'react-router-dom';

const { Title, Text } = Typography;
const { Search } = Input;
const logger = getLogger();

function Clothing() {
  const [form] = Form.useForm();
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
      message.error('加载服装失败');
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
        message.success('已更新服装');
      } else {
        await createClothing(values);
        message.success('已添加服装');
      }
      setModalVisible(false);
      setEditingClothing(null);
    } catch (e) {
      logger.error('Clothing', '保存服装失败', e);
      message.error('保存失败');
    }
  };

  const handleDelete = async (item) => {
    try {
      await deleteClothing(item.id);
      message.success('已删除服装');
    } catch (e) {
      logger.error('Clothing', '删除服装失败', e);
      message.error('删除失败');
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

  const formatImageSrc = (imagePath) => {
    if (!imagePath) return null;
    if (imagePath.startsWith('data:') || imagePath.startsWith('http')) {
      return imagePath;
    }
    // Electron 环境：处理 file:// 路径
    const path = imagePath.replace(/\\/g, '/');
    return path.startsWith('file://') ? path : `file:///${path}`;
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
                    hoverable
                    cover={
                      item.image_path ? (
                        <div style={{ height: 200, overflow: 'hidden', backgroundColor: '#f5f5f5' }}>
                          <img
                            src={formatImageSrc(item.image_path)}
                            alt={item.name}
                            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                            onError={(e) => {
                              e.target.style.display = 'none';
                              e.target.parentElement.innerHTML = `<div style="display: flex; align-items: center; justify-content: center; height: 100%; font-size: 48px;">${getCategoryIcon(item.category)}</div>`;
                            }}
                          />
                        </div>
                      ) : (
                        <div
                          style={{
                            height: 200,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 48,
                            backgroundColor: '#f5f5f5',
                          }}
                        >
                          {getCategoryIcon(item.category)}
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
                          <Tag
                            color={WASH_STATUS.find((s) => s.value === item.wash_status)?.color}
                            style={{ marginLeft: 8 }}
                          >
                            {WASH_STATUS.find((s) => s.value === item.wash_status)?.label}
                          </Tag>
                        </div>
                      }
                      description={
                        <div>
                          <div>
                            {CLOTHING_CATEGORIES.find((c) => c.value === item.category)?.label}
                            {item.color && (
                              <span style={{ marginLeft: 8 }}>{getColorDisplay(item.color)}</span>
                            )}
                          </div>
                          {item.material && <div style={{ marginTop: 4 }}>材质: {item.material}</div>}
                          {item.price && (
                            <div style={{ marginTop: 4, color: '#ff4d4f' }}>
                              ¥{Number(item.price).toFixed(2)}
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
                title={
                  <span>
                    {category.icon} {category.label} ({items.length})
                  </span>
                }
                style={{ marginBottom: 16 }}
              >
                <Row gutter={[16, 16]}>
                  {items.map((item) => (
                    <Col key={item.id} xs={12} sm={8} md={6} lg={4}>
                      <Card
                        hoverable
                        size="small"
                        cover={
                          item.image_path ? (
                            <div style={{ height: 120, overflow: 'hidden', backgroundColor: '#f5f5f5' }}>
                              <img
                                src={formatImageSrc(item.image_path)}
                                alt={item.name}
                                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                                onError={(e) => {
                                  e.target.style.display = 'none';
                                  e.target.parentElement.innerHTML = `<div style="display: flex; align-items: center; justify-content: center; height: 100%; font-size: 32px;">${getCategoryIcon(item.category)}</div>`;
                                }}
                              />
                            </div>
                          ) : (
                            <div
                              style={{
                                height: 120,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 32,
                                backgroundColor: '#f5f5f5',
                              }}
                            >
                              {getCategoryIcon(item.category)}
                            </div>
                          )
                        }
                        onClick={() => handleEdit(item)}
                      >
                        <Card.Meta
                          title={
                            <div>
                              <Text ellipsis style={{ fontSize: 12 }}>
                                {item.name}
                              </Text>
                              {item.wash_status === 'dirty' && (
                                <Badge status="error" style={{ marginLeft: 4 }} />
                              )}
                            </div>
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
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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

      <Card style={{ marginBottom: 16 }}>
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
