import React from 'react';
import {
  ComposedChart, Line, Area, XAxis, YAxis, ReferenceLine, ReferenceArea, CartesianGrid,
  ResponsiveContainer, Tooltip, Label,
} from 'recharts';
import { wilsonInterval, niceTicks } from '../lib/chartMath';

function monthAbbr(ym) {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'short' });
}

const KIND_STYLE = {
  staffing: { band: '#b8860b', label: 'Staffing' },
  intervention: { band: '#2c6b4f', label: 'Intervention' },
  process: { band: '#3d6690', label: 'Process change' },
  external: { band: '#7a5c8d', label: 'External' },
  other: { band: '#52626e', label: 'Note' },
};

function RunChartTooltip({ active, payload, label, composite }) {
  if (!active || !payload || !payload.length) return null;
  const point = payload.find((p) => p.dataKey === 'pct');
  if (!point || point.value === null || point.value === undefined) return null;
  const { low, high, total, audits, metricsContributing } = point.payload;
  return (
    <div className="bg-surface border border-rule px-2 py-1.5 text-xs shadow-sm">
      <div className="text-text-muted">{label}</div>
      {composite ? (
        <div className="font-semibold text-ink">
          {point.value}%{' '}
          <span className="font-normal text-text-muted">
            (weighted across {metricsContributing} metrics · {audits} audits)
          </span>
        </div>
      ) : (
        <div className="font-semibold text-ink">
          {point.value}% <span className="font-normal text-text-muted">(95% CI {low}–{high}, n={total})</span>
        </div>
      )}
    </div>
  );
}

// One semester's month-over-month improvement, standing entirely on its
// own - no reference to, or pairing with, any other semester. The point is
// to show whether compliance climbed across the months volunteers were
// actually active that term, not to invite a Fall-vs-Spring read, which
// would conflate too many other differences (cohort, patients, program
// maturity) to mean anything reliable.
//
// `annotations` overlay real program events (staffing changes, leadership
// interventions) onto the months they affected - annotating run charts with
// the events behind a shift is standard QI practice, and without it a reader
// can't tell a care problem from a staffing gap.
export default function SemesterMonthChart({ label, months, series, target, big = false, showGoal = true, annotations = [] }) {
  const seriesByMonth = {};
  series.forEach((s) => { seriesByMonth[s.month] = s; });

  // A category series is a weighted blend of several different proportions,
  // not a single binomial one - so a Wilson interval simply doesn't apply to
  // it. Composite series get no confidence band; per-metric series, which
  // ARE a single proportion, still do.
  const composite = series.some((s) => s.metricsContributing !== undefined);

  const data = months.map((mo) => {
    const cell = seriesByMonth[mo];
    if (!cell || cell.pct === null || cell.pct === undefined) {
      return { month: monthAbbr(mo), pct: null, low: null, high: null, total: 0, band: null };
    }
    if (composite) {
      return {
        month: monthAbbr(mo), pct: cell.pct, low: null, high: null, band: null,
        audits: cell.audits, metricsContributing: cell.metricsContributing,
      };
    }
    const ci = wilsonInterval(cell.compliant, cell.total);
    return { month: monthAbbr(mo), pct: cell.pct, low: ci.low, high: ci.high, total: cell.total, band: [ci.low, ci.high] };
  });
  const withData = data.filter((d) => d.pct !== null);
  const first = withData[0];
  const last = withData[withData.length - 1];
  const delta = first && last && first !== last ? Math.round((last.pct - first.pct) * 10) / 10 : null;
  const values = composite
    ? withData.map((d) => d.pct)
    : data.flatMap((d) => (d.pct !== null ? [d.low, d.high] : []));
  const boundsForScale = showGoal ? [...values, target] : values;
  const { ticks, domain } = values.length ? niceTicks(Math.min(...boundsForScale), Math.max(...boundsForScale)) : { ticks: [0, 50, 100], domain: [0, 100] };

  if (withData.length === 0) return null; // nothing tracked this semester - omit rather than show an empty chart

  // Only annotations that actually overlap this semester's months, clipped to
  // the visible window so a multi-month event doesn't run off the chart edge.
  const visible = annotations
    .map((a) => {
      const overlap = months.filter((m) => m >= a.start_month && m <= a.end_month);
      if (overlap.length === 0) return null;
      return { ...a, from: monthAbbr(overlap[0]), to: monthAbbr(overlap[overlap.length - 1]) };
    })
    .filter(Boolean);

  return (
    <div className={`bg-surface border border-rule rounded ${big ? 'p-4' : 'p-3'}`}>
      <div className="flex items-baseline justify-between gap-2 mb-2">
        <h4 className={big ? 'text-sm font-medium text-text-muted' : 'text-xs font-medium text-text-muted leading-tight'}>{label}</h4>
        {delta !== null && (
          <span className={`text-xs font-semibold flex-shrink-0 ${delta >= 0 ? 'text-status-good' : 'text-status-bad'}`}>{delta >= 0 ? '+' : ''}{delta} pts this semester</span>
        )}
      </div>
      <div className={big ? 'h-56' : 'h-32'}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 10, right: 14, left: 4, bottom: 0 }}>
            <CartesianGrid stroke="#e4e8eb" strokeDasharray="0" vertical={false} />
            {visible.map((a) => (
              <ReferenceArea
                key={`ann-${a.id}`}
                x1={a.from}
                x2={a.to}
                fill={(KIND_STYLE[a.kind] || KIND_STYLE.other).band}
                fillOpacity={0.09}
                stroke={(KIND_STYLE[a.kind] || KIND_STYLE.other).band}
                strokeOpacity={0.35}
                strokeDasharray="3 3"
                ifOverflow="extendDomain"
              />
            ))}
            <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#52626e' }} axisLine={{ stroke: '#d7dce1' }} tickLine={false} interval={0} />
            <YAxis domain={domain} ticks={ticks} tick={{ fontSize: 10, fill: '#52626e' }} width={34} axisLine={false} tickLine={false} />
            {showGoal && (
              <ReferenceLine y={target} stroke="#52626e" strokeDasharray="4 3" strokeWidth={1.25}>
                <Label value="Goal" position="insideTopRight" fontSize={9} fill="#52626e" />
              </ReferenceLine>
            )}
            <Tooltip content={<RunChartTooltip composite={composite} />} />
            {!composite && <Area dataKey="band" stroke="none" fill="#3d6690" fillOpacity={0.12} connectNulls isAnimationActive={false} />}
            <Line type="linear" dataKey="pct" stroke="#12283b" strokeWidth={2.25} dot={{ r: 3.5, fill: '#12283b', strokeWidth: 0 }} activeDot={{ r: 5 }} connectNulls isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      {visible.length > 0 && (
        <ul className="mt-2 space-y-1 border-t border-rule pt-2">
          {visible.map((a) => (
            <li key={a.id} className="text-[11px] text-text-muted flex gap-1.5">
              <span
                className="mt-1 h-2 w-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: (KIND_STYLE[a.kind] || KIND_STYLE.other).band }}
                aria-hidden="true"
              />
              <span>
                <span className="font-medium text-ink">{a.title}</span>
                {a.detail ? <span className="text-text-dim"> — {a.detail}</span> : null}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
