/**
 * 习惯统计饼图（Recharts）
 * 已完成/未完成颜色与图例统一，深色模式图例可读
 */
import React from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { useI18n } from '../../context/I18nContext';

export const PIE_COLORS = {
  已完成: '#52c41a',
  未完成: '#ff4d4f',
};

const LEGEND_ITEMS = [
  { key: '已完成', color: PIE_COLORS['已完成'], labelKey: 'habits.chart.completed' },
  { key: '未完成', color: PIE_COLORS['未完成'], labelKey: 'habits.chart.uncompleted' },
];

function HabitsPieChart({ data, legendColor, height = 260 }) {
  const { t } = useI18n();
  const getColor = (entry) => PIE_COLORS[entry.status] || '#999';

  return (
    <div className="habits-pie-wrap">
      <ResponsiveContainer width="100%" height={height}>
        <PieChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
          <Pie
            data={data}
            dataKey="value"
            nameKey="type"
            cx="50%"
            cy="50%"
            outerRadius="78%"
            stroke="none"
          >
            {data.map((entry, i) => (
              <Cell key={i} fill={getColor(entry)} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value, name) => [value, name]}
            contentStyle={{ fontSize: 12 }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div
        className="habits-pie-legend"
        style={{
          display: 'flex',
          gap: 16,
          justifyContent: 'center',
          flexWrap: 'wrap',
          marginTop: 8,
        }}
      >
        {LEGEND_ITEMS.map(({ key, color, labelKey }) => (
          <span
            key={key}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              color: legendColor,
              fontSize: 12,
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: color,
                flexShrink: 0,
              }}
            />
            {t(labelKey, key)}
          </span>
        ))}
      </div>
    </div>
  );
}

export default HabitsPieChart;
