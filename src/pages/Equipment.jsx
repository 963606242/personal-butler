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
  Image,
  Tooltip,
} from 'antd';
import FriendlyEmpty from '../components/FriendlyEmpty';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
  FilterOutlined,
  RobotOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import useEquipmentStore, { EQUIPMENT_CATEGORIES, EQUIPMENT_STATUS } from '../stores/equipmentStore';
import useUserStore from '../stores/userStore';
import { getLogger } from '../services/logger-client';
import EquipmentFormModal from '../components/Equipment/EquipmentFormModal';

const { Title, Text } = Typography;
const { Search } = Input;
const logger = getLogger();

function Equipment() {
  const [form] = Form.useForm();
  const [modalVisible, setModalVisible] = useState(false);
  const [editingEquipment, setEditingEquipment] = useState(null);
  const [searchText, setSearchText] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const { currentUser, isInitialized } = useUserStore();
  const navigate = useNavigate();
  const { equipment, loading, loadEquipment, createEquipment, updateEquipment, deleteEquipment } =
    useEquipmentStore();

  useEffect(() => {
    if (!isInitialized || !currentUser) return;
    loadEquipment();
  }, [isInitialized, currentUser]);

  const handleCreate = () => {
    setEditingEquipment(null);
    form.resetFields();
    form.setFieldsValue({ category: 'other', status: 'normal' });
    setModalVisible(true);
  };

  const handleEdit = (item) => {
    setEditingEquipment(item);
    form.setFieldsValue({
      name: item.name,
      category: item.category || 'other',
      brand: item.brand || '',
      model: item.model || '',
      purchase_date: item.purchase_date ? dayjs(item.purchase_date) : null,
      price: item.price || null,
      status: item.status || 'normal',
      image_path: item.image_path || '',
      notes: item.notes || '',
    });
    setModalVisible(true);
  };

  const handleSubmit = async (values) => {
    try {
      const data = {
        name: values.name,
        category: values.category || 'other',
        brand: values.brand || null,
        model: values.model || null,
        purchase_date: values.purchase_date || null,
        price: values.price || null,
        status: values.status || 'normal',
        image_path: values.image_path || null,
        notes: values.notes || null,
      };
      if (editingEquipment) {
        await updateEquipment(editingEquipment.id, data);
        message.success('装备已更新');
      } else {
        await createEquipment(data);
        message.success('装备已创建');
      }
      setModalVisible(false);
      setEditingEquipment(null);
      form.resetFields();
    } catch (e) {
      if (e?.errorFields) return;
      logger.error('Equipment', '保存装备失败', e);
      message.error('保存失败：' + (e?.message || '未知错误'));
    }
  };

  const handleDelete = async (item) => {
    try {
      await deleteEquipment(item.id);
      message.success('已删除装备');
    } catch (e) {
      logger.error('Equipment', '删除装备失败', e);
      message.error('删除失败');
    }
  };

  const filteredEquipment = useMemo(() => {
    let result = equipment;
    if (searchText) {
      const lower = searchText.toLowerCase();
      result = result.filter(
        (item) =>
          item.name?.toLowerCase().includes(lower) ||
          item.brand?.toLowerCase().includes(lower) ||
          item.model?.toLowerCase().includes(lower) ||
          item.notes?.toLowerCase().includes(lower)
      );
    }
    if (categoryFilter !== 'all') {
      result = result.filter((item) => item.category === categoryFilter);
    }
    if (statusFilter !== 'all') {
      result = result.filter((item) => item.status === statusFilter);
    }
    return result;
  }, [equipment, searchText, categoryFilter, statusFilter]);

  const categoryMap = Object.fromEntries(EQUIPMENT_CATEGORIES.map((c) => [c.value, c]));
  const statusMap = Object.fromEntries(EQUIPMENT_STATUS.map((s) => [s.value, s]));

  if (!isInitialized) {
    return (
      <Card>
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Spin size="large">
            <div style={{ padding: '20px 0', color: '#8c8c8c' }}>正在初始化...</div>
          </Spin>
        </div>
      </Card>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={2}>装备管理</Title>
        <Space>
          <Button icon={<RobotOutlined />} onClick={() => navigate('/ai', { state: { carry: ['equipment'] } })}>
            问 AI
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            新建装备
          </Button>
        </Space>
      </div>

      {/* 搜索和筛选 */}
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} md={8}>
            <Search
              placeholder="搜索装备名称、品牌、型号..."
              allowClear
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              prefix={<SearchOutlined />}
            />
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Select
              style={{ width: '100%' }}
              placeholder="筛选类别"
              value={categoryFilter}
              onChange={setCategoryFilter}
            >
              <Select.Option value="all">全部类别</Select.Option>
              {EQUIPMENT_CATEGORIES.map((c) => (
                <Select.Option key={c.value} value={c.value}>
                  {c.icon} {c.label}
                </Select.Option>
              ))}
            </Select>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Select
              style={{ width: '100%' }}
              placeholder="筛选状态"
              value={statusFilter}
              onChange={setStatusFilter}
            >
              <Select.Option value="all">全部状态</Select.Option>
              {EQUIPMENT_STATUS.map((s) => (
                <Select.Option key={s.value} value={s.value}>
                  {s.label}
                </Select.Option>
              ))}
            </Select>
          </Col>
        </Row>
      </Card>

      {/* 装备列表 */}
      {filteredEquipment.length === 0 && !loading ? (
        <Card>
          <FriendlyEmpty
            context={equipment.length === 0 ? 'equipment' : 'equipmentNoResult'}
            onAction={equipment.length === 0 ? handleCreate : undefined}
          />
        </Card>
      ) : (
        <Row gutter={[16, 16]}>
          {filteredEquipment.map((item) => {
            const category = categoryMap[item.category] || EQUIPMENT_CATEGORIES[EQUIPMENT_CATEGORIES.length - 1];
            const status = statusMap[item.status] || EQUIPMENT_STATUS[0];
            return (
              <Col key={item.id} xs={24} sm={12} md={8} lg={6}>
                <Card
                  hoverable
                  cover={
                    item.image_path ? (
                      <div style={{ height: 200, overflow: 'hidden', background: '#f5f5f5' }}>
                        <img
                          src={
                            item.image_path.startsWith('data:')
                              ? item.image_path
                              : item.image_path.startsWith('/') || /^[A-Z]:/.test(item.image_path)
                              ? `file:///${item.image_path.replace(/\\/g, '/')}`
                              : item.image_path
                          }
                          alt={item.name}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          onError={(e) => {
                            // 如果加载失败，显示占位符
                            e.target.style.display = 'none';
                            e.target.parentElement.innerHTML = `<div style="height: 200px; display: flex; align-items: center; justify-content: center; background: #f5f5f5; font-size: 48px;">${category.icon}</div>`;
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
                          background: '#f5f5f5',
                          fontSize: 48,
                        }}
                      >
                        {category.icon}
                      </div>
                    )
                  }
                  actions={[
                    <Tooltip key="edit" title="编辑">
                      <EditOutlined onClick={() => handleEdit(item)} />
                    </Tooltip>,
                    <Popconfirm
                      key="delete"
                      title="确定删除该装备？"
                      onConfirm={() => handleDelete(item)}
                      okText="删除"
                      cancelText="取消"
                    >
                      <DeleteOutlined style={{ color: '#ff4d4f' }} />
                    </Popconfirm>,
                  ]}
                >
                  <Card.Meta
                    title={
                      <Space>
                        <span>{item.name}</span>
                        <Tag color={status.color}>{status.label}</Tag>
                      </Space>
                    }
                    description={
                      <div>
                        <div style={{ marginTop: 8 }}>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {category.label}
                          </Text>
                        </div>
                        {item.brand && (
                          <div style={{ marginTop: 4 }}>
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              品牌：{item.brand}
                            </Text>
                          </div>
                        )}
                        {item.model && (
                          <div style={{ marginTop: 4 }}>
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              型号：{item.model}
                            </Text>
                          </div>
                        )}
                        {item.purchase_date && (
                          <div style={{ marginTop: 4 }}>
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              购买日期：{dayjs(item.purchase_date).format('YYYY-MM-DD')}
                            </Text>
                          </div>
                        )}
                        {item.price && (
                          <div style={{ marginTop: 4 }}>
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              价格：¥{item.price.toFixed(2)}
                            </Text>
                          </div>
                        )}
                        {item.notes && (
                          <div style={{ marginTop: 8 }}>
                            <Text type="secondary" style={{ fontSize: 12 }} ellipsis={{ tooltip: item.notes }}>
                              {item.notes}
                            </Text>
                          </div>
                        )}
                      </div>
                    }
                  />
                </Card>
              </Col>
            );
          })}
        </Row>
      )}

      <EquipmentFormModal
        open={modalVisible}
        editing={editingEquipment}
        form={form}
        onCancel={() => {
          setModalVisible(false);
          setEditingEquipment(null);
          form.resetFields();
        }}
        onOk={handleSubmit}
      />
    </div>
  );
}

export default Equipment;
