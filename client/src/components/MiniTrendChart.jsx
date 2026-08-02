import React, { useMemo } from 'react';
import {
  ComposedChart, Line, Area, XAxis, YAxis, ReferenceLine, CartesianGrid,
  ResponsiveContainer, Tooltip, Label,
} from 'recharts';
import { wilsonInterval, niceTicks } from '../lib/chartMath';

function formatMonthShort(ym) {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'short' });
}

function RunChartTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  const point = payload.find((p) => p.dataKey === 'pct');
  if (!point || point.value === null || point.value === undefined) return null;
  const { low, high, n } = point.payload;
  return (
    <div className="bg-surface border border-rule px-2 py-1.5 text-xs shadow-sm">
      <div className="text-text-muted">{label}</div>
      <div className="font-semibold text-ink">{point.value}% <span className="font-normal text-text-muted">(95% CI {low}–{high}, n={n})</span></div>
    </div>
  );
}

export default function MiniTrendChart({ metric, monthlyData, monthsToShow = 8 }) {
  const data = useMemo(() => {
    if (!monthlyData) return [];
    const full = monthlyData.metrics.find((m) => m.key === metric.key);
    if (!full) return [];
    return monthlyData.months.slice(-monthsToShow).map((mo) => {
      const cell = full.byMonth[mo];
      if (!cell) return { month: formatMonthShort(mo), pct: null, low: null, high: null, n: 0, band: null };
      const ci = wilsonInterval(cell.compliant, cell.total);
      return {
        month: formatMonthShort(mo), pct: cell.pct, low: ci.low, high: ci.high, n: cell.total,
        band: [ci.low, ci.high],
      };
    });
  }, [metric, monthlyData, monthsToShow]);

  const hasData = data.some((d) => d.pct !== null);
  const latest = [...data].reverse().find((d) => d.pct !== null);
  const values = data.flatMap((d) => (d.pct !== null ? [d.low, d.high] : []));
  const { ticks, domain } = niceTicks(
    Math.min(...values, metric.target),
    Math.max(...values, metric.target)
  );

  return (
    <div className="bg-surface border border-rule rounded p-3">
      <div className="flex items-baseline justify-between gap-2 mb-2">
        <h4 className="text-xs font-medium text-text-muted leading-tight">{metric.label}</h4>
        {latest && <span className="text-lg font-bold text-ink flex-shrink-0">{Math.round(latest.pct)}%</span>}
      </div>
      {!hasData ? (
        <div className="h-36 flex items-center justify-center text-xs text-text-dim">Not enough audits yet to chart</div>
      ) : (
        <div className="h-36">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 6, right: 12, left: 4, bottom: 0 }}>
              <CartesianGrid stroke="#e4e8eb" strokeDasharray="0" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#52626e' }} axisLine={{ stroke: '#d7dce1' }} tickLine={false} interval={0} />
              <YAxis domain={domain} ticks={ticks} tick={{ fontSize: 10, fill: '#52626e' }} width={34} axisLine={false} tickLine={false} />
              <ReferenceLine y={metric.target} stroke="#52626e" strokeDasharray="4 3" strokeWidth={1.25}>
                <Label value="Goal" position="insideTopRight" fontSize={9} fill="#52626e" />
              </ReferenceLine>
              <Tooltip content={<RunChartTooltip />} />
              <Area dataKey="band" stroke="none" fill="#3d6690" fillOpacity={0.12} connectNulls isAnimationActive={false} />
              <Line type="linear" dataKey="pct" stroke="#12283b" strokeWidth={2} dot={{ r: 3, fill: '#12283b', strokeWidth: 0 }} activeDot={{ r: 4 }} connectNulls isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
      <div className="text-[10px] text-text-dim mt-1">Goal {metric.target}% · shaded band is the 95% confidence interval · months under 10 audits omitted</div>
    </div>
  );
}
