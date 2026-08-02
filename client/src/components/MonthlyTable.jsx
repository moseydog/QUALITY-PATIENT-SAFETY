import React from 'react';
import { LineChart, Line, ReferenceLine } from 'recharts';

const CATEGORY_LABELS = { fall: 'Fall Prevention', hapi: 'HAPI Prevention', education: 'Patient Education' };
const CATEGORY_ORDER = ['fall', 'hapi', 'education'];

function statusColor(pct, target) {
  if (pct === null || pct === undefined) return '#5a5a56';
  if (pct >= target) return '#7a9b85';
  if (pct >= target - 10) return '#b8935a';
  return '#b3574f';
}

function Sparkline({ series, target }) {
  const hasData = series.some((d) => d.pct !== null);
  if (!hasData) return <span className="text-xs text-text-dim">—</span>;
  return (
    <LineChart width={92} height={26} data={series} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
      <ReferenceLine y={target} stroke="#4a4a46" strokeWidth={1} strokeDasharray="2 2" />
      <Line type="monotone" dataKey="pct" stroke="#f2f2f0" strokeWidth={1.25} dot={false} connectNulls isAnimationActive={false} />
    </LineChart>
  );
}

export default function MonthlyTable({ data, targets, monthsToShow = 6 }) {
  if (!data || !data.months || data.months.length === 0) {
    return <p className="text-sm text-text-dim">No dated audits yet.</p>;
  }
  const months = data.months.slice(-monthsToShow);
  const first = months[0];
  const last = months[months.length - 1];

  return (
    <div className="bg-surface border-t-2 border-b border-ink overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-ink text-text-muted text-xs uppercase tracking-wide">
            <th className="text-left px-3 py-2 font-medium border-r border-rule">Metric</th>
            <th className="text-left px-3 py-2 font-medium border-r border-rule">Trend</th>
            <th className="text-right px-3 py-2 font-medium border-r border-rule">Latest</th>
            <th className="text-right px-3 py-2 font-medium">Δ, 6mo</th>
          </tr>
        </thead>
        <tbody>
          {CATEGORY_ORDER.map((cat) => {
            const rows = data.metrics.filter((m) => m.category === cat);
            if (rows.length === 0) return null;
            return (
              <React.Fragment key={cat}>
                <tr className="bg-surface-2">
                  <td colSpan={4} className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-text-muted border-b border-rule">
                    {CATEGORY_LABELS[cat]}
                  </td>
                </tr>
                {rows.map((m) => {
                  const target = targets[m.key];
                  const series = months.map((mo) => ({ month: mo, pct: m.byMonth[mo] ?? null }));
                  const latest = m.byMonth[last];
                  const prior = m.byMonth[first];
                  const delta = latest !== null && latest !== undefined && prior !== null && prior !== undefined
                    ? Math.round((latest - prior) * 10) / 10 : null;
                  return (
                    <tr key={m.key} className="border-t border-rule">
                      <td className="px-3 py-1.5 text-ink border-r border-rule whitespace-nowrap">{m.label}</td>
                      <td className="px-3 py-1 border-r border-rule">
                        <Sparkline series={series} target={target} />
                      </td>
                      <td className="px-3 py-1.5 text-right border-r border-rule tabular-nums font-medium" style={{ color: statusColor(latest, target) }}>
                        {latest !== null && latest !== undefined ? `${Math.round(latest)}%` : '—'}
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-text-muted">
                        {delta === null ? '—' : `${delta > 0 ? '+' : ''}${delta}`}
                      </td>
                    </tr>
                  );
                })}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
      <div className="px-3 py-1.5 text-[11px] text-text-dim border-t border-rule">
        Trend spans {months.length} months ({first} to {last}); dashed reference in each sparkline is that metric's target.
      </div>
    </div>
  );
}
