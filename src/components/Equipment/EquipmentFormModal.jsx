/**
 * 装备新建/编辑表单弹窗
 * 支持图片上传、分类、状态等
 */
import React, { useState } from 'react';
import { Modal, Form, Input, Select, DatePicker, InputNumber, Button, Row, Col, message } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { EQUIPMENT_CATEGORIES, EQUIPMENT_STATUS } from '../../stores/equipmentStore';

const { TextArea } = Input;

function EquipmentFormModal({ open, editing, onCancel, onOk, form }) {
  const [imagePreview, setImagePreview] = useState(null);
  const [imagePath, setImagePath] = useState(null);

  React.useEffect(() => {
    if (open) {
      if (editing && editing.image_path) {
        const imgPath = editing.image_path;
        setImagePath(imgPath);
        // 处理 Electron 本地文件路径
        if (imgPath.startsWith('data:')) {
          setImagePreview(imgPath);
        } else if (imgPath.startsWith('/') || /^[A-Z]:/.test(imgPath)) {
          // Windows 绝对路径，转换为 file:// URL
          setImagePreview(`file:///${imgPath.replace(/\\/g, '/')}`);
        } else {
          setImagePreview(imgPath);
        }
      } else {
        setImagePath(null);
        setImagePreview(null);
      }
    }
  }, [editing, open]);

  const handleImageSelect = async () => {
    try {
      if (window.electronAPI?.selectImageFile) {
        const result = await window.electronAPI.selectImageFile();
        if (result?.success && result.filePath) {
          const filePath = result.filePath;
          setImagePath(filePath);
          // 转换 Windows 路径为 file:// URL
          const fileUrl = `file:///${filePath.replace(/\\/g, '/')}`;
          setImagePreview(fileUrl);
          form.setFieldsValue({ image_path: filePath });
        } else if (!result?.canceled) {
          message.error('选择图片失败');
        }
      } else {
        // Web环境：使用input file
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = (e) => {
          const file = e.target.files?.[0];
          if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => {
              const dataUrl = ev.target?.result;
              setImagePreview(dataUrl);
              // Web环境暂存为base64
              setImagePath(dataUrl);
              form.setFieldsValue({ image_path: dataUrl });
            };
            reader.readAsDataURL(file);
          }
        };
        input.click();
      }
    } catch (e) {
      message.error('选择图片失败：' + (e.message || '未知错误'));
    }
  };

  return (
    <Modal
      title={editing ? '编辑装备' : '新建装备'}
      open={open}
      onCancel={onCancel}
      onOk={() => form.submit()}
      okText="保存"
      cancelText="取消"
      width={640}
    >
      <Form form={form} layout="vertical" onFinish={onOk}>
        <Form.Item name="name" label="装备名称" rules={[{ required: true, message: '请输入装备名称' }]}>
          <Input placeholder="如：MacBook Pro、跑步鞋" />
        </Form.Item>
        <Form.Item name="category" label="类别" rules={[{ required: true, message: '请选择类别' }]}>
          <Select
            placeholder="选择装备类别"
            options={EQUIPMENT_CATEGORIES.map((c) => ({
              value: c.value,
              label: `${c.icon} ${c.label}`,
            }))}
          />
        </Form.Item>
        <Form.Item name="brand" label="品牌">
          <Input placeholder="如：Apple、Nike" />
        </Form.Item>
        <Form.Item name="model" label="型号">
          <Input placeholder="如：M1 Pro、Air Max 90" />
        </Form.Item>
        <Form.Item name="purchase_date" label="购买日期">
          <DatePicker style={{ width: '100%' }} placeholder="选择购买日期" />
        </Form.Item>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="price" label="价格（元）">
              <InputNumber style={{ width: '100%' }} placeholder="0.00" min={0} precision={2} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="status" label="状态" initialValue="normal">
              <Select
                options={EQUIPMENT_STATUS.map((s) => ({
                  value: s.value,
                  label: s.label,
                }))}
              />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item name="image_path" label="图片">
          <div>
            {imagePreview && (
              <div style={{ marginBottom: 8 }}>
                <img
                  src={imagePreview}
                  alt="预览"
                  style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 4 }}
                />
              </div>
            )}
            <Button icon={<UploadOutlined />} onClick={handleImageSelect}>
              {imagePreview ? '更换图片' : '选择图片'}
            </Button>
          </div>
        </Form.Item>
        <Form.Item name="notes" label="备注">
          <TextArea rows={3} placeholder="备注信息（可选）" />
        </Form.Item>
      </Form>
    </Modal>
  );
}

export default EquipmentFormModal;
