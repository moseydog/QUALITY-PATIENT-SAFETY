import React from 'react';
import {
  ComposedChart, Line, Area, XAxis, YAxis, ReferenceLine, CartesianGrid,
  ResponsiveContainer, Tooltip, Label,
} from 'recharts';
import { wilsonInterval, niceTicks } from '../lib/chartMath';

function formatMonthShort(ym) {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

function RunChartTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  const point = payload.find((p) => p.dataKey === 'pct');
  if (!point || point.value === null || point.value === undefined) return null;
  const { low, high, total } = point.payload;
  return (
    <div className="bg-surface border border-rule px-2 py-1.5 text-xs shadow-sm">
      <div className="text-text-muted">{label}</div>
      <div className="font-semibold text-ink">{point.value}% <span className="font-normal text-text-muted">(95% CI {low}–{high}, n={total})</span></div>
    </div>
  );
}

export default function CategoryRunChart({ label, series, target, height = 220 }) {
  const data = series.map((d) => {
    const ci = d.pct !== null && d.total > 0 ? wilsonInterval(d.compliant, d.total) : null;
    return { ...d, monthLabel: formatMonthShort(d.month), low: ci ? ci.low : null, high: ci ? ci.high : null, band: ci ? [ci.low, ci.high] : null };
  });
  const withData = data.filter((d) => d.pct !== null);
  const first = withData[0];
  const last = withData[withData.length - 1];
  const delta = first && last && first !== last ? Math.round((last.pct - first.pct) * 10) / 10 : null;
  const values = data.flatMap((d) => (d.pct !== null ? [d.low, d.high] : []));
  const { ticks, domain } = values.length ? niceTicks(Math.min(...values, target), Math.max(...values, target)) : { ticks: [0, 50, 100], domain: [0, 100] };

  return (
    <div className="bg-surface border border-rule rounded p-4">
      <div className="flex items-baseline justify-between mb-2">
        <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wide">{label}</h3>
        {delta !== null && (
          <span className={`text-sm font-semibold ${delta >= 0 ? 'text-status-good' : 'text-status-bad'}`}>
            {delta >= 0 ? '+' : ''}{delta} pts since {formatMonthShort(first.month)}
          </span>
        )}
      </div>
      <div style={{ width: '100%', height }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 10, right: 16, left: 4, bottom: 4 }}>
            <CartesianGrid stroke="#e4e8eb" strokeDasharray="0" vertical={false} />
            <XAxis dataKey="monthLabel" tick={{ fontSize: 10, fill: '#52626e' }} axisLine={{ stroke: '#d7dce1' }} tickLine={false} interval={0} />
            <YAxis domain={domain} ticks={ticks} tick={{ fontSize: 10, fill: '#52626e' }} width={36} axisLine={false} tickLine={false} />
            <ReferenceLine y={target} stroke="#52626e" strokeDasharray="4 3" strokeWidth={1.25}>
              <Label value={`Goal ${target}%`} position="insideTopRight" fontSize={10} fill="#52626e" />
            </ReferenceLine>
            <Tooltip content={<RunChartTooltip />} />
            <Area dataKey="band" stroke="none" fill="#3d6690" fillOpacity={0.12} connectNulls isAnimationActive={false} />
            <Line type="linear" dataKey="pct" stroke="#12283b" strokeWidth={2.25} dot={{ r: 3.5, fill: '#12283b', strokeWidth: 0 }} activeDot={{ r: 5 }} connectNulls isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <p className="text-[11px] text-text-dim mt-1">Weighted average across {label.toLowerCase()} metrics. Shaded band is the 95% confidence interval; months under 10 audits are omitted.</p>
    </div>
  );
}
