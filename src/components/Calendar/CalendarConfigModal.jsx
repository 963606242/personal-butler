import React, { useState } from 'react';
import {
  Modal,
  Form,
  Switch,
  Select,
  Input,
  Button,
  Space,
  Divider,
  Typography,
  List,
  Popconfirm,
  message,
} from 'antd';
import {
  SettingOutlined,
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
} from '@ant-design/icons';
import useCalendarConfigStore from '../../stores/calendarConfigStore';
import { getLogger } from '../../services/logger-client';

const { Option } = Select;
const { TextArea } = Input;
const { Title } = Typography;
const logger = getLogger();

// 添加信息源表单组件（独立组件，避免 Form 嵌套）
function AddSourceForm({ onAdd }) {
  const [name, setName] = useState('');
  const [type, setType] = useState('holiday');
  const [url, setUrl] = useState('');

  const handleAdd = () => {
    if (!name.trim()) {
      message.warning('请输入信息源名称');
      return;
    }

    const newSource = {
      id: `source_${Date.now()}`,
      name: name.trim(),
      type: type,
      enabled: true,
      url: url.trim(),
      config: {},
    };
    
    onAdd(newSource);
    setName('');
    setUrl('');
    message.success('信息源已添加');
  };

  return (
    <div style={{ marginTop: 16 }}>
      <Space.Compact style={{ width: '100%' }}>
        <Input
          placeholder="信息源名称"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onPressEnter={handleAdd}
          style={{ width: '30%' }}
        />
        <Select
          value={type}
          onChange={setType}
          style={{ width: '20%' }}
        >
          <Option value="holiday">节假日</Option>
          <Option value="event">事件</Option>
          <Option value="custom">自定义</Option>
        </Select>
        <Input
          placeholder="API地址（可选）"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onPressEnter={handleAdd}
          style={{ width: '40%' }}
        />
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={handleAdd}
        >
          添加
        </Button>
      </Space.Compact>
    </div>
  );
}

function CalendarConfigModal({ visible, onCancel }) {
  const [form] = Form.useForm();
  const [editingSource, setEditingSource] = useState(null);
  
  const {
    showLunar,
    showHoliday,
    showWeekend,
    showToday,
    lunarFormat,
    holidaySource,
    holidayAPI,
    customHolidays,
    thirdPartySources,
    updateConfig,
    addThirdPartySource,
    removeThirdPartySource,
    updateThirdPartySource,
    addCustomHoliday,
    removeCustomHoliday,
  } = useCalendarConfigStore();

  const handleSubmit = (values) => {
    logger.log('CalendarConfig', '保存配置:', values);
    updateConfig(values);
    message.success('配置已保存');
    onCancel();
  };


  const handleRemoveSource = (sourceId) => {
    removeThirdPartySource(sourceId);
    message.success('信息源已删除');
  };

  const handleToggleSource = (sourceId, enabled) => {
    updateThirdPartySource(sourceId, { enabled });
    message.success(enabled ? '信息源已启用' : '信息源已禁用');
  };

  return (
    <Modal
      title={
        <Space>
          <SettingOutlined />
          <span>日历配置</span>
        </Space>
      }
      open={visible}
      onCancel={onCancel}
      footer={null}
      width={800}
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          showLunar,
          showHoliday,
          showWeekend,
          showToday,
          lunarFormat,
          holidaySource,
          holidayAPI,
        }}
        onFinish={handleSubmit}
      >
        <Title level={4}>显示设置</Title>
        <Form.Item
          name="showLunar"
          label="显示农历"
          valuePropName="checked"
        >
          <Switch />
        </Form.Item>

        <Form.Item
          name="showHoliday"
          label="显示节假日"
          valuePropName="checked"
        >
          <Switch />
        </Form.Item>

        <Form.Item
          name="showWeekend"
          label="高亮周末"
          valuePropName="checked"
        >
          <Switch />
        </Form.Item>

        <Form.Item
          name="showToday"
          label="高亮今天"
          valuePropName="checked"
        >
          <Switch />
        </Form.Item>

        <Divider />

        <Title level={4}>农历设置</Title>
        <Form.Item
          name="lunarFormat"
          label="农历显示格式"
        >
          <Select>
            <Option value="full">完整格式（正月初一）</Option>
            <Option value="simple">简化格式（正.1）</Option>
            <Option value="none">不显示</Option>
          </Select>
        </Form.Item>

        <Divider />

        <Title level={4}>节假日设置</Title>
        <Form.Item
          name="holidaySource"
          label="节假日数据源"
        >
          <Select>
            <Option value="local">本地数据</Option>
            <Option value="api">第三方API</Option>
            <Option value="custom">自定义</Option>
          </Select>
        </Form.Item>

        <Form.Item
          noStyle
          shouldUpdate={(prevValues, currentValues) =>
            prevValues.holidaySource !== currentValues.holidaySource
          }
        >
          {({ getFieldValue }) =>
            getFieldValue('holidaySource') === 'api' ? (
              <Form.Item
                name="holidayAPI"
                label="节假日API地址"
                rules={[{ required: true, message: '请输入API地址' }]}
              >
                <Input placeholder="https://api.example.com/holidays" />
              </Form.Item>
            ) : null
          }
        </Form.Item>

        <Divider />

        <Title level={4}>第三方信息源</Title>
        <List
          dataSource={thirdPartySources}
          renderItem={(source) => (
            <List.Item
              actions={[
                <Switch
                  key="enable"
                  checked={source.enabled}
                  onChange={(checked) => handleToggleSource(source.id, checked)}
                />,
                <Popconfirm
                  key="delete"
                  title="确定要删除这个信息源吗？"
                  onConfirm={() => handleRemoveSource(source.id)}
                >
                  <Button
                    type="link"
                    danger
                    icon={<DeleteOutlined />}
                  >
                    删除
                  </Button>
                </Popconfirm>,
              ]}
            >
              <List.Item.Meta
                title={source.name}
                description={`类型: ${source.type} | URL: ${source.url || '本地'}`}
              />
            </List.Item>
          )}
        />

        {/* 使用独立的状态管理，避免 Form 嵌套 */}
        <AddSourceForm 
          onAdd={addThirdPartySource}
        />

        <Divider />

        <Form.Item>
          <Space>
            <Button type="primary" htmlType="submit">
              保存配置
            </Button>
            <Button onClick={onCancel}>
              取消
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </Modal>
  );
}

export default CalendarConfigModal;
