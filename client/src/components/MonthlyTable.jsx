import React from 'react';
import { LineChart, Line, ReferenceLine, YAxis } from 'recharts';

const CATEGORY_LABELS = { fall: 'Fall Prevention', hapi: 'HAPI Prevention', education: 'Patient Education' };
const CATEGORY_ORDER = ['fall', 'hapi', 'education'];

function statusColor(pct, target) {
  if (pct === null || pct === undefined) return '#8f8f89';
  if (pct >= target) return '#7fae97';
  if (pct >= target - 10) return '#d1a86a';
  return '#d1857c';
}

function Sparkline({ series, target }) {
  const values = series.map((d) => d.pct).filter((v) => v !== null && v !== undefined);
  if (values.length === 0) return <span className="text-xs text-panel-muted">—</span>;
  const withTarget = [...values, target].filter((v) => v !== undefined && v !== null);
  const lo = Math.min(...withTarget);
  const hi = Math.max(...withTarget);
  const pad = Math.max(2, (hi - lo) * 0.15);
  const domain = [Math.max(0, Math.floor(lo - pad)), Math.min(100, Math.ceil(hi + pad))];
  return (
    <LineChart width={92} height={26} data={series} margin={{ top: 3, right: 2, left: 2, bottom: 3 }}>
      <YAxis hide domain={domain} />
      <ReferenceLine y={target} stroke="#55554f" strokeWidth={1} strokeDasharray="2 2" />
      <Line type="monotone" dataKey="pct" stroke="#f4f4f0" strokeWidth={1.5} dot={{ r: 1.5, fill: '#f4f4f0', strokeWidth: 0 }} connectNulls isAnimationActive={false} />
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
    <div className="bg-panel overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-panel-rule text-panel-muted text-xs uppercase tracking-wide">
            <th className="text-left px-3 py-2 font-medium border-r border-panel-rule">Metric</th>
            <th className="text-left px-3 py-2 font-medium border-r border-panel-rule">Trend</th>
            <th className="text-right px-3 py-2 font-medium border-r border-panel-rule">Latest</th>
            <th className="text-right px-3 py-2 font-medium">Δ, 6mo</th>
          </tr>
        </thead>
        <tbody>
          {CATEGORY_ORDER.map((cat) => {
            const rows = data.metrics.filter((m) => m.category === cat);
            if (rows.length === 0) return null;
            return (
              <React.Fragment key={cat}>
                <tr className="bg-panel-2">
                  <td colSpan={4} className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-panel-muted border-b border-panel-rule">
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
                    <tr key={m.key} className="border-t border-panel-rule">
                      <td className="px-3 py-1.5 text-panel-text border-r border-panel-rule whitespace-nowrap">{m.label}</td>
                      <td className="px-3 py-1 border-r border-panel-rule">
                        <Sparkline series={series} target={target} />
                      </td>
                      <td className="px-3 py-1.5 text-right border-r border-panel-rule tabular-nums font-bold" style={{ color: statusColor(latest, target) }}>
                        {latest !== null && latest !== undefined ? `${Math.round(latest)}%` : '—'}
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-panel-muted">
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
      <div className="px-3 py-1.5 text-[11px] text-panel-muted border-t border-panel-rule">
        Trend spans {months.length} months ({first} to {last}); dashed reference in each sparkline is that metric's target.
      </div>
    </div>
  );
}
