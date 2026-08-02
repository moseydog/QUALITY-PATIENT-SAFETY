import React from 'react';

const CATEGORY_LABELS = { fall: 'Fall Prevention', hapi: 'HAPI Prevention', education: 'Patient Education' };
const CATEGORY_ORDER = ['fall', 'hapi', 'education'];

function formatMonth(ym) {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

function cellClass(pct, target) {
  if (pct === null || pct === undefined) return 'text-text-dim';
  if (pct >= target) return 'text-status-good font-semibold';
  if (pct >= target - 10) return 'text-status-warn font-semibold';
  return 'text-status-bad font-semibold';
}

export default function MonthlyTable({ data, targets, monthsToShow = 8 }) {
  if (!data || !data.months || data.months.length === 0) {
    return <p className="text-sm text-text-dim">No dated audits yet.</p>;
  }
  const months = data.months.slice(-monthsToShow);

  return (
    <div className="bg-surface border border-rule rounded overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b-2 border-ink text-text-muted text-xs uppercase tracking-wide">
            <th className="text-left px-3 py-2 font-semibold sticky left-0 bg-surface">Metric</th>
            {months.map((mo) => <th key={mo} className="text-center px-2 py-2 font-semibold whitespace-nowrap">{formatMonth(mo)}</th>)}
            <th className="text-center px-3 py-2 font-semibold">Goal</th>
          </tr>
        </thead>
        <tbody>
          {CATEGORY_ORDER.map((cat) => {
            const rows = data.metrics.filter((m) => m.category === cat);
            if (rows.length === 0) return null;
            return (
              <React.Fragment key={cat}>
                <tr className="bg-surface-2">
                  <td colSpan={months.length + 2} className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-text-muted border-b border-rule">
                    {CATEGORY_LABELS[cat]}
                  </td>
                </tr>
                {rows.map((m) => {
                  const target = targets[m.key];
                  return (
                    <tr key={m.key} className="border-t border-rule">
                      <td className="px-3 py-1.5 text-ink whitespace-nowrap sticky left-0 bg-surface">{m.label}</td>
                      {months.map((mo) => {
                        const v = m.byMonth[mo];
                        return (
                          <td key={mo} className={`px-2 py-1.5 text-center tabular-nums ${cellClass(v, target)}`}>
                            {v !== undefined && v !== null ? Math.round(v) : '—'}
                          </td>
                        );
                      })}
                      <td className="px-3 py-1.5 text-center tabular-nums text-text-muted">{target}</td>
                    </tr>
                  );
                })}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
      <div className="px-3 py-1.5 text-[11px] text-text-dim border-t border-rule">
        Values are % compliant for that month. A month is shown only once at least 10 audits answered that question; earlier months with too few audits are blank rather than misleadingly showing 0% or 100%.
      </div>
    </div>
  );
}
