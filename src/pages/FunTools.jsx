import React, { useState, useCallback } from 'react';
import { App, Card, Tabs, Input, Button, Space, Typography, Tag } from 'antd';
import { TeamOutlined, ExperimentOutlined, DollarOutlined, BgColorsOutlined, MessageOutlined } from '@ant-design/icons';
import relationship from 'relationship-ts';
import { LOTTERY_LIST, QUOTE_LIST } from '../constants/fun-tools';
import { useI18n } from '../context/I18nContext';

const { Title, Text, Paragraph } = Typography;

function FunTools() {
  const { message } = App.useApp();
  const { t } = useI18n();
  const [relationInput, setRelationInput] = useState('');
  const [relationResult, setRelationResult] = useState(null);
  const [relationReverse, setRelationReverse] = useState(false);
  const [relationSex, setRelationSex] = useState(1); // 1男 0女 -1未知
  const [lottery, setLottery] = useState(null);
  const [diceResult, setDiceResult] = useState(null);
  const [coinResult, setCoinResult] = useState(null);
  const [quoteText, setQuoteText] = useState(null);

  // 亲戚计算器
  const handleRelationQuery = useCallback(() => {
    const text = (relationInput || '').trim();
    if (!text) {
      message.warning(t('fun.relationship.inputHint', '请输入关系链，如：爸爸的妈妈'));
      return;
    }
    try {
      const res = relationship({ text, reverse: relationReverse, sex: relationSex });
      setRelationResult(Array.isArray(res) ? res : [String(res)]);
    } catch (e) {
      setRelationResult([]);
      message.info(t('fun.relationship.noResult', '未找到对应称谓，可换一种说法试试'));
    }
  }, [relationInput, relationReverse, relationSex, t]);

  // 抽签
  const handleLottery = useCallback(() => {
    const idx = Math.floor(Math.random() * LOTTERY_LIST.length);
    setLottery(LOTTERY_LIST[idx]);
    message.success(t('fun.lottery.drew', '已抽签～'));
  }, [t]);

  // 掷骰子
  const handleDice = useCallback(() => {
    const n = Math.floor(Math.random() * 6) + 1;
    setDiceResult(n);
  }, []);

  // 抛硬币
  const handleCoin = useCallback(() => {
    const side = Math.random() < 0.5 ? 'heads' : 'tails';
    setCoinResult(side);
  }, []);

  // 随机一句
  const handleQuote = useCallback(() => {
    const idx = Math.floor(Math.random() * QUOTE_LIST.length);
    setQuoteText(QUOTE_LIST[idx]);
    message.success(t('fun.quote.drew', '今日份～'));
  }, [t]);

  const tabItems = [
    {
      key: 'relationship',
      label: (
        <span>
          <TeamOutlined /> {t('fun.tabs.relationship', '亲戚计算器')}
        </span>
      ),
      children: (
        <Card size="small" title={t('fun.relationship.title', '关系链 → 称谓')}>
          <Paragraph type="secondary">{t('fun.relationship.desc', '输入亲戚关系链，如：爸爸的妈妈、妈妈的哥哥的老婆')}</Paragraph>
          <Space.Compact style={{ width: '100%', maxWidth: 400 }}>
            <Input
              placeholder={t('fun.relationship.placeholder', '例如：爸爸的妈妈')}
              value={relationInput}
              onChange={(e) => setRelationInput(e.target.value)}
              onPressEnter={handleRelationQuery}
            />
            <Button type="primary" onClick={handleRelationQuery}>
              {t('fun.relationship.query', '查询')}
            </Button>
          </Space.Compact>
          <div style={{ marginTop: 12 }}>
            <Space>
              <label>
                <input type="checkbox" checked={relationReverse} onChange={(e) => setRelationReverse(e.target.checked)} />
                <span style={{ marginLeft: 6 }}>{t('fun.relationship.reverse', '对方称呼我')}</span>
              </label>
              <select value={relationSex} onChange={(e) => setRelationSex(Number(e.target.value))} style={{ padding: '4px 8px' }}>
                <option value={1}>{t('fun.relationship.sexMale', '本人男')}</option>
                <option value={0}>{t('fun.relationship.sexFemale', '本人女')}</option>
                <option value={-1}>{t('fun.relationship.sexUnknown', '未知')}</option>
              </select>
            </Space>
          </div>
          {relationResult !== null && (
            <div style={{ marginTop: 16 }}>
              <Text type="secondary">{t('fun.relationship.result', '称谓')}：</Text>
              <div style={{ marginTop: 8 }}>
                {relationResult.length ? relationResult.map((r, i) => <Tag key={i} color="blue">{r}</Tag>) : <Text type="secondary">{t('fun.relationship.noResult', '未找到')}</Text>}
              </div>
            </div>
          )}
        </Card>
      ),
    },
    {
      key: 'lottery',
      label: (
        <span>
          <ExperimentOutlined /> {t('fun.tabs.lottery', '抽签解签')}
        </span>
      ),
      children: (
        <Card size="small" title={t('fun.lottery.title', '抽一签（娱乐向）')}>
          <Paragraph type="secondary">{t('fun.lottery.desc', '随机抽一签，看看签文与解签，仅供娱乐')}</Paragraph>
          <Button type="primary" size="large" onClick={handleLottery} style={{ marginBottom: 16 }}>
            {t('fun.lottery.button', '抽签')}
          </Button>
          {lottery && (
            <Card type="inner" size="small">
              <div style={{ marginBottom: 8 }}>
                <Text type="secondary">{t('fun.lottery.no', '签号')}：</Text>
                <Tag>{lottery.id}</Tag>
              </div>
              <Paragraph strong style={{ fontSize: 16 }}>{lottery.verse}</Paragraph>
              <div>
                <Text type="secondary">{t('fun.lottery.hint', '解签')}：</Text>
                <Paragraph style={{ marginTop: 4 }}>{lottery.hint}</Paragraph>
              </div>
            </Card>
          )}
        </Card>
      ),
    },
    {
      key: 'dice',
      label: (
        <span>
          <BgColorsOutlined /> {t('fun.tabs.dice', '掷骰子')}
        </span>
      ),
      children: (
        <Card size="small" title={t('fun.dice.title', '掷骰子')}>
          <Paragraph type="secondary">{t('fun.dice.desc', '点一下，掷出 1～6，纯娱乐')}</Paragraph>
          <Button type="primary" size="large" onClick={handleDice} style={{ marginBottom: 16 }}>
            {t('fun.dice.button', '掷一次')}
          </Button>
          {diceResult !== null && (
            <div style={{ fontSize: 48, fontWeight: 'bold', color: '#1890ff' }}>
              🎲 {diceResult}
            </div>
          )}
        </Card>
      ),
    },
    {
      key: 'coin',
      label: (
        <span>
          <DollarOutlined /> {t('fun.tabs.coin', '抛硬币')}
        </span>
      ),
      children: (
        <Card size="small" title={t('fun.coin.title', '抛硬币')}>
          <Paragraph type="secondary">{t('fun.coin.desc', '正面还是反面？交给命运吧')}</Paragraph>
          <Button type="primary" size="large" onClick={handleCoin} style={{ marginBottom: 16 }}>
            {t('fun.coin.button', '抛一次')}
          </Button>
          {coinResult !== null && (
            <Tag color="blue" style={{ fontSize: 20, padding: '8px 16px' }}>
              {coinResult === 'heads' ? '🪙 ' + t('fun.coin.heads', '正面') : '🪙 ' + t('fun.coin.tails', '反面')}
            </Tag>
          )}
        </Card>
      ),
    },
    {
      key: 'quote',
      label: (
        <span>
          <MessageOutlined /> {t('fun.tabs.quote', '随机一句')}
        </span>
      ),
      children: (
        <Card size="small" title={t('fun.quote.title', '随机一句')}>
          <Paragraph type="secondary">{t('fun.quote.desc', '毒鸡汤 / 鸡汤 / 搞笑，来一句')}</Paragraph>
          <Button type="primary" size="large" onClick={handleQuote} style={{ marginBottom: 16 }}>
            {t('fun.quote.button', '来一句')}
          </Button>
          {quoteText && (
            <Card type="inner" size="small">
              <Paragraph strong style={{ fontSize: 16, marginBottom: 0 }}>{quoteText}</Paragraph>
            </Card>
          )}
        </Card>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <Title level={2}>
          <ExperimentOutlined /> {t('fun.pageTitle', '趣味工具')}
        </Title>
        <Text type="secondary">{t('fun.pageDesc', '亲戚计算器、每日签到、抽签解签，提升 DAU 的轻量娱乐')}</Text>
      </div>
      <Tabs items={tabItems} />
    </div>
  );
}

export default FunTools;
