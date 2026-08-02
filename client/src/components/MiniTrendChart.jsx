import React, { useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, ReferenceLine,
  ResponsiveContainer, Tooltip,
} from 'recharts';

function formatMonthShort(ym) {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'short' });
}

function PanelTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length || payload[0].value === null || payload[0].value === undefined) return null;
  return (
    <div className="bg-black border border-panel-rule px-2 py-1 text-xs">
      <span className="text-panel-muted">{label}: </span>
      <span className="font-medium text-panel-text">{payload[0].value}%</span>
    </div>
  );
}

export default function MiniTrendChart({ metric, monthlyData, monthsToShow = 6 }) {
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
  const pad = Math.max(3, (hi - lo) * 0.2);
  const domain = [Math.max(0, Math.floor(lo - pad)), Math.min(100, Math.ceil(hi + pad))];

  return (
    <div className="bg-panel p-3">
      <div className="flex items-baseline justify-between gap-2 mb-1">
        <h4 className="text-[11px] font-medium text-panel-muted leading-tight">{metric.label}</h4>
        {latest && <span className="text-lg font-bold text-panel-text flex-shrink-0">{Math.round(latest.pct)}%</span>}
      </div>
      {!hasData ? (
        <div className="h-24 flex items-center justify-center text-xs text-panel-muted">No dated data</div>
      ) : (
        <div className="h-24">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 4, right: 6, left: -8, bottom: 0 }}>
              <XAxis dataKey="month" tick={{ fontSize: 9, fill: '#8f8f89' }} axisLine={{ stroke: '#333330' }} tickLine={false} interval={0} />
              <YAxis domain={domain} tick={{ fontSize: 9, fill: '#8f8f89' }} width={30} axisLine={false} tickLine={false} />
              <ReferenceLine y={metric.target} stroke="#55554f" strokeDasharray="3 3" strokeWidth={1} />
              <Tooltip content={<PanelTooltip />} />
              <Line type="monotone" dataKey="pct" stroke="#f4f4f0" strokeWidth={1.75} dot={{ r: 2, fill: '#f4f4f0', strokeWidth: 0 }} activeDot={{ r: 3 }} connectNulls isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
      <div className="text-[10px] text-panel-muted mt-1">Target {metric.target}% · dashed line marks it</div>
    </div>
  );
}
