'use client';

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from 'recharts';
import { colors } from '@syntra/ui/tokens';

interface ChartRow {
  name: string;
  var_usd: number;
  covered_usd: number;
  gap_usd: number;
}

function fmtUsd(v: number) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

export function CoverageChart({ data }: { data: ChartRow[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} barCategoryGap="30%" barGap={4}>
        <CartesianGrid
          strokeDasharray="3 3"
          vertical={false}
          stroke={colors.border.subtle}
        />
        <XAxis
          dataKey="name"
          tick={{ fill: colors.text.secondary, fontSize: 12 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tickFormatter={fmtUsd}
          tick={{ fill: colors.text.muted, fontSize: 11, fontFamily: 'monospace' }}
          axisLine={false}
          tickLine={false}
          width={64}
        />
        <Tooltip
          cursor={{ fill: colors.bg.surface2 }}
          contentStyle={{
            background: colors.bg.surface,
            border: `1px solid ${colors.border.default}`,
            borderRadius: '4px',
            color: colors.text.primary,
            fontSize: 12,
          }}
          formatter={(val: number, name: string) => [fmtUsd(val), name === 'covered_usd' ? 'Covered' : 'Gap']}
        />
        <Legend
          iconType="square"
          wrapperStyle={{ fontSize: 12, color: colors.text.secondary }}
          formatter={(v) => v === 'covered_usd' ? 'Covered' : 'Coverage Gap'}
        />
        <Bar dataKey="covered_usd" name="covered_usd" stackId="a" fill={colors.accent.DEFAULT} radius={[0, 0, 2, 2]} />
        <Bar dataKey="gap_usd" name="gap_usd" stackId="a" fill={colors.severity.high} radius={[2, 2, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
