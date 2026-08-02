import React from 'react';
import { BarChart, Bar, XAxis, ReferenceLine, Cell, LabelList, ResponsiveContainer } from 'recharts';

function formatMonthShort(ym) {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

function ValueLabel(props) {
  const { x, y, width, value } = props;
  if (value === null || value === undefined) return null;
  return (
    <text x={x + width / 2} y={y - 8} textAnchor="middle" fill="#f2f2f0" fontSize={13} fontWeight={600}>
      {Math.round(value)}%
    </text>
  );
}

export default function PalantirBarChart({ label, series, target, height = 220 }) {
  const data = series.map((d) => ({ ...d, monthLabel: formatMonthShort(d.month) }));
  const first = data.find((d) => d.pct !== null);
  const last = [...data].reverse().find((d) => d.pct !== null);
  const delta = first && last && first !== last ? Math.round((last.pct - first.pct) * 10) / 10 : null;

  return (
    <div className="bg-surface border border-rule p-4">
      <div className="flex items-baseline justify-between mb-4">
        <h3 className="text-sm font-medium text-text-muted uppercase tracking-wide">{label}</h3>
        {delta !== null && (
          <span className={`text-sm font-semibold ${delta >= 0 ? 'text-status-good' : 'text-status-bad'}`}>
            {delta >= 0 ? '+' : ''}{delta} pts since start
          </span>
        )}
      </div>
      <div style={{ width: '100%', height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 24, right: 8, left: 8, bottom: 4 }}>
            <XAxis dataKey="monthLabel" tick={{ fontSize: 10, fill: '#8a8a86' }} axisLine={{ stroke: '#2a2a2a' }} tickLine={false} interval={0} />
            <ReferenceLine y={target} stroke="#5a5a56" strokeDasharray="3 3" strokeWidth={1} />
            <Bar dataKey="pct" radius={[2, 2, 0, 0]} maxBarSize={28} isAnimationActive={false}>
              <LabelList dataKey="pct" content={ValueLabel} />
              {data.map((d, i) => (
                <Cell key={i} fill={d.pct === null ? 'transparent' : (d.pct >= target ? '#f2f2f0' : '#8a8a86')} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="text-[11px] text-text-dim mt-1">Dashed line marks the {target}% target. Bars in dimmer gray are below it.</p>
    </div>
  );
}
