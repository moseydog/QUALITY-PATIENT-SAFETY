import React, { useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, ReferenceLine, CartesianGrid,
  ResponsiveContainer, Tooltip, Label,
} from 'recharts';

function formatMonthShort(ym) {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'short' });
}

function RunChartTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length || payload[0].value === null || payload[0].value === undefined) return null;
  return (
    <div className="bg-surface border border-rule px-2 py-1 text-xs shadow-sm">
      <span className="text-text-muted">{label}: </span>
      <span className="font-semibold text-ink">{payload[0].value}%</span>
    </div>
  );
}

export default function MiniTrendChart({ metric, monthlyData, monthsToShow = 8 }) {
  const data = useMemo(() => {
    if (!monthlyData) return [];
    const full = monthlyData.metrics.find((m) => m.key === metric.key);
    if (!full) return [];
    return monthlyData.months.slice(-monthsToShow).map((mo) => ({
      month: formatMonthShort(mo),
      pct: full.byMonth[mo] !== undefined && full.byMonth[mo] !== null ? full.byMonth[mo] : null,
    }));
  }, [metric, monthlyData, monthsToShow]);

  const hasData = data.some((d) => d.pct !== null);
  const latest = [...data].reverse().find((d) => d.pct !== null);
  const values = data.map((d) => d.pct).filter((v) => v !== null);
  const withTarget = [...values, metric.target];
  const lo = Math.min(...withTarget);
  const hi = Math.max(...withTarget);
  const pad = Math.max(4, (hi - lo) * 0.2);
  const domain = [Math.max(0, Math.floor(lo - pad)), Math.min(100, Math.ceil(hi + pad))];

  return (
    <div className="bg-surface border border-rule rounded p-3">
      <div className="flex items-baseline justify-between gap-2 mb-2">
        <h4 className="text-xs font-medium text-text-muted leading-tight">{metric.label}</h4>
        {latest && <span className="text-lg font-bold text-ink flex-shrink-0">{Math.round(latest.pct)}%</span>}
      </div>
      {!hasData ? (
        <div className="h-32 flex items-center justify-center text-xs text-text-dim">Not enough audits yet to chart</div>
      ) : (
        <div className="h-32">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 6, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid stroke="#dde2e7" strokeDasharray="0" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#5b6b78' }} axisLine={{ stroke: '#dde2e7' }} tickLine={false} interval={0} />
              <YAxis domain={domain} tick={{ fontSize: 10, fill: '#5b6b78' }} width={30} axisLine={false} tickLine={false} />
              <ReferenceLine y={metric.target} stroke="#5b6b78" strokeDasharray="4 3" strokeWidth={1.25}>
                <Label value="Goal" position="insideTopRight" fontSize={9} fill="#5b6b78" />
              </ReferenceLine>
              <Tooltip content={<RunChartTooltip />} />
              <Line type="linear" dataKey="pct" stroke="#16324a" strokeWidth={2} dot={{ r: 3, fill: '#16324a', strokeWidth: 0 }} activeDot={{ r: 4 }} connectNulls isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
      <div className="text-[10px] text-text-dim mt-1">Goal: {metric.target}% · each point is one month's audits (months under 10 audits are omitted)</div>
    </div>
  );
}
