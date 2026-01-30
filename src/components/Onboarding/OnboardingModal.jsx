import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Modal,
  Steps,
  Button,
  Typography,
  Space,
  Tag,
  List,
  Divider,
} from 'antd';
import {
  UserOutlined,
  StarOutlined,
  SettingOutlined,
  CheckCircleOutlined,
  RightOutlined,
  LeftOutlined,
} from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;

const ONBOARDING_DONE_KEY = 'personal-butler-onboarding-done';

export function getOnboardingDone() {
  try {
    return !!localStorage.getItem(ONBOARDING_DONE_KEY);
  } catch {
    return false;
  }
}

export function setOnboardingDone() {
  try {
    localStorage.setItem(ONBOARDING_DONE_KEY, '1');
  } catch (_) {}
}

const REQUIRED_ITEMS = [
  { label: '性别', desc: '用于首页问候（先生/女士）与界面配色' },
  { label: '年龄', desc: '基础档案' },
  { label: '身高、体重', desc: '用于 BMI 等健康指标' },
  { label: '职业', desc: '用于 AI 建议与个性化' },
];

const RECOMMENDED_ITEMS = [
  { label: '生日', desc: '首页生日祝福、星座展示' },
  { label: 'MBTI', desc: '首页展示、AI 建议参考' },
  { label: '城市', desc: '天气默认城市、穿搭建议' },
  { label: '工作信息', desc: '日程与 AI 建议更贴合' },
];

const OTHER_ITEMS = [
  { label: '习惯', desc: '打卡、统计、时段推荐' },
  { label: '日程', desc: '日程提醒、今日安排' },
  { label: '设置 → API Keys', desc: '新闻、天气、AI 助手需配置后使用' },
  { label: '天气 → 默认城市', desc: '首页天气与穿搭建议' },
];

function OnboardingModal({ open, onClose, markDone = true }) {
  const navigate = useNavigate();
  const [current, setCurrent] = useState(0);

  const handleClose = () => {
    setCurrent(0);
    if (markDone) setOnboardingDone();
    onClose?.();
  };

  const handleSkip = () => {
    handleClose();
  };

  const handleFinish = (goToProfile) => {
    if (markDone) setOnboardingDone();
    setCurrent(0);
    onClose?.();
    if (goToProfile) navigate('/profile');
  };

  const steps = [
    { title: '欢迎', icon: <UserOutlined /> },
    { title: '必填项', icon: <CheckCircleOutlined /> },
    { title: '推荐项', icon: <StarOutlined /> },
    { title: '其他推荐', icon: <SettingOutlined /> },
    { title: '完成', icon: <CheckCircleOutlined /> },
  ];

  const renderStepContent = () => {
    switch (current) {
      case 0:
        return (
          <div>
            <Title level={5} style={{ marginTop: 0 }}>欢迎使用个人管家</Title>
            <Paragraph type="secondary">
              本应用帮你管理日程、习惯、天气穿搭、装备服装等，并搭配 AI 管家建议。为获得更好体验，请先了解哪些信息<strong>必填</strong>、哪些<strong>推荐填写</strong>。
            </Paragraph>
            <Space direction="vertical" size="small">
              <Text><Tag color="red">必填</Tag> 基础信息中的性别、年龄、身高体重、职业 — 不填无法保存。</Text>
              <Text><Tag color="blue">推荐</Tag> 生日、MBTI、城市、工作信息等 — 填了可获得问候、星座、天气、更准的 AI 建议等。</Text>
            </Space>
          </div>
        );
      case 1:
        return (
          <div>
            <Title level={5} style={{ marginTop: 0 }}>必填项（个人信息 · 基础信息）</Title>
            <Paragraph type="secondary">以下内容在「个人信息」→「基础信息」中填写，保存时校验必填。</Paragraph>
            <List
              size="small"
              dataSource={REQUIRED_ITEMS}
              renderItem={({ label, desc }) => (
                <List.Item>
                  <Space>
                    <Tag color="red">必填</Tag>
                    <Text strong>{label}</Text>
                    <Text type="secondary">— {desc}</Text>
                  </Space>
                </List.Item>
              )}
            />
          </div>
        );
      case 2:
        return (
          <div>
            <Title level={5} style={{ marginTop: 0 }}>推荐项（填了体验更好）</Title>
            <Paragraph type="secondary">选填，但填了可获得更个性化的问候、天气、AI 建议等。</Paragraph>
            <List
              size="small"
              dataSource={RECOMMENDED_ITEMS}
              renderItem={({ label, desc }) => (
                <List.Item>
                  <Space>
                    <Tag color="blue">推荐</Tag>
                    <Text strong>{label}</Text>
                    <Text type="secondary">— {desc}</Text>
                  </Space>
                </List.Item>
              )}
            />
          </div>
        );
      case 3:
        return (
          <div>
            <Title level={5} style={{ marginTop: 0 }}>其他推荐</Title>
            <Paragraph type="secondary">习惯、日程、设置中的 API、天气默认城市等，按需配置即可使用对应功能。</Paragraph>
            <List
              size="small"
              dataSource={OTHER_ITEMS}
              renderItem={({ label, desc }) => (
                <List.Item>
                  <Space>
                    <Tag>选填</Tag>
                    <Text strong>{label}</Text>
                    <Text type="secondary">— {desc}</Text>
                  </Space>
                </List.Item>
              )}
            />
          </div>
        );
      case 4:
        return (
          <div>
            <Title level={5} style={{ marginTop: 0 }}>准备就绪</Title>
            <Paragraph type="secondary">
              建议先到 <strong>个人信息</strong> 完善必填与推荐项，再到 <strong>设置</strong> 配置 API Keys（新闻、天气、AI 等）。
            </Paragraph>
            <Paragraph type="secondary">之后可随时在侧边栏进入各模块使用。</Paragraph>
          </div>
        );
      default:
        return null;
    }
  };

  const isLast = current === steps.length - 1;
  const isFirst = current === 0;

  return (
    <Modal
      title="新手教程"
      open={open}
      onCancel={handleClose}
      footer={null}
      width={560}
      destroyOnClose
      maskClosable={false}
    >
      <Steps current={current} size="small" style={{ marginBottom: 24 }}>
        {steps.map((s, i) => (
          <Steps.Step key={i} title={s.title} icon={s.icon} />
        ))}
      </Steps>

      {renderStepContent()}

      <Divider style={{ margin: '16px 0' }} />
      <Space style={{ width: '100%', justifyContent: 'space-between' }}>
        <Button type="text" onClick={handleSkip}>
          跳过
        </Button>
        <Space>
          {!isFirst && (
            <Button icon={<LeftOutlined />} onClick={() => setCurrent((c) => c - 1)}>
              上一步
            </Button>
          )}
          {!isLast ? (
            <Button type="primary" icon={<RightOutlined />} iconPosition="end" onClick={() => setCurrent((c) => c + 1)}>
              下一步
            </Button>
          ) : (
            <>
              <Button onClick={() => handleFinish(false)}>完成</Button>
              <Button type="primary" onClick={() => handleFinish(true)}>
                完成并前往个人信息
              </Button>
            </>
          )}
        </Space>
      </Space>
    </Modal>
  );
}

export default OnboardingModal;
