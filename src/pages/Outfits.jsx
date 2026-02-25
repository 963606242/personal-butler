import React, { useState, useEffect } from 'react';
import {
  Card,
  Button,
  Space,
  Typography,
  Form,
  Input,
  message,
  Popconfirm,
  Row,
  Col,
  Spin,
  Tag,
  Select,
  Rate,
  DatePicker,
  Modal,
  Tabs,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  StarOutlined,
  ThunderboltOutlined,
  SkinOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import useOutfitStore from '../stores/outfitStore';
import useClothingStore from '../stores/clothingStore';
import useUserStore from '../stores/userStore';
import { getLogger } from '../services/logger-client';
import FriendlyEmpty from '../components/FriendlyEmpty';

const { Title, Text } = Typography;
const logger = getLogger();

function Outfits() {
  const [form] = Form.useForm();
  const [modalVisible, setModalVisible] = useState(false);
  const [editingOutfit, setEditingOutfit] = useState(null);
  const [recommendModalVisible, setRecommendModalVisible] = useState(false);
  const [recommendations, setRecommendations] = useState([]);
  const [loadingRecommendations, setLoadingRecommendations] = useState(false);

  const { currentUser, isInitialized } = useUserStore();
  const { outfits, loading, loadOutfits, createOutfit, updateOutfit, deleteOutfit, recommendOutfit } =
    useOutfitStore();
  const { clothing, loadClothing } = useClothingStore();

  useEffect(() => {
    if (!isInitialized || !currentUser) return;
    loadOutfits().catch((e) => {
      logger.error('Outfits', '加载搭配失败', e);
      message.error('加载搭配失败');
    });
    loadClothing().catch((e) => {
      logger.error('Outfits', '加载服装失败', e);
    });
  }, [isInitialized, currentUser, loadOutfits, loadClothing]);

  const handleCreate = () => {
    setEditingOutfit(null);
    form.resetFields();
    form.setFieldsValue({
      clothing_ids: [],
      rating: 3,
    });
    setModalVisible(true);
  };

  const handleEdit = (outfit) => {
    setEditingOutfit(outfit);
    form.setFieldsValue({
      name: outfit.name,
      clothing_ids: outfit.clothing_ids || [],
      occasion: outfit.occasion,
      rating: outfit.rating || 3,
      worn_date: outfit.worn_date ? dayjs(outfit.worn_date) : null,
    });
    setModalVisible(true);
  };

  const handleSubmit = async (values) => {
    try {
      if (editingOutfit) {
        await updateOutfit(editingOutfit.id, values);
        message.success('已更新搭配');
      } else {
        await createOutfit(values);
        message.success('已创建搭配');
      }
      setModalVisible(false);
      setEditingOutfit(null);
    } catch (e) {
      logger.error('Outfits', '保存搭配失败', e);
      message.error('保存失败');
    }
  };

  const handleDelete = async (outfit) => {
    try {
      await deleteOutfit(outfit.id);
      message.success('已删除搭配');
    } catch (e) {
      logger.error('Outfits', '删除搭配失败', e);
      message.error('删除失败');
    }
  };

  const handleRecommend = async () => {
    try {
      setLoadingRecommendations(true);
      const recs = await recommendOutfit({ excludeDirty: true });
      setRecommendations(recs);
      setRecommendModalVisible(true);
    } catch (e) {
      logger.error('Outfits', '获取推荐失败', e);
      message.error('获取推荐失败');
    } finally {
      setLoadingRecommendations(false);
    }
  };

  const handleSelectRecommendation = (recommendation) => {
    form.setFieldsValue({
      clothing_ids: recommendation.clothing_ids,
    });
    setRecommendModalVisible(false);
    setModalVisible(true);
  };

  const getClothingById = (id) => {
    return clothing.find((c) => c.id === id);
  };

  const formatImageSrc = (imagePath) => {
    if (!imagePath) return null;
    if (imagePath.startsWith('data:') || imagePath.startsWith('http')) {
      return imagePath;
    }
    const path = imagePath.replace(/\\/g, '/');
    return path.startsWith('file://') ? path : `file:///${path}`;
  };

  if (!isInitialized || loading) {
    return (
      <Card style={{ borderRadius: 16 }}>
        <div style={{ textAlign: 'center', padding: 50 }}>
          <Spin size="large" />
          <Text type="secondary" style={{ display: 'block', marginTop: 16 }}>加载中...</Text>
        </div>
      </Card>
    );
  }

  const tabItems = [
    {
      key: 'list',
      label: '我的搭配',
      children: (
        <div>
          {outfits.length === 0 ? (
            <FriendlyEmpty context="outfits" onAction={handleCreate} />
          ) : (
            <Row gutter={[16, 16]}>
              {outfits.map((outfit) => {
                const outfitClothing = (outfit.clothing_ids || []).map(getClothingById).filter(Boolean);
                return (
                  <Col key={outfit.id} xs={24} sm={12} md={8}>
                    <Card
                      className="outfit-card"
                      hoverable
                      actions={[
                        <EditOutlined key="edit" onClick={() => handleEdit(outfit)} />,
                        <Popconfirm
                          key="delete"
                          title="确定删除这个搭配吗？"
                          onConfirm={() => handleDelete(outfit)}
                        >
                          <DeleteOutlined />
                        </Popconfirm>,
                      ]}
                    >
                      <Card.Meta
                        title={
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <Text strong>{outfit.name || '未命名搭配'}</Text>
                            {outfit.rating && (
                              <Rate
                                disabled
                                value={outfit.rating}
                                style={{ fontSize: 13 }}
                              />
                            )}
                          </div>
                        }
                        description={
                          <div>
                            {outfit.occasion && (
                              <Tag className="outfit-occasion-tag" style={{ marginBottom: 8 }}>
                                {outfit.occasion}
                              </Tag>
                            )}
                            {outfit.worn_date && (
                              <Text type="secondary" style={{ display: 'block', marginBottom: 8, fontSize: 12 }}>
                                📅 穿着日期: {dayjs(outfit.worn_date).format('YYYY-MM-DD')}
                              </Text>
                            )}
                            <div>
                              <Text type="secondary" style={{ fontSize: 12 }}>包含 {outfitClothing.length} 件服装：</Text>
                              <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                {outfitClothing.map((c) => (
                                  <span key={c.id} className="outfit-clothing-tag">
                                    {c.name}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                        }
                      />
                    </Card>
                  </Col>
                );
              })}
            </Row>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      {/* Header */}
      <div className="outfit-header">
        <Title level={3} style={{ margin: 0 }}>
          <SkinOutlined style={{ marginRight: 8 }} />
          搭配管理
        </Title>
        <Space>
          <Button icon={<ThunderboltOutlined />} onClick={handleRecommend} loading={loadingRecommendations} style={{ borderRadius: 10 }}>
            智能推荐
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate} style={{ borderRadius: 10 }}>
            创建搭配
          </Button>
        </Space>
      </div>

      <Tabs items={tabItems} />

      {/* Create/Edit modal */}
      <Modal
        className="outfit-form-modal"
        title={editingOutfit ? '编辑搭配' : '创建搭配'}
        open={modalVisible}
        onOk={() => form.submit()}
        onCancel={() => {
          setModalVisible(false);
          setEditingOutfit(null);
          form.resetFields();
        }}
        width={600}
        okText="确定"
        cancelText="取消"
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="name" label="搭配名称">
            <Input placeholder="例如：休闲日常装" />
          </Form.Item>

          <Form.Item
            name="clothing_ids"
            label="选择服装"
            rules={[{ required: true, message: '请至少选择一件服装' }]}
          >
            <Select mode="multiple" placeholder="选择服装" showSearch optionFilterProp="children">
              {clothing.map((c) => (
                <Select.Option key={c.id} value={c.id}>
                  {c.name} ({c.category})
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item name="occasion" label="场合">
            <Select placeholder="选择场合" allowClear>
              <Select.Option value="daily">日常</Select.Option>
              <Select.Option value="work">工作</Select.Option>
              <Select.Option value="formal">正式</Select.Option>
              <Select.Option value="sport">运动</Select.Option>
              <Select.Option value="party">聚会</Select.Option>
              <Select.Option value="travel">旅行</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item name="rating" label="评分" initialValue={3}>
            <Rate />
          </Form.Item>

          <Form.Item name="worn_date" label="穿着日期">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Recommend modal */}
      <Modal
        className="outfit-recommend-modal"
        title="智能推荐搭配"
        open={recommendModalVisible}
        onCancel={() => setRecommendModalVisible(false)}
        footer={null}
        width={800}
      >
        {recommendations.length === 0 ? (
          <FriendlyEmpty context="outfitsNoRecommend" />
        ) : (
          <Row gutter={[16, 16]}>
            {recommendations.map((rec, index) => {
              const recClothing = rec.items || rec.clothing_ids.map(getClothingById).filter(Boolean);
              return (
                <Col key={index} xs={24} sm={12} md={8}>
                  <Card
                    className="outfit-recommend-card"
                    hoverable
                    onClick={() => handleSelectRecommendation(rec)}
                    style={{ cursor: 'pointer' }}
                  >
                    <div>
                      <Text strong>推荐搭配 {index + 1}</Text>
                      <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {recClothing.map((c) => (
                          <span key={c.id} className="outfit-clothing-tag">
                            {c.name}
                          </span>
                        ))}
                      </div>
                      <Button
                        type="link"
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectRecommendation(rec);
                        }}
                        style={{ marginTop: 8, padding: 0 }}
                      >
                        使用此搭配
                      </Button>
                    </div>
                  </Card>
                </Col>
              );
            })}
          </Row>
        )}
      </Modal>
    </div>
  );
}

export default Outfits;
