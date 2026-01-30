import React from 'react';
import { Typography, Space, Divider, theme } from 'antd';
import {
  BulbOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  CloudOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import { useTheme } from '../../context/ThemeContext';

const { Text, Paragraph } = Typography;

const SECTION_ICONS = {
  当日金句: BulbOutlined,
  日程提醒: CalendarOutlined,
  习惯提醒: CheckCircleOutlined,
  天气与穿戴: CloudOutlined,
};

const SECTION_COLORS = {
  当日金句: '#722ed1',
  日程提醒: '#1890ff',
  习惯提醒: '#52c41a',
  天气与穿戴: '#13c2c2',
};

function parseSuggestionSections(raw) {
  if (!raw || typeof raw !== 'string') return [];
  const parts = raw.split(/\*\*([^*]+)\*\*/);
  const sections = [];
  const lead = (parts[0] || '').trim();
  if (lead) sections.push({ title: null, content: lead });
  for (let i = 1; i < parts.length; i += 2) {
    const title = (parts[i] || '').trim();
    const content = (parts[i + 1] || '').trim();
    if (title) sections.push({ title, content });
  }
  return sections;
}

export default function SuggestionDisplay({ text }) {
  const { isDark } = useTheme();
  const { token } = theme.useToken();
  const sections = parseSuggestionSections(text);
  if (!sections.length) return null;

  const dividerBorder = isDark ? token.colorBorderSecondary : 'rgba(0,0,0,0.06)';
  const quoteBg = isDark
    ? 'linear-gradient(90deg, rgba(114, 46, 209, 0.15) 0%, transparent 100%)'
    : 'linear-gradient(90deg, rgba(114, 46, 209, 0.06) 0%, transparent 100%)';
  const quoteColor = isDark ? token.colorText : 'rgba(0,0,0,0.85)';

  return (
    <div className="suggestion-display">
      {sections.map((s, i) => {
        const isQuote = s.title === '当日金句';
        const Icon = s.title ? SECTION_ICONS[s.title] || FileTextOutlined : null;
        const color = s.title ? SECTION_COLORS[s.title] : undefined;

        if (!s.title) {
          return (
            <React.Fragment key={i}>
              <Paragraph type="secondary" style={{ marginBottom: 0, whiteSpace: 'pre-wrap' }}>
                {s.content}
              </Paragraph>
              {sections.length > 1 && (
                <Divider style={{ margin: '16px 0', borderColor: dividerBorder }} />
              )}
            </React.Fragment>
          );
        }

        const sectionStyle = {
          paddingLeft: 4,
          ...(isQuote
            ? {
                padding: '12px 16px',
                marginLeft: -4,
                background: quoteBg,
                borderLeft: `4px solid ${color || '#722ed1'}`,
                borderRadius: '0 8px 8px 0',
              }
            : {}),
        };

        return (
          <React.Fragment key={i}>
            <div style={sectionStyle}>
              <Space align="flex-start" size={8} style={{ marginBottom: 8 }}>
                {Icon && <Icon style={{ color, fontSize: 16, marginTop: 4 }} />}
                <Text strong style={{ fontSize: 15, color }}>
                  {s.title}
                </Text>
              </Space>
              <Paragraph
                style={{
                  margin: 0,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  lineHeight: 1.75,
                  color: isQuote ? quoteColor : undefined,
                }}
              >
                {s.content}
              </Paragraph>
            </div>
            {i < sections.length - 1 && (
              <Divider style={{ margin: '16px 0', borderColor: dividerBorder }} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
