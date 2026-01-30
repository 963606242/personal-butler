import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, Select, DatePicker, InputNumber, Upload, message, Button } from 'antd';
import { PictureOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  CLOTHING_CATEGORIES,
  CLOTHING_COLORS,
  CLOTHING_SEASONS,
  CLOTHING_STYLES,
  WASH_STATUS,
} from '../../stores/clothingStore';

const { TextArea } = Input;

function ClothingFormModal({ visible, form, onOk, onCancel, editingClothing }) {
  const [imagePreview, setImagePreview] = useState(null);

  useEffect(() => {
    if (visible) {
      if (editingClothing) {
        form.setFieldsValue({
          name: editingClothing.name,
          category: editingClothing.category,
          color: editingClothing.color,
          material: editingClothing.material,
          season: editingClothing.season || 'all',
          style: editingClothing.style || 'casual',
          purchase_date: editingClothing.purchase_date ? dayjs(editingClothing.purchase_date) : null,
          price: editingClothing.price,
          wash_status: editingClothing.wash_status || 'clean',
        });
        if (editingClothing.image_path) {
          setImagePreview(editingClothing.image_path);
        } else {
          setImagePreview(null);
        }
      } else {
        form.resetFields();
        setImagePreview(null);
      }
    }
  }, [visible, editingClothing, form]);

  const handleImageSelect = async () => {
    try {
      if (window.electronAPI && window.electronAPI.selectImageFile) {
        const filePath = await window.electronAPI.selectImageFile();
        if (filePath) {
          // Electron 环境：使用 file:// 协议
          const imagePath = filePath.replace(/\\/g, '/');
          const imageUrl = imagePath.startsWith('file://') ? imagePath : `file:///${imagePath}`;
          form.setFieldsValue({ image_path: filePath });
          setImagePreview(imageUrl);
        }
      } else {
        // Web 环境：使用文件输入
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = (e) => {
          const file = e.target.files[0];
          if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
              const dataUrl = event.target.result;
              form.setFieldsValue({ image_path: dataUrl });
              setImagePreview(dataUrl);
            };
            reader.readAsDataURL(file);
          }
        };
        input.click();
      }
    } catch (error) {
      message.error('选择图片失败');
      console.error('选择图片失败:', error);
    }
  };

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      await onOk(values);
      form.resetFields();
      setImagePreview(null);
    } catch (error) {
      console.error('表单验证失败:', error);
    }
  };

  const handleCancel = () => {
    form.resetFields();
    setImagePreview(null);
    onCancel();
  };

  return (
    <Modal
      title={editingClothing ? '编辑服装' : '添加服装'}
      open={visible}
      onOk={handleOk}
      onCancel={handleCancel}
      width={600}
      okText="确定"
      cancelText="取消"
    >
      <Form form={form} layout="vertical">
        <Form.Item
          name="name"
          label="服装名称"
          rules={[{ required: true, message: '请输入服装名称' }]}
        >
          <Input placeholder="例如：白色T恤" />
        </Form.Item>

        <Form.Item
          name="category"
          label="类别"
          rules={[{ required: true, message: '请选择类别' }]}
        >
          <Select placeholder="选择类别">
            {CLOTHING_CATEGORIES.map((cat) => (
              <Select.Option key={cat.value} value={cat.value}>
                {cat.icon} {cat.label}
              </Select.Option>
            ))}
          </Select>
        </Form.Item>

        <Form.Item name="color" label="颜色">
          <Select placeholder="选择颜色" allowClear>
            {CLOTHING_COLORS.map((color) => (
              <Select.Option key={color.value} value={color.value}>
                <span
                  style={{
                    display: 'inline-block',
                    width: 16,
                    height: 16,
                    backgroundColor: color.color,
                    border: '1px solid #ddd',
                    marginRight: 8,
                    verticalAlign: 'middle',
                  }}
                />
                {color.label}
              </Select.Option>
            ))}
          </Select>
        </Form.Item>

        <Form.Item name="material" label="材质">
          <Input placeholder="例如：棉、涤纶、羊毛等" />
        </Form.Item>

        <Form.Item name="season" label="季节适用" initialValue="all">
          <Select>
            {CLOTHING_SEASONS.map((season) => (
              <Select.Option key={season.value} value={season.value}>
                {season.label}
              </Select.Option>
            ))}
          </Select>
        </Form.Item>

        <Form.Item name="style" label="风格" initialValue="casual">
          <Select>
            {CLOTHING_STYLES.map((style) => (
              <Select.Option key={style.value} value={style.value}>
                {style.label}
              </Select.Option>
            ))}
          </Select>
        </Form.Item>

        <Form.Item name="image_path" label="图片">
          <div>
            {imagePreview && (
              <div style={{ marginBottom: 8 }}>
                <img
                  src={imagePreview}
                  alt="预览"
                  style={{ maxWidth: '100%', maxHeight: 200, objectFit: 'contain' }}
                  onError={(e) => {
                    e.target.style.display = 'none';
                  }}
                />
              </div>
            )}
            <Upload
              beforeUpload={() => false}
              showUploadList={false}
              customRequest={handleImageSelect}
            >
              <Button icon={<PictureOutlined />}>选择图片</Button>
            </Upload>
          </div>
        </Form.Item>

        <Form.Item name="purchase_date" label="购买日期">
          <DatePicker style={{ width: '100%' }} />
        </Form.Item>

        <Form.Item name="price" label="价格（元）">
          <InputNumber style={{ width: '100%' }} min={0} precision={2} placeholder="可选" />
        </Form.Item>

        <Form.Item name="wash_status" label="清洗状态" initialValue="clean">
          <Select>
            {WASH_STATUS.map((status) => (
              <Select.Option key={status.value} value={status.value}>
                {status.label}
              </Select.Option>
            ))}
          </Select>
        </Form.Item>
      </Form>
    </Modal>
  );
}

export default ClothingFormModal;
