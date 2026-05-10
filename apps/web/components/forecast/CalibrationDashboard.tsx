'use client';

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { colors } from '@syntra/ui/tokens';

export interface CalibrationForecastRecord {
  id: string;
  indicator_type: string;
  probability_pct: number;
  actual_outcome: 'occurred' | 'did_not_occur' | null;
  brier_score: number | null;
  expires_at: string | Date;
}

export interface CalibrationBin {
  bin: string;
  predictedMidpoint: number;
  forecastCount: number;
  actualOutcomeRate: number;
}

export interface RollingBrierPoint {
  date: string;
  rollingBrier: number;
  forecastCount: number;
}

function toDate(value: string | Date): Date {
  return value instanceof Date ? value : new Date(value);
}

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function aggregateCalibrationBins(forecasts: CalibrationForecastRecord[]): CalibrationBin[] {
  const bins = new Map<number, { total: number; occurred: number }>();

  for (const forecast of forecasts) {
    if (forecast.actual_outcome === null) continue;
    const lower = Math.min(90, Math.max(0, Math.floor(forecast.probability_pct / 10) * 10));
    const bucket = bins.get(lower) ?? { total: 0, occurred: 0 };
    bucket.total += 1;
    if (forecast.actual_outcome === 'occurred') bucket.occurred += 1;
    bins.set(lower, bucket);
  }

  return [...bins.entries()]
    .sort(([a], [b]) => a - b)
    .map(([lower, bucket]) => ({
      bin: `${lower}-${lower + 9}%`,
      predictedMidpoint: lower + 5,
      forecastCount: bucket.total,
      actualOutcomeRate: Math.round((bucket.occurred / bucket.total) * 1000) / 10,
    }));
}

export function computeRollingBrierSeries(
  forecasts: CalibrationForecastRecord[],
  windowDays: number,
): Record<string, RollingBrierPoint[]> {
  const grouped = forecasts
    .filter(f => f.brier_score !== null)
    .reduce<Record<string, CalibrationForecastRecord[]>>((acc, forecast) => {
      (acc[forecast.indicator_type] ??= []).push(forecast);
      return acc;
    }, {});

  return Object.fromEntries(Object.entries(grouped).map(([indicatorType, records]) => {
    const sorted = [...records].sort((a, b) => toDate(a.expires_at).getTime() - toDate(b.expires_at).getTime());
    const series = sorted.map((forecast) => {
      const currentDate = toDate(forecast.expires_at);
      const windowStart = new Date(currentDate.getTime() - windowDays * 86400_000);
      const monthStart = new Date(Date.UTC(currentDate.getUTCFullYear(), currentDate.getUTCMonth(), 1));
      const effectiveStart = windowStart > monthStart ? windowStart : monthStart;
      const windowRecords = sorted.filter(candidate => {
        const candidateDate = toDate(candidate.expires_at);
        return candidateDate >= effectiveStart && candidateDate <= currentDate;
      });
      const rollingBrier = windowRecords.reduce((acc, item) => acc + (item.brier_score ?? 0), 0) / windowRecords.length;

      return {
        date: dateKey(currentDate),
        rollingBrier,
        forecastCount: windowRecords.length,
      };
    });

    return [indicatorType, series];
  }));
}

function CalibrationTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; payload?: CalibrationBin }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div
      style={{
        background: colors.bg.surface2,
        border: `1px solid ${colors.border.default}`,
        borderRadius: '4px',
        padding: '8px 10px',
        fontSize: 12,
      }}
    >
      <div style={{ color: colors.text.secondary, marginBottom: 4 }}>{label}</div>
      {payload.map(item => (
        <div key={item.name} style={{ color: colors.text.primary, fontFamily: 'monospace' }}>
          {item.name}: {Number(item.value).toFixed(1)}%
        </div>
      ))}
      {row && (
        <div style={{ color: colors.text.muted, marginTop: 4 }}>
          {row.forecastCount} resolved
        </div>
      )}
    </div>
  );
}

export function CalibrationDashboard({ forecasts }: { forecasts: CalibrationForecastRecord[] }) {
  const bins = aggregateCalibrationBins(forecasts);

  if (bins.length === 0) {
    return (
      <section className="bg-bg-surface border border-border-subtle rounded-md p-6">
        <h2 className="text-base font-medium text-text-primary m-0">Calibration</h2>
        <p className="mt-2 text-sm text-text-muted">
          No resolved forecasts available for reliability analysis.
        </p>
      </section>
    );
  }

  const chartData = bins.map(bin => ({
    ...bin,
    perfectCalibration: bin.predictedMidpoint,
  }));
  const total = bins.reduce((acc, bin) => acc + bin.forecastCount, 0);

  return (
    <section className="bg-bg-surface border border-border-subtle rounded-md p-4">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h2 className="text-base font-medium text-text-primary m-0">Calibration</h2>
          <p className="mt-1 text-xs text-text-muted">
            Reliability diagram across {total} resolved forecasts.
          </p>
        </div>
        <div className="text-right">
          <div className="text-xs text-text-muted">Bins</div>
          <div className="text-lg font-mono text-text-primary">{bins.length}</div>
        </div>
      </div>

      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 8, right: 12, bottom: 4, left: -12 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={colors.border.subtle} />
            <XAxis
              dataKey="bin"
              tick={{ fill: colors.text.muted, fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fill: colors.text.muted, fontSize: 11, fontFamily: 'monospace' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(value) => `${value}%`}
            />
            <Tooltip content={<CalibrationTooltip />} />
            <Legend
              iconType="plainline"
              wrapperStyle={{ color: colors.text.secondary, fontSize: 12 }}
            />
            <Line
              type="linear"
              dataKey="perfectCalibration"
              name="Predicted"
              stroke={colors.text.muted}
              strokeDasharray="4 4"
              dot={false}
              strokeWidth={1.5}
            />
            <Line
              type="linear"
              dataKey="actualOutcomeRate"
              name="Observed"
              stroke={colors.accent.DEFAULT}
              strokeWidth={2}
              dot={{ r: 3, fill: colors.accent.DEFAULT }}
              activeDot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
