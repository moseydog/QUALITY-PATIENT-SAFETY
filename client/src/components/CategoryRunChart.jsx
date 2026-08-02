import React from 'react';
import {
  LineChart, Line, XAxis, YAxis, ReferenceLine, CartesianGrid,
  ResponsiveContainer, Tooltip, Label,
} from 'recharts';

function formatMonthShort(ym) {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
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

export default function CategoryRunChart({ label, series, target, height = 220 }) {
  const data = series.map((d) => ({ ...d, monthLabel: formatMonthShort(d.month) }));
  const withData = data.filter((d) => d.pct !== null);
  const first = withData[0];
  const last = withData[withData.length - 1];
  const delta = first && last && first !== last ? Math.round((last.pct - first.pct) * 10) / 10 : null;

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
          <LineChart data={data} margin={{ top: 10, right: 14, left: -10, bottom: 4 }}>
            <CartesianGrid stroke="#dde2e7" strokeDasharray="0" vertical={false} />
            <XAxis dataKey="monthLabel" tick={{ fontSize: 10, fill: '#5b6b78' }} axisLine={{ stroke: '#dde2e7' }} tickLine={false} interval={0} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#5b6b78' }} axisLine={false} tickLine={false} ticks={[0, 25, 50, 75, 100]} />
            <ReferenceLine y={target} stroke="#5b6b78" strokeDasharray="4 3" strokeWidth={1.25}>
              <Label value={`Goal ${target}%`} position="insideTopRight" fontSize={10} fill="#5b6b78" />
            </ReferenceLine>
            <Tooltip content={<RunChartTooltip />} />
            <Line type="linear" dataKey="pct" stroke="#16324a" strokeWidth={2.25} dot={{ r: 3.5, fill: '#16324a', strokeWidth: 0 }} activeDot={{ r: 5 }} connectNulls isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="text-[11px] text-text-dim mt-1">Weighted average across {label.toLowerCase()} metrics. Months with fewer than 10 audits are omitted rather than plotted.</p>
    </div>
  );
}
