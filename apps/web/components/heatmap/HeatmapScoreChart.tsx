'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { colors } from '@syntra/ui/tokens';

interface HistoryPoint {
  date: string;
  score: number;
}

interface HeatmapScoreChartProps {
  history: HistoryPoint[];
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: colors.bg.surface2,
        border: `1px solid ${colors.border.default}`,
        borderRadius: '4px',
        padding: '8px 12px',
        fontSize: '12px',
        fontFamily: 'inherit',
      }}
    >
      <div style={{ color: colors.text.secondary, marginBottom: 2 }}>{label}</div>
      <div style={{ color: colors.text.primary, fontFamily: 'monospace', fontWeight: 600 }}>
        {payload[0].value} / 100
      </div>
    </div>
  );
}

export function HeatmapScoreChart({ history }: HeatmapScoreChartProps) {
  if (history.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-xs text-text-muted">
        No score history yet — check back after the first scoring cycle.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={history} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke={colors.border.subtle}
          vertical={false}
        />
        <XAxis
          dataKey="date"
          tick={{ fill: colors.text.muted, fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          domain={[0, 100]}
          tick={{ fill: colors.text.muted, fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip content={<CustomTooltip />} />
        <Line
          type="monotone"
          dataKey="score"
          stroke={colors.accent.DEFAULT}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 3, fill: colors.accent.DEFAULT }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
