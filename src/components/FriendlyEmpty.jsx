import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Empty, Button } from 'antd';
import { useI18n } from '../context/I18nContext';

const PRESETS = {
  habits: {
    description: '还没有习惯呢，去创建第一个吧 ~',
    actionLabel: '新建习惯',
    actionPath: '/habits',
  },
  schedule: {
    description: '今日暂无安排，好好享受自由时光',
    actionLabel: '添加日程',
    actionPath: '/schedule',
  },
  schedulePeriod: {
    description: '当前时段暂无待完成的习惯，休息一下也不错',
    actionLabel: '看看习惯',
    actionPath: '/habits',
  },
  countdown: {
    description: '还没有倒数或纪念日，点击「新建」添加一个吧',
    actionLabel: '新建',
    actionPath: '/countdown',
  },
  equipment: {
    description: '还没有装备记录，添加你的第一件装备吧',
    actionLabel: '添加装备',
    actionPath: '/equipment',
  },
  clothing: {
    description: '还没有服装数据，先添加几件常穿的～',
    actionLabel: '添加服装',
    actionPath: '/clothing',
  },
  outfits: {
    description: '还没有搭配记录，试试搭配一套吧～',
    actionLabel: '新建搭配',
    actionPath: null,
  },
  news: {
    description: '暂无新闻数据，稍后再来看看',
    actionLabel: null,
    actionPath: null,
  },
  newsSearch: {
    description: '输入关键词搜索一下',
    actionLabel: null,
    actionPath: null,
  },
  habitsStats: {
    description: '该周期暂无打卡数据，完成习惯后这里会有记录～',
    actionLabel: null,
    actionPath: null,
  },
  equipmentNoResult: {
    description: '没有找到匹配的装备，试试其他关键词吧',
    actionLabel: null,
    actionPath: null,
  },
  outfitsNoRecommend: {
    description: '暂无推荐搭配，先添加一些服装和搭配吧～',
    actionLabel: null,
    actionPath: null,
  },
  outfitsLink: {
    description: '搭配管理在「搭配」页，去看看吧～',
    actionLabel: '前往搭配管理',
    actionPath: '/outfits',
  },
  generic: {
    description: '这里还没有内容，去别处逛逛吧',
    actionLabel: null,
    actionPath: null,
  },
};

/**
 * 友好空状态：替换冷冰冰的「暂无数据」，带贴心文案与可选操作
 * @param {string} context - 预设场景: habits | schedule | schedulePeriod | countdown | equipment | clothing | outfits | news | newsSearch | generic
 * @param {string} [description] - 自定义描述，覆盖预设
 * @param {string} [actionLabel] - 自定义按钮文案
 * @param {function} [onAction] - 点击按钮回调；若同时传 actionPath 则优先 navigate
 * @param {string} [actionPath] - 点击后跳转路径（需配合 useNavigate 传入 onAction 封装）
 * @param {boolean} [simple] - 使用 PRESENTED_IMAGE_SIMPLE
 */
function FriendlyEmpty({
  context = 'generic',
  description,
  actionLabel,
  onAction,
  actionPath,
  simple = true,
}) {
  const navigate = useNavigate();
  const preset = PRESETS[context] || PRESETS.generic;
  const { t } = useI18n();
  const desc =
    description ??
    t(`friendlyEmpty.${context}.description`, preset.description);
  const label =
    actionLabel ??
    (preset.actionLabel
      ? t(`friendlyEmpty.${context}.action`, preset.actionLabel)
      : null);
  const path = actionPath ?? preset.actionPath;

  const handleAction = () => {
    if (onAction) onAction();
    else if (path) navigate(path);
  };

  return (
    <Empty
      image={simple ? Empty.PRESENTED_IMAGE_SIMPLE : undefined}
      description={
        <span style={{ color: 'var(--ant-color-text-secondary)' }}>{desc}</span>
      }
    >
      {label && (onAction || path) && (
        <Button type="primary" size="small" onClick={handleAction}>
          {label}
        </Button>
      )}
    </Empty>
  );
}

export default FriendlyEmpty;
export { PRESETS };
