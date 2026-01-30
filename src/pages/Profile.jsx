import React, { useState, useEffect } from 'react';
import {
  Form,
  Input,
  InputNumber,
  Select,
  Button,
  Card,
  Row,
  Col,
  Typography,
  Space,
  message,
  Tabs,
  TimePicker,
  Checkbox,
  DatePicker,
} from 'antd';
import { UserOutlined, IdcardOutlined, HeartOutlined } from '@ant-design/icons';
import useUserStore from '../stores/userStore';
import dayjs from 'dayjs';
import { getZodiacFromBirthday } from '../utils/zodiac';

const { Title, Text } = Typography;
const { Option } = Select;

const MBTI_OPTIONS = [
  'INTJ', 'INTP', 'ENTJ', 'ENTP', 'INFJ', 'INFP', 'ENFJ', 'ENFP',
  'ISTJ', 'ISFJ', 'ESTJ', 'ESFJ', 'ISTP', 'ISFP', 'ESTP', 'ESFP',
];

function Profile() {
  const [form] = Form.useForm();
  const { userProfile, loadUser, updateProfile, isInitialized } = useUserStore();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadUser().catch((error) => {
      console.error('加载用户信息失败:', error);
      message.error('加载用户信息失败: ' + error.message);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (userProfile) {
      const birthdayVal = userProfile.birthday
        ? dayjs(userProfile.birthday)
        : undefined;
      form.setFieldsValue({
        gender: userProfile.gender || undefined,
        height: userProfile.height || undefined,
        weight: userProfile.weight || undefined,
        age: userProfile.age || undefined,
        occupation: userProfile.occupation || undefined,
        birthday: birthdayVal,
        mbti: userProfile.mbti || undefined,
      });

      // 工作信息
      if (userProfile.work_schedule) {
        try {
          const workSchedule = userProfile.work_schedule;
          form.setFieldsValue({
            workLocation: userProfile.work_location?.address || undefined,
            workType: workSchedule.workType || undefined,
            workStartTime: workSchedule.startTime ? dayjs(workSchedule.startTime, 'HH:mm') : undefined,
            workEndTime: workSchedule.endTime ? dayjs(workSchedule.endTime, 'HH:mm') : undefined,
            workDays: workSchedule.workDays || [],
            overtimeFrequency: workSchedule.overtimeFrequency || undefined,
            commuteMethod: workSchedule.commuteMethod || undefined,
            commuteTime: workSchedule.commuteTime || undefined,
          });
        } catch (error) {
          console.error('解析工作信息失败:', error);
        }
      }

      // 兴趣爱好
      if (userProfile.interests) {
        form.setFieldsValue({
          games: userProfile.interests.games || [],
          sports: userProfile.interests.sports || [],
          entertainment: userProfile.interests.entertainment || [],
          otherInterests: userProfile.interests.other || undefined,
        });
      }
    }
  }, [userProfile, form]);

  const handleSubmit = async (values, tabKey) => {
    setLoading(true);
    try {
      console.log('[Profile] 表单提交 - Tab:', tabKey);
      console.log('[Profile] 表单值:', values);
      
      let profileData = {};

      if (tabKey === 'basic') {
        profileData = {
          gender: values.gender,
          height: values.height,
          weight: values.weight,
          age: values.age,
          occupation: values.occupation,
          birthday: values.birthday ? values.birthday.startOf('day').valueOf() : null,
          mbti: values.mbti || null,
        };
        console.log('[Profile] 基础信息数据:', profileData);
        console.log('[Profile] 原始表单值:', values);
      } else if (tabKey === 'work') {
        // 工作信息
        profileData = {
          work_location: {
            address: values.workLocation || null,
          },
          work_schedule: {
            workType: values.workType || null,
            startTime: values.workStartTime ? values.workStartTime.format('HH:mm') : null,
            endTime: values.workEndTime ? values.workEndTime.format('HH:mm') : null,
            workDays: values.workDays || [],
            overtimeFrequency: values.overtimeFrequency || null,
            commuteMethod: values.commuteMethod || null,
            commuteTime: values.commuteTime !== undefined && values.commuteTime !== null ? values.commuteTime : null,
          },
        };
        console.log('[Profile] 工作信息数据:', profileData);
      } else if (tabKey === 'interests') {
        // 兴趣爱好
        profileData = {
          interests: {
            games: values.games || [],
            sports: values.sports || [],
            entertainment: values.entertainment || [],
            other: values.otherInterests || null,
          },
        };
        console.log('[Profile] 兴趣爱好数据:', profileData);
      }

      console.log('[Profile] 准备更新的数据:', profileData);
      await updateProfile(profileData);
      message.success('个人信息更新成功');
    } catch (error) {
      console.error('[Profile] 更新失败:', error);
      message.error('更新失败: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isInitialized) {
    return (
      <Card>
        <Title level={3}>首次使用</Title>
        <p>请先初始化应用...</p>
      </Card>
    );
  }

  return (
    <div>
      <Title level={2}>
        <UserOutlined /> 个人信息
      </Title>

      <Card style={{ marginTop: 24 }}>
        <Tabs
          defaultActiveKey="basic"
          items={[
            {
              key: 'basic',
              label: (
                <span>
                  <UserOutlined />
                  基础信息
                </span>
              ),
              children: (
                <>
                  <Form
                    form={form}
                    layout="vertical"
                    onFinish={(values) => handleSubmit(values, 'basic')}
                    onFinishFailed={(errorInfo) => {
                      console.error('[Profile] 表单验证失败:', errorInfo);
                      message.error('请检查表单填写是否正确');
                    }}
                  >
                    <Row gutter={16}>
                      <Col xs={24} sm={12}>
                        <Form.Item
                          name="gender"
                          label="性别"
                          rules={[{ required: true, message: '请选择性别' }]}
                        >
                          <Select placeholder="请选择性别">
                            <Option value="male">男</Option>
                            <Option value="female">女</Option>
                            <Option value="other">其他</Option>
                          </Select>
                        </Form.Item>
                      </Col>
                      <Col xs={24} sm={12}>
                        <Form.Item
                          name="age"
                          label="年龄"
                          rules={[{ required: true, message: '请输入年龄' }]}
                        >
                          <InputNumber
                            min={1}
                            max={150}
                            placeholder="年龄"
                            style={{ width: '100%' }}
                          />
                        </Form.Item>
                      </Col>
                    </Row>

                    <Row gutter={16}>
                      <Col xs={24} sm={12}>
                        <Form.Item name="birthday" label="生日">
                          <DatePicker
                            style={{ width: '100%' }}
                            placeholder="选填"
                          />
                        </Form.Item>
                      </Col>
                      <Col xs={24} sm={12}>
                        <Form.Item noStyle shouldUpdate={(prev, curr) => prev.birthday !== curr.birthday}>
                          {({ getFieldValue }) => {
                            const b = getFieldValue('birthday');
                            const zodiac = getZodiacFromBirthday(b);
                            return (
                              <Form.Item label="星座">
                                <Text type="secondary">
                                  {zodiac ? `${zodiac}（根据生日自动计算）` : '填写生日后自动显示'}
                                </Text>
                              </Form.Item>
                            );
                          }}
                        </Form.Item>
                      </Col>
                    </Row>

                    <Form.Item name="mbti" label="MBTI">
                      <Select
                        placeholder="选填"
                        allowClear
                        options={MBTI_OPTIONS.map((v) => ({ value: v, label: v }))}
                      />
                    </Form.Item>

                    <Row gutter={16}>
                      <Col xs={24} sm={12}>
                        <Form.Item
                          name="height"
                          label="身高 (cm)"
                          rules={[{ required: true, message: '请输入身高' }]}
                        >
                          <InputNumber
                            min={50}
                            max={250}
                            placeholder="身高"
                            style={{ width: '100%' }}
                          />
                        </Form.Item>
                      </Col>
                      <Col xs={24} sm={12}>
                        <Form.Item
                          name="weight"
                          label="体重 (kg)"
                          rules={[{ required: true, message: '请输入体重' }]}
                        >
                          <InputNumber
                            min={20}
                            max={300}
                            step={0.1}
                            placeholder="体重"
                            style={{ width: '100%' }}
                          />
                        </Form.Item>
                      </Col>
                    </Row>

                    <Form.Item
                      name="occupation"
                      label="职业"
                      rules={[{ required: true, message: '请输入职业' }]}
                    >
                      <Input placeholder="例如：程序员、设计师等" />
                    </Form.Item>

                    <Form.Item>
                      <Space>
                        <Button type="primary" htmlType="submit" loading={loading}>
                          保存
                        </Button>
                        <Button onClick={() => form.resetFields(['gender', 'age', 'height', 'weight', 'occupation', 'birthday', 'mbti'])}>
                          重置
                        </Button>
                      </Space>
                    </Form.Item>
                  </Form>

                  {userProfile && userProfile.height && userProfile.weight && (
                    <Card style={{ marginTop: 24 }}>
                      <Title level={4}>健康指标</Title>
                      <p>
                        BMI: {(
                          userProfile.weight /
                          Math.pow(userProfile.height / 100, 2)
                        ).toFixed(2)}
                      </p>
                    </Card>
                  )}
                </>
              ),
            },
            {
              key: 'work',
              label: (
                <span>
                  <IdcardOutlined />
                  工作信息
                </span>
              ),
              children: (
                <Form
                  form={form}
                  layout="vertical"
                  onFinish={(values) => handleSubmit(values, 'work')}
                  onFinishFailed={(errorInfo) => {
                    console.error('[Profile] 表单验证失败:', errorInfo);
                    message.error('请检查表单填写是否正确');
                  }}
                >
                  <Form.Item
                    name="workLocation"
                    label="工作地点"
                  >
                    <Input placeholder="请输入工作地点地址" />
                  </Form.Item>

                  <Form.Item
                    name="workType"
                    label="工作性质"
                  >
                    <Select placeholder="请选择工作性质">
                      <Option value="fixed">固定工作时间</Option>
                      <Option value="flexible">弹性工作时间</Option>
                      <Option value="remote">远程工作</Option>
                    </Select>
                  </Form.Item>

                  <Row gutter={16}>
                    <Col xs={24} sm={12}>
                      <Form.Item
                        name="workStartTime"
                        label="工作开始时间"
                      >
                        <TimePicker
                          format="HH:mm"
                          style={{ width: '100%' }}
                          placeholder="选择开始时间"
                        />
                      </Form.Item>
                    </Col>
                    <Col xs={24} sm={12}>
                      <Form.Item
                        name="workEndTime"
                        label="工作结束时间"
                      >
                        <TimePicker
                          format="HH:mm"
                          style={{ width: '100%' }}
                          placeholder="选择结束时间"
                        />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Form.Item
                    name="workDays"
                    label="工作日"
                  >
                    <Checkbox.Group>
                      <Checkbox value="1">周一</Checkbox>
                      <Checkbox value="2">周二</Checkbox>
                      <Checkbox value="3">周三</Checkbox>
                      <Checkbox value="4">周四</Checkbox>
                      <Checkbox value="5">周五</Checkbox>
                      <Checkbox value="6">周六</Checkbox>
                      <Checkbox value="0">周日</Checkbox>
                    </Checkbox.Group>
                  </Form.Item>

                  <Form.Item
                    name="overtimeFrequency"
                    label="加班频率"
                  >
                    <Select placeholder="请选择加班频率">
                      <Option value="never">从不</Option>
                      <Option value="rarely">很少</Option>
                      <Option value="sometimes">偶尔</Option>
                      <Option value="often">经常</Option>
                      <Option value="always">总是</Option>
                    </Select>
                  </Form.Item>

                  <Form.Item
                    name="commuteMethod"
                    label="通勤方式"
                  >
                    <Select placeholder="请选择通勤方式">
                      <Option value="walk">步行</Option>
                      <Option value="bike">自行车</Option>
                      <Option value="car">自驾</Option>
                      <Option value="public">公共交通</Option>
                      <Option value="taxi">打车</Option>
                    </Select>
                  </Form.Item>

                  <Form.Item
                    name="commuteTime"
                    label="通勤时间 (分钟)"
                  >
                    <InputNumber
                      min={0}
                      max={300}
                      placeholder="通勤时间"
                      style={{ width: '100%' }}
                    />
                  </Form.Item>

                  <Form.Item>
                    <Space>
                      <Button type="primary" htmlType="submit" loading={loading}>
                        保存
                      </Button>
                      <Button onClick={() => form.resetFields(['workLocation', 'workType', 'workStartTime', 'workEndTime', 'workDays', 'overtimeFrequency', 'commuteMethod', 'commuteTime'])}>
                        重置
                      </Button>
                    </Space>
                  </Form.Item>
                </Form>
              ),
            },
            {
              key: 'interests',
              label: (
                <span>
                  <HeartOutlined />
                  兴趣爱好
                </span>
              ),
              children: (
                <Form
                  form={form}
                  layout="vertical"
                  onFinish={(values) => handleSubmit(values, 'interests')}
                  onFinishFailed={(errorInfo) => {
                    console.error('[Profile] 表单验证失败:', errorInfo);
                    message.error('请检查表单填写是否正确');
                  }}
                >
                  <Form.Item
                    name="games"
                    label="游戏"
                  >
                    <Select
                      mode="tags"
                      placeholder="输入游戏名称，按回车添加"
                      style={{ width: '100%' }}
                    />
                  </Form.Item>

                  <Form.Item
                    name="sports"
                    label="运动类型"
                  >
                    <Select
                      mode="multiple"
                      placeholder="选择运动类型"
                      style={{ width: '100%' }}
                    >
                      <Option value="running">跑步</Option>
                      <Option value="swimming">游泳</Option>
                      <Option value="cycling">骑行</Option>
                      <Option value="gym">健身</Option>
                      <Option value="yoga">瑜伽</Option>
                      <Option value="basketball">篮球</Option>
                      <Option value="football">足球</Option>
                      <Option value="tennis">网球</Option>
                      <Option value="badminton">羽毛球</Option>
                      <Option value="table-tennis">乒乓球</Option>
                      <Option value="hiking">徒步</Option>
                      <Option value="climbing">攀岩</Option>
                    </Select>
                  </Form.Item>

                  <Form.Item
                    name="entertainment"
                    label="娱乐活动"
                  >
                    <Select
                      mode="multiple"
                      placeholder="选择娱乐活动"
                      style={{ width: '100%' }}
                    >
                      <Option value="movie">电影</Option>
                      <Option value="music">音乐</Option>
                      <Option value="reading">阅读</Option>
                      <Option value="travel">旅行</Option>
                      <Option value="photography">摄影</Option>
                      <Option value="cooking">烹饪</Option>
                      <Option value="drawing">绘画</Option>
                      <Option value="dancing">舞蹈</Option>
                      <Option value="singing">唱歌</Option>
                      <Option value="theater">戏剧</Option>
                    </Select>
                  </Form.Item>

                  <Form.Item
                    name="otherInterests"
                    label="其他爱好"
                  >
                    <Input.TextArea
                      rows={4}
                      placeholder="请输入其他兴趣爱好"
                    />
                  </Form.Item>

                  <Form.Item>
                    <Space>
                      <Button type="primary" htmlType="submit" loading={loading}>
                        保存
                      </Button>
                      <Button onClick={() => form.resetFields(['games', 'sports', 'entertainment', 'otherInterests'])}>
                        重置
                      </Button>
                    </Space>
                  </Form.Item>
                </Form>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}

export default Profile;
