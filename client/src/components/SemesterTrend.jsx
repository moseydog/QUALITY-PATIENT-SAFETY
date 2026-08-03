import React from 'react';
import {
  ComposedChart, Line, Area, XAxis, YAxis, ReferenceLine, CartesianGrid,
  ResponsiveContainer, Tooltip, Label,
} from 'recharts';
import { wilsonInterval, niceTicks } from '../lib/chartMath';

const FALL_MONTHS = ['2025-09', '2025-10', '2025-11', '2025-12'];
const SPRING_MONTHS = ['2026-01', '2026-02', '2026-03', '2026-04'];

function monthAbbr(ym) {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'short' });
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

function SemesterPanel({ semesterLabel, months, seriesByMonth, target }) {
  const data = months.map((mo) => {
    const cell = seriesByMonth[mo];
    if (!cell || cell.pct === null || cell.pct === undefined) {
      return { month: monthAbbr(mo), pct: null, low: null, high: null, total: 0, band: null };
    }
    const ci = wilsonInterval(cell.compliant, cell.total);
    return { month: monthAbbr(mo), pct: cell.pct, low: ci.low, high: ci.high, total: cell.total, band: [ci.low, ci.high] };
  });
  const withData = data.filter((d) => d.pct !== null);
  const first = withData[0];
  const last = withData[withData.length - 1];
  const delta = first && last && first !== last ? Math.round((last.pct - first.pct) * 10) / 10 : null;
  const values = data.flatMap((d) => (d.pct !== null ? [d.low, d.high] : []));
  const { ticks, domain } = values.length ? niceTicks(Math.min(...values, target), Math.max(...values, target)) : { ticks: [0, 50, 100], domain: [0, 100] };

  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <p className="text-[11px] font-semibold text-text-muted uppercase tracking-wide">{semesterLabel}</p>
        {delta !== null && (
          <span className={`text-xs font-semibold ${delta >= 0 ? 'text-status-good' : 'text-status-bad'}`}>{delta >= 0 ? '+' : ''}{delta} pts</span>
        )}
      </div>
      {withData.length === 0 ? (
        <div className="h-28 flex items-center justify-center text-xs text-text-dim border border-dashed border-rule rounded">Not tracked this semester</div>
      ) : (
        <div className="h-28">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 8, right: 10, left: 2, bottom: 0 }}>
              <CartesianGrid stroke="#e4e8eb" strokeDasharray="0" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 9, fill: '#52626e' }} axisLine={{ stroke: '#d7dce1' }} tickLine={false} interval={0} />
              <YAxis domain={domain} ticks={ticks} tick={{ fontSize: 9, fill: '#52626e' }} width={30} axisLine={false} tickLine={false} />
              <ReferenceLine y={target} stroke="#52626e" strokeDasharray="4 3" strokeWidth={1} />
              <Tooltip content={<RunChartTooltip />} />
              <Area dataKey="band" stroke="none" fill="#3d6690" fillOpacity={0.12} connectNulls isAnimationActive={false} />
              <Line type="linear" dataKey="pct" stroke="#12283b" strokeWidth={2} dot={{ r: 2.75, fill: '#12283b', strokeWidth: 0 }} activeDot={{ r: 4 }} connectNulls isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

// Renders a metric's (or category's) trend as two independent panels, one
// per semester, rather than one continuous line spanning winter break - the
// program goes idle between semesters, so a line drawn straight across that
// gap would visually claim continuity that didn't happen.
export default function SemesterTrend({ label, series, target, big = false }) {
  const seriesByMonth = {};
  series.forEach((s) => { seriesByMonth[s.month] = s; });
  return (
    <div className={`bg-surface border border-rule rounded ${big ? 'p-4' : 'p-3'}`}>
      <h4 className={big ? 'text-xs font-semibold text-text-muted uppercase tracking-wide mb-2' : 'text-xs font-medium text-text-muted leading-tight mb-2'}>{label}</h4>
      <div className="grid grid-cols-2 gap-3">
        <SemesterPanel semesterLabel="Fall 2025 (Sep–Dec)" months={FALL_MONTHS} seriesByMonth={seriesByMonth} target={target} />
        <SemesterPanel semesterLabel="Spring 2026 (Jan–Apr)" months={SPRING_MONTHS} seriesByMonth={seriesByMonth} target={target} />
      </div>
    </div>
  );
}
