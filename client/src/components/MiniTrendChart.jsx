import React, { useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, ReferenceLine, ReferenceArea,
  ResponsiveContainer, Tooltip,
} from 'recharts';

function formatMonthShort(ym) {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'short' });
}

function JournalTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length || payload[0].value === null || payload[0].value === undefined) return null;
  return (
    <div className="bg-white border border-slate-300 px-2 py-1 text-xs shadow-sm">
      <span className="text-slate-500">{label}: </span>
      <span className="font-medium text-slate-800">{payload[0].value}%</span>
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

  return (
    <div className="bg-white border border-slate-200 rounded p-3">
      <div className="flex items-baseline justify-between gap-2 mb-1">
        <h4 className="text-[11px] font-medium text-slate-600 leading-tight">{metric.label}</h4>
        {latest && <span className="text-sm font-semibold text-slate-800 flex-shrink-0">{Math.round(latest.pct)}%</span>}
      </div>
      {!hasData ? (
        <div className="h-24 flex items-center justify-center text-xs text-slate-300">No dated data</div>
      ) : (
        <div className="h-24">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 4, right: 6, left: -28, bottom: 0 }}>
              <ReferenceArea y1={0} y2={metric.target} fill="#fef2f2" fillOpacity={0.6} />
              <XAxis dataKey="month" tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={{ stroke: '#e2e8f0' }} tickLine={false} interval={0} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: '#94a3b8' }} width={26} axisLine={false} tickLine={false} ticks={[0, 50, 100]} />
              <ReferenceLine y={metric.target} stroke="#94a3b8" strokeDasharray="3 3" strokeWidth={1} />
              <Tooltip content={<JournalTooltip />} />
              <Line type="monotone" dataKey="pct" stroke="#1e293b" strokeWidth={1.5} dot={{ r: 2, fill: '#1e293b', strokeWidth: 0 }} activeDot={{ r: 3 }} connectNulls isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
      <div className="text-[10px] text-slate-400 mt-1">Target {metric.target}% · shaded = below target</div>
    </div>
  );
}
